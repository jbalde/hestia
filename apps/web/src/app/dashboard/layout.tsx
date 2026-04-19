"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/auth";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  CheckSquare,
  ShoppingCart,
  ChefHat,
  Calendar,
  MessageCircle,
  UtensilsCrossed,
  Settings,
  LogOut,
} from "lucide-react";

const navItems = [
  { href: "/dashboard",         label: "Inicio",    icon: LayoutDashboard },
  { href: "/dashboard/tasks",   label: "Tareas",    icon: CheckSquare },
  { href: "/dashboard/shopping",label: "Compra",    icon: ShoppingCart },
  { href: "/dashboard/recipes", label: "Recetas",   icon: ChefHat },
  { href: "/dashboard/menu",    label: "Menú",      icon: UtensilsCrossed },
  { href: "/dashboard/calendar",label: "Calendario",icon: Calendar },
  { href: "/dashboard/chat",    label: "Hestia IA", icon: MessageCircle },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, user, logout } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/auth");
      return;
    }
    // Verifica que el token sigue siendo válido
    api.get("/users/" + user?.id).catch(() => {
      logout();
      router.push("/auth");
    });
  }, [isAuthenticated, router, user, logout]);

  if (!isAuthenticated || !user) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top header */}
      <header className="sticky top-0 z-50 bg-white border-b border-border px-4 flex flex-col safe-top">
        <div className="py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🏠</span>
          <span className="font-bold text-indigo-600 text-lg">Hestia</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/settings"
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            title="Ajustes"
          >
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ring-2 ring-transparent transition-all",
                pathname === "/dashboard/settings" && "ring-indigo-400"
              )}
              style={{ backgroundColor: user.color }}
            >
              {user.name[0]}
            </div>
            <span className="text-sm font-medium hidden sm:block">{user.name}</span>
          </Link>
          {user.name === "Juan" && (
            <Link
              href="/dashboard/admin"
              className={cn(
                "p-2 rounded-lg hover:bg-muted transition-colors",
                pathname === "/dashboard/admin"
                  ? "text-indigo-600 bg-indigo-50"
                  : "text-muted-foreground"
              )}
              title="Administración"
            >
              <Settings className="w-4 h-4" />
            </Link>
          )}
          <button
            onClick={() => { logout(); router.push("/auth"); }}
            className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
        </div>
      </header>

      {/* Main content — padding-bottom leaves room for the nav + safe area */}
      <main className="flex-1 overflow-auto pb-[calc(4rem+env(safe-area-inset-bottom))]">
        {children}
      </main>

      {/* Bottom navigation (mobile) */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-border" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="grid grid-cols-7 max-w-lg mx-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center py-3 px-1 gap-1 transition-colors min-h-[3.5rem]",
                  isActive
                    ? "text-indigo-600"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className="text-[10px] font-medium leading-none">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
