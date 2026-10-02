import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, requireAuth, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_my_certifications",
  title: "List my tracked certifications",
  description:
    "List the certifications the signed-in user is tracking, with status, study hours logged, target date and latest mock score.",
  inputSchema: {
    status: z
      .string()
      .describe("Optional status filter, e.g. planned, in_progress, completed. Use an empty string for all."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status }, ctx) => {
    if (!requireAuth(ctx)) return errorResult("Not authenticated.");
    const supabase = supabaseForUser(ctx);

    let builder = supabase
      .from("user_certifications")
      .select("id,certification_slug,status,study_hours,target_date,mock_score,completed_at,notes")
      .order("updated_at", { ascending: false });

    const s = (status ?? "").trim();
    if (s) builder = builder.eq("status", s as never);

    const { data, error } = await builder;
    if (error) return errorResult(error.message);

    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { tracked: data ?? [] },
    };
  },
});
