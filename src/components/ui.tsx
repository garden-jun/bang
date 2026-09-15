"use client";

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }) {
  const base = "rounded-md px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40";
  const styles = {
    primary: "bg-amber-600 text-black hover:bg-amber-500",
    ghost: "border border-white/20 text-white/90 hover:bg-white/10",
    danger: "bg-red-700 text-white hover:bg-red-600",
  }[variant];
  return <button className={`${base} ${styles} ${className}`} {...props} />;
}

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`rounded-md border border-white/20 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-white/40 focus:border-amber-500 ${className}`}
      {...props}
    />
  );
}

export function Panel({ title, children, className = "" }: { title?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-white/10 bg-white/5 p-4 ${className}`}>
      {title && <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-amber-400">{title}</h2>}
      {children}
    </section>
  );
}

export function ErrorBanner({ message, onClose }: { message: string | null; onClose?: () => void }) {
  if (!message) return null;
  return (
    <div className="flex items-center justify-between rounded-md border border-red-500/40 bg-red-900/40 px-3 py-2 text-sm text-red-100">
      <span>{message}</span>
      {onClose && (
        <button className="ml-3 text-red-200/70 hover:text-white" onClick={onClose} aria-label="닫기">
          ✕
        </button>
      )}
    </div>
  );
}

export function NicknameForm({
  initial,
  onSubmit,
  busy,
}: {
  initial: string;
  onSubmit: (nickname: string) => void;
  busy?: boolean;
}) {
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const v = new FormData(e.currentTarget).get("nickname");
        if (typeof v === "string" && v.trim()) onSubmit(v.trim());
      }}
    >
      <Input name="nickname" defaultValue={initial} maxLength={12} placeholder="닉네임 (1~12자)" autoFocus className="flex-1" />
      <Button type="submit" disabled={busy}>
        입장
      </Button>
    </form>
  );
}
