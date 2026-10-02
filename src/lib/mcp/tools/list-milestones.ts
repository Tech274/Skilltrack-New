import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, requireAuth, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_milestones",
  title: "List study milestones",
  description:
    "List the signed-in user's study milestones with due dates and completion state, optionally filtered to a single certification slug.",
  inputSchema: {
    certification_slug: z.string().describe("Optional certification slug filter. Empty string returns all."),
    only_open: z.boolean().describe("When true, return only milestones that are not yet completed."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ certification_slug, only_open }, ctx) => {
    if (!requireAuth(ctx)) return errorResult("Not authenticated.");
    const supabase = supabaseForUser(ctx);

    let builder = supabase
      .from("study_milestones")
      .select("id,title,description,certification_slug,milestone_type,due_date,completed_at,order_index")
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("order_index", { ascending: true });

    const slug = (certification_slug ?? "").trim();
    if (slug) builder = builder.eq("certification_slug", slug);
    if (only_open) builder = builder.is("completed_at", null);

    const { data, error } = await builder;
    if (error) return errorResult(error.message);

    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { milestones: data ?? [] },
    };
  },
});
