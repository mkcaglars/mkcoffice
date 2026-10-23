"use client";

import { useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useExtracted } from "next-intl";
import { useAuthStore } from "@/store/auth";
import { usePageTitle } from "@/hooks/use-page-title";

/**
 * Shown when there is no Office session. Signing in happens only on the
 * portal, which sends the user to /giris.php with a one-time token.
 */
export function LoginView() {
  const t = useExtracted();
  const router = useRouter();
  const { loaded, user, portalUrl, refresh } = useAuthStore();

  usePageTitle(t("Sign in from the portal — MKC Ofis"));

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (loaded && user) router.replace("/");
  }, [loaded, user, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted dark:bg-[#0b0b0b] p-4">
      <div className="w-full max-w-sm bg-card dark:bg-[#141414] border border-border dark:border-white/10 rounded-2xl shadow-xl p-8 flex flex-col items-center gap-4 text-center">
        <Image width={220} height={86} src="/logo-full.png" alt="MKC Ofis" className="h-16 w-auto dark:hidden" />
        <Image width={220} height={86} src="/logo-full_white.png" alt="MKC Ofis" className="h-16 w-auto hidden dark:block" />
        <h1 className="text-xl font-bold">{t("Sign in from the portal")}</h1>
        <p className="text-sm text-text-secondary">
          {t("Open Office from the Office icon on the portal desktop. You will be signed in automatically.")}
        </p>
        {!loaded ? (
          <Loader2 className="w-6 h-6 animate-spin text-text-secondary" />
        ) : (
          portalUrl && (
            <a
              href={portalUrl}
              className="w-full h-10 rounded-lg bg-primary text-primary-foreground font-medium text-sm shadow-md hover:bg-primary/90 flex items-center justify-center"
            >
              {t("Go to the portal")}
            </a>
          )
        )}
      </div>
    </div>
  );
}
