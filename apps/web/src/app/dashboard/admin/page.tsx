"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { api } from "@/lib/api";
import {
  Save, RotateCcw, Cpu, AlertCircle, CheckCircle2,
  Send, Eye, EyeOff, UserCheck, Trash2, Clock, Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { CronSection } from "./cron-section";

// ── Types ─────────────────────────────────────────────────────────

interface LlmConfig { apiUrl: string; model: string; temperature: string; maxTokens: string }
interface TelegramConfig { botToken: string; isRunning: boolean }
interface FamilyMember { id: string; name: string; color: string }
interface TelegramContact {
  id: string;
  chatId: string;
  telegramUsername?: string;
  telegramFirstName?: string;
  userId: string | null;
  userName: string | null;
  userColor: string | null;
  authenticated: boolean;
  lastSeen: string;
  firstSeen: string;
}

const PRESETS = [
  { label: "Ollama (local)", apiUrl: "http://localhost:11434/v1", model: "llama3.2" },
  { label: "LM Studio",      apiUrl: "http://localhost:1234/v1",  model: "local-model" },
  { label: "Jan",            apiUrl: "http://localhost:1337/v1",  model: "llama3.2" },
];

// ── Page ──────────────────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [llm, setLlm]         = useState<LlmConfig>({ apiUrl: "", model: "", temperature: "0.7", maxTokens: "1024" });
  const [telegram, setTelegram] = useState<TelegramConfig>({ botToken: "", isRunning: false });
  const [contacts, setContacts] = useState<TelegramContact[]>([]);
  const [members, setMembers]   = useState<FamilyMember[]>([]);

  const [loading, setLoading]       = useState(true);
  const [savingLlm, setSavingLlm]   = useState(false);
  const [savingTg, setSavingTg]     = useState(false);
  const [llmStatus, setLlmStatus]   = useState<"idle" | "success" | "error">("idle");
  const [tgStatus, setTgStatus]     = useState<"idle" | "success" | "error">("idle");
  const [testResult, setTestResult] = useState<"idle" | "testing" | "ok" | "fail">("idle");
  const [showToken, setShowToken]   = useState(false);
  const [pairingId, setPairingId]   = useState<string | null>(null);

  const loadContacts = useCallback(async () => {
    const data = await api.get<TelegramContact[]>("/admin/telegram-contacts");
    setContacts(data);
  }, []);

  useEffect(() => {
    if (user?.name !== "Juan") { router.replace("/dashboard"); return; }
    Promise.all([
      api.get<LlmConfig>("/admin/llm-config"),
      api.get<TelegramConfig>("/admin/telegram-config"),
      api.get<TelegramContact[]>("/admin/telegram-contacts"),
      api.get<FamilyMember[]>("/users"),
    ]).then(([l, t, c, m]) => { setLlm(l); setTelegram(t); setContacts(c); setMembers(m); })
      .finally(() => setLoading(false));
  }, [user, router]);

  const handleSaveLlm = async () => {
    setSavingLlm(true); setLlmStatus("idle");
    try {
      await api.put("/admin/llm-config", llm);
      setLlmStatus("success");
      setTimeout(() => setLlmStatus("idle"), 3000);
    } catch { setLlmStatus("error"); }
    finally { setSavingLlm(false); }
  };

  const handleSaveTelegram = async () => {
    setSavingTg(true); setTgStatus("idle");
    try {
      const res = await api.put<{ isRunning: boolean }>("/admin/telegram-config", { botToken: telegram.botToken });
      setTelegram((t) => ({ ...t, isRunning: res.isRunning }));
      setTgStatus("success");
      setTimeout(() => setTgStatus("idle"), 3000);
    } catch { setTgStatus("error"); }
    finally { setSavingTg(false); }
  };

  const handleTest = async () => {
    setTestResult("testing");
    try {
      const res = await api.post<{ reply: string }>("/llm/chat", { message: "Di solo 'OK' como confirmación." });
      setTestResult(res.reply ? "ok" : "fail");
    } catch { setTestResult("fail"); }
  };

  const handlePair = async (contactId: string, userId: string | null) => {
    setPairingId(contactId);
    try {
      await api.put(`/admin/telegram-contacts/${contactId}/pair`, { userId });
      await loadContacts();
    } finally { setPairingId(null); }
  };

  const handleDelete = async (contactId: string) => {
    await api.delete(`/admin/telegram-contacts/${contactId}`);
    setContacts((c) => c.filter((x) => x.id !== contactId));
  };

  if (loading) return (
    <div className="flex items-center justify-center h-40 text-muted-foreground">Cargando...</div>
  );

  const pendingContacts = contacts.filter((c) => !c.userId);
  const pairedContacts  = contacts.filter((c) =>  c.userId);

  return (
    <div className="p-4 max-w-lg mx-auto space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="bg-indigo-100 p-2.5 rounded-xl">
          <Cpu className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Panel de administración</h1>
          <p className="text-xs text-muted-foreground">Solo accesible para Juan</p>
        </div>
      </div>

      {/* ── LLM Config ── */}
      <div className="bg-white rounded-2xl border border-border p-5 space-y-5">
        <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
          Configuración del LLM local
        </h2>

        <div>
          <p className="text-sm font-medium mb-2">Presets rápidos</p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button key={p.label}
                onClick={() => setLlm((c) => ({ ...c, apiUrl: p.apiUrl, model: p.model }))}
                className="text-xs px-3 py-1.5 rounded-full border border-border hover:bg-indigo-50 hover:border-indigo-300 transition-colors">
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">URL de la API</label>
          <input type="url" value={llm.apiUrl}
            onChange={(e) => setLlm((c) => ({ ...c, apiUrl: e.target.value }))}
            placeholder="http://localhost:11434/v1"
            className="w-full px-3 py-2 rounded-xl border border-border bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 font-mono" />
          <p className="text-xs text-muted-foreground">Endpoint compatible con OpenAI (Ollama, LM Studio, Jan…)</p>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Nombre del modelo</label>
          <input type="text" value={llm.model}
            onChange={(e) => setLlm((c) => ({ ...c, model: e.target.value }))}
            placeholder="llama3.2"
            className="w-full px-3 py-2 rounded-xl border border-border bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 font-mono" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Temperatura <span className="font-normal text-muted-foreground">({llm.temperature})</span>
            </label>
            <input type="range" min="0" max="1" step="0.1" value={llm.temperature}
              onChange={(e) => setLlm((c) => ({ ...c, temperature: e.target.value }))}
              className="w-full accent-indigo-600" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Preciso</span><span>Creativo</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Máx. tokens</label>
            <input type="number" value={llm.maxTokens}
              onChange={(e) => setLlm((c) => ({ ...c, maxTokens: e.target.value }))}
              min="256" max="8192" step="256"
              className="w-full px-3 py-2 rounded-xl border border-border bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button onClick={handleSaveLlm} disabled={savingLlm}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50">
            <Save className="w-4 h-4" />
            {savingLlm ? "Guardando..." : "Guardar"}
          </button>
          <button onClick={handleTest} disabled={testResult === "testing"}
            className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50">
            <RotateCcw className={cn("w-4 h-4", testResult === "testing" && "animate-spin")} />
            {testResult === "testing" ? "Probando..." : "Probar conexión"}
          </button>
        </div>

        {llmStatus === "success" && <StatusMsg ok text="Configuración guardada correctamente" />}
        {llmStatus === "error"   && <StatusMsg ok={false} text="Error al guardar la configuración" />}
        {testResult === "ok"     && <StatusMsg ok text="Conexión con el LLM establecida correctamente" />}
        {testResult === "fail"   && <StatusMsg ok={false} text="No se pudo conectar. Revisa la URL y que el servidor esté activo." />}
      </div>

      {/* ── Telegram Config ── */}
      <div className="bg-white rounded-2xl border border-border p-5 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
            Bot de Telegram
          </h2>
          <span className={cn(
            "text-xs px-2.5 py-1 rounded-full font-medium",
            telegram.isRunning ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"
          )}>
            {telegram.isRunning ? "Activo" : "Inactivo"}
          </span>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Token del bot</label>
          <div className="relative">
            <input
              type={showToken ? "text" : "password"}
              value={telegram.botToken}
              onChange={(e) => setTelegram((t) => ({ ...t, botToken: e.target.value }))}
              placeholder="1234567890:AAXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
              className="w-full pr-10 px-3 py-2 rounded-xl border border-border bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 font-mono"
            />
            <button type="button" onClick={() => setShowToken((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
              {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Obtén el token en <span className="font-mono">@BotFather</span>. Al guardar, el bot se reinicia automáticamente.
          </p>
        </div>

        <button onClick={handleSaveTelegram} disabled={savingTg}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50">
          <Send className="w-4 h-4" />
          {savingTg ? "Guardando..." : "Guardar y activar"}
        </button>

        {tgStatus === "success" && (
          <StatusMsg ok text={telegram.isRunning ? "Bot activado correctamente" : "Token guardado. Bot detenido (token vacío)."} />
        )}
        {tgStatus === "error" && <StatusMsg ok={false} text="Error al guardar la configuración de Telegram" />}
      </div>

      {/* ── Cron Jobs ── */}
      <div className="bg-white rounded-2xl border border-border p-5">
        <CronSection members={members} />
      </div>

      {/* ── Telegram Contacts ── */}
      <div className="bg-white rounded-2xl border border-border p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
            Usuarios de Telegram
          </h2>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {contacts.length} registrado{contacts.length !== 1 ? "s" : ""}
          </span>
        </div>

        {contacts.length === 0 && (
          <div className="flex flex-col items-center py-6 gap-2 text-muted-foreground">
            <Users className="w-8 h-8 opacity-30" />
            <p className="text-sm">Nadie ha escrito al bot todavía</p>
          </div>
        )}

        {/* Pending */}
        {pendingContacts.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide">
              Sin emparejar ({pendingContacts.length})
            </p>
            {pendingContacts.map((c) => (
              <ContactCard
                key={c.id}
                contact={c}
                members={members}
                pairing={pairingId === c.id}
                onPair={(userId) => handlePair(c.id, userId)}
                onDelete={() => handleDelete(c.id)}
              />
            ))}
          </div>
        )}

        {/* Paired */}
        {pairedContacts.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">
              Emparejados ({pairedContacts.length})
            </p>
            {pairedContacts.map((c) => (
              <ContactCard
                key={c.id}
                contact={c}
                members={members}
                pairing={pairingId === c.id}
                onPair={(userId) => handlePair(c.id, userId)}
                onDelete={() => handleDelete(c.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────

function ContactCard({
  contact, members, pairing, onPair, onDelete,
}: {
  contact: TelegramContact;
  members: FamilyMember[];
  pairing: boolean;
  onPair: (userId: string | null) => void;
  onDelete: () => void;
}) {
  const displayName = contact.telegramFirstName
    ? `${contact.telegramFirstName}${contact.telegramUsername ? ` (@${contact.telegramUsername})` : ""}`
    : contact.telegramUsername
    ? `@${contact.telegramUsername}`
    : `Chat ${contact.chatId}`;

  return (
    <div className="flex items-start gap-3 p-3 rounded-xl border border-border bg-muted/20">
      {/* Avatar placeholder */}
      <div className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0",
        contact.userId ? "" : "bg-muted-foreground/30"
      )}
        style={contact.userColor ? { backgroundColor: contact.userColor } : {}}>
        {contact.telegramFirstName?.[0]?.toUpperCase() ?? "?"}
      </div>

      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium truncate">{displayName}</p>
          {contact.userId && (
            <span className="text-[10px] px-2 py-0.5 rounded-full text-white font-medium shrink-0"
              style={{ backgroundColor: contact.userColor ?? "#6b7280" }}>
              {contact.userName}
            </span>
          )}
          {contact.authenticated && (
            <span className="flex items-center gap-0.5 text-[10px] text-emerald-600 font-medium shrink-0">
              <UserCheck className="w-3 h-3" /> Verificado
            </span>
          )}
        </div>

        <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock className="w-3 h-3" />
          {formatDistanceToNow(new Date(contact.lastSeen), { locale: es, addSuffix: true })}
        </p>

        {/* Pair selector */}
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
          <span className="text-xs text-muted-foreground">Asociar con:</span>
          {members.map((m) => (
            <button key={m.id}
              disabled={pairing}
              onClick={() => onPair(m.id)}
              className={cn(
                "text-xs px-2.5 py-1 rounded-full font-medium transition-colors disabled:opacity-50",
                contact.userId === m.id
                  ? "text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/70"
              )}
              style={contact.userId === m.id ? { backgroundColor: m.color } : {}}>
              {m.name}
            </button>
          ))}
          {contact.userId && (
            <button disabled={pairing} onClick={() => onPair(null)}
              className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground hover:bg-muted/70 transition-colors disabled:opacity-50">
              Desvincular
            </button>
          )}
        </div>
      </div>

      <button onClick={onDelete}
        className="p-1.5 rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-500 transition-colors shrink-0">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function StatusMsg({ ok, text }: { ok: boolean; text: string }) {
  return (
    <div className={cn("flex items-center gap-2 text-sm", ok ? "text-green-600" : "text-destructive")}>
      {ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
      {text}
    </div>
  );
}
