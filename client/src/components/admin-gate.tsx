/**
 * client/src/components/admin-gate.tsx
 * ──────────────────────────────────────
 * Passcode-gated wrapper for admin pages. The passcode is checked
 * server-side (POST /api/admin/login) — this component never sees or
 * compares the real passcode itself, just the server's yes/no. On success
 * the server sets an httpOnly session cookie that every /api/admin/*
 * endpoint requires; localStorage here is only a UX shortcut so returning
 * visitors skip straight to the login check instead of always seeing the
 * form flash first.
 */

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock, LogOut, Loader2 } from "lucide-react";
import { BrandMonogram } from "@/components/brand-mark";
import config from "@/lib/tenant";

const AUTH_KEY = "generalbooking:admin:auth";

function readAuth(): boolean {
  try {
    return localStorage.getItem(AUTH_KEY) === "1";
  } catch {
    return false;
  }
}

function writeAuth(v: boolean) {
  try {
    if (v) localStorage.setItem(AUTH_KEY, "1");
    else localStorage.removeItem(AUTH_KEY);
  } catch {
    /* quota / disabled */
  }
}

export function useAdminAuth() {
  const [authed, setAuthed] = useState<boolean>(() => readAuth());
  return {
    authed,
    login: () => {
      writeAuth(true);
      setAuthed(true);
    },
    logout: () => {
      writeAuth(false);
      setAuthed(false);
      fetch("/api/admin/logout", { method: "POST" }).catch(() => {});
    },
  };
}

export function AdminLogout() {
  const { logout } = useAdminAuth();
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={logout}
      className="text-sidebar-foreground/70 hover:text-sidebar-foreground"
      data-testid="button-admin-logout"
    >
      <LogOut className="size-4 mr-2" /> Log out
    </Button>
  );
}

export function AdminGate({ children }: { children: React.ReactNode }) {
  const { authed, login, logout } = useAdminAuth();
  const [checking, setChecking] = useState(true);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // The local flag just says "you logged in before" — confirm the session
  // cookie is actually still valid (it expires, and a redeploy invalidates
  // it) before trusting it, so an expired session shows the login form
  // instead of a broken/empty admin panel.
  useEffect(() => {
    if (!authed) {
      setChecking(false);
      return;
    }
    fetch("/api/admin/session")
      .then((res) => {
        if (!res.ok) logout();
      })
      .catch(() => logout())
      .finally(() => setChecking(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen grid place-items-center bg-sidebar text-sidebar-foreground">
        <Loader2 className="size-6 animate-spin opacity-60" />
      </div>
    );
  }

  if (authed) return <>{children}</>;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode: code }),
      });
      if (res.ok) {
        login();
      } else if (res.status === 429) {
        setError("Too many attempts. Please wait a while and try again.");
        setCode("");
      } else {
        setError("Incorrect passcode. Please try again.");
        setCode("");
      }
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-sidebar text-sidebar-foreground p-6">
      <Card className="w-full max-w-sm p-8 bg-card text-card-foreground border-border">
        <div className="flex flex-col items-center gap-3 mb-6">
          <BrandMonogram className="h-12 w-12" />
          <div className="text-center">
            <h1 className="font-display text-xl font-bold">Admin</h1>
            <p className="text-sm text-muted-foreground mt-1">Enter passcode to continue</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              type="password"
              autoFocus
              autoComplete="current-password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Passcode"
              className="pl-10"
              disabled={submitting}
              data-testid="input-admin-passcode"
            />
          </div>
          {error && (
            <p className="text-sm text-destructive" data-testid="text-admin-error">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={submitting || !code} data-testid="button-admin-login">
            {submitting && <Loader2 className="size-4 mr-1 animate-spin" />} Sign in
          </Button>
        </form>
        <p className="text-xs text-muted-foreground text-center mt-6">
          For {config.brand.name} staff only.
        </p>
      </Card>
    </div>
  );
}
