import { REGIONS, type RegionCode } from "@/lib/region-currency";

export function RegionSelect({
  value,
  onChange,
  label = "Region",
  className = "",
}: {
  value: RegionCode;
  onChange: (code: RegionCode) => void;
  label?: string;
  className?: string;
}) {
  return (
    <label className={`inline-flex items-center gap-2 text-xs text-muted-foreground ${className}`}>
      <span className="uppercase tracking-wider">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as RegionCode)}
        className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-foreground outline-none transition-colors hover:border-accent focus-visible:border-accent"
      >
        {REGIONS.map((r) => (
          <option key={r.code} value={r.code}>
            {r.label} ({r.currency})
          </option>
        ))}
      </select>
    </label>
  );
}
