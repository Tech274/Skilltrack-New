// Lovable Stripe billing — checkout session, customer portal, and read.
//
// Subscription rows are written ONLY by the verified webhook handler at
// src/routes/api/public/payments/webhook.ts. Server fns here just open
// hosted Stripe surfaces and read state.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { type StripeEnv, createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";

type CheckoutResult = { clientSecret: string } | { error: string };
type PortalResult = { url: string } | { error: string };

const PRICE_TO_PLAN: Record<string, { plan: "professional" | "team"; scope: "user" | "org"; interval: "month" | "year" }> = {
  professional_monthly: { plan: "professional", scope: "user", interval: "month" },
  professional_yearly: { plan: "professional", scope: "user", interval: "year" },
  team_monthly: { plan: "team", scope: "org", interval: "month" },
  team_yearly: { plan: "team", scope: "org", interval: "year" },
};

async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  options: { email?: string; userId?: string; orgId?: string },
): Promise<string> {
  if (options.userId && !/^[a-zA-Z0-9_-]+$/.test(options.userId)) throw new Error("Invalid userId");
  if (options.orgId && !/^[a-zA-Z0-9_-]+$/.test(options.orgId)) throw new Error("Invalid orgId");

  if (options.userId) {
    const found = await stripe.customers.search({
      query: `metadata['userId']:'${options.userId}'`,
      limit: 1,
    });
    if (found.data.length) return found.data[0].id;
  }
  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    if (existing.data.length) {
      const customer = existing.data[0];
      if (options.userId && customer.metadata?.userId !== options.userId) {
        await stripe.customers.update(customer.id, {
          metadata: { ...customer.metadata, userId: options.userId, ...(options.orgId && { orgId: options.orgId }) },
        });
      }
      return customer.id;
    }
  }
  const created = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    metadata: {
      ...(options.userId && { userId: options.userId }),
      ...(options.orgId && { orgId: options.orgId }),
    },
  });
  return created.id;
}

export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      priceId: z.enum(["professional_monthly", "professional_yearly", "team_monthly", "team_yearly"]),
      orgId: z.string().uuid().optional(),
      seats: z.number().int().min(1).max(500).optional(),
      returnUrl: z.string().url(),
      environment: z.enum(["sandbox", "live"]),
    }),
  )
  .handler(async ({ data, context }): Promise<CheckoutResult> => {
    const plan = PRICE_TO_PLAN[data.priceId];
    if (plan.scope === "org" && !data.orgId) {
      return { error: "Team plan requires an organization" };
    }

    // Org plan: caller must be exec/admin of the org.
    if (plan.scope === "org") {
      const { data: isMember } = await context.supabase.rpc("is_org_member", {
        _org: data.orgId!,
        _user: context.userId,
        _roles: ["exec", "manager"] as any,
      });
      if (!isMember) return { error: "You must be an org exec or manager to subscribe the team" };
    }

    try {
      const { data: { user } } = await context.supabase.auth.getUser();
      const stripe = createStripeClient(data.environment as StripeEnv);

      const prices = await stripe.prices.list({ lookup_keys: [data.priceId] });
      if (!prices.data.length) return { error: "Price not found. Has the catalog been published?" };
      const stripePrice = prices.data[0];

      const customerId = await resolveOrCreateCustomer(stripe, {
        email: user?.email ?? undefined,
        userId: context.userId,
        orgId: plan.scope === "org" ? data.orgId : undefined,
      });

      const quantity = plan.scope === "org" ? Math.max(1, data.seats ?? 1) : 1;

      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: stripePrice.id, quantity }],
        mode: "subscription",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        customer: customerId,
        subscription_data: {
          trial_period_days: 14,
          metadata: {
            userId: context.userId,
            plan_code: plan.plan,
            scope: plan.scope,
            billing_interval: plan.interval,
            ...(plan.scope === "org" && data.orgId && { orgId: data.orgId }),
          },
        },
        metadata: {
          userId: context.userId,
          plan_code: plan.plan,
          scope: plan.scope,
          ...(plan.scope === "org" && data.orgId && { orgId: data.orgId }),
        },
        managed_payments: { enabled: true },
      } as any);

      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

export const createPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      subscriptionId: z.string().uuid(),
      returnUrl: z.string().url().optional(),
      environment: z.enum(["sandbox", "live"]),
    }),
  )
  .handler(async ({ data, context }): Promise<PortalResult> => {
    const { data: sub, error } = await context.supabase
      .from("subscriptions")
      .select("stripe_customer_id, environment")
      .eq("id", data.subscriptionId)
      .maybeSingle();
    if (error || !sub?.stripe_customer_id) return { error: "Subscription not found" };

    try {
      const stripe = createStripeClient(data.environment as StripeEnv);
      const portal = await stripe.billingPortal.sessions.create({
        customer: sub.stripe_customer_id as string,
        ...(data.returnUrl && { return_url: data.returnUrl }),
      });
      return { url: portal.url };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

export const getMySubscriptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("subscriptions")
      .select("id, scope, user_id, org_id, plan_code, billing_interval, seats, status, current_period_end, trial_end, cancel_at_period_end, environment")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });
