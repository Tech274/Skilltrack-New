import { createFileRoute, Outlet } from "@tanstack/react-router";

/** Layout shell so /marketplace/$type and /marketplace/$cert/$type render via Outlet. */
export const Route = createFileRoute("/marketplace")({
  component: () => <Outlet />,
});
