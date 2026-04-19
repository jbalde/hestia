"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { cn } from "@/lib/utils";
import { Send, Bot, CalendarCheck, RotateCcw, History, ArrowLeft, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  eventsCreated?: CreatedEvent[];
}

interface ConversationSummary {
  id: string;
  title?: string;
  lastMessageAt?: string;
  createdAt: string;
  messageCount: number;
}

interface CreatedEvent {
  id: string;
  title: string;
  startDate: string;
  endDate?: string;
  allDay: boolean;
  type: string;
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  appointment: "Cita",
  task:        "Tarea",
  reminder:    "Recordatorio",
  birthday:    "Cumpleaños",
  other:       "Otro",
};

const EVENT_TYPE_COLORS: Record<string, string> = {
  appointment: "#6366f1",
  task:        "#10b981",
  reminder:    "#f59e0b",
  birthday:    "#ec4899",
  other:       "#6b7280",
};

const QUICK_SUGGESTIONS = [
  "¿Qué tareas tengo hoy?",
  "Sugiere una receta fácil",
  "¿Qué hay en la lista de la compra?",
  "📅 Añadir programa al calendario",
];

const CONV_KEY = "hestia_conversation_id";

function ChatInner() {
  const { user } = useAuthStore();
  const searchParams = useSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const bottomRef = useRef<HTMLDivElement>(null);
  const autoSentRef = useRef(false);

  // Historial
  const [historyView, setHistoryView] = useState<"chat" | "list" | "detail">("chat");
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(false);
  const [detailConv, setDetailConv] = useState<ConversationSummary | null>(null);
  const [detailMessages, setDetailMessages] = useState<Message[]>([]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // On mount: restore previous conversation from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(CONV_KEY);
    if (!stored) { setLoadingHistory(false); return; }

    api.get<Message[]>(`/llm/conversations/${stored}/messages`)
      .then((history) => {
        if (history.length > 0) {
          setConversationId(stored);
          setMessages(history);
        } else {
          localStorage.removeItem(CONV_KEY);
        }
      })
      .catch(() => localStorage.removeItem(CONV_KEY))
      .finally(() => setLoadingHistory(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startNewConversation = () => {
    localStorage.removeItem(CONV_KEY);
    setConversationId(undefined);
    setMessages([]);
  };

  const openHistory = async () => {
    setHistoryView("list");
    setLoadingConvs(true);
    try {
      const data = await api.get<ConversationSummary[]>("/llm/conversations");
      setConversations(data);
    } finally {
      setLoadingConvs(false);
    }
  };

  const openDetail = async (conv: ConversationSummary) => {
    setDetailConv(conv);
    setHistoryView("detail");
    const msgs = await api.get<Message[]>(`/llm/conversations/${conv.id}/messages`);
    setDetailMessages(msgs);
  };

  const resumeConversation = (conv: ConversationSummary) => {
    localStorage.setItem(CONV_KEY, conv.id);
    setConversationId(conv.id);
    setMessages(detailMessages);
    setHistoryView("chat");
  };

  const sendMessage = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages((m) => [...m, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const data = await api.post<{ reply: string; conversationId: string; eventsCreated?: CreatedEvent[] }>(
        "/llm/chat",
        { message: content, conversationId }
      );
      // Persist conversationId across page loads
      localStorage.setItem(CONV_KEY, data.conversationId);
      setConversationId(data.conversationId);
      setMessages((m) => [
        ...m,
        {
          id: Date.now().toString() + "-a",
          role: "assistant",
          content: data.reply,
          createdAt: new Date().toISOString(),
          eventsCreated: data.eventsCreated,
        },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          id: Date.now().toString() + "-e",
          role: "assistant",
          content: "Lo siento, no pude conectar con el asistente. Asegúrate de que el LLM local está funcionando.",
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Auto-send ?q= param once, but only after history has loaded
  useEffect(() => {
    if (loadingHistory) return;
    const q = searchParams.get("q");
    if (q && !autoSentRef.current) {
      autoSentRef.current = true;
      sendMessage(q);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingHistory]);

  // ── Vista historial — lista ──────────────────────────────────────
  if (historyView === "list") {
    return (
      <div className="flex flex-col h-[calc(100vh-8rem)]">
        <div className="px-4 py-3 border-b border-border bg-white">
          <div className="flex items-center gap-2 max-w-lg mx-auto">
            <button onClick={() => setHistoryView("chat")} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h2 className="font-semibold text-sm flex-1">Mis conversaciones</h2>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 max-w-lg mx-auto w-full space-y-2">
          {loadingConvs && <p className="text-center text-sm text-muted-foreground py-8">Cargando…</p>}
          {!loadingConvs && conversations.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">No hay conversaciones guardadas.</p>
          )}
          {conversations.map((conv) => (
            <button key={conv.id} onClick={() => openDetail(conv)}
              className="w-full text-left p-3 bg-white rounded-xl border border-border hover:shadow-md transition-all"
            >
              <p className="text-sm font-medium truncate">{conv.title || "Conversación sin título"}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MessageSquare className="w-3 h-3" />
                  {conv.messageCount} mensajes
                </span>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs text-muted-foreground">
                  {conv.lastMessageAt
                    ? format(new Date(conv.lastMessageAt), "d MMM yyyy · HH:mm", { locale: es })
                    : format(new Date(conv.createdAt), "d MMM yyyy", { locale: es })}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Vista historial — detalle ────────────────────────────────────
  if (historyView === "detail" && detailConv) {
    return (
      <div className="flex flex-col h-[calc(100vh-8rem)]">
        <div className="px-4 py-3 border-b border-border bg-white">
          <div className="flex items-center gap-2 max-w-lg mx-auto">
            <button onClick={() => setHistoryView("list")} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <p className="font-semibold text-sm flex-1 truncate">{detailConv.title || "Conversación"}</p>
            <button
              onClick={() => resumeConversation(detailConv)}
              className="flex items-center gap-1.5 text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Continuar
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-lg mx-auto w-full">
          {detailMessages.map((msg) => (
            <div key={msg.id} className={cn("flex flex-col", msg.role === "user" ? "items-end" : "items-start")}>
              <div className={cn("flex items-start gap-2", msg.role === "user" ? "flex-row-reverse" : "flex-row")}>
                {msg.role === "assistant" ? (
                  <div className="bg-indigo-100 p-1.5 rounded-full h-7 w-7 flex items-center justify-center shrink-0 mt-1">
                    <Bot className="w-4 h-4 text-indigo-600" />
                  </div>
                ) : (
                  <div
                    className="h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 mt-1"
                    style={{ backgroundColor: user?.color ?? "#6366f1" }}
                  >
                    {user?.name?.[0]}
                  </div>
                )}
                <div className={cn(
                  "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm",
                  msg.role === "user" ? "bg-indigo-600 text-white rounded-tr-sm" : "bg-white border border-border rounded-tl-sm"
                )}>
                  {msg.role === "user" ? (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                      p:    ({ children }) => <p className="mb-1.5 last:mb-0 leading-relaxed">{children}</p>,
                      ul:   ({ children }) => <ul className="list-disc pl-4 mb-1.5 space-y-0.5">{children}</ul>,
                      ol:   ({ children }) => <ol className="list-decimal pl-4 mb-1.5 space-y-0.5">{children}</ol>,
                      code: ({ children }) => <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">{children}</code>,
                    }}>
                      {msg.content}
                    </ReactMarkdown>
                  )}
                </div>
              </div>
              <span className="text-[10px] text-muted-foreground mt-1 px-1">
                {format(new Date(msg.createdAt), "HH:mm", { locale: es })}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-white">
        <div className="flex items-center justify-between gap-2 max-w-lg mx-auto">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-100 p-2 rounded-xl">
              <Bot className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="font-semibold text-sm">Hestia IA</p>
              <p className="text-xs text-muted-foreground">Asistente familiar • LLM local</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={openHistory}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-muted"
              title="Ver historial"
            >
              <History className="w-3.5 h-3.5" />
              Historial
            </button>
            {messages.length > 0 && (
              <button
                onClick={startNewConversation}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-muted"
                title="Nueva conversación"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Nueva
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-lg mx-auto w-full">
        {loadingHistory && (
          <div className="text-center py-8 text-sm text-muted-foreground">Cargando conversación…</div>
        )}
        {!loadingHistory && messages.length === 0 && (
          <div className="text-center py-8 space-y-3">
            <div className="text-4xl">🏠</div>
            <p className="font-medium">¡Hola, {user?.name}!</p>
            <p className="text-muted-foreground text-sm">
              Soy Hestia, tu asistente familiar. Puedo ayudarte a organizar tareas, buscar recetas, recordarte eventos y mucho más.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {QUICK_SUGGESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="text-xs px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={cn("flex flex-col", msg.role === "user" ? "items-end" : "items-start")}>
            <div className={cn("flex items-start gap-2", msg.role === "user" ? "flex-row-reverse" : "flex-row")}>
              {msg.role === "assistant" ? (
                <div className="bg-indigo-100 p-1.5 rounded-full h-7 w-7 flex items-center justify-center shrink-0 mt-1">
                  <Bot className="w-4 h-4 text-indigo-600" />
                </div>
              ) : (
                <div
                  className="h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 mt-1"
                  style={{ backgroundColor: user?.color ?? "#6366f1" }}
                >
                  {user?.name?.[0]}
                </div>
              )}
              <div
                className={cn(
                  "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm",
                  msg.role === "user"
                    ? "bg-indigo-600 text-white rounded-tr-sm"
                    : "bg-white border border-border rounded-tl-sm"
                )}
              >
                {msg.role === "user" ? (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                ) : (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p:      ({ children }) => <p className="mb-1.5 last:mb-0 leading-relaxed">{children}</p>,
                      ul:     ({ children }) => <ul className="list-disc pl-4 mb-1.5 space-y-0.5">{children}</ul>,
                      ol:     ({ children }) => <ol className="list-decimal pl-4 mb-1.5 space-y-0.5">{children}</ol>,
                      li:     ({ children }) => <li className="leading-relaxed">{children}</li>,
                      strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                      em:     ({ children }) => <em className="italic">{children}</em>,
                      code:   ({ children }) => <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">{children}</code>,
                      pre:    ({ children }) => <pre className="bg-muted p-2 rounded-lg text-xs font-mono overflow-x-auto mb-1.5">{children}</pre>,
                      h1:     ({ children }) => <h1 className="font-bold text-base mb-1">{children}</h1>,
                      h2:     ({ children }) => <h2 className="font-bold text-sm mb-1">{children}</h2>,
                      h3:     ({ children }) => <h3 className="font-semibold text-sm mb-1">{children}</h3>,
                      hr:     () => <hr className="my-2 border-border" />,
                      blockquote: ({ children }) => <blockquote className="border-l-2 border-indigo-300 pl-3 italic text-muted-foreground mb-1.5">{children}</blockquote>,
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                )}
              </div>
            </div>

            {/* Events created card */}
            {msg.eventsCreated && msg.eventsCreated.length > 0 && (
              <div className="mt-2 ml-9 w-full max-w-[80%] bg-emerald-50 border border-emerald-200 rounded-2xl p-3 space-y-2">
                <div className="flex items-center gap-1.5 text-emerald-700">
                  <CalendarCheck className="w-4 h-4 shrink-0" />
                  <p className="text-xs font-semibold">
                    {msg.eventsCreated.length === 1
                      ? "1 evento añadido al calendario"
                      : `${msg.eventsCreated.length} eventos añadidos al calendario`}
                  </p>
                </div>
                <div className="space-y-1.5">
                  {msg.eventsCreated.map((ev) => {
                    const start = new Date(ev.startDate);
                    return (
                      <div key={ev.id} className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: EVENT_TYPE_COLORS[ev.type] ?? "#6b7280" }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-emerald-900 truncate">{ev.title}</p>
                          <p className="text-[10px] text-emerald-600">
                            {format(start, "EEEE d 'de' MMMM", { locale: es })}
                            {!ev.allDay && ` · ${format(start, "HH:mm")}`}
                            {!ev.allDay && ev.endDate && ` – ${format(new Date(ev.endDate), "HH:mm")}`}
                            {" · "}
                            {EVENT_TYPE_LABELS[ev.type] ?? ev.type}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-indigo-100 p-1.5 rounded-full h-7 w-7 flex items-center justify-center mr-2 shrink-0">
              <Bot className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="bg-white border border-border rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border bg-white">
        <div className="flex gap-2 max-w-lg mx-auto">
          <textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Escribe un mensaje o pega un programa..."
            className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-muted/30 focus:outline-none focus:ring-2 focus:ring-indigo-300 text-sm resize-none"
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 self-end"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground text-center mt-1.5 max-w-lg mx-auto">
          Shift+Enter para nueva línea · Pega un programa para crear eventos automáticamente
        </p>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      <ChatInner />
    </Suspense>
  );
}
