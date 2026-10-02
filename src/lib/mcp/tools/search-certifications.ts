import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, requireAuth, supabaseForUser } from "../supabase";

export default defineTool({
  name: "search_certifications",
  title: "Search certification catalog",
  description:
    "Search the SkillTrack-365 certification catalog by name, vendor, category or skill. Returns matching published certifications with slug, vendor, level and estimated cost.",
  inputSchema: {
    query: z.string().describe("Free-text search over certification name, vendor and category."),
    limit: z.number().int().describe("Maximum number of results to return (1-25). Defaults to 10."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, limit }, ctx) => {
    if (!requireAuth(ctx)) return errorResult("Not authenticated.");
    const take = Math.min(Math.max(Number(limit) || 10, 1), 25);
    const supabase = supabaseForUser(ctx);
    const q = (query ?? "").trim();

    let builder = supabase
      .from("certifications_catalog")
      .select("slug,name,vendor,category,level,cost_usd,duration_minutes,tagline,skills")
      .eq("status", "published")
      .limit(take);

    if (q) {
      const like = `%${q}%`;
      builder = builder.or(
        `name.ilike.${like},vendor.ilike.${like},category.ilike.${like},code.ilike.${like}`,
      );
    }

    const { data, error } = await builder;
    if (error) return errorResult(error.message);

    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { certifications: data ?? [] },
    };
  },
});
