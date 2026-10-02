import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const resendSchema = z.object({
  email: z.string().email("A valid email address is required"),
});

export const resendPasswordReset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => resendSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { assertAdminOrSuper } = await import("@/lib/admin-auth.server");
    await assertAdminOrSuper(context.userId);

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !serviceRoleKey || !publishableKey) {
      throw new Error("Server configuration error: missing Supabase credentials");
    }

    const response = await fetch(`${supabaseUrl}/auth/v1/recover`, {
      method: "POST",
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: data.email }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Failed to resend password reset: ${response.status} ${body}`);
    }

    return { success: true, email: data.email };
  });
