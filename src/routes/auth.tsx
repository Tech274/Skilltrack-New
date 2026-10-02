import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { BrandLogo } from "@/components/brand-logo";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Authentication — SkillTrack-365" },
      { name: "description", content: "Sign in or create your free SkillTrack-365 account." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthLayout,
});

function AuthLayout() {
  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-mesh">
      <div className="mx-auto flex max-w-md flex-col px-6 py-16">
        <Link to="/" className="mx-auto mb-8 flex items-center gap-2.5">
          <BrandLogo className="h-10 w-10 object-contain" size={40} />
          <span className="text-base font-semibold tracking-tight">
            Skilltrack<span className="text-primary">-365</span>
          </span>
        </Link>

        <Outlet />

        <p className="mt-6 text-center text-xs text-muted-foreground">
          By continuing you agree to our Terms and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
