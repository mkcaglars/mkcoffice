"use client";

import { useEffect, useState } from "react";
import { Github, ShieldCheck } from "lucide-react";
import { useExtracted } from "next-intl";
import { usePageTitle } from "@/hooks/use-page-title";
import Image from "next/image";
import { APP_NAME, SOURCE_URL } from "@/lib/site";

/**
 * The site-specific part of this page comes from /hakkinda.html, a plain HTML
 * file the site admin edits on the server (no rebuild needed). The credits
 * below it stay fixed: the AGPL requires offering the source code.
 */
const CONTENT_URL = "/hakkinda.html";

export function AboutView() {
  const t = useExtracted();
  usePageTitle(t("About — MKC Ofis"));
  const [content, setContent] = useState<string | null>(null);

  useEffect(() => {
    fetch(CONTENT_URL, { cache: "no-store" })
      .then((res) => (res.ok ? res.text() : ""))
      .then(setContent)
      .catch(() => setContent(""));
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-primary/10 rounded-3xl mb-4">
          <Image width={48} height={48} src="/logo.svg" alt="" className="w-12 h-12" />
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight">
          {APP_NAME}
        </h1>
        <p className="text-sm text-text-secondary">
          {t("Based on the open-source ZIZIYI Office project and ONLYOFFICE.")}
        </p>
      </div>

      {content && (
        <div
          className="text-left space-y-4 leading-relaxed [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mt-8 [&_h2:first-child]:mt-0 [&_h3]:text-lg [&_h3]:font-semibold [&_p]:text-text-secondary [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1.5 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:text-text-secondary [&_a]:text-primary [&_a]:underline [&_strong]:text-foreground [&_img]:rounded-xl [&_img]:max-w-full"
          dangerouslySetInnerHTML={{ __html: content }}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
        <div className="p-8 bg-white/5 dark:bg-white/5 border border-border dark:border-white/10 rounded-3xl hover:border-primary/50 dark:hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all group">
          <div className="w-12 h-12 bg-primary/10 dark:bg-primary/20 rounded-2xl flex items-center justify-center mb-6">
            <Github className="w-6 h-6 text-primary" />
          </div>
          <h3 className="text-xl font-bold mb-3">{t("Open Source")}</h3>
          <p className="text-text-secondary dark:text-slate-400 text-sm leading-relaxed mb-6">
            {t(
              "We believe in the power of community. The source code for this project is available on GitHub for everyone to view, contribute, and improve.",
            )}
          </p>
          <a
            href={SOURCE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-sm font-semibold text-primary hover:underline"
          >
            {t("View on GitHub")}
          </a>
        </div>

        <div className="p-8 bg-white/5 dark:bg-white/5 border border-border dark:border-white/10 rounded-3xl hover:border-primary/50 dark:hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all group">
          <div className="w-12 h-12 bg-primary/10 dark:bg-primary/20 rounded-2xl flex items-center justify-center mb-6">
            <ShieldCheck className="w-6 h-6 text-primary" />
          </div>
          <h3 className="text-xl font-bold mb-3">
            {t("Powered by OnlyOffice")}
          </h3>
          <p className="text-text-secondary dark:text-slate-400 text-sm leading-relaxed">
            {t(
              "This project is built upon the robust foundation of OnlyOffice open-source code. We strictly adhere to and support OnlyOffice's open-source license, ensuring a sustainable ecosystem for document processing.",
            )}
          </p>
        </div>
      </div>

    </div>
  );
}
