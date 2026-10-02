import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — SkillTrack-365" },
      {
        name: "description",
        content:
          "The terms that govern your use of SkillTrack-365, including accounts, subscriptions, acceptable use and liability.",
      },
      { property: "og:title", content: "Terms of Service — SkillTrack-365" },
      {
        property: "og:description",
        content: "Accounts, subscriptions, acceptable use, content ownership and liability.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/terms" }],
  }),
  component: Terms,
});

function Terms() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">Terms of Service</h1>
      <p className="mt-2 text-xs text-muted-foreground">Last updated: {new Date().getFullYear()}</p>

      <div className="mt-8 space-y-7 text-sm text-muted-foreground">
        <section>
          <h2 className="text-base font-semibold text-foreground">1. Agreement</h2>
          <p className="mt-2">
            By creating an account or using SkillTrack-365 you agree to these terms. If you use
            the service on behalf of an organisation, you confirm you are authorised to accept
            them for that organisation.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-foreground">2. Accounts</h2>
          <p className="mt-2">
            You are responsible for keeping your sign-in credentials secure and for activity under
            your account. Accounts are personal; seats in a team plan may be reassigned by an
            organisation administrator.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-foreground">3. Subscriptions and billing</h2>
          <p className="mt-2">
            Paid plans are billed per seat in advance for the chosen interval and renew
            automatically until cancelled. Trials convert to a paid subscription at the end of the
            trial unless cancelled first. Cancellation takes effect at the end of the current
            billing period; we do not provide pro-rated refunds unless required by law.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-foreground">4. Acceptable use</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>Do not share, resell or republish exam content, question banks or study material.</li>
            <li>Do not attempt to access another organisation's data or bypass access rules.</li>
            <li>Do not use the service to breach any certification vendor's exam policies.</li>
            <li>Do not scrape, overload or reverse engineer the platform.</li>
          </ul>
        </section>
        <section>
          <h2 className="text-base font-semibold text-foreground">5. Content</h2>
          <p className="mt-2">
            You keep ownership of content you upload. You grant us the licence needed to host and
            process it to deliver the service. Our catalog, question bank and platform content
            remain our property or that of our licensors.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-foreground">6. Guidance, not guarantees</h2>
          <p className="mt-2">
            Roadmaps, pass-probability estimates and salary figures are informational aids. They
            do not guarantee an exam result, a job outcome or a salary. Certification vendors set
            their own exam rules, pricing and availability.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-foreground">7. Availability and liability</h2>
          <p className="mt-2">
            We aim for continuous availability but do not guarantee uninterrupted service. To the
            maximum extent permitted by law, our aggregate liability is limited to the fees you
            paid in the twelve months before the claim.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-foreground">8. Termination</h2>
          <p className="mt-2">
            You may stop using the service at any time. We may suspend or terminate access for
            breach of these terms or for unlawful use.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-foreground">9. Contact</h2>
          <p className="mt-2">
            Questions about these terms:{" "}
            <Link to="/contact" className="underline hover:text-foreground">contact us</Link>.
          </p>
        </section>
      </div>
    </div>
  );
}
