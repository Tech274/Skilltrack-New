import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { MailCheck, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { resendPasswordReset } from "@/lib/password-reset.functions";

export const Route = createFileRoute("/auth/password-reset-sent")({
  head: () => ({
    meta: [
      { title: "Password reset sent — SkillTrack-365" },
      { name: "description", content: "Password reset emails have been sent. Check your inbox." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PasswordResetSentPage,
});

const recipients = [
  "admin@skillbridge365.co.in",
  "satish@skillbridge365.co.in",
];

function PasswordResetSentPage() {
  const fnResend = useServerFn(resendPasswordReset);
  const resend = useMutation({
    mutationFn: (email: string) => fnResend({ data: { email } }),
    onSuccess: (r: any) => toast.success("Password reset resent", { description: `A new reset link was sent to ${r.email}.` }),
    onError: (e: any) => toast.error(e?.message ?? "Failed to resend password reset"),
  });

  return (
    <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-xl p-8 shadow-elevated text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
        <MailCheck className="h-6 w-6" />
      </div>

      <h1 className="text-2xl font-semibold tracking-tight">Password reset sent</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Password reset emails were sent successfully. Each recipient can click the link in their inbox to choose a new password.
      </p>

      <ul className="mt-6 space-y-2 rounded-md border border-border bg-surface p-4 text-left">
        {recipients.map((email) => (
          <li key={email} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-3 min-w-0" title={email}>
              <MailCheck className="h-4 w-4 text-primary shrink-0" />
              <span className="font-medium text-foreground truncate">{email}</span>
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={resend.isPending}
              onClick={() => resend.mutate(email)}
              className="shrink-0"
            >
              <RefreshCw size={14} className={`mr-1.5 ${resend.isPending ? "animate-spin" : ""}`} />
              Resend
            </Button>
          </li>
        ))}
      </ul>

      <Link
        to="/auth"
        className="mt-8 block w-full rounded-md bg-gradient-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-card transition-transform hover:scale-[1.01]"
      >
        Back to sign in
      </Link>
    </div>
  );
}

