import { Injectable, InternalServerErrorException, ForbiddenException, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { LessThan, Repository } from "typeorm";
import { Cron } from "@nestjs/schedule";
import { ConversationEntity } from "./conversation.entity";
import { ChatMessageEntity } from "./chat-message.entity";
import { ConversationMemoryEntity } from "./conversation-memory.entity";
import { SettingsService, LLM_KEYS } from "../settings/settings.service";
import { ContextBuilderService } from "./context-builder.service";
import { CalendarService } from "../calendar/calendar.service";
import { UsersService } from "../users/users.service";

interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ParsedEvent {
  title: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  allDay?: boolean;
  type?: string;
}

const TYPE_COLORS: Record<string, string> = {
  appointment: "#6366f1",
  task:        "#10b981",
  reminder:    "#f59e0b",
  birthday:    "#ec4899",
  other:       "#6b7280",
};

const TIME_PATTERN    = /\b\d{1,2}:\d{2}\b/g;
const ADD_VERBS       = /\b(añ[ae]d[ei]r?|agrega?r?|crea?r?|apunta?r?|anota?r?|mete?r?|guarda?r?|pon(?:me)?)\b/i;
const CAL_NOUNS       = /\b(calendario|agenda)\b/i;
const EVENT_NOUNS     = /\b(evento|cita|reuni[oó]n|cumplea[nñ]os|recordatorio)\b/i;

function looksLikeSchedule(text: string): boolean {
  const times = (text.match(TIME_PATTERN) ?? []).length;
  if (times >= 2) return true;                                // agenda con varios horarios
  if (ADD_VERBS.test(text) && CAL_NOUNS.test(text)) return true;  // "añade al calendario..."
  if (ADD_VERBS.test(text) && EVENT_NOUNS.test(text)) return true; // "crea un evento/cita..."
  if (times >= 1 && (CAL_NOUNS.test(text) || EVENT_NOUNS.test(text))) return true; // "tengo una reunión a las 10:00"
  return false;
}

function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const bracket = raw.indexOf("[");
  const lastBracket = raw.lastIndexOf("]");
  if (bracket !== -1 && lastBracket > bracket) {
    return raw.slice(bracket, lastBracket + 1).trim();
  }
  return raw.trim();
}

