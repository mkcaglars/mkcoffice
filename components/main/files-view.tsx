"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ChevronRight,
  Eye,
  Download,
  Folder,
  FolderPlus,
  HardDrive,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import { useExtracted } from "next-intl";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DocumentIcon } from "@/components/document-icon";
import { getAppIcon, getDocConfig } from "@/lib/document-types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PromptDialog, type PromptDialogProps } from "@/components/ui/prompt-dialog";
import { usePageTitle } from "@/hooks/use-page-title";
import { useAuthStore } from "@/store/auth";
import {
  downloadUrl,
  editorUrl,
  files as filesApi,
  filesUrl,
  formatSize,
  newDocumentUrl,
  type FileItem,
} from "@/utils/backend";
import { getFileExt } from "@/utils/editor/utils";

const ACCEPT =
  ".docx,.doc,.odt,.rtf,.txt,.xlsx,.xls,.ods,.csv,.pptx,.ppt,.odp,.pdf,.docm,.dotx,.xlsm,.xltx,.pptm,.potx,.ppsx,.epub,.vsdx";

type DialogState = Omit<PromptDialogProps, "open" | "onClose"> | null;

export function FilesView() {
  const t = useExtracted();
  usePageTitle(t("My Files — MKC Ofis"));
  const router = useRouter();
  const searchParams = useSearchParams();
  const path = searchParams.get("path") || "";
  // A teacher viewing a student's files (read-only, enforced by the server).
  const owner = searchParams.get("owner");
  const uploadLimit = useAuthStore((s) => s.uploadLimit);

  const [items, setItems] = useState<FileItem[] | null>(null);
  const [ownerInfo, setOwnerInfo] = useState<{ name: string; sinif: string } | null>(null);
  const [usage, setUsage] = useState<{ usage: number; quota: number } | null>(null);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(0);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await filesApi.list(path, owner);
      setOwnerInfo(res.owner ? { name: res.owner.name, sinif: res.owner.sinif } : null);
      res.items.sort((a, b) =>
        a.type !== b.type
          ? a.type === "dir" ? -1 : 1
          : a.name.localeCompare(b.name, undefined, { numeric: true }),
      );
      setItems(res.items);
      setUsage(res.quota ? { usage: res.usage || 0, quota: res.quota } : null);
    } catch (err) {
      setError((err as Error).message);
      setItems([]);
    }
  }, [path, owner]);

  useEffect(() => {
    setItems(null);
    load();
  }, [load]);

  const upload = useCallback(
    async (list: File[]) => {
      if (!list.length) return;
      const tooBig = list.find((f) => uploadLimit && f.size > uploadLimit);
      if (tooBig) {
        toast.error(
          t("{name} is larger than the upload limit ({limit})", {
            name: tooBig.name,
            limit: formatSize(uploadLimit),
          }),
        );
        return;
      }
      setUploading((n) => n + list.length);
      try {
        // One request per file keeps each request under the server limit.
        for (const file of list) {
          try {
            await filesApi.upload(path, [file]);
          } catch (err) {
            toast.error(`${file.name}: ${(err as Error).message}`);
          }
        }
      } finally {
        setUploading((n) => n - list.length);
        load();
      }
    },
    [path, load, uploadLimit, t],
  );

  // Files dropped anywhere on the page (see the main layout) land here.
  useEffect(() => {
    const onUpload = (e: Event) => {
      if (owner) {
        toast.error(t("Student files are read-only."));
        return;
      }
      upload((e as CustomEvent<File[]>).detail);
    };
    window.addEventListener("office:upload", onUpload);
    return () => window.removeEventListener("office:upload", onUpload);
  }, [upload, owner, t]);

  const segments = path ? path.split("/") : [];

  const open = (item: FileItem) => {
    router.push(item.type === "dir" ? filesUrl(item.path, owner) : editorUrl(item.path, owner));
  };

  const move = async (from: string, toDir: string) => {
    if (from === toDir || from.split("/").slice(0, -1).join("/") === toDir) return;
    try {
      await filesApi.move(from, toDir);
      load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const newFolder = () =>
    setDialog({
      title: t("New folder"),
      defaultValue: t("New folder"),
      confirmLabel: t("Create"),
      onConfirm: async (name) => {
        await filesApi.mkdir(path, name);
        load();
      },
    });

  const rename = (item: FileItem) => {
    const ext = item.type === "file" ? getFileExt(item.name) : "";
    setDialog({
      title: t("Rename"),
      defaultValue: item.name,
      selectLength: ext ? item.name.length - ext.length - 1 : undefined,
      confirmLabel: t("Rename"),
      onConfirm: async (name) => {
        await filesApi.rename(item.path, name);
        load();
      },
    });
  };

  const remove = (item: FileItem) =>
    setDialog({
      title: item.type === "dir" ? t("Delete folder?") : t("Delete file?"),
      description:
        item.type === "dir"
          ? t("“{name}” and everything inside it will be permanently deleted.", { name: item.name })
          : t("“{name}” will be permanently deleted.", { name: item.name }),
      confirmLabel: t("Delete"),
      destructive: true,
      onConfirm: async () => {
        await filesApi.remove(item.path);
        load();
      },
    });

  const dragProps = (dir: string) => owner ? {} : ({
    onDragOver: (e: React.DragEvent) => {
      if (e.dataTransfer.types.includes("application/x-office-path")) {
        e.preventDefault();
        e.stopPropagation();
        setDropTarget(dir);
      }
    },
    onDragLeave: () => setDropTarget((d) => (d === dir ? null : d)),
    onDrop: (e: React.DragEvent) => {
      const from = e.dataTransfer.getData("application/x-office-path");
      if (from) {
        e.preventDefault();
        setDropTarget(null);
        move(from, dir);
      }
    },
  });

  const newTypes = [
    { type: "docx", label: t({ id: "Document", message: "Document" }) },
    { type: "xlsx", label: t({ id: "Spreadsheet", message: "Spreadsheet" }) },
    { type: "pptx", label: t({ id: "Presentation", message: "Presentation" }) },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {owner ? (
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/students/"
              aria-label={t("Back to students")}
              className="h-9 w-9 shrink-0 rounded-lg border border-border hover:bg-muted dark:hover:bg-white/10 flex items-center justify-center"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight truncate">
                {ownerInfo?.name || owner}
              </h1>
              <p className="text-sm text-text-secondary flex items-center gap-1.5">
                <Eye className="w-4 h-4" />
                {ownerInfo?.sinif ? `${ownerInfo.sinif} · ` : ""}
                {t("Read-only")}
              </p>
            </div>
          </div>
        ) : (
          <h1 className="text-2xl font-bold tracking-tight">{t("My Files")}</h1>
        )}
        {!owner && (
        <div className="flex flex-wrap items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <button className="h-9 px-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium shadow-sm hover:bg-primary/90 flex items-center gap-1.5">
                <Plus className="w-4 h-4" />
                {t("New")}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-52 p-1.5 bg-popover border-border">
              {newTypes.map(({ type, label }) => {
                const Icon = getDocConfig(type).icon;
                return (
                  <Link
                    key={type}
                    href={newDocumentUrl(type, path)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm hover:bg-muted dark:hover:bg-white/10"
                  >
                    {getAppIcon(type) ? (
                      <img src={getAppIcon(type)!} alt="" className="w-5 h-5 object-contain" />
                    ) : (
                      <Icon className={cn("w-4 h-4", getDocConfig(type).color)} />
                    )}
                    {label}
                  </Link>
                );
              })}
              <div className="my-1 border-t border-border" />
              <button
                onClick={newFolder}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm hover:bg-muted dark:hover:bg-white/10"
              >
                <FolderPlus className="w-4 h-4 text-text-secondary" />
                {t("Folder")}
              </button>
            </PopoverContent>
          </Popover>
          <button
            onClick={() => inputRef.current?.click()}
            className="h-9 px-3 rounded-lg border border-border text-sm font-medium hover:bg-muted dark:hover:bg-white/10 flex items-center gap-1.5"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {t("Upload")}
          </button>
          <button
            onClick={load}
            title={t("Refresh")}
            aria-label={t("Refresh")}
            className="h-9 w-9 rounded-lg border border-border hover:bg-muted dark:hover:bg-white/10 flex items-center justify-center"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => {
              upload(Array.from(e.target.files || []));
              e.target.value = "";
            }}
          />
        </div>
        )}
      </div>

      {/* Breadcrumbs; each crumb is also a drop target for moving items */}
      <nav className="flex flex-wrap items-center gap-1 text-sm">
        {["", ...segments].map((segment, i) => {
          const crumbPath = segments.slice(0, i).join("/");
          const last = i === segments.length;
          return (
            <span key={crumbPath + i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="w-4 h-4 text-text-secondary" />}
              <Link
                href={filesUrl(crumbPath, owner)}
                {...dragProps(crumbPath)}
                className={cn(
                  "px-2 py-1 rounded-md flex items-center gap-1.5 hover:bg-muted dark:hover:bg-white/10",
                  last ? "font-semibold" : "text-text-secondary",
                  dropTarget === crumbPath && "ring-2 ring-primary bg-primary/10",
                )}
              >
                {i === 0 && <HardDrive className="w-4 h-4" />}
                {i === 0 ? (owner ? ownerInfo?.name || owner : t("My Files")) : segment}
              </Link>
            </span>
          );
        })}
      </nav>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {items === null ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-text-secondary" />
        </div>
      ) : items.length === 0 && owner ? (
        <p className="py-16 text-center text-sm text-text-secondary">
          {t("This folder is empty")}
        </p>
      ) : items.length === 0 ? (
        <div
          onClick={() => inputRef.current?.click()}
          className="cursor-pointer border-2 border-dashed border-border rounded-2xl py-16 px-6 flex flex-col items-center gap-3 text-center hover:border-primary/50 transition-colors"
        >
          <Upload className="w-8 h-8 text-text-secondary" />
          <p className="font-medium">{t("This folder is empty")}</p>
          <p className="text-sm text-text-secondary">
            {t("Drop files here or click to upload. You can also create a new document.")}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border dark:border-white/10 overflow-hidden">
          <div className="hidden sm:grid grid-cols-[1fr_160px_100px_44px] gap-2 px-4 py-2 text-xs font-medium text-text-secondary bg-muted/50 dark:bg-white/5 border-b border-border dark:border-white/10">
            <span>{t("Name")}</span>
            <span>{t("Modified")}</span>
            <span className="text-right">{t("Size")}</span>
            <span />
          </div>
          <ul>
            {items.map((item) => (
              <li
                key={item.path}
                draggable={!owner}
                onDragStart={(e) => {
                  e.dataTransfer.setData("application/x-office-path", item.path);
                  e.dataTransfer.effectAllowed = "move";
                }}
                {...(item.type === "dir" ? dragProps(item.path) : {})}
                onDoubleClick={() => open(item)}
                className={cn(
                  "group grid grid-cols-[1fr_44px] sm:grid-cols-[1fr_160px_100px_44px] gap-2 items-center px-4 py-2 border-b last:border-b-0 border-border dark:border-white/5 hover:bg-muted/60 dark:hover:bg-white/5",
                  dropTarget === item.path && "ring-2 ring-inset ring-primary bg-primary/10",
                )}
              >
                <button
                  onClick={() => open(item)}
                  className="flex items-center gap-3 min-w-0 text-left"
                >
                  {item.type === "dir" ? (
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-amber-50 dark:bg-amber-900/30 shrink-0">
                      <Folder className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    </div>
                  ) : (
                    <DocumentIcon type={getFileExt(item.name)} size="sm" className="shrink-0" />
                  )}
                  <span className="truncate text-sm font-medium group-hover:text-primary">
                    {item.name}
                  </span>
                </button>
                <span className="hidden sm:block text-sm text-text-secondary">
                  {new Date(item.mtime * 1000).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
                <span className="hidden sm:block text-sm text-text-secondary text-right">
                  {item.type === "file" ? formatSize(item.size) : ""}
                </span>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      aria-label={t("More actions")}
                      className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-muted dark:hover:bg-white/10"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-44 p-1.5 bg-popover border-border">
                    {item.type === "file" && (
                      <a
                        href={downloadUrl(item.path, owner)}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm hover:bg-muted dark:hover:bg-white/10"
                      >
                        <Download className="w-4 h-4" />
                        {t("Download")}
                      </a>
                    )}
                    {!owner && (<>
                    <button
                      onClick={() => rename(item)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm hover:bg-muted dark:hover:bg-white/10"
                    >
                      <Pencil className="w-4 h-4" />
                      {t("Rename")}
                    </button>
                    <button
                      onClick={() => remove(item)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-4 h-4" />
                      {t("Delete")}
                    </button>
                    </>)}
                  </PopoverContent>
                </Popover>
              </li>
            ))}
          </ul>
        </div>
      )}

      {usage && (
        <div className="max-w-xs space-y-1.5">
          <div className="h-1.5 rounded-full bg-muted dark:bg-white/10 overflow-hidden">
            <div
              className="h-full bg-primary"
              style={{ width: `${Math.min(100, (usage.usage / usage.quota) * 100)}%` }}
            />
          </div>
          <p className="text-xs text-text-secondary">
            {t("{used} of {total} used", {
              used: formatSize(usage.usage),
              total: formatSize(usage.quota),
            })}
          </p>
        </div>
      )}

      {!owner && (
        <p className="text-xs text-text-secondary">
          {t("Tip: drag a file onto a folder or a breadcrumb to move it.")}
        </p>
      )}

      <PromptDialog
        open={dialog !== null}
        onClose={() => setDialog(null)}
        {...(dialog || { title: "", onConfirm: () => {} })}
      />
    </div>
  );
}
