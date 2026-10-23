"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useExtracted } from "next-intl";
import { BACKEND_ENABLED } from "@/utils/backend";
import { useAuthStore } from "@/store/auth";

/**
 * With the PHP backend enabled, only render children for a signed-in user
 * and send everyone else to the login page.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const t = useExtracted();
  const { loaded, user, error, refresh } = useAuthStore();

  useEffect(() => {
    if (!BACKEND_ENABLED) return;
    refresh();
    const onUnauthorized = () => refresh();
    window.addEventListener("office:unauthorized", onUnauthorized);
    return () => window.removeEventListener("office:unauthorized", onUnauthorized);
  }, [refresh]);

  useEffect(() => {
    if (BACKEND_ENABLED && loaded && !user && !error) {
      router.replace("/login/");
    }
  }, [loaded, user, error, router]);

  if (!BACKEND_ENABLED) return <>{children}</>;

  if (error) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-lg font-semibold">{t("Cannot reach the server")}</p>
        <p className="text-sm text-text-secondary max-w-md">{error}</p>
        <button
          onClick={() => refresh()}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm"
        >
          {t("Try again")}
        </button>
      </div>
    );
  }

  if (!loaded || !user) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-text-secondary" />
      </div>
    );
  }

  return <>{children}</>;
}
