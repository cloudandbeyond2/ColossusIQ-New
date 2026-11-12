"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Fi } from "@/components/ui/icon";
import { Button, inputClass, Spinner } from "@/components/ui/primitives";

/** Accessible destructive-action dialog. High-impact records require typing the record ID. */
export function ConfirmDelete({
  open,
  recordId,
  recordName,
  singular = "record",
  title,
  description,
  confirmLabel = "Delete",
  warning,
  strong,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  recordId?: string;
  recordName: string;
  singular?: string;
  title?: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  warning?: string;
  strong?: boolean;
  busy?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [typed, setTyped] = useState("");
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;
  const canDelete = !strong || (Boolean(recordId) && typed.trim() === recordId);

  // Portal to <body> so no ancestor transform/overflow can clip the overlay.
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" role="alertdialog" aria-modal="true" aria-labelledby="del-title" aria-describedby="del-desc">
      <button className="absolute inset-0 bg-[#0b1020]/55 backdrop-blur-sm" aria-label="Cancel" tabIndex={-1} onClick={() => !busy && onCancel()} />
      <div className="animate-fade-up relative w-full max-w-md rounded-3xl border border-line bg-surface p-6 shadow-2xl">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-rose-soft text-xl text-rose">
          <Fi name="trash" />
        </span>
        <h2 id="del-title" className="mt-4 text-lg font-semibold text-ink">
          {title ?? `Delete ${singular.toLowerCase()}?`}
        </h2>
        <div id="del-desc" className="mt-1.5 space-y-2 text-sm text-ink-2">
          {description ? (
            description
          ) : (
            <p>
              <span className="font-medium text-ink">{recordName}</span> {recordId ? <span className="font-mono text-xs text-ink-3">({recordId})</span> : null} will be permanently removed.
            </p>
          )}
          {warning ? <p className="rounded-xl bg-amber-soft px-3 py-2 text-ink">{warning}</p> : null}
        </div>
        {strong && recordId ? (
          <div className="mt-4 space-y-1.5">
            <label htmlFor="del-confirm" className="text-sm text-ink">
              Type <span className="font-mono font-semibold">{recordId}</span> to confirm
            </label>
            <input id="del-confirm" className={inputClass} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} />
          </div>
        ) : null}
        {error ? (
          <p className="mt-3 text-sm text-rose" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-6 flex justify-end gap-2">
          <Button ref={cancelRef} variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={!canDelete || busy}>
            {busy ? <Spinner /> : <Fi name="trash" />} {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
