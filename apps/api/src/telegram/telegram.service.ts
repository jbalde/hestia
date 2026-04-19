import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ConfigService } from "@nestjs/config";
import { Bot } from "grammy";
import { UsersService } from "../users/users.service";
import { LlmService } from "../llm/llm.service";
import { TasksService } from "../tasks/tasks.service";
import { SettingsService, TELEGRAM_KEYS } from "../settings/settings.service";
import { TelegramContactEntity } from "./telegram-contact.entity";

// Transient PIN entry: chatId -> userId (only lives until PIN verified)
const pendingPinAuth = new Map<string, string>();

/**
 * Converts a markdown string to Telegram-safe HTML.
 * HTML entities are escaped first so LLM output can't inject tags.
 */
function mdToHtml(text: string): string {
  // 1. Escape HTML entities
  let s = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // 2. Fenced code blocks  ```lang\ncode\n```
  s = s.replace(/```[^\n]*\n?([\s\S]*?)```/g, (_, code) => `<pre><code>${code.trim()}</code></pre>`);

  // 3. Inline code  `code`
  s = s.replace(/`([^`\n]+)`/g, "<code>$1</code>");

  // 4. Bold  **text**  or  __text__
  s = s.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  s = s.replace(/__(.+?)__/g, "<b>$1</b>");

  // 5. Italic  *text*  or  _text_  (not touching word-internal underscores)
  s = s.replace(/\*(.+?)\*/g, "<i>$1</i>");
  s = s.replace(/(?<!\w)_(.+?)_(?!\w)/g, "<i>$1</i>");

  // 6. Strikethrough  ~~text~~
  s = s.replace(/~~(.+?)~~/g, "<s>$1</s>");

  // 7. Headers  # H1 / ## H2 / ### H3  → bold line
  s = s.replace(/^#{1,3} (.+)$/gm, "<b>$1</b>");

  return s;
}

@Injectable()
export class TelegramService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(TelegramService.name);
  private bot: Bot | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly settingsService: SettingsService,
    private readonly usersService: UsersService,
    private readonly llmService: LlmService,
    private readonly tasksService: TasksService,
    @InjectRepository(TelegramContactEntity)
    private readonly contactRepo: Repository<TelegramContactEntity>
  ) {}

  get isRunning(): boolean {
    return this.bot !== null;
  }

  async onApplicationBootstrap() {
    const dbToken = await this.settingsService.get(TELEGRAM_KEYS.BOT_TOKEN);
    const token   = (dbToken?.trim()) ? dbToken.trim()
                  : this.config.get<string>("TELEGRAM_BOT_TOKEN");
    if (!token) {
      this.logger.warn("TELEGRAM_BOT_TOKEN no configurado — bot desactivado");
      return;
    }
    this.startBot(token);
  }

  async onApplicationShutdown() {
    await this.stopBot();
  }

  /** Send a message to a family member via their paired Telegram contact. */
  async sendToUser(userId: string, message: string): Promise<void> {
    if (!this.bot) return;
    const contact = await this.contactRepo.findOne({
      where: { userId, authenticated: true },
    });
    if (!contact) return;

    // Use numeric chat_id — the Telegram Bot API treats integer and string
    // chat_ids differently in some edge cases, and ctx.reply() always uses numbers.
    const chatId = parseInt(contact.chatId, 10);
    if (isNaN(chatId)) {
      this.logger.warn(`Invalid chatId for user ${userId}: "${contact.chatId}"`);
      return;
    }

    try {
      await this.bot.api.sendMessage(chatId, mdToHtml(message), {
        parse_mode: "HTML",
        disable_notification: false,
      });
    } catch (htmlErr) {
      // If Telegram rejects the HTML (malformed tags from LLM output), retry as plain text
      this.logger.warn(`HTML send failed for user ${userId}, retrying as plain text: ${htmlErr}`);
      await this.bot.api.sendMessage(chatId, message, {
        disable_notification: false,
      });
    }
  }

  async applyToken(token: string): Promise<void> {
    await this.settingsService.set(TELEGRAM_KEYS.BOT_TOKEN, token);
    await this.stopBot();
    if (token.trim()) this.startBot(token.trim());
  }

  // ── Admin contact management ────────────────────────────────────

  async getContacts() {
    const contacts = await this.contactRepo.find({ order: { lastSeen: "DESC" } });
    const users    = await this.usersService.findAll();
    const userMap  = new Map(users.map((u) => [u.id, u]));

    return contacts.map((c) => ({
      id:                c.id,
      chatId:            c.chatId,
      telegramUsername:  c.telegramUsername,
      telegramFirstName: c.telegramFirstName,
      userId:            c.userId ?? null,
      userName:          c.userId ? (userMap.get(c.userId)?.name ?? null) : null,
      userColor:         c.userId ? (userMap.get(c.userId)?.color ?? null) : null,
      authenticated:     c.authenticated,
      lastSeen:          c.lastSeen,
      firstSeen:         c.firstSeen,
    }));
  }

  async pairContact(contactId: string, userId: string | null): Promise<void> {
    const contact = await this.contactRepo.findOne({ where: { id: contactId } });
    if (!contact) return;
    contact.userId        = userId ?? (undefined as any);
    contact.authenticated = false; // require re-auth on re-pair
    await this.contactRepo.save(contact);
  }

  async deleteContact(contactId: string): Promise<void> {
    await this.contactRepo.delete({ id: contactId });
  }

  // ── Bot lifecycle ───────────────────────────────────────────────

  private startBot(token: string) {
    this.bot = new Bot(token);
    this.registerHandlers(this.bot);
    this.bot.start().catch((err) => {
      this.logger.error("Error al iniciar el bot de Telegram", err);
      this.bot = null;
    });
    this.logger.log("Bot de Telegram iniciado");
  }

  private async stopBot() {
    if (this.bot) {
      await this.bot.stop();
      this.bot = null;
      this.logger.log("Bot de Telegram detenido");
    }
  }

  // ── Handlers ────────────────────────────────────────────────────

  private registerHandlers(bot: Bot) {
    bot.command("start", async (ctx) => {
      await ctx.reply(
        "¡Hola! Soy Hestia, tu asistente familiar 🏠\n\n" +
        "Escríbeme un mensaje para que el administrador pueda identificarte.",
        { parse_mode: "Markdown" }
      );
    });

    bot.command("tareas", async (ctx) => {
      const chatId  = String(ctx.chat.id);
      const contact = await this.getAuthenticatedContact(chatId);
      if (!contact) return ctx.reply("No tienes acceso autorizado. Habla con el administrador.");
      const tasks   = await this.tasksService.getTasks(contact.userId!);
      const pending = tasks.filter((t) => t.status === "pending");
      if (pending.length === 0) return ctx.reply("No tienes tareas pendientes 🎉");
      const list = pending.map((t, i) => `${i + 1}. ${t.title}`).join("\n");
      return ctx.reply(`📋 *Tareas pendientes:*\n${list}`, { parse_mode: "Markdown" });
    });

    bot.command("ayuda", async (ctx) => {
      await ctx.reply(
        "🏠 *Comandos de Hestia*\n\n" +
        "/tareas — Ver tareas pendientes\n" +
        "/ayuda — Esta ayuda\n\n" +
        "O escríbeme directamente y te responderé con IA 🤖",
        { parse_mode: "Markdown" }
      );
    });

    bot.on("message:text", async (ctx) => {
      const chatId    = String(ctx.chat.id);
      const text      = ctx.message.text.trim();
      const fromUser  = ctx.from;

      // Upsert contact record so admin always sees who wrote
      const contact = await this.upsertContact(
        chatId,
        fromUser?.username,
        fromUser?.first_name
      );

      // Not yet paired by admin
      if (!contact.userId) {
        await ctx.reply(
          "👋 He registrado tu mensaje. El administrador necesita autorizarte antes de que pueda responderte."
        );
        return;
      }

      // Paired but not authenticated — ask for PIN
      if (!contact.authenticated) {
        if (pendingPinAuth.has(chatId)) {
          // Expecting PIN
          if (/^\d{4}$/.test(text)) {
            const valid = await this.usersService.validatePin(contact.userId, text);
            if (valid) {
              contact.authenticated = true;
              await this.contactRepo.save(contact);
              pendingPinAuth.delete(chatId);
              const user = await this.usersService.findById(contact.userId);
              return ctx.reply(
                `✅ ¡Bienvenido/a *${user.name}*! Ya puedes hablar conmigo 🏠`,
                { parse_mode: "Markdown" }
              );
            } else {
              return ctx.reply("PIN incorrecto. Inténtalo de nuevo:");
            }
          } else {
            return ctx.reply("Introduce tu PIN de 4 dígitos:");
          }
        } else {
          // First message after pairing
          const user = await this.usersService.findById(contact.userId);
          pendingPinAuth.set(chatId, contact.userId);
          return ctx.reply(
            `Hola *${user.name}*! Para confirmar tu identidad, introduce tu PIN de 4 dígitos:`,
            { parse_mode: "Markdown" }
          );
        }
      }

      // Fully authenticated — chat with LLM
      // Show typing indicator while waiting; refresh it every 4s (Telegram clears it after 5s)
      await ctx.api.sendChatAction(ctx.chat.id, "typing");
      const typingInterval = setInterval(() => {
        ctx.api.sendChatAction(ctx.chat.id, "typing").catch(() => {});
      }, 4000);

      try {
        const { reply, conversationId } = await this.llmService.chat(
          contact.userId,
          text,
          contact.conversationId ?? undefined,
          "telegram"
        );
        // Persist conversationId so next message continues the same thread
        if (conversationId && contact.conversationId !== conversationId) {
          contact.conversationId = conversationId;
          await this.contactRepo.save(contact);
        }
        clearInterval(typingInterval);
        await ctx.reply(mdToHtml(reply), { parse_mode: "HTML" });
      } catch {
        clearInterval(typingInterval);
        await ctx.reply("Lo siento, el asistente no está disponible en este momento.");
      }
    });

    bot.catch((err) => {
      this.logger.error("Error en el bot de Telegram:", err.error);
    });
  }

  // ── Helpers ─────────────────────────────────────────────────────

  private async upsertContact(
    chatId: string,
    username?: string,
    firstName?: string
  ): Promise<TelegramContactEntity> {
    let contact = await this.contactRepo.findOne({ where: { chatId } });
    if (!contact) {
      contact = this.contactRepo.create({ chatId });
    }
    if (username)  contact.telegramUsername  = username;
    if (firstName) contact.telegramFirstName = firstName;
    return this.contactRepo.save(contact);
  }

  private async getAuthenticatedContact(chatId: string): Promise<TelegramContactEntity | null> {
    const contact = await this.contactRepo.findOne({ where: { chatId } });
    if (!contact?.userId || !contact.authenticated) return null;
    return contact;
  }
}
