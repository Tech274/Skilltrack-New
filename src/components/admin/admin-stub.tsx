import { Construction } from "lucide-react";

export function AdminStub({
  title,
  description,
  features,
}: {
  title: string;
  description: string;
  features: string[];
}) {
  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>

      <div className="mt-6 rounded-lg border border-dashed border-border bg-surface/50 p-8 text-center">
        <Construction size={28} className="mx-auto text-muted-foreground" />
        <h2 className="mt-3 text-base font-semibold">Module under construction</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The schema and access rules are in place. The full UI for this module is being rolled out in a follow-up phase.
        </p>
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-semibold">Planned features</h3>
        <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="mt-1.5 inline-block h-1.5 w-1.5 rounded-full bg-primary/60" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
