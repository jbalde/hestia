"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { MessageSquare, ChevronDown, ArrowLeft, Bot, User } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ConvSummary {
  id: string;
  title?: string;
  lastMessageAt?: string;
  createdAt: string;
  messageCount: number;
  compacted: boolean;
  user: { id: string; name: string; color: string } | null;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export function ConversationsSection() {
  const [open, setOpen] = useState(false);
  const [conversations, setConversations] = useState<ConvSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<ConvSummary | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  const toggle = async () => {
    if (!open && conversations.length === 0) {
      setLoading(true);
      try {
        const data = await api.get<ConvSummary[]>("/llm/conversations/all");
        setConversations(data);
      } finally {
        setLoading(false);
      }
    }
    setOpen((v) => !v);
    setDetail(null);
  };

  const openDetail = async (conv: ConvSummary) => {
    setDetail(conv);
    setLoadingMsgs(true);
    try {
      const data = await api.get<ChatMessage[]>(`/llm/conversations/${conv.id}/messages/admin`);
      setMessages(data);
    } finally {
      setLoadingMsgs(false);
    }
  };

  // Group by user
  const byUser = conversations.reduce<Record<string, ConvSummary[]>>((acc, conv) => {
    const key = conv.user?.id ?? "unknown";
    if (!acc[key]) acc[key] = [];
    acc[key].push(conv);
    return acc;
  }, {});

  return (
    <div className="bg-white rounded-2xl border border-border overflow-hidden">
      <button onClick={toggle} className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/30 transition-colors">
        <div className="bg-indigo-50 p-2 rounded-xl">
          <MessageSquare className="w-5 h-5 text-indigo-600" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-sm">Historial de conversaciones</p>
          <p className="text-xs text-muted-foreground">Todas las conversaciones con Hestia IA</p>
        </div>
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="border-t border-border">
          {loading && <p className="text-sm text-muted-foreground text-center py-6">Cargando…</p>}

          {!loading && !detail && (
            <div className="p-4 space-y-4">
              {conversations.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No hay conversaciones.</p>
              )}
              {Object.entries(byUser).map(([, convs]) => {
                const u = convs[0]?.user;
                return (
                  <div key={u?.id ?? "unknown"} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ backgroundColor: u?.color ?? "#6b7280" }}
                      >
                        {u?.name?.[0] ?? "?"}
                      </div>
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        {u?.name ?? "Desconocido"} — {convs.length} conversaciones
                      </span>
                    </div>
                    {convs.map((conv) => (
                      <button
                        key={conv.id}
                        onClick={() => openDetail(conv)}
                        className="w-full text-left p-3 bg-muted/30 rounded-xl border border-border hover:bg-muted/60 transition-colors"
                      >
                        <p className="text-sm font-medium truncate">{conv.title || "Sin título"}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                            <MessageSquare className="w-3 h-3" />
                            {conv.messageCount}
                          </span>
                          {conv.compacted && (
                            <span className="text-xs bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-full">Compactada</span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {conv.lastMessageAt
                              ? format(new Date(conv.lastMessageAt), "d MMM yyyy · HH:mm", { locale: es })
                              : format(new Date(conv.createdAt), "d MMM yyyy", { locale: es })}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          )}

          {!loading && detail && (
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <button onClick={() => setDetail(null)} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{detail.title || "Conversación"}</p>
                  <p className="text-xs text-muted-foreground">{detail.user?.name ?? "?"} · {detail.messageCount} mensajes</p>
                </div>
                {detail.user && (
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ backgroundColor: detail.user.color }}
                  >
                    {detail.user.name[0]}
                  </div>
                )}
              </div>

              {loadingMsgs && <p className="text-sm text-muted-foreground text-center py-4">Cargando mensajes…</p>}

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {messages.map((msg) => (
                  <div key={msg.id} className={cn("flex gap-2", msg.role === "user" ? "justify-end" : "justify-start")}>
                    {msg.role === "assistant" && (
                      <div className="bg-indigo-100 p-1.5 rounded-full h-6 w-6 flex items-center justify-center shrink-0 mt-1">
                        <Bot className="w-3.5 h-3.5 text-indigo-600" />
                      </div>
                    )}
                    <div className={cn(
                      "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                      msg.role === "user" ? "bg-indigo-600 text-white rounded-br-sm" : "bg-muted/50 rounded-bl-sm"
                    )}>
                      {msg.role === "user" ? (
                        <p className="whitespace-pre-wrap text-xs">{msg.content}</p>
                      ) : (
                        <div className="text-xs prose prose-xs max-w-none">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                        </div>
                      )}
                      <p className={cn("text-[10px] mt-1", msg.role === "user" ? "text-indigo-200" : "text-muted-foreground")}>
                        {format(new Date(msg.createdAt), "HH:mm", { locale: es })}
                      </p>
                    </div>
                    {msg.role === "user" && (
                      <div
                        className="h-6 w-6 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 mt-1"
                        style={{ backgroundColor: detail.user?.color ?? "#6b7280" }}
                      >
                        {detail.user?.name?.[0] ?? <User className="w-3 h-3" />}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
