"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const FAMILY_MEMBERS = [
  { name: "Juan", color: "#6366f1", emoji: "👨" },
  { name: "Marina", color: "#ec4899", emoji: "👩" },
  { name: "Judith", color: "#f59e0b", emoji: "👵" },
];

type Step = "select-user" | "enter-pin";

export default function AuthPage() {
  const router = useRouter();
  const { setAuth, setUsers, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, router]);

  const [step, setStep] = useState<Step>("select-user");
  const [selectedUser, setSelectedUser] = useState<(typeof FAMILY_MEMBERS)[0] | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSelectUser = async (member: (typeof FAMILY_MEMBERS)[0]) => {
    setError("");
    // Fetch users from API to get the actual user ID
    try {
      const users = await api.get("/users");
      setUsers(users);
      const user = users.find((u: any) => u.name === member.name);
      if (user) {
        setSelectedUser({ ...member, id: user.id } as any);
        setStep("enter-pin");
      }
    } catch {
      setError("Error al conectar con el servidor");
    }
  };

  const handlePinDigit = (digit: string) => {
    if (pin.length < 4) {
      const newPin = pin + digit;
      setPin(newPin);
      if (newPin.length === 4) {
        handleLogin(newPin);
      }
    }
  };

  const handleLogin = async (pinValue: string) => {
    if (!selectedUser) return;
    setLoading(true);
    setError("");
    try {
      const data = await api.post("/auth/login", {
        userId: (selectedUser as any).id,
        pin: pinValue,
      });
      setAuth(data.token, data.user);
      router.push("/dashboard");
    } catch {
      setError("PIN incorrecto. Inténtalo de nuevo.");
      setPin("");
    } finally {
      setLoading(false);
    }
  };

  const handleBackspace = () => {
    setPin((p) => p.slice(0, -1));
    setError("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-2">🏠</div>
          <h1 className="text-3xl font-bold text-indigo-600">Hestia</h1>
          <p className="text-muted-foreground mt-1">Tu asistente familiar</p>
        </div>

        {step === "select-user" && (
          <div className="space-y-4">
            <h2 className="text-center text-lg font-medium">¿Quién eres?</h2>
            {FAMILY_MEMBERS.map((member) => (
              <button
                key={member.name}
                onClick={() => handleSelectUser(member)}
                className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white shadow-sm border border-border hover:shadow-md transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
                  style={{ backgroundColor: member.color + "20" }}
                >
                  {member.emoji}
                </div>
                <span className="text-lg font-medium">{member.name}</span>
              </button>
            ))}
            {error && <p className="text-destructive text-center text-sm">{error}</p>}
          </div>
        )}

        {step === "enter-pin" && selectedUser && (
          <div className="space-y-6">
            <button
              onClick={() => { setStep("select-user"); setPin(""); setError(""); }}
              className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
            >
              ← Volver
            </button>
            <div className="text-center">
              <div className="text-3xl mb-1">{(selectedUser as any).emoji}</div>
              <h2 className="text-xl font-semibold">Hola, {selectedUser.name}</h2>
              <p className="text-muted-foreground text-sm">Introduce tu PIN de 4 dígitos</p>
            </div>

            {/* PIN dots */}
            <div className="flex justify-center gap-4">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={cn(
                    "w-4 h-4 rounded-full border-2 transition-all",
                    pin.length > i
                      ? "border-indigo-500 bg-indigo-500"
                      : "border-muted-foreground"
                  )}
                />
              ))}
            </div>

            {error && <p className="text-destructive text-center text-sm">{error}</p>}

            {/* Numpad */}
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <button
                  key={n}
                  onClick={() => handlePinDigit(String(n))}
                  disabled={loading}
                  className="h-16 rounded-2xl bg-white border border-border text-xl font-semibold shadow-sm hover:bg-indigo-50 hover:border-indigo-300 transition-all active:scale-95"
                >
                  {n}
                </button>
              ))}
              <div />
              <button
                onClick={() => handlePinDigit("0")}
                disabled={loading}
                className="h-16 rounded-2xl bg-white border border-border text-xl font-semibold shadow-sm hover:bg-indigo-50 hover:border-indigo-300 transition-all active:scale-95"
              >
                0
              </button>
              <button
                onClick={handleBackspace}
                disabled={loading || pin.length === 0}
                className="h-16 rounded-2xl bg-white border border-border text-xl shadow-sm hover:bg-red-50 hover:border-red-300 transition-all active:scale-95 disabled:opacity-30"
              >
                ⌫
              </button>
            </div>

            {loading && (
              <p className="text-center text-muted-foreground text-sm animate-pulse">
                Verificando...
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
