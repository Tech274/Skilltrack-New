import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, requireAuth, supabaseForUser } from "../supabase";

export default defineTool({
  name: "track_certification",
  title: "Track or update a certification",
  description:
    "Start tracking a certification for the signed-in user, or update an existing tracked certification's status, target date, study hours or notes.",
  inputSchema: {
    certification_slug: z.string().describe("Catalog slug of the certification, e.g. aws-saa-c03."),
    status: z
      .string()
      .describe("Tracking status: planned, in_progress, or completed. Empty string keeps the current value."),
    target_date: z.string().describe("Target exam date as YYYY-MM-DD. Empty string leaves it unset."),
    study_hours: z.number().describe("Total study hours logged so far. Use a negative number to leave unchanged."),
    notes: z.string().describe("Free-form notes. Empty string leaves notes unchanged."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ certification_slug, status, target_date, study_hours, notes }, ctx) => {
    const userId = requireAuth(ctx);
    if (!userId) return errorResult("Not authenticated.");

    const slug = (certification_slug ?? "").trim();
    if (!slug) return errorResult("certification_slug is required.");

    const supabase = supabaseForUser(ctx);
    const { data: existing, error: readError } = await supabase
      .from("user_certifications")
      .select("id")
      .eq("certification_slug", slug)
      .maybeSingle();
    if (readError) return errorResult(readError.message);

    const patch: Record<string, unknown> = {};
    if ((status ?? "").trim()) patch.status = status.trim();
    if ((target_date ?? "").trim()) patch.target_date = target_date.trim();
    if (typeof study_hours === "number" && study_hours >= 0) patch.study_hours = study_hours;
    if ((notes ?? "").trim()) patch.notes = notes;
    if (patch.status === "completed") patch.completed_at = new Date().toISOString();

    if (existing) {
      const { data, error } = await supabase
        .from("user_certifications")
        .update(patch as never)
        .eq("id", existing.id)
        .select()
        .maybeSingle();
      if (error) return errorResult(error.message);
      return {
        content: [{ type: "text", text: `Updated tracking for ${slug}.` }],
        structuredContent: { certification: data },
      };
    }

    const { data, error } = await supabase
      .from("user_certifications")
      .insert({
        user_id: userId,
        certification_slug: slug,
        ...patch,
      } as never)
      .select()
      .maybeSingle();
    if (error) return errorResult(error.message);

    return {
      content: [{ type: "text", text: `Now tracking ${slug}.` }],
      structuredContent: { certification: data },
    };
  },
});
