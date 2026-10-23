"use client";

import Link from "next/link";
import {
  Layout,
  Plus,
  FolderOpen,
  Info,
  Settings,
  Puzzle,
  HardDrive,
  LogOut,
  UserRound,
  GraduationCap,
} from "lucide-react";
import { BACKEND_ENABLED } from "@/utils/backend";
import { useAuthStore } from "@/store/auth";
import { useExtracted } from "next-intl";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { getNewUrl } from "@/utils/editor/utils";
import { isExtensionAvailable, EXTENSION_STORE_URL } from "@/utils/extension";
import { getAppIcon, getDocConfig } from "@/lib/document-types";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface SidebarProps {
  pathname: string;
}

export function Sidebar({ pathname }: SidebarProps) {
  const t = useExtracted();
  const { user, logout } = useAuthStore();
  const [hasExtension, setHasExtension] = useState(true); // default true to avoid flash

  useEffect(() => {
    // Check immediately and after a delay (content script may not have injected yet)
    const check = () => setHasExtension(isExtensionAvailable());
    check();
    const timer = setTimeout(check, 1500);
    return () => clearTimeout(timer);
  }, []);

  const newDocTypes = [
    {
      type: "docx",
      label: t({ id: "Document", message: "Document" }),
    },
    {
      type: "xlsx",
      label: t({ id: "Spreadsheet", message: "Spreadsheet" }),
    },
    {
      type: "pptx",
      label: t({ id: "Presentation", message: "Presentation" }),
    },
    { type: "pdf", label: t({ id: "PDF", message: "PDF" }) },
  ];

  const sidebarItems = [
    BACKEND_ENABLED
      ? { id: "files", label: t("My Files"), icon: HardDrive, href: "/" }
      : { id: "open", label: t("Open"), icon: FolderOpen, href: "/" },
    ...(user?.role === "ogretmen"
      ? [{ id: "students", label: t("Student Files"), icon: GraduationCap, href: "/students" }]
      : []),
    { id: "template", label: t("Template"), icon: Layout, href: "/template" },
  ];

  return (
    <aside className="w-56 flex flex-col shrink-0">
      <div className="h-4" />

      {/* New Document Button with Popover */}
      <div className="px-4 mb-2">
        <Popover>
          <PopoverTrigger asChild>
            <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium text-sm shadow-md hover:bg-primary/90 hover:shadow-lg transition-all active:scale-[0.98]">
              <Plus className="w-5 h-5" />
              {t("New")}
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="bottom"
            align="start"
            sideOffset={8}
            className="w-56 p-2 bg-popover border-border"
          >
            <div className="space-y-2">
              {newDocTypes.map(({ type, label }) => {
                const doc = getDocConfig(type);
                const Icon = doc.icon;
                return (
                  <Link
                    key={type}
                    href={getNewUrl(type)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                      // Light mode: use doc colors; Dark mode: use custom dark styles
                      doc.bgColor,
                      "dark:bg-white/5 dark:hover:bg-white/10 dark:border dark:border-white/5",
                    )}
                  >
                    {getAppIcon(type) ? (
                      <img src={getAppIcon(type)!} alt="" className="w-6 h-6 object-contain" />
                    ) : (
                    <Icon
                      className={cn(
                        "w-5 h-5",
                        doc.color,
                        // Ensure icons are vibrant in dark mode
                        "dark:text-primary dark:filter dark:brightness-125",
                      )}
                    />
                    )}
                    <span className="text-sm font-medium text-foreground dark:text-slate-200">
                      {label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <nav className="flex-1 px-4 py-2 space-y-1">
        {sidebarItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors text-sm font-medium",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-foreground hover:bg-sidebar-hover hover:text-foreground",
              )}
            >
              <item.icon
                className={cn(
                  "w-5 h-5",
                  isActive ? "text-primary" : "text-text-secondary",
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 space-y-1">
        {!BACKEND_ENABLED && !hasExtension && EXTENSION_STORE_URL && (
          <a
            href={EXTENSION_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group mb-3 block rounded-xl border border-primary/20 bg-linear-to-br from-primary/10 via-background to-orange-500/10 p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md hover:shadow-primary/5"
          >
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-foreground">
                    {t("Get Extension")}
                  </span>
                  <span className="rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-medium text-primary ring-1 ring-primary/10">
                    Chrome
                  </span>
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-text-secondary">
                  {t("Make your browser an Office app")}
                </p>
              </div>
            </div>
          </a>
        )}
        <Link
          href="/settings"
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors rounded-md",
            pathname === "/settings"
              ? "bg-primary/10 text-primary"
              : "text-text-secondary hover:text-foreground hover:bg-sidebar-hover",
          )}
        >
          <Settings
            className={cn(
              "w-5 h-5",
              pathname === "/settings" ? "text-primary" : "text-text-secondary",
            )}
          />
          {t("Settings")}
        </Link>

        <Link
          href="/about"
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors rounded-md",
            pathname === "/about"
              ? "bg-primary/10 text-primary"
              : "text-text-secondary hover:text-foreground hover:bg-sidebar-hover",
          )}
        >
          <Info
            className={cn(
              "w-5 h-5",
              pathname === "/about" ? "text-primary" : "text-text-secondary",
            )}
          />
          {t("About")}
        </Link>

        {BACKEND_ENABLED && user && (
          <div className="mt-2 pt-3 border-t border-border dark:border-white/10 flex items-center gap-2 px-3">
            <UserRound className="w-5 h-5 text-text-secondary shrink-0" />
            <span className="flex-1 min-w-0" title={user.name}>
              <span className="block truncate text-sm font-medium">{user.name}</span>
              <span className="block truncate text-xs text-text-secondary">
                {user.role === "ogretmen" ? t("Teacher") : user.sinif || t("Student")}
              </span>
            </span>
            <button
              onClick={() => logout()}
              title={t("Sign out")}
              aria-label={t("Sign out")}
              className="p-1.5 rounded-md text-text-secondary hover:text-foreground hover:bg-sidebar-hover"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
