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
- **Database**: SQLite via TypeORM (`better-sqlite3`). Schema is auto-synced in non-production (`synchronize: true`). No migrations — entities are the source of truth.
- **Settings**: Runtime-configurable key-value store (`settings` table). LLM URL/model/temperature and Telegram token are stored here and seeded from env on first boot. Use `SettingsService.get(key)` / `set(key, value)`.
- **Users**: Three hardcoded family members (Juan, Marina, Judith) are seeded on boot with PIN `0000`. No registration flow — users are fixed.
- **Auth**: PIN-based login. `POST /auth/login` with `{ name, pin }` returns a JWT. The admin panel is gated by `user.name === "Juan"` in the frontend.

### Key API modules

| Module | Responsibility |
|---|---|
| `auth` | JWT login with PIN |
| `users` | Family member management, PIN validation |
| `tasks` | Task CRUD with priority/assignee/due date |
| `shopping` | Shopping lists + items |
| `recipes` | Recipe CRUD with ingredients/steps (stored as `simple-json`) |
| `menu-plan` | Weekly meal grid (one row per weekStart+dayOfWeek+mealType slot) |
| `calendar` | Events with type, color, assignees |
| `llm` | Chat with conversation history, memory compaction, context injection |
| `telegram` | grammY bot, contact pairing, PIN auth via Telegram |
| `cron-jobs` | Dynamic cron scheduling for Telegram broadcasts |
| `admin` | Admin-only endpoints for settings, Telegram config, cron management |
| `settings` | Key-value runtime config store |

### LLM / Chat system

Every chat message goes through `LlmService.chat(userId, message, conversationId?)`:

1. **Context injection**: `ContextBuilderService.buildContext()` assembles the system prompt with live data — pending tasks, shopping lists, calendar events (14 days), full recipes (with ingredients + steps), and the weekly menu plan (this week + next).
2. **Schedule detection**: If the message contains ≥2 time patterns (`HH:MM`), a dedicated zero-temperature LLM call extracts calendar events and creates them before the main chat response.
3. **Memory**: Past conversations are compacted by a `@Cron("0 */15 * * * *")` job — conversations idle for >1 hour are summarized into `ConversationMemoryEntity` rows. These memories are prepended to every new system prompt.
4. **Conversation persistence**: `conversationId` is returned in the API response. The web chat stores it in `localStorage` (`hestia_conversation_id`). Telegram stores it in `TelegramContactEntity.conversationId`.

### Telegram bot

- Uses grammY (`^1.34.0`), started on boot if token is configured.
- Flow: unknown user → admin approval → PIN verification → LLM chat.
- Markdown replies use a custom `mdToHtml()` function (safe HTML conversion, escapes entities first) sent with `parse_mode: "HTML"`.
- When sending proactive messages (cron/`sendToUser`), always pass `chatId` as `parseInt(contact.chatId, 10)` — not as a string — to match how `ctx.reply()` works internally.
- Typing indicator: `sendChatAction("typing")` refreshed every 4s while LLM is processing.

### Web app (`apps/web`)

- **Auth state**: Zustand store (`useAuthStore`) persisted in `localStorage`. Token stored separately as `hestia_token`.
- **API client**: `src/lib/api.ts` — thin wrapper around `fetch` that reads `hestia_token` from localStorage and adds Bearer header.
- **Layout**: `DashboardLayout` handles auth redirect and renders the sticky top header + bottom nav (7 items). The bottom nav uses `grid-cols-7`.
- **Dropdown portals**: Any dropdown that appears inside a scrollable container (e.g., the menu planner recipe picker) must use `createPortal(…, document.body)` with `position: fixed` coords from `getBoundingClientRect()`. Do not use `position: absolute` inside `overflow: auto` containers.
- **Chat page**: Uses `<Suspense>` wrapper because of `useSearchParams()`. The inner component is `ChatInner`.

### Data patterns

- All entities use `@PrimaryGeneratedColumn("uuid")`.
- `simple-json` columns (ingredients, steps, mealTypes, tags, targetUserIds) are stored as JSON strings in SQLite — TypeORM handles serialization automatically.
- `synchronize: true` in development means adding a column to an entity takes effect on next restart with no migration needed.
