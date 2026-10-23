import { create } from "zustand";
import { auth, BACKEND_ENABLED, type AuthStatus } from "@/utils/backend";

interface AuthState extends AuthStatus {
  loaded: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /** Close the Office session and return to the portal. */
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  loaded: !BACKEND_ENABLED,
  error: null,
  user: null,
  portalUrl: "",
  uploadLimit: 0,

  refresh: async () => {
    try {
      const status = await auth.status();
      set({ ...status, loaded: true, error: null });
    } catch (err) {
      set({ loaded: true, error: (err as Error).message });
    }
  },

  logout: async () => {
    let portalUrl = get().portalUrl;
    try {
      ({ portalUrl } = await auth.logout());
    } finally {
      set({ user: null });
      window.location.href = portalUrl || "/login/";
    }
  },
}));
