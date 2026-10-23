import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — SkillTrack-365" },
      {
        name: "description",
        content:
          "How SkillTrack-365 collects, uses, stores and protects your personal data, and the choices you have over it.",
      },
      { property: "og:title", content: "Privacy Policy — SkillTrack-365" },
      {
        property: "og:description",
        content: "Data we collect, how we use it, how long we keep it, and how to contact us.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/privacy" }],
  }),
  component: Privacy,
});

function Privacy() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">Privacy Policy</h1>
      <p className="mt-2 text-xs text-muted-foreground">Last updated: 23 October 2026</p>

      <div className="mt-8 space-y-7 text-sm text-muted-foreground">
        <section>
          <h2 className="text-base font-semibold text-foreground">1. Who we are</h2>
          <p className="mt-2">
            SkillTrack-365 provides a certification tracking and career planning platform. This
            policy explains how we handle personal data for visitors, learners and organisation
            members.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-foreground">2. Data we collect</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>Account data: name, email, and — if you enable phone sign-in — your phone number.</li>
            <li>
              Enquiry data: details you submit through the "Book a free call" form, including
              certification interest, timing and any campaign parameters in the page link.
            </li>
            <li>
              Learning data: certifications you track, study hours, milestones, mock exam results
              and roadmap inputs.
            </li>
            <li>Billing data: plan, seats and subscription status. Card details are handled by our payment processor, not by us.</li>
            <li>Technical data: log and diagnostic records needed to operate and secure the service.</li>
          </ul>
        </section>
        <section>
          <h2 className="text-base font-semibold text-foreground">3. How we use it</h2>
          <p className="mt-2">
            To provide the service, personalise roadmaps and recommendations, process payments,
            respond to enquiries, prevent abuse, and meet legal obligations.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-foreground">4. Sharing</h2>
          <p className="mt-2">
            We share data only with processors that run the service on our behalf — hosting and
            database, payment processing, email and messaging delivery, and sales enquiry
            handling. If you join an organisation account, your progress within that organisation
            is visible to its administrators. We do not sell personal data.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-foreground">5. Retention</h2>
          <p className="mt-2">
            We keep account and learning data while your account is active, and for as long as
            needed afterwards to meet legal, tax and audit requirements. You can ask us to delete
            your account data at any time.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-foreground">6. Your rights</h2>
          <p className="mt-2">
            You can request access to, correction of, export of, or deletion of your personal
            data, and you can object to certain processing. Contact us and we will respond within
            a reasonable period.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-foreground">7. Security</h2>
          <p className="mt-2">
            Data is stored on managed infrastructure with row-level access rules, tenant
            isolation between organisations, and audit logging on administrative actions.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-foreground">8. WhatsApp and Telegram</h2>
          <p className="mt-2">
            Public forms that ask for a phone number or email — including Book a call — include a
            consent box. It is unchecked until you tick it, and the form cannot be sent without it.
            Ticking it means SkillTrack-365 may contact you at the phone number or email you gave,
            including by phone, email, WhatsApp, and Telegram, about that enquiry and certification
            guidance. We record that you consented and the time you consented. We do not use those
            channels for that enquiry if you leave the box unticked.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-foreground">9. Withdrawing consent</h2>
          <p className="mt-2">
            You can withdraw consent at any time. Email{" "}
            <a className="hover:text-foreground" href="mailto:admin@skilltrack.co.in">
              admin@skilltrack.co.in
            </a>{" "}
            or use the <Link to="/contact" className="underline hover:text-foreground">contact page</Link>{" "}
            and ask us to stop WhatsApp, Telegram, phone, or email messages. We will stop enquiry
            and marketing messages on those channels. Withdrawal does not erase messages already
            sent, and we may keep a short record that you withdrew consent where the law requires it.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-foreground">10. Enquiry and consent retention</h2>
          <p className="mt-2">
            We keep book-a-call and similar enquiry records, including your messaging consent and
            its timestamp, for up to 24 months after your last message with us. We keep them longer
            when a booking, invoice, dispute, or legal duty requires it. Account and learning data
            follow section 5. You can ask us to delete an enquiry record, subject to those duties.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-foreground">11. Grievance officer</h2>
          <p className="mt-2">
            Under India&apos;s Digital Personal Data Protection Act, you may raise a grievance about
            how we handle your personal data. Grievance Officer: [Name to be published]. Email:{" "}
            <a className="hover:text-foreground" href="mailto:admin@skilltrack.co.in">
              admin@skilltrack.co.in
            </a>{" "}
            with the subject &quot;DPDP grievance&quot;. Postal address: [Address to be published].
            We will acknowledge the grievance and work to resolve it.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-foreground">12. Contact</h2>
          <p className="mt-2">
            Questions about this policy: <a className="hover:text-foreground" href="mailto:admin@skilltrack.co.in">admin@skilltrack.co.in</a>, or via our{" "}
            <Link to="/contact" className="underline hover:text-foreground">contact page</Link>.
          </p>
        </section>
      </div>
    </div>
  );
}
