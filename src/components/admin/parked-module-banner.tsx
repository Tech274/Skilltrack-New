import { ParkingSquare } from "lucide-react";

/** Shown when a parked admin module is opened via direct URL (hidden from sidebar). */
export const PARKED_MODULE_MESSAGE = "Parked — not used for SkillTrack lead ops";

export function ParkedModuleBanner({ label }: { label?: string }) {
  return (
    <div
      role="status"
      className="border-b border-warning/40 bg-warning/10 px-4 py-2.5 text-sm text-foreground"
    >
      <div className="mx-auto flex max-w-7xl items-start gap-2">
        <ParkingSquare size={16} className="mt-0.5 shrink-0 text-warning" aria-hidden />
        <div>
          <span className="font-medium">{PARKED_MODULE_MESSAGE}</span>
          {label ? (
            <span className="text-muted-foreground">
              {" "}
              — “{label}” remains available for Super Admin if needed.
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