/** One hour in milliseconds */
const IDLE_THRESHOLD_MS = 60 * 60 * 1000;

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  constructor(
    private readonly settingsService: SettingsService,
    private readonly contextBuilder: ContextBuilderService,
    private readonly calendarService: CalendarService,
    private readonly usersService: UsersService,
    @InjectRepository(ConversationEntity)
    private readonly convRepo: Repository<ConversationEntity>,
    @InjectRepository(ChatMessageEntity)
    private readonly msgRepo: Repository<ChatMessageEntity>,
    @InjectRepository(ConversationMemoryEntity)
    private readonly memRepo: Repository<ConversationMemoryEntity>
  ) {}

  // ── Main chat entry point ──────────────────────────────────────────────────

  async chat(
    userId: string,
    message: string,
    conversationId?: string,
    source: "web" | "telegram" = "web"
  ): Promise<{ reply: string; conversationId: string; eventsCreated?: any[] }> {
    // 1. Resolve conversation
    let conversation: ConversationEntity;
    if (conversationId) {
      const found = await this.convRepo.findOne({
        where: { id: conversationId, userId },
      });
      conversation = found ?? (await this.createConversation(userId, source));
    } else {
      conversation = await this.createConversation(userId, source);
    }

    // 2. Load full message history for this conversation
    const history = await this.msgRepo.find({
      where: { conversationId: conversation.id },
      order: { createdAt: "ASC" },
    });

    // 3. Phase 1 — extract & create calendar events if message looks like a schedule
    let eventsCreated: any[] | undefined;
    let createdSummary = "";
    if (looksLikeSchedule(message)) {
      try {
        eventsCreated = await this.extractAndCreateEvents(userId, message);
        if (eventsCreated && eventsCreated.length > 0) {
          createdSummary =
            `\n\n[El sistema ya ha creado automáticamente ${eventsCreated.length} evento(s) en el calendario: ` +
            eventsCreated.map((e) => `"${e.title}"`).join(", ") +
            `. Confírmalo al usuario de forma natural y amable.]`;
        }
      } catch {
        // extraction failed — continue with normal chat
      }
    }

    // 4. Load long-term memories for this user
    const memories = await this.memRepo.find({
      where: { userId },
      order: { createdAt: "DESC" },
      take: 20,
    });

    // 5. Build system prompt
    const systemContext = await this.contextBuilder.buildContext(userId);
    const memoryBlock = this.buildMemoryBlock(memories);

    const systemPrompt = `Eres Hestia, un asistente familiar inteligente para la familia compuesta por Juan, Marina y Judith.
Responde SIEMPRE en español. Sé amable y conciso.

Cuando el usuario te pase una agenda o programa con fechas y horas, el sistema ya habrá creado los eventos automáticamente.
Tu trabajo es confirmar al usuario qué eventos se han creado, de forma natural.

Para preguntas sobre tareas, compras, recetas o eventos existentes, usa SOLO los datos del sistema que aparecen abajo. No inventes información.

${memoryBlock}
${systemContext}${createdSummary}`;

    // 6. Build messages array: system + full history + new user message
    const messages: LLMMessage[] = [
      { role: "system", content: systemPrompt },
      ...history.map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
      { role: "user", content: message },
    ];

    // 7. Call LLM
    const reply = await this.callLLM(messages);

    // 8. Persist messages + update conversation metadata
    await this.msgRepo.save([
      this.msgRepo.create({ conversationId: conversation.id, role: "user",      content: message, userId }),
      this.msgRepo.create({ conversationId: conversation.id, role: "assistant", content: reply,   userId }),
    ]);

    conversation.lastMessageAt = new Date();
    if (history.length === 0 && !conversation.title) {
      conversation.title = message.substring(0, 60);
    }
    await this.convRepo.save(conversation);

    return { reply, conversationId: conversation.id, eventsCreated };
  }

  // ── Memory block ───────────────────────────────────────────────────────────

  private buildMemoryBlock(memories: ConversationMemoryEntity[]): string {
    if (memories.length === 0) return "";

    const lines = [
      "=== MEMORIA DE CONVERSACIONES ANTERIORES ===",
      "Usa este contexto para entender mejor a la familia y personalizar tus respuestas.",
      "",
    ];
    for (const m of memories) {
      const date = m.createdAt.toLocaleDateString("es-ES", {
        day: "numeric", month: "long", year: "numeric",
      });
      lines.push(`[${date}] ${m.content}`);
    }
    lines.push("=== FIN DE MEMORIA ===");
    lines.push("");
    return lines.join("\n");
  }

  // ── Compaction cron (runs every 15 min) ───────────────────────────────────

  @Cron("0 */15 * * * *")
  async compactIdleConversations(): Promise<void> {
    const cutoff = new Date(Date.now() - IDLE_THRESHOLD_MS);

    const idle = await this.convRepo.find({
      where: {
        compacted: false,
        lastMessageAt: LessThan(cutoff),
      },
    });

    for (const conv of idle) {
      try {
        await this.compactConversation(conv);
      } catch (err) {
        this.logger.warn(`Failed to compact conversation ${conv.id}: ${err}`);
      }
    }
  }

  private async compactConversation(conv: ConversationEntity): Promise<void> {
    const messages = await this.msgRepo.find({
      where: { conversationId: conv.id },
      order: { createdAt: "ASC" },
    });

    if (messages.length < 2) {
      // Nothing meaningful to summarize
      conv.compacted = true;
      await this.convRepo.save(conv);
      return;
    }

    // Build a transcript for the LLM to summarize
    const transcript = messages
      .map((m) => `${m.role === "user" ? "Usuario" : "Hestia"}: ${m.content}`)
      .join("\n");

    const summaryPrompt = `Analiza la siguiente conversación entre un usuario y Hestia (asistente familiar) y extrae un resumen de memoria útil en 3-6 puntos concisos.

El objetivo es que en futuras conversaciones Hestia recuerde:
- Preferencias, gustos o hábitos mencionados
- Eventos, planes o compromisos futuros discutidos
- Decisiones importantes tomadas
- Contexto personal relevante de la familia

Responde en español, con viñetas (•). Sé concreto y breve. No incluyas saludos ni explicaciones, solo los puntos de memoria.

Conversación:
${transcript}`;

    const summary = await this.callLLMRaw(
      [{ role: "user", content: summaryPrompt }],
      { temperature: 0.3, max_tokens: 512 }
    );

    if (summary.trim().length > 10) {
      await this.memRepo.save(
        this.memRepo.create({
          userId: conv.userId,
          content: summary.trim(),
          sourceConversationId: conv.id,
        })
      );
      this.logger.log(`Compacted conversation ${conv.id} → memory saved`);
    }

    conv.compacted = true;
    await this.convRepo.save(conv);
  }

  // ── Calendar event extraction ──────────────────────────────────────────────

  private async extractAndCreateEvents(userId: string, text: string): Promise<any[]> {
    const now = new Date();
    const today = now.toISOString().split("T")[0] as string;
    const currentYear = today.substring(0, 4);

    // Build a reference calendar for the next 14 days so the LLM can resolve day names
    const dayNames = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];
    const nextDays = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      return `${dayNames[d.getDay()]} ${d.toISOString().split("T")[0]}`;
    }).join(", ");

    const extractionPrompt = `Extrae todos los eventos del siguiente texto como un JSON array.
Responde ÚNICAMENTE con el JSON array. Sin texto adicional, sin explicaciones, sin markdown.

Formato exacto de cada elemento:
{"title":"nombre del evento","date":"YYYY-MM-DD","startTime":"HH:MM","endTime":"HH:MM","allDay":false,"type":"appointment"}

Reglas:
- date: YYYY-MM-DD. Hoy es ${today} (${dayNames[now.getDay()]}). Próximos días: ${nextDays}.
- Cuando el texto diga un día de la semana (lunes, martes, etc.) usa la fecha correspondiente más próxima de la lista anterior.
- startTime y endTime: formato 24h HH:MM. Si el evento no tiene hora concreta, omite ambos y pon allDay:true.
- Si solo hay hora de inicio (no hay hora de fin), incluye solo startTime y pon allDay:false.
- type: usa exactamente uno de: appointment, task, reminder, birthday, other.
- Incluye TODOS los eventos, aunque solo tengan hora de inicio.

Texto a analizar:
${text}`;

    const rawJson = await this.callLLMRaw(
      [{ role: "user", content: extractionPrompt }],
      { temperature: 0, max_tokens: 1024 }
    );

    const jsonStr = extractJson(rawJson);
    let parsed: ParsedEvent[];
    try {
      parsed = JSON.parse(jsonStr);
      if (!Array.isArray(parsed)) return [];
    } catch {
      return [];
    }

    const created: any[] = [];
    for (const ev of parsed) {
      if (!ev.title) continue;
      try {
        const dateStr   = ev.date ?? today;
        const startDate = ev.allDay || !ev.startTime
          ? new Date(`${dateStr}T00:00:00`)
          : new Date(`${dateStr}T${ev.startTime}:00`);
        const endDate   = ev.endTime && !ev.allDay
          ? new Date(`${dateStr}T${ev.endTime}:00`)
          : undefined;

        const result = await this.calendarService.create(userId, {
          title:       ev.title,
          type:        ev.type ?? "other",
          startDate,
          endDate,
          allDay:      ev.allDay ?? false,
          color:       TYPE_COLORS[ev.type ?? "other"] ?? "#6b7280",
          assigneeIds: [],
        });
        created.push(result);
      } catch {
        // skip
      }
    }
    return created;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async createConversation(userId: string, source: "web" | "telegram" = "web"): Promise<ConversationEntity> {
    const conv = this.convRepo.create({ userId, source, lastMessageAt: new Date() });
    return this.convRepo.save(conv);
  }

  private async callLLM(messages: LLMMessage[]): Promise<string> {
    const [apiUrl, model, temperatureStr, maxTokensStr] = await Promise.all([
      this.settingsService.get(LLM_KEYS.API_URL),
      this.settingsService.get(LLM_KEYS.MODEL),
      this.settingsService.get(LLM_KEYS.TEMPERATURE),
      this.settingsService.get(LLM_KEYS.MAX_TOKENS),
    ]);
    return this.callLLMRaw(messages, {
      apiUrl:      apiUrl ?? undefined,
      model:       model ?? undefined,
      temperature: parseFloat(temperatureStr ?? "0.7"),
      max_tokens:  parseInt(maxTokensStr ?? "1024", 10),
    });
  }

  private async callLLMRaw(
    messages: LLMMessage[],
    opts: { apiUrl?: string; model?: string; temperature?: number; max_tokens?: number } = {}
  ): Promise<string> {
    const [apiUrl, model, temperatureStr, maxTokensStr] = await Promise.all([
      this.settingsService.get(LLM_KEYS.API_URL),
      this.settingsService.get(LLM_KEYS.MODEL),
      this.settingsService.get(LLM_KEYS.TEMPERATURE),
      this.settingsService.get(LLM_KEYS.MAX_TOKENS),
    ]);

    const url         = `${opts.apiUrl ?? apiUrl}/chat/completions`;
    const temperature = opts.temperature ?? parseFloat(temperatureStr ?? "0.7");
    const max_tokens  = opts.max_tokens  ?? parseInt(maxTokensStr ?? "1024", 10);
    const finalModel  = opts.model ?? model;

    let response: Response;
    try {
      response = await fetch(url, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ model: finalModel, messages, temperature, max_tokens }),
      });
    } catch {
      throw new InternalServerErrorException(
        "No se puede conectar al LLM local. Asegúrate de que Ollama está corriendo."
      );
    }

    if (!response.ok) {
      const error = await response.text();
      throw new InternalServerErrorException(`LLM error: ${error}`);
    }

    const data: any = await response.json();
    return data.choices?.[0]?.message?.content ?? "Sin respuesta del LLM.";
  }

  // ── Conversation list / detail ─────────────────────────────────────────────

  async getConversations(userId: string) {
    const convs = await this.convRepo.find({
      where: { userId },
      order: { lastMessageAt: "DESC" },
    });
    return Promise.all(convs.map((conv) => this.withMessageCount(conv)));
  }

  async getAllConversationsAdmin(requestingUserId: string) {
    const requestingUser = await this.usersService.findById(requestingUserId);
    if (requestingUser.name !== "Juan") throw new ForbiddenException();

    const [convs, users] = await Promise.all([
      this.convRepo.find({ order: { lastMessageAt: "DESC" } }),
      this.usersService.findAll(),
    ]);
    const userMap = new Map(users.map((u) => [u.id, { id: u.id, name: u.name, color: u.color }]));

    return Promise.all(
      convs.map(async (conv) => ({
        ...(await this.withMessageCount(conv)),
        user: userMap.get(conv.userId) ?? null,
      }))
    );
  }

  private async withMessageCount(conv: ConversationEntity) {
    const messageCount = await this.msgRepo.count({ where: { conversationId: conv.id } });
    return {
      id: conv.id,
      title: conv.title,
      lastMessageAt: conv.lastMessageAt,
      createdAt: conv.createdAt,
      compacted: conv.compacted,
      source: conv.source,
      messageCount,
    };
  }

  async getConversationMessages(userId: string, conversationId: string) {
    const conv = await this.convRepo.findOne({ where: { id: conversationId, userId } });
    if (!conv) return [];
    return this.msgRepo.find({
      where: { conversationId },
      order: { createdAt: "ASC" },
    });
  }

  async getConversationMessagesAdmin(requestingUserId: string, conversationId: string) {
    const requestingUser = await this.usersService.findById(requestingUserId);
    if (requestingUser.name !== "Juan") throw new ForbiddenException();
    return this.msgRepo.find({
      where: { conversationId },
      order: { createdAt: "ASC" },
    });
  }

  // ── Memory management (for admin / debugging) ─────────────────────────────

  async getMemories(userId: string) {
    return this.memRepo.find({
      where: { userId },
      order: { createdAt: "DESC" },
    });
  }

  async deleteMemory(id: string) {
    await this.memRepo.delete(id);
    return { message: "Memoria eliminada" };
  }
}
