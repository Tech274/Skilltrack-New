import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, requireAuth, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_learning_paths",
  title: "List learning paths",
  description:
    "List learning paths visible to the signed-in user, including title, difficulty, estimated hours, target certification and step count.",
  inputSchema: {
    query: z.string().describe("Optional free-text filter on the learning path title. Empty string returns all."),
    limit: z.number().int().describe("Maximum number of paths to return (1-25). Defaults to 10."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, limit }, ctx) => {
    if (!requireAuth(ctx)) return errorResult("Not authenticated.");
    const take = Math.min(Math.max(Number(limit) || 10, 1), 25);
    const supabase = supabaseForUser(ctx);

    let builder = supabase
      .from("learning_paths")
      .select("id,title,description,difficulty,estimated_hours,target_certification_slug,status,steps")
      .order("updated_at", { ascending: false })
      .limit(take);

    const q = (query ?? "").trim();
    if (q) builder = builder.ilike("title", `%${q}%`);

    const { data, error } = await builder;
    if (error) return errorResult(error.message);

    const paths = (data ?? []).map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      difficulty: p.difficulty,
      estimated_hours: p.estimated_hours,
      target_certification_slug: p.target_certification_slug,
      status: p.status,
      step_count: Array.isArray(p.steps) ? p.steps.length : 0,
    }));

    return {
      content: [{ type: "text", text: JSON.stringify(paths, null, 2) }],
      structuredContent: { learning_paths: paths },
    };
  },
});
