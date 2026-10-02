import { Link } from "@tanstack/react-router";
import { ShieldAlert, ShieldX, AlertTriangle } from "lucide-react";

/**
 * Friendly admin error/access-denied screen.
 * Detects "Forbidden" / "permission" errors and explains what is required
 * + how to resolve, instead of a generic stack message.
 */
export function AdminErrorScreen({
  title,
  error,
  onRetry,
}: {
  title: string;
  error: Error | unknown;
  onRetry?: () => void;
}) {
  const msg = error instanceof Error ? error.message : String(error ?? "Unknown error");
  const lower = msg.toLowerCase();

  let kind: "forbidden" | "auth" | "generic" = "generic";
  let reason = msg;
  let suggestion = "Try again, or reload the page. If the problem persists, contact your Super Admin.";

  if (lower.includes("forbidden") || lower.includes("permission") || lower.includes("not allowed")) {
    kind = "forbidden";
    // Try to pluck a `requires 'xyz' permission` phrase out
    const match = msg.match(/requires '([^']+)' permission/i);
    if (match) {
      reason = `This page requires the “${match[1]}” permission.`;
      suggestion = `Ask a Super Admin to grant your role the “${match[1]}” permission in Permissions Matrix, or to assign you a role that already holds it.`;
    } else if (lower.includes("super admin")) {
      reason = "This page is restricted to Super Admins.";
      suggestion = "Only an existing Super Admin can grant Super Admin access from the Super Admins page.";
    } else {
      reason = "Your account doesn't have the role required to view this page.";
      suggestion = "Ask a Super Admin to assign you the appropriate admin role.";
    }
  } else if (lower.includes("unauthorized") || lower.includes("no authorization") || lower.includes("not authenticated")) {
    kind = "auth";
    reason = "Your session has expired or you aren't signed in.";
    suggestion = "Sign in again to continue.";
  }

  const Icon = kind === "forbidden" ? ShieldX : kind === "auth" ? ShieldAlert : AlertTriangle;
  const tone = kind === "generic" ? "text-destructive" : "text-primary";

  return (
    <div className="mx-auto max-w-xl px-6 py-12">
      <div className="rounded-lg border border-border bg-surface p-8 text-center">
        <Icon size={40} className={`mx-auto ${tone}`} />
        <h1 className="mt-3 text-xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm font-medium">{reason}</p>
        <p className="mt-1 text-sm text-muted-foreground">{suggestion}</p>
        <div className="mt-6 flex items-center justify-center gap-2">
          {onRetry && (
            <button
              onClick={onRetry}
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-surface-elevated"
            >
              Retry
            </button>
          )}
          <Link
            to="/admin"
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-surface-elevated"
          >
            Back to Admin
          </Link>
          <Link
            to="/dashboard"
            className="rounded-md bg-gradient-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
          >
            Dashboard
          </Link>
        </div>
        {kind === "generic" && (
          <details className="mt-6 text-left text-xs text-muted-foreground">
            <summary className="cursor-pointer">Technical details</summary>
            <pre className="mt-2 whitespace-pre-wrap break-all rounded bg-surface-elevated p-3">{msg}</pre>
          </details>
        )}
      </div>
    </div>
  );
}
