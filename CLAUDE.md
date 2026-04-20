# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hestia is a family assistant app for Juan, Marina, and Judith. It combines a Next.js web app, a NestJS API, and a Telegram bot with a local LLM (Ollama). The monorepo uses Yarn workspaces + Turborepo.

## Dev Commands

From the repo root:
```bash
yarn dev          # Runs both apps concurrently via Turborepo
yarn build        # Builds both apps
yarn lint         # Lints both apps
yarn type-check   # TypeScript check both apps
```

Per-app (from `apps/api` or `apps/web`):
```bash
yarn dev          # API: nest start --watch  |  Web: next dev --port 3000
yarn build        # API: nest build  |  Web: next build
yarn type-check   # tsc --noEmit (no tests exist in this project)
```

There are no test suites. Type-check is the main correctness verification.

## Environment

Copy `apps/api/.env.example` to `apps/api/.env`. Key variables:
- `LLM_API_URL` / `LLM_MODEL` — Ollama endpoint (default `http://localhost:11434/v1`, model `llama3.2`)
- `TELEGRAM_BOT_TOKEN` — seeded into the DB on first boot; can also be set via the admin panel at runtime
- `DATABASE_PATH` — SQLite file (default `./data/hestia.db`)
- `JWT_SECRET` — used for auth tokens (long-lived: 3650d default)

The web app has no `.env` file; it proxies all API calls via `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:3001/api/v1`).

## Architecture

### Monorepo layout
```
apps/api/     NestJS REST API + Telegram bot
apps/web/     Next.js 15 (App Router) PWA
packages/
  tsconfig/   Shared TypeScript configs
  types/      Shared type definitions
```

### API (`apps/api`)

- **Transport**: REST at `/api/v1/*`, protected by JWT (`JwtAuthGuard`). All routes require Bearer token except `/auth/*`.
- **Rate limiting**: `@nestjs/throttler` global guard (200 req/min default). Auth endpoints use `@Throttle` override: 3 attempts per hour.
- **Database**: SQLite via TypeORM (`better-sqlite3`). Schema is auto-synced in non-production (`synchronize: true`). No migrations — entities are the source of truth.
- **Settings**: Runtime-configurable key-value store (`settings` table). Keys are namespaced constants in `SettingsService`: `LLM_KEYS`, `TELEGRAM_KEYS`, `SYSTEM_KEYS`. Seeded from env on first boot. Use `SettingsService.get(key)` / `set(key, value)`.
- **Users**: Three hardcoded family members (Juan, Marina, Judith) are seeded on boot with PIN `0000`. No registration flow — users are fixed. PIN change available via `POST /auth/change-pin` (rate-limited).
- **Auth**: PIN-based login. `POST /auth/login` with `{ name, pin }` returns a JWT. The admin panel is gated by `user.name === "Juan"` in both frontend (`AdminGuard` checks this server-side too).

### Key API modules

| Module | Responsibility |
|---|---|
| `auth` | JWT login with PIN; PIN change endpoint |
| `users` | Family member management, PIN validation |
| `tasks` | Task CRUD with priority/assignee/due date/description/recurrence |
| `shopping` | Shopping lists (with category + archive) + items |
| `recipes` | Recipe CRUD with ingredients/steps (stored as `simple-json`) |
| `menu-plan` | Weekly meal grid (one row per weekStart+dayOfWeek+mealType slot) |
| `calendar` | Events with type, color, assignees |
| `llm` | Chat with conversation history, memory compaction, context injection, admin conversation viewer |
| `telegram` | grammY bot, contact pairing, PIN auth via Telegram |
| `notifications` | PWA push subscriptions (VAPID, web-push), automatic reminders via Telegram + push |
| `cron-jobs` | Dynamic cron scheduling for Telegram broadcasts |
| `admin` | Admin-only endpoints: LLM config, Telegram config, system config (timezone), cron jobs |
| `settings` | Key-value runtime config store |
| `stats` | Weekly statistics: tasks, recipes, shopping, calendar |

### Tasks

`RecurrenceType`: `"daily" | "weekly_window" | "every_n_days" | "weekly" | "monthly" | "yearly"`

- `weekly_window` — task is worked on throughout the week; resets every Monday.
- Tasks have a `description` field (Markdown, rendered with `react-markdown` + `remark-gfm` in the web).

### Shopping

`ShoppingListCategory`: `"hogar" | "decoracion" | "ocio" | "otros"`

Lists have `status: "active" | "archived"` and `archivedAt: Date | null`. Endpoints:
- `GET /shopping/lists/archived` — archived lists
- `PATCH /shopping/lists/:id/archive` / `unarchive`

### LLM / Chat system

Every chat message goes through `LlmService.chat(userId, message, conversationId?, source?)`:

1. **Context injection**: `ContextBuilderService.buildContext()` assembles the system prompt with live data — pending tasks, shopping lists, calendar events (14 days), full recipes (with ingredients + steps), and the weekly menu plan (this week + next).
2. **Schedule detection**: `looksLikeSchedule(text)` triggers a dedicated zero-temperature LLM call to extract calendar events when:
   - Message contains ≥2 `HH:MM` time patterns, OR
   - Contains an add verb (añadir, crear, apuntar…) + "calendario"/"agenda", OR
   - Contains an add verb + event noun (cita, reunión, cumpleaños…), OR
   - Contains ≥1 time pattern + calendar/event noun.
   The extraction prompt includes the next 14 days with weekday names so the LLM can resolve "el martes" to an exact date.
