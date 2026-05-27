"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "./icon";

export type ToastKind = "error" | "info" | "success";
export type Toast = { id: number; kind: ToastKind; message: string };

const AUTO_DISMISS_MS = 20_000;

// Lightweight queue. Returned `push` schedules an auto-dismiss timer; the
// hook also clears any pending timers when the host unmounts so stale
// setTimeout callbacks can't fire on a torn-down tree.
export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t) {
      clearTimeout(t);
      timers.current.delete(id);
    }
    setToasts((ts) => ts.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (toast: Omit<Toast, "id">) => {
      const id = nextId.current++;
      setToasts((ts) => [...ts, { ...toast, id }]);
      const handle = setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
      timers.current.set(id, handle);
      return id;
    },
    [dismiss],
  );

  useEffect(() => {
    const map = timers.current;
    return () => {
      for (const handle of map.values()) clearTimeout(handle);
      map.clear();
    };
  }, []);

  return { toasts, push, dismiss };
}

export function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div
      aria-live="polite"
      style={{
        position: "fixed",
        bottom: 20,
        left: 20,
        zIndex: 1000,
        display: "flex",
        flexDirection: "column-reverse",
        gap: 8,
        pointerEvents: "none",
        maxWidth: 380,
      }}
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: number) => void;
}) {
  const accent =
    toast.kind === "error"
      ? "var(--blossom-700)"
      : toast.kind === "success"
        ? "var(--sage-700)"
        : "var(--ink-500)";
  return (
    <div
      role={toast.kind === "error" ? "alert" : "status"}
      style={{
        pointerEvents: "auto",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderLeft: `4px solid ${accent}`,
        borderRadius: "var(--radius-md)",
        padding: "10px 10px 10px 14px",
        boxShadow: "var(--shadow-md)",
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        fontFamily: "var(--font-body)",
        fontSize: 13,
        color: "var(--ink-900)",
        lineHeight: 1.4,
        minWidth: 240,
      }}
    >
      <span style={{ flex: 1, paddingTop: 1 }}>{toast.message}</span>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => onDismiss(toast.id)}
        style={{
          border: "none",
          background: "transparent",
          padding: 4,
          margin: -2,
          cursor: "pointer",
          color: "var(--ink-500)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 6,
        }}
      >
        <Icon name="x" size={12} />
      </button>
    </div>
  );
}
