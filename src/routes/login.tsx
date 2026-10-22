import { createFileRoute, redirect } from "@tanstack/react-router";
import { legacyLocationHref } from "@/lib/legacy-redirects";

export const Route = createFileRoute("/login")({
  beforeLoad: ({ location }) => {
    throw redirect({
      href: legacyLocationHref("/login", location.href),
      statusCode: 301,
    });
  },
});
