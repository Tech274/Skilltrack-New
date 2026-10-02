import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, Trash2, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  createOrgLogoUploadUrl,
  getOrgBranding,
  setOrgLogoPath,
} from "@/lib/org-branding.functions";
import { supabase } from "@/integrations/supabase/client";

export function OrgBrandSettings({ orgId }: { orgId: string }) {
  const getFn = useServerFn(getOrgBranding);
  const createUrlFn = useServerFn(createOrgLogoUploadUrl);
  const setPathFn = useServerFn(setOrgLogoPath);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["org-branding", orgId],
    queryFn: () => getFn({ data: { orgId } }),
  });

  const canEdit = data?.role === "exec" || data?.role === "hr";

  const saveMut = useMutation({
    mutationFn: async (args: { variant: "light" | "dark"; file: File | null }) => {
      if (args.file === null) {
        await setPathFn({ data: { orgId, variant: args.variant, path: null } });
        return;
      }
      const file = args.file;
      if (!/\.(png|jpe?g|svg|webp)$/i.test(file.name)) throw new Error("Logo must be PNG, JPG, WEBP, or SVG.");
      if (file.size > 2 * 1024 * 1024) throw new Error("Logo must be 2 MB or smaller.");
      const { path, token } = await createUrlFn({
        data: { orgId, variant: args.variant, filename: file.name },
      });
      const { error: upErr } = await supabase.storage.from("org-logos").uploadToSignedUrl(path, token, file, {
        contentType: file.type || "image/png",
        upsert: true,
      });
      if (upErr) throw new Error(upErr.message);
      await setPathFn({ data: { orgId, variant: args.variant, path } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org-branding", orgId] });
      toast.success("Logo updated");
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not update logo"),
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading branding…</div>;
  if (!data) return null;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <LogoSlot
        title="Light-mode logo"
        description="Shown on light backgrounds (tenant header, invoices, light emails)."
        previewBg="bg-white"
        url={data.logo_light_url}
        disabled={!canEdit || saveMut.isPending}
        onUpload={(file) => saveMut.mutate({ variant: "light", file })}
        onClear={() => saveMut.mutate({ variant: "light", file: null })}
      />
      <LogoSlot
        title="Dark-mode logo"
        description="Shown on dark backgrounds (dark theme header, dark emails)."
        previewBg="bg-neutral-900"
        url={data.logo_dark_url}
        disabled={!canEdit || saveMut.isPending}
        onUpload={(file) => saveMut.mutate({ variant: "dark", file })}
        onClear={() => saveMut.mutate({ variant: "dark", file: null })}
      />
      {!canEdit && (
        <p className="md:col-span-2 text-xs text-muted-foreground">
          Only org execs or HR can change branding.
        </p>
      )}
    </div>
  );
}

function LogoSlot({
  title, description, previewBg, url, disabled, onUpload, onClear,
}: {
  title: string;
  description: string;
  previewBg: string;
  url: string | null | undefined;
  disabled: boolean;
  onUpload: (f: File) => void;
  onClear: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  return (
    <div className="rounded-lg border border-border/60 bg-surface/40 p-4">
      <div className="text-sm font-semibold">{title}</div>
      <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      <div
        className={`mt-3 flex h-32 items-center justify-center rounded-md border-2 border-dashed ${dragging ? "border-primary" : "border-border/60"} ${previewBg}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f && !disabled) onUpload(f);
        }}
      >
        {url ? (
          <img src={url} alt={title} className="max-h-24 max-w-[80%] object-contain" />
        ) : (
          <div className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
            <ImageIcon size={20} />
            <span>No logo uploaded</span>
          </div>
        )}
      </div>
      <input
        ref={ref}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ""; }}
      />
      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="outline" disabled={disabled} onClick={() => ref.current?.click()}>
          <Upload size={14} /> Upload
        </Button>
        {url && (
          <Button size="sm" variant="ghost" disabled={disabled} onClick={onClear}>
            <Trash2 size={14} /> Remove
          </Button>
        )}
      </div>
    </div>
  );
}
