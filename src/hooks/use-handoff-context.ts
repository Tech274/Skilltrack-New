import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { HandoffParams } from "@/lib/handoff";

function phoneFromUser(user: {
  phone?: string;
  user_metadata?: Record<string, unknown>;
} | null): string | undefined {
  if (!user) return undefined;
  const direct = typeof user.phone === "string" ? user.phone.trim() : "";
  if (direct) return direct;
  const meta = user.user_metadata ?? {};
  for (const key of ["phone", "phone_number", "mobile"] as const) {
    const v = meta[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

/**
 * Session/profile context for Hub/Bridge deep-link handoffs.
 * Email from signed-in Supabase user; phone only if already on the auth user.
 * Never invents PII.
 */
export function useHandoffContext(): Pick<HandoffParams, "email" | "phone"> {
  const [email, setEmail] = useState<string | undefined>();
  const [phone, setPhone] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;

    function apply(user: {
      email?: string;
      phone?: string;
      user_metadata?: Record<string, unknown>;
    } | null) {
      if (cancelled) return;
      const e = user?.email?.trim();
      setEmail(e || undefined);
      setPhone(phoneFromUser(user));
    }

    supabase.auth.getUser().then(({ data }) => apply(data.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      apply(session?.user ?? null);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { email, phone };
}

