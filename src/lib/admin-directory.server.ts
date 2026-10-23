import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { pageBounds } from "@/lib/admin-page";

type AdminClient = SupabaseClient<Database>;
const MISSING_RPC = new Set(["PGRST202", "42883"]);

export type DirectoryRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  headline: string | null;
  country: string | null;
  target_role: string | null;
  timezone: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  banned_until: string | null;
  roles: string[] | string | null;
  is_super_admin: boolean;
  total_count: number | string;
};

export function asRoles(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") {
    const inner = value.replace(/^\{|\}$/g, "").trim();
    if (!inner) return [];
    return inner
      .split(",")
      .map((part) => part.trim().replace(/^"|"$/g, ""))
      .filter(Boolean);
  }
  return [];
}

export function isBanned(until: string | null | undefined): boolean {
  if (!until) return false;
  const time = new Date(until).getTime();
  return Number.isFinite(time) && time > Date.now();
}

export type DirectoryPage = {
  rows: DirectoryRow[];
  total: number;
  page: number;
  pageSize: number;
  capped: false;
};

/** Service-role page of auth users. Returns null when the migration is not applied yet. */
export async function queryAdminDirectory(
  admin: AdminClient,
  args: {
    role?: string | null;
    search?: string | null;
    status?: string | null;
    page?: number;
    pageSize?: number;
    order?: "email" | "created_at";
  },
): Promise<DirectoryPage | null> {
  const bounds = pageBounds(args.page, args.pageSize);
  const { data, error } = await admin.rpc("admin_directory_page", {
    _role: args.role ?? "",
    _search: args.search?.trim() ?? "",
    _status: args.status && args.status !== "all" ? args.status : "",
    _page: bounds.page,
    _page_size: bounds.pageSize,
    _order: args.order ?? "created_at",
  });
  if (error) {
    console.error("admin_directory_page", error.code ?? "unknown");
    if (MISSING_RPC.has(error.code ?? "")) return null;
    throw new Error("Could not load the directory");
  }
  const raw = (data ?? []) as DirectoryRow[];
  const total = raw.length > 0 ? Number(raw[0].total_count ?? 0) : 0;
  return {
    rows: raw.filter((row) => row.id),
    total: Number.isFinite(total) ? total : 0,
    page: bounds.page,
    pageSize: bounds.pageSize,
    capped: false,
  };
}

type AuthUser = {
  id: string;
  email?: string | null;
  created_at: string;
  last_sign_in_at?: string | null;
};

export type FallbackDirectory = {
  rows: Array<{
    id: string;
    email: string | null;
    created_at: string;
    last_sign_in_at: string | null;
    roles: string[];
    is_super_admin: boolean;
    display_name: string | null;
    avatar_url: string | null;
  }>;
  total: number;
  page: number;
  pageSize: number;
  capped: true;
  hasMore: boolean;
};

/** Used only when admin_directory_page is not deployed. Search cannot pass the auth list cap. */
export async function fallbackAuthUsers(
  admin: AdminClient,
  args: { page?: number; pageSize?: number; search?: string | null },
): Promise<FallbackDirectory> {
  const bounds = pageBounds(args.page, args.pageSize);
  const search = args.search?.trim().toLowerCase() ?? "";

  if (search) {
    const matches: AuthUser[] = [];
    let hitCap = false;
    for (let page = 1; page <= 25; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) {
        console.error("auth listUsers", "unknown");
        throw new Error("Could not load users");
      }
      const users = data?.users ?? [];
      for (const user of users) {
        if ((user.email ?? "").toLowerCase().includes(search)) matches.push(user);
      }
      if (users.length < 200) break;
      if (page === 25) hitCap = true;
    }
    const slice = matches.slice(bounds.from, bounds.from + bounds.pageSize);
    return {
      rows: await hydrateAuthUsers(admin, slice),
      total: matches.length,
      page: bounds.page,
      pageSize: bounds.pageSize,
      capped: true,
      hasMore: hitCap,
    };
  }

  const { data, error } = await admin.auth.admin.listUsers({
    page: bounds.page,
    perPage: bounds.pageSize,
  });
  if (error) {
    console.error("auth listUsers", "unknown");
    throw new Error("Could not load users");
  }
  const users = data?.users ?? [];
  return {
    rows: await hydrateAuthUsers(admin, users),
    total: (bounds.page - 1) * bounds.pageSize + users.length,
    page: bounds.page,
    pageSize: bounds.pageSize,
    capped: true,
    hasMore: users.length === bounds.pageSize,
  };
}

