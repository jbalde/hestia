"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import { KeyRound, CheckCircle2, AlertCircle } from "lucide-react";

type Status = "idle" | "saving" | "success" | "error" | "ratelimit";

export default function SettingsPage() {
  const { user } = useAuthStore();

  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const canSubmit =
    currentPin.length === 4 &&
    newPin.length === 4 &&
    confirmPin.length === 4 &&
    status !== "saving";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    if (newPin !== confirmPin) {
      setErrorMsg("El nuevo PIN y la confirmación no coinciden.");
      setStatus("error");
      return;
    }

    setStatus("saving");
    setErrorMsg("");

    try {
      await api.post("/auth/change-pin", { currentPin, newPin });
      setStatus("success");
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
    } catch (err: any) {
      if (err?.status === 429) {
        setStatus("ratelimit");
        setErrorMsg("Demasiados intentos. Espera 1 hora e inténtalo de nuevo.");
      } else {
        setStatus("error");
        setErrorMsg(err?.message ?? "PIN actual incorrecto.");
      }
    }
  };

  return (
    <div className="p-4 max-w-lg mx-auto space-y-6 pb-8">
      <h1 className="text-xl font-bold">Ajustes</h1>

      {/* Perfil */}
      <div className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-border">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold shrink-0"
          style={{ backgroundColor: user?.color }}
        >
          {user?.name?.[0]}
        </div>
        <div>
          <p className="font-semibold">{user?.name}</p>
          <p className="text-xs text-muted-foreground">Miembro de la familia</p>
        </div>
      </div>

      {/* Cambiar PIN */}
      <div className="bg-white rounded-2xl border border-border p-4 space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-indigo-600" />
          <p className="font-semibold text-sm">Cambiar PIN</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <PinInput
            label="PIN actual"
            value={currentPin}
            onChange={setCurrentPin}
            autoFocus
          />
          <PinInput
            label="Nuevo PIN"
            value={newPin}
            onChange={setNewPin}
          />
          <PinInput
            label="Confirmar nuevo PIN"
            value={confirmPin}
            onChange={setConfirmPin}
          />

          {status === "success" && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 px-3 py-2 rounded-xl">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              PIN actualizado correctamente.
            </div>
          )}

          {(status === "error" || status === "ratelimit") && (
            <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 px-3 py-2 rounded-xl">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {status === "saving" ? "Guardando..." : "Cambiar PIN"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Componente entrada PIN ─────────────────────────────��──────────

function PinInput({
  label,
  value,
  onChange,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <div className="flex gap-2 justify-center">
        {[0, 1, 2, 3].map((i) => (
          <input
            key={i}
            type="password"
            inputMode="numeric"
            maxLength={1}
            autoFocus={autoFocus && i === 0}
            value={value[i] ?? ""}
            onChange={(e) => {
              const digit = e.target.value.replace(/\D/g, "").slice(-1);
              const arr = value.split("");
              arr[i] = digit;
              const next = arr.join("").slice(0, 4);
              onChange(next);
              if (digit && i < 3) {
                const nextInput = e.target.parentElement?.children[i + 1] as HTMLInputElement;
                nextInput?.focus();
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && !value[i] && i > 0) {
                const prev = e.currentTarget.parentElement?.children[i - 1] as HTMLInputElement;
                prev?.focus();
                const arr = value.split("");
                arr[i - 1] = "";
                onChange(arr.join(""));
              }
            }}
            className={cn(
              "w-12 h-12 text-center text-lg font-bold rounded-xl border bg-muted/30 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-colors",
              value[i] ? "border-indigo-300 bg-indigo-50" : "border-border"
            )}
          />
        ))}
      </div>
    </div>
  );
}
