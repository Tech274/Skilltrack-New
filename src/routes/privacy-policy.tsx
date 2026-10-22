import { createFileRoute, redirect } from "@tanstack/react-router";
import { legacyLocationHref } from "@/lib/legacy-redirects";

export const Route = createFileRoute("/privacy-policy")({
  beforeLoad: ({ location }) => {
    throw redirect({
      href: legacyLocationHref("/privacy-policy", location.href),
      statusCode: 301,
    });
  },
});