async function hydrateAuthUsers(admin: AdminClient, users: AuthUser[]) {
  if (users.length === 0) return [];
  const ids = users.map((user) => user.id);
  const [{ data: roleRows }, { data: profiles }, { data: superRows }] = await Promise.all([
    admin.from("user_roles").select("user_id, role").in("user_id", ids),
    admin.from("profiles").select("id, display_name, avatar_url").in("id", ids),
    admin.from("super_admins").select("user_id").in("user_id", ids),
  ]);
  const roleMap = new Map<string, string[]>();
  for (const row of roleRows ?? []) {
    const list = roleMap.get(row.user_id) ?? [];
    list.push(row.role);
    roleMap.set(row.user_id, list);
  }
  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const superSet = new Set((superRows ?? []).map((row) => row.user_id));
  return users.map((user) => {
    const profile = profileMap.get(user.id);
    return {
      id: user.id,
      email: user.email ?? null,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at ?? null,
      roles: roleMap.get(user.id) ?? [],
      is_super_admin: superSet.has(user.id),
      display_name: profile?.display_name ?? null,
      avatar_url: profile?.avatar_url ?? null,
    };
  });
}

const EMAIL_FALLBACK_PAGE_SIZE = 200;
const EMAIL_FALLBACK_MAX_USERS = 5_000;

/**
 * One lookup for many auth emails. Uses admin_user_emails when that function
 * is deployed. Otherwise walks listUsers until every requested id is found.
 * A directory larger than 5,000 users cannot be scanned this way, so a missing
 * migration throws instead of returning blank emails.
 */
export async function loadUserEmails(
  admin: AdminClient,
  ids: Array<string | null | undefined>,
): Promise<Map<string, string | null>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  const map = new Map<string, string | null>();
  if (unique.length === 0) return map;

  const { data, error } = await admin.rpc("admin_user_emails", { _ids: unique });
  if (!error) {
    for (const row of (data ?? []) as Array<{ id: string; email: string | null }>) {
      map.set(row.id, row.email ?? null);
    }
    return map;
  }
  console.error("admin_user_emails", error.code ?? "unknown");
  if (!MISSING_RPC.has(error.code ?? "")) throw new Error("Could not load user emails");

  const wanted = new Set(unique);
  const maxPages = EMAIL_FALLBACK_MAX_USERS / EMAIL_FALLBACK_PAGE_SIZE;
  for (let page = 1; page <= maxPages && map.size < wanted.size; page++) {
    const { data: listed, error: listError } = await admin.auth.admin.listUsers({
      page,
      perPage: EMAIL_FALLBACK_PAGE_SIZE,
    });
    if (listError) throw new Error("Could not load user emails");
    const users = listed?.users ?? [];
    for (const user of users) {
      if (wanted.has(user.id)) map.set(user.id, user.email ?? null);
    }
    if (users.length < EMAIL_FALLBACK_PAGE_SIZE) return map;
  }

  if (map.size < wanted.size) {
    const { data: extra, error: extraError } = await admin.auth.admin.listUsers({
      page: EMAIL_FALLBACK_MAX_USERS + 1,
      perPage: 1,
    });
    if (extraError) throw new Error("Could not load user emails");
    if ((extra?.users ?? []).length > 0) {
      throw new Error(
        "admin_user_emails is not deployed and there are more than 5,000 users, so email addresses cannot be filled in. Apply the admin_user_emails migration and try again.",
      );
    }
  }
  return map;
}

export function directoryUser(row: DirectoryRow) {
  return {
    id: row.id,
    email: row.email,
    created_at: row.created_at,
    last_sign_in_at: row.last_sign_in_at,
    roles: asRoles(row.roles),
    is_super_admin: Boolean(row.is_super_admin),
    display_name: row.display_name,
    avatar_url: row.avatar_url,
  };
}

export function directoryLearner(row: DirectoryRow) {
  return {
    id: row.id,
    display_name: row.display_name,
    email: row.email,
    headline: row.headline,
    country: row.country,
    target_role: row.target_role,
    timezone: row.timezone,
    status: isBanned(row.banned_until) ? "disabled" : "active",
    created_at: row.created_at,
  };
}

export async function countRoleAssignments(admin: AdminClient, role: string): Promise<number> {
  const { count, error } = await admin
    .from("user_roles")
    .select("user_id", { count: "exact", head: true })
    .eq("role", role as Database["public"]["Enums"]["app_role"]);
  if (error) {
    console.error("user_roles count", error.code ?? "unknown");
    return 0;
  }
  return count ?? 0;
}

export async function countSuperAdmins(admin: AdminClient): Promise<number> {
  const { count, error } = await admin
    .from("super_admins")
    .select("user_id", { count: "exact", head: true });
  if (error) {
    console.error("super_admins count", error.code ?? "unknown");
    return 0;
  }
  return count ?? 0;
}
