"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useExtracted } from "next-intl";
import { cn } from "@/lib/utils";

export interface PromptDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  /** Show a text input with this initial value. Omit for a confirmation. */
  defaultValue?: string;
  /** Select this many characters of the initial value (e.g. name without extension). */
  selectLength?: number;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: (value: string) => void | Promise<void>;
  onClose: () => void;
}

export function PromptDialog({
  open,
  title,
  description,
  defaultValue,
  selectLength,
  confirmLabel,
  destructive,
  onConfirm,
  onClose,
}: PromptDialogProps) {
  const t = useExtracted();
  const [value, setValue] = useState(defaultValue ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const hasInput = defaultValue !== undefined;

  useEffect(() => {
    if (!open) return;
    setValue(defaultValue ?? "");
    setError("");
    setBusy(false);
    requestAnimationFrame(() => {
      const input = inputRef.current;
      if (input) {
        input.focus();
        input.setSelectionRange(0, selectLength ?? input.value.length);
      }
    });
  }, [open, defaultValue, selectLength]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasInput && !value.trim()) return;
    setBusy(true);
    setError("");
    try {
      await onConfirm(value.trim());
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-black/40 p-4 animate-in fade-in duration-150"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-xl bg-card dark:bg-[#1c1c1c] border border-border dark:border-white/10 shadow-2xl p-6 space-y-4"
      >
        <h2 className="text-lg font-semibold">{title}</h2>
        {description && <div className="text-sm text-text-secondary">{description}</div>}
        {hasInput && (
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-lg text-sm hover:bg-muted dark:hover:bg-white/10"
          >
            {t("Cancel")}
          </button>
          <button
            type="submit"
            disabled={busy}
            className={cn(
              "h-9 px-4 rounded-lg text-sm font-medium text-white disabled:opacity-60",
              destructive ? "bg-destructive hover:bg-destructive/90" : "bg-primary hover:bg-primary/90",
            )}
          >
            {confirmLabel || t("OK")}
          </button>
        </div>
      </form>
    </div>
  );
}
