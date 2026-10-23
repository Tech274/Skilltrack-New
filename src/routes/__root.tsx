import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { SiteHeader, SiteFooter } from "../components/site-layout";
import { BRAND } from "../lib/brand";
import { themeInitScript } from "../components/theme-toggle";

function NotFoundComponent() {
  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-mesh" aria-hidden />
      <div className="relative mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-6 py-24 text-center">
        <p className="font-mono text-xs uppercase tracking-wider text-accent">SkillTrack-365</p>
        <p className="mt-4 text-7xl font-semibold tracking-tight text-gradient" aria-hidden>
          404
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          Page not found
        </h1>
        <p className="mt-3 max-w-md text-sm text-muted-foreground md:text-base">
          That link doesn&apos;t match a page on SkillTrack. It may have moved. Head home, or browse
          certification guides to pick a vendor and open a path.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-gradient-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-card transition-transform hover:scale-[1.02]"
          >
            Back home
          </Link>
          <Link
            to="/certifications"
            className="inline-flex items-center justify-center rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-elevated"
          >
            Browse certifications
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: import("@tanstack/react-router").ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "SkillTrack-365 — Certification Intelligence & Career Growth Platform" },
      {
        name: "description",
        content:
          "Discover, compare, prepare for, and pass professional certifications. AI Career Advisor, Pass Predictor, salary intelligence, and enterprise workforce readiness.",
      },
      { name: "author", content: "SkillTrack-365" },
      { property: "og:site_name", content: "SkillTrack-365" },
      { property: "og:type", content: "website" },
      {
        property: "og:title",
        content: "SkillTrack-365 — Certification Intelligence & Career Growth Platform",
      },
      {
        property: "og:description",
        content: "Track Skills. Predict Success. Accelerate Careers.",
      },
      { name: "twitter:card", content: "summary_large_image" },
      {
        name: "twitter:title",
        content: "SkillTrack-365 — Certification Intelligence & Career Growth Platform",
      },
      {
        name: "twitter:description",
        content: "Cert Clarity + Prep from SkillTrack — pick the right certification and pass it.",
      },
      {
        property: "og:image",
        content: `https://skilltrack.co.in/__l5e/assets-v1/f6e98f8e-a6d8-4d86-b097-a61ef1fe9943/skilltrack-og.png?v=${4}`,
      },
      {
        name: "twitter:image",
        content: `https://skilltrack.co.in/__l5e/assets-v1/f6e98f8e-a6d8-4d86-b097-a61ef1fe9943/skilltrack-og.png?v=${4}`,
      },
    ],
    links: [
      { rel: "preconnect", href: "https://rsms.me", crossOrigin: "anonymous" },
      {
        rel: "preload",
        href: "https://rsms.me/inter/font-files/InterVariable.woff2",
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous",
      },
      ...(import.meta.env.VITE_SUPABASE_URL
        ? [{ rel: "preconnect" as const, href: import.meta.env.VITE_SUPABASE_URL }]
        : []),
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: BRAND.favicon },
      { rel: "apple-touch-icon", href: BRAND.favicon },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "SkillTrack-365",
          description: "AI-powered certification intelligence and career growth platform.",
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <SiteHeader />
        <main className="flex-1">
          <Outlet />
        </main>
        <SiteFooter />
      </div>
    </QueryClientProvider>
  );
}
