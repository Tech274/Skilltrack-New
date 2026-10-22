import { createFileRoute, redirect } from "@tanstack/react-router";
import { legacyLocationHref } from "@/lib/legacy-redirects";

export const Route = createFileRoute("/signup")({
  beforeLoad: ({ location }) => {
    throw redirect({
      href: legacyLocationHref("/signup", location.href),
      statusCode: 301,
    });
  },
});
