import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const dismissReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("milestone_reminders")
      .update({ dismissed_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const snoozeReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), days: z.number().min(1).max(30).default(1) }))
  .handler(async ({ data, context }) => {
    const newAt = new Date(Date.now() + data.days * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await context.supabase
      .from("milestone_reminders")
      .update({ remind_at: newAt })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true, remind_at: newAt };
  });

export const createExamReminders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ userCertificationId: z.string().uuid(), examDate: z.string() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const exam = new Date(data.examDate);
    const rows = [
      { offsetDays: 7, label: "Exam in 1 week" },
      { offsetDays: 1, label: "Exam tomorrow" },
    ].map((r) => ({
      user_id: userId,
      user_certification_id: data.userCertificationId,
      title: r.label,
      body: `Your scheduled exam is on ${exam.toLocaleDateString()}.`,
      remind_at: new Date(exam.getTime() - r.offsetDays * 24 * 60 * 60 * 1000).toISOString(),
      channel: "in_app",
    }));
    // remove old exam reminders for this cert
    await supabase
      .from("milestone_reminders")
      .delete()
      .eq("user_certification_id", data.userCertificationId)
      .is("milestone_id", null);
    const { error } = await supabase.from("milestone_reminders").insert(rows);
    if (error) throw error;
    return { inserted: rows.length };
  });
