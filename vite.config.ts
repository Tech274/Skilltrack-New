// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";
import type { Plugin } from "vite";

/**
 * Pull large dependencies out of the entry chunk. Route components and loaders
 * are already split by the TanStack Start router plugin (dynamic import, rendered
 * inside Suspense — the same contract as React.lazy). These groups are the
 * vendors that were still landing in the ~900KB entry.
 */
function vendorChunk(id: string): string | undefined {
  const pkg = packageName(id);
  if (!pkg) return undefined;

  if (pkg === "react" || pkg === "react-dom" || pkg === "scheduler") return "vendor-react";
  if (pkg.startsWith("@tanstack/")) return "vendor-tanstack";
  if (pkg.startsWith("@radix-ui/")) return "vendor-radix";
  if (pkg === "zod") return "vendor-zod";
  if (pkg.startsWith("@supabase/")) return "vendor-supabase";
  if (pkg === "lucide-react") return "vendor-icons";
  if (
    pkg === "recharts" ||
    pkg.startsWith("d3-") ||
    pkg === "victory-vendor" ||
    pkg === "internmap"
  ) {
    return "vendor-charts";
  }
  if (
    pkg === "jspdf" ||
    pkg === "html2canvas" ||
    pkg === "canvg" ||
    pkg === "pdf-lib" ||
    pkg === "pdf-parse" ||
    pkg === "pdfjs-dist" ||
    pkg === "mammoth" ||
    pkg === "xlsx" ||
    pkg === "jszip" ||
    pkg.startsWith("@pdf-lib/")
  ) {
    return "vendor-docs";
  }
  if (pkg === "stripe" || pkg.startsWith("@stripe/")) return "vendor-stripe";
  if (
    pkg === "react-markdown" ||
    pkg === "remark-parse" ||
    pkg === "remark-gfm" ||
    pkg === "rehype-raw" ||
    pkg === "unified" ||
    pkg === "mdast-util-to-hast" ||
    pkg.startsWith("micromark")
  ) {
    return "vendor-markdown";
  }
  return undefined;
}

function packageName(id: string): string | undefined {
  const marker = "node_modules/";
  const idx = id.lastIndexOf(marker);
  if (idx === -1) return undefined;
  const parts = id.slice(idx + marker.length).split("/");
  if (!parts[0]) return undefined;
  if (parts[0].startsWith("@")) return parts[1] ? `${parts[0]}/${parts[1]}` : undefined;
  return parts[0];
}

function vendorChunksPlugin(): Plugin {
  return {
    name: "skilltrack-vendor-chunks",
    apply: "build",
    outputOptions(options) {
      // Client entry only. The SSR/Nitro build must keep its own chunk graph.
      if (this.environment?.name !== "client") return options;
      const previous = options.manualChunks;
      return {
        ...options,
        manualChunks(id, meta) {
          const vendor = vendorChunk(id);
          if (vendor) return vendor;
          if (typeof previous === "function") return previous(id, meta);
          return undefined;
        },
      };
    },
  };
}

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
    router: {
      // Compile each route's component and loader into its own async chunk.
      autoCodeSplitting: true,
      codeSplittingOptions: {
        defaultBehavior: [
          ["loader"],
          ["component"],
          ["pendingComponent"],
          ["errorComponent"],
          ["notFoundComponent"],
        ],
      },
    },
  },
  vite: {
    plugins: [mcpPlugin(), vendorChunksPlugin()],
    build: {
      chunkSizeWarningLimit: 700,
    },
  },
});
