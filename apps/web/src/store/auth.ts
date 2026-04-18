import { create } from "zustand";
import { persist } from "zustand/middleware";

interface User {
  id: string;
  name: string;
  color: string;
  avatar?: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  users: User[];
  isAuthenticated: boolean;
  setAuth: (token: string, user: User) => void;
  setUsers: (users: User[]) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      users: [],
      isAuthenticated: false,
      setAuth: (token, user) => {
        localStorage.setItem("hestia_token", token);
        set({ token, user, isAuthenticated: true });
      },
      setUsers: (users) => set({ users }),
      logout: () => {
        localStorage.removeItem("hestia_token");
        set({ token: null, user: null, isAuthenticated: false });
      },
    }),
    {
      name: "hestia-auth",
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
