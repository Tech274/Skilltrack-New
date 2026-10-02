import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy /packs alias → Marketplace shelf. */
export const Route = createFileRoute("/packs")({
  beforeLoad: () => {
    throw redirect({ to: "/marketplace" });
  },
});
