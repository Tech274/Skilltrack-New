// Stripe webhook handler — the ONLY writer of public.subscriptions rows.
// Lovable proxies /api/public/* without auth; security is the verified
// Stripe signature on every request.

import { createFileRoute } from "@tanstack/react-router";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";

const PLAN_FROM_PRICE: Record<string, { plan: "professional" | "team"; scope: "user" | "org"; interval: "month" | "year" }> = {
  professional_monthly: { plan: "professional", scope: "user", interval: "month" },
  professional_yearly: { plan: "professional", scope: "user", interval: "year" },
  team_monthly: { plan: "team", scope: "org", interval: "month" },
  team_yearly: { plan: "team", scope: "org", interval: "year" },
};

function lookupKey(item: any): string | null {
  return item?.price?.lookup_key
    ?? item?.price?.metadata?.lovable_external_id
    ?? null;
}

async function recordEvent(supabase: any, event: any, env: StripeEnv, subscriptionId: string | null) {
  await supabase.from("subscription_events").upsert(
    {
      stripe_event_id: event.id,
      type: event.type,
      payload: event.data?.object ?? {},
      subscription_id: subscriptionId,
      environment: env,
    },
    { onConflict: "stripe_event_id" },
  );
}

async function upsertSubscription(supabase: any, subscription: any, env: StripeEnv): Promise<string | null> {
  const item = subscription.items?.data?.[0];
  const key = lookupKey(item);
  const planMeta = key ? PLAN_FROM_PRICE[key] : null;
  if (!planMeta) {
    console.error("[stripe webhook] unknown lookup_key", key);
    return null;
  }

  const userId = subscription.metadata?.userId ?? null;
  const orgId = subscription.metadata?.orgId ?? null;
  const scope = (subscription.metadata?.scope as "user" | "org" | undefined) ?? planMeta.scope;

  if (scope === "user" && !userId) {
    console.error("[stripe webhook] user-scope subscription missing userId");
    return null;
  }
  if (scope === "org" && !orgId) {
    console.error("[stripe webhook] org-scope subscription missing orgId");
    return null;
  }

  const periodStart = item?.current_period_start ?? subscription.current_period_start;
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;
  const trialEnd = subscription.trial_end;

  const row: any = {
    scope,
    user_id: scope === "user" ? userId : null,
    org_id: scope === "org" ? orgId : null,
    plan_code: planMeta.plan,
    billing_interval: planMeta.interval,
    seats: item?.quantity ?? 1,
    status: subscription.status,
    stripe_customer_id: typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id,
    stripe_subscription_id: subscription.id,
    price_id: key,
    product_id: typeof item?.price?.product === "string" ? item.price.product : item?.price?.product?.id ?? null,
    current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    trial_end: trialEnd ? new Date(trialEnd * 1000).toISOString() : null,
    cancel_at_period_end: !!subscription.cancel_at_period_end,
    environment: env,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("subscriptions")
    .upsert(row, { onConflict: "stripe_subscription_id" })
    .select("id")
    .single();
  if (error) {
    console.error("[stripe webhook] upsert error", error);
    return null;
  }
  return data?.id ?? null;
}

async function markCanceled(supabase: any, subscription: any, env: StripeEnv): Promise<string | null> {
  const { data, error } = await supabase
    .from("subscriptions")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", subscription.id)
    .eq("environment", env)
    .select("id")
    .maybeSingle();
  if (error) console.error("[stripe webhook] cancel error", error);
  return data?.id ?? null;
}

async function handle(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  let subscriptionId: string | null = null;
  const obj = event.data.object;

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "checkout.session.completed": {
      // checkout.session.completed for subscription mode — fetch the
      // subscription object via the existing webhook chain instead; the
      // subsequent customer.subscription.created event also fires and
      // carries the full sub. Here, only handle subscription-shaped objs.
      if (obj?.object === "subscription") {
        subscriptionId = await upsertSubscription(supabaseAdmin, obj, env);
      }
      break;
    }
    case "customer.subscription.deleted": {
      subscriptionId = await markCanceled(supabaseAdmin, obj, env);
      break;
    }
    case "invoice.payment_failed": {
      // Stripe also fires customer.subscription.updated → status=past_due,
      // but log explicitly for audit.
      console.warn("[stripe webhook] invoice.payment_failed", obj?.id);
      break;
    }
    default:
      // Subscribed events that aren't actionable here (e.g. transaction.completed)
      break;
  }

  await recordEvent(supabaseAdmin, event, env, subscriptionId);
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          return Response.json({ received: true, ignored: "invalid env" });
        }
        try {
          await handle(request, rawEnv);
          return Response.json({ received: true });
        } catch (err) {
          console.error("[stripe webhook] error", err);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
