import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/checkout/$")({
  beforeLoad: () => {
    throw redirect({ to: "/book-a-call", search: { utm_campaign: "checkout" } as any });
  },
});