3. **Memory**: Past conversations are compacted by a `@Cron("0 */15 * * * *")` job — conversations idle for >1 hour are summarized into `ConversationMemoryEntity` rows prepended to every new system prompt.
4. **Conversation source**: The `source: "web" | "telegram"` field is set on every conversation. Telegram sets it via the 4th param of `llmService.chat(...)`.
5. **Conversation persistence**: `conversationId` is returned in the API response. Telegram stores it in `TelegramContactEntity.conversationId`. The web chat always starts a new conversation on mount (does not restore from `localStorage`).
6. **Admin views**: `GET /llm/conversations/all` and `GET /llm/conversations/:id/messages/admin` — Juan-only endpoints.

### Notifications & Reminders

`NotificationsService` manages PWA push subscriptions:
- VAPID keys are auto-generated on `onModuleInit` and persisted in the settings DB (`vapid_public_key`, `vapid_private_key`, `vapid_email`).
- Subscriptions stored in `push_subscriptions` table. Expired subscriptions (410/404) are removed automatically.
- `GET /notifications/vapid-public-key`, `POST /notifications/subscribe`, `DELETE /notifications/unsubscribe`.

`RemindersService` registers three cron jobs via `SchedulerRegistry` (timezone-aware, using the `cron` package):
- **8:00** — daily digest: today's events + due tasks per user → Telegram + push.
- **every 15 min** — event-soon alert: events starting in 15–45 min → Telegram + push. In-memory `remindedEventIds` Set prevents duplicates within a process lifetime.
- **9:00** — overdue tasks: pending tasks past due date → Telegram + push.

Timezone is read from `SYSTEM_KEYS.TIMEZONE` (default `Europe/Madrid`). Calling `remindersService.reinitCrons(timezone)` re-registers jobs at runtime without restart.

Date calculations use `Intl`-based helpers (`getTzOffsetMs`, `getDayBoundsInTz`) to compute correct UTC ranges for "today" in the configured timezone.

### Telegram bot

- Uses grammY (`^1.34.0`), started on boot if token is configured.
- Flow: unknown user → admin approval → PIN verification → LLM chat.
- Markdown replies use a custom `mdToHtml()` function (safe HTML conversion, escapes entities first) sent with `parse_mode: "HTML"`.
- When sending proactive messages (cron/`sendToUser`), always pass `chatId` as `parseInt(contact.chatId, 10)` — not as a string — to match how `ctx.reply()` works internally.
- Typing indicator: `sendChatAction("typing")` refreshed every 4s while LLM is processing.

### Web app (`apps/web`)

- **Auth state**: Zustand store (`useAuthStore`) persisted in `localStorage`. Token stored separately as `hestia_token`.
- **API client**: `src/lib/api.ts` — thin wrapper around `fetch` that reads `hestia_token` from localStorage and adds Bearer header. Errors include `err.status` (HTTP code). `delete()` accepts an optional body.
- **Layout**: `DashboardLayout` handles auth redirect and renders the sticky top header + bottom nav (7 items). The bottom nav uses `grid-cols-7`, is `position: fixed`, and applies `env(safe-area-inset-bottom)` padding for iOS home indicator.
- **iOS safe area**: `viewportFit: "cover"` must be set in the Next.js `Viewport` export (`app/layout.tsx`) for `env(safe-area-inset-bottom)` to work on Safari. Without it the value is always 0.
- **Dropdown portals**: Any dropdown that appears inside a scrollable container (e.g., the menu planner recipe picker) must use `createPortal(…, document.body)` with `position: fixed` coords from `getBoundingClientRect()`. Do not use `position: absolute` inside `overflow: auto` containers.
- **Chat page**: Uses `<Suspense>` wrapper because of `useSearchParams()`. The inner component is `ChatInner`. Always starts a fresh conversation on mount.
- **PWA push**: `src/lib/push.ts` — helpers `subscribeToPush`, `unsubscribeFromPush`, `isPushSubscribed`. Service worker at `public/sw.js` handles `push` and `notificationclick` events.

### Web pages

| Route | Description |
|---|---|
| `/dashboard` | Home: today's events, due tasks, quick links, family avatars |
| `/dashboard/tasks` | Task list with Markdown description, recurrence, filters |
| `/dashboard/shopping` | Shopping lists by category, archive management |
| `/dashboard/recipes` | Recipe browser and editor |
| `/dashboard/menu` | Weekly meal planner |
| `/dashboard/calendar` | Calendar view |
| `/dashboard/chat` | Hestia AI chat with conversation history |
| `/dashboard/stats` | Weekly statistics |
| `/dashboard/settings` | PIN change + push notification toggle |
| `/dashboard/admin` | Admin panel (Juan only): LLM, Telegram, timezone, cron jobs, conversations |

### Data patterns

- All entities use `@PrimaryGeneratedColumn("uuid")`.
- `simple-json` columns (ingredients, steps, mealTypes, tags, targetUserIds, assigneeIds) are stored as JSON strings in SQLite — TypeORM handles serialization automatically.
- `synchronize: true` in development means adding a column to an entity takes effect on next restart with no migration needed.
- Settings keys follow a `module.camelCaseKey` convention (e.g., `llm.apiUrl`, `system.timezone`).
