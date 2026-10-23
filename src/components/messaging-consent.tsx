import { Link } from "@tanstack/react-router";

/** Explicit, unchecked DPDP consent for forms that collect a phone number or email. */
export function MessagingConsentField({
  checked,
  onChange,
  id = "messaging-consent",
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
}) {
  return (
    <div className="rounded-md border border-border bg-background px-3 py-3">
      <label htmlFor={id} className="flex items-start gap-3 text-sm text-muted-foreground">
        <input
          id={id}
          name="messaging_consent"
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          required
          aria-required="true"
          className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
        />
        <span>
          I agree that SkillTrack may contact me by email, phone, WhatsApp, or Telegram about this
          enquiry. This box is required and starts unticked. I can withdraw consent at any time. See
          the{" "}
          <Link to="/privacy" className="underline hover:text-foreground">
            privacy policy
          </Link>
          .
        </span>
      </label>
    </div>
  );
}
