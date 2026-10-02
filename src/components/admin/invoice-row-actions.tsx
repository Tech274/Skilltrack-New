import {
  Download,
  MoreHorizontal,
  Trash2,
  CheckCircle2,
  Send,
  Ban,
  History,
  RefreshCw,
  Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Self-contained row-actions menu for the admin invoices list.
 * Extracting it from admin.invoices.tsx keeps the table JSX flat and
 * prevents the deep DropdownMenu nesting that caused repeated
 * "Expected corresponding JSX closing tag" build failures.
 */
export type InvoiceRowActionsProps = {
  invoice: {
    id: string;
    invoice_number: string;
    status: string;
    email_status?: string | null;
    learner_email?: string | null;
  };
  isPreviewLoading: boolean;
  onDownload: () => void;
  onViewAudit: () => void;
  onRetryEmail: () => void;
  onPreviewAndSend: () => void;
  onMarkPaid: () => void;
  onCancel: () => void;
  onDelete: () => void;
  /** Paid + known learner email → copy SkillHub unlock deep-link */
  onCopyHubUnlock?: () => void;
};

export function InvoiceRowActions({
  invoice,
  isPreviewLoading,
  onDownload,
  onViewAudit,
  onRetryEmail,
  onPreviewAndSend,
  onMarkPaid,
  onCancel,
  onDelete,
  onCopyHubUnlock,
}: InvoiceRowActionsProps) {
  const canCopyHub =
    invoice.status === "paid" &&
    Boolean(invoice.learner_email?.trim()) &&
    typeof onCopyHubUnlock === "function";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7">
          <MoreHorizontal size={14} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={onDownload}>
          <Download size={14} /> Download PDF…
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onViewAudit}>
          <History size={14} /> View email audit
        </DropdownMenuItem>
        {invoice.email_status === "failed" && (
          <DropdownMenuItem onClick={onRetryEmail}>
            <RefreshCw size={14} /> Retry failed email
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        {invoice.status === "draft" && (
          <DropdownMenuItem disabled={isPreviewLoading} onClick={onPreviewAndSend}>
            <Send size={14} /> Preview & send
          </DropdownMenuItem>
        )}
        {invoice.status !== "paid" && (
          <DropdownMenuItem onClick={onMarkPaid}>
            <CheckCircle2 size={14} /> Mark as paid
          </DropdownMenuItem>
        )}
        {canCopyHub && (
          <DropdownMenuItem onClick={onCopyHubUnlock}>
            <Link2 size={14} /> Copy Hub unlock link
          </DropdownMenuItem>
        )}
        {invoice.status !== "cancelled" && (
          <DropdownMenuItem onClick={onCancel}>
            <Ban size={14} /> Cancel invoice
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive" onClick={onDelete}>
          <Trash2 size={14} /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
