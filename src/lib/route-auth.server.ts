// Server-route auth helper. Validates a Supabase bearer token from an
// incoming Request and resolves the authenticated user + their roles.
// Use this from `src/routes/api/*` handlers, since `requireSupabaseAuth`
// middleware only applies to `createServerFn`.

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type RouteAuth = {
  userId: string;
  email: string | null;
  roles: string[];
  isSuper: boolean;
  supabase: ReturnType<typeof createClient<Database>>;
};

export async function authenticateRoute(request: Request): Promise<RouteAuth> {
  const SUPABASE_URL = process.env.SUPABASE_URL!;
  const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;
  const authHeader = request.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    throw new Response("Unauthorized", { status: 401 });
  }
  const token = authHeader.slice(7);
  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) {
    throw new Response("Unauthorized", { status: 401 });
  }
  const userId = data.claims.sub as string;
  const email = (data.claims.email as string | undefined) ?? null;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: roleRows }, { data: superRow }] = await Promise.all([
    supabaseAdmin.from("user_roles").select("role").eq("user_id", userId),
    supabaseAdmin.from("super_admins").select("user_id").eq("user_id", userId).maybeSingle(),
  ]);
  return {
    userId,
    email,
    roles: (roleRows ?? []).map((r: any) => String(r.role)),
    isSuper: !!superRow,
    supabase,
  };
}

export function assertAnyRole(auth: RouteAuth, allowed: readonly string[]) {
  if (auth.isSuper) return;
  if (!auth.roles.some((r) => allowed.includes(r))) {
    throw new Response("Forbidden", { status: 403 });
  }
}
