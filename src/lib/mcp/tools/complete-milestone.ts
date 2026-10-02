import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, requireAuth, supabaseForUser } from "../supabase";

export default defineTool({
  name: "complete_milestone",
  title: "Complete or reopen a milestone",
  description:
    "Mark one of the signed-in user's study milestones as completed, or reopen it by clearing its completion timestamp.",
  inputSchema: {
    milestone_id: z.string().describe("The milestone id returned by list_milestones."),
    completed: z.boolean().describe("True to mark completed, false to reopen the milestone."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ milestone_id, completed }, ctx) => {
    if (!requireAuth(ctx)) return errorResult("Not authenticated.");
    const id = (milestone_id ?? "").trim();
    if (!id) return errorResult("milestone_id is required.");

    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("study_milestones")
      .update({ completed_at: completed ? new Date().toISOString() : null } as never)
      .eq("id", id)
      .select("id,title,completed_at")
      .maybeSingle();

    if (error) return errorResult(error.message);
    if (!data) return errorResult("Milestone not found, or you do not have access to it.");

    return {
      content: [{ type: "text", text: completed ? `Completed "${data.title}".` : `Reopened "${data.title}".` }],
      structuredContent: { milestone: data },
    };
  },
});
