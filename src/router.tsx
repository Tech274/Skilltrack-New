import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

function RoutePending() {
  return <div className="min-h-[40vh]" aria-busy="true" />;
}

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // Loader/component chunks (see vite router.autoCodeSplitting) suspend here
    // until the route module arrives. Matches the React.lazy + Suspense contract.
    defaultPendingMs: 200,
    defaultPendingComponent: RoutePending,
  });

  return router;
};
