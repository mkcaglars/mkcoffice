"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Loader2, Search, UserRound } from "lucide-react";
import { useExtracted } from "next-intl";
import { usePageTitle } from "@/hooks/use-page-title";
import { useAuthStore } from "@/store/auth";
import { files as filesApi, filesUrl, type Student } from "@/utils/backend";

/** Teachers: every student who has signed in, grouped by class. */
export function StudentsView() {
  const t = useExtracted();
  usePageTitle(t("Student Files — MKC Ofis"));
  const user = useAuthStore((s) => s.user);
  const [students, setStudents] = useState<Student[] | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (user?.role !== "ogretmen") return;
    filesApi
      .students()
      .then((res) => setStudents(res.students))
      .catch((err) => {
        setError((err as Error).message);
        setStudents([]);
      });
  }, [user]);

  const groups = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr");
    const filtered = (students || []).filter(
      (s) =>
        !q ||
        s.name.toLocaleLowerCase("tr").includes(q) ||
        s.uid.toLocaleLowerCase("tr").includes(q) ||
        s.sinif.toLocaleLowerCase("tr").includes(q),
    );
    const byClass = new Map<string, Student[]>();
    for (const s of filtered) {
      const key = s.sinif || "";
      byClass.set(key, [...(byClass.get(key) || []), s]);
    }
    return [...byClass.entries()]
      .sort(([a], [b]) => (a ? (b ? a.localeCompare(b, "tr", { numeric: true }) : -1) : 1))
      .map(([sinif, list]) => ({
        sinif,
        list: list.sort((a, b) => a.name.localeCompare(b.name, "tr")),
      }));
  }, [students, query]);

  if (user?.role !== "ogretmen") {
    return <p className="text-sm text-text-secondary">{t("This page is only for teachers.")}</p>;
  }

  const formatDate = (ts: number | null) =>
    ts
      ? new Date(ts * 1000).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
      : "—";

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{t("Student Files")}</h1>
        <p className="text-sm text-text-secondary">
          {t("Students appear here after signing in to Office once. Their files open read-only.")}
        </p>
      </div>

      <label className="relative block max-w-sm">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("Search by name, number or class")}
          className="w-full h-10 pl-9 pr-3 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </label>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {students === null ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-text-secondary" />
        </div>
      ) : groups.length === 0 ? (
        <p className="py-16 text-center text-sm text-text-secondary">
          {students.length === 0 ? t("No student has signed in yet.") : t("No matching student.")}
        </p>
      ) : (
        groups.map(({ sinif, list }) => (
          <section key={sinif} className="space-y-2">
            <h2 className="text-sm font-semibold text-text-secondary">
              {sinif || t("No class")} · {list.length}
            </h2>
            <ul className="rounded-xl border border-border dark:border-white/10 overflow-hidden">
              {list.map((s) => (
                <li key={s.uid} className="border-b last:border-b-0 border-border dark:border-white/5">
                  <Link
                    href={filesUrl("", s.uid)}
                    className="group flex items-center gap-3 px-4 py-3 hover:bg-muted/60 dark:hover:bg-white/5"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <UserRound className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate group-hover:text-primary">{s.name}</p>
                      <p className="text-xs text-text-secondary">{s.uid}</p>
                    </div>
                    <div className="hidden sm:block text-right text-xs text-text-secondary">
                      <p>{t("{count} files", { count: String(s.fileCount) })}</p>
                      <p>{formatDate(s.lastModified)}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-text-secondary" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
