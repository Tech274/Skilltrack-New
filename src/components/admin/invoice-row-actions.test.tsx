import { describe, it, expect, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";
import { InvoiceRowActions, type InvoiceRowActionsProps } from "./invoice-row-actions";

/**
 * Unit tests for the InvoiceRowActions dropdown.
 *
 * These tests don't mount the component into a DOM — they call it as a pure
 * function and walk the returned React element tree. That keeps the test
 * runner dependency-free (no jsdom / @testing-library) while still locking
 * in the menu's conditional structure, which is the part that regressed
 * before and broke the build with mismatched JSX closing tags.
 */

type AnyEl = ReactElement<{ children?: ReactNode; onClick?: () => void }>;

function walk(node: ReactNode, out: AnyEl[] = []): AnyEl[] {
  if (node == null || node === false || node === true) return out;
  if (Array.isArray(node)) {
    for (const c of node) walk(c, out);
    return out;
  }
  if (typeof node === "object" && "type" in (node as object)) {
    const el = node as AnyEl;
    out.push(el);
    const children = el.props?.children;
    if (children != null) walk(children, out);
  }
  return out;
}

function labelOf(el: AnyEl): string {
  const parts: string[] = [];
  walk(el.props?.children, []).forEach((c) => {
    if (typeof c === "string") parts.push(c);
  });
  // Also collect direct string children
  const collect = (n: ReactNode) => {
    if (typeof n === "string") parts.push(n);
    else if (Array.isArray(n)) n.forEach(collect);
    else if (n && typeof n === "object" && "props" in (n as object)) {
      collect((n as AnyEl).props?.children);
    }
  };
  collect(el.props?.children);
  return parts.join(" ");
}

function menuItems(tree: AnyEl[]) {
  return tree.filter((el) => {
    const t = el.type as any;
    return typeof t === "object" && t?.displayName === "DropdownMenuItem"
      // Fallback for our wrapper components whose displayName isn't set:
      || (typeof t === "function" && t.name === "DropdownMenuItem");
  });
}

function renderProps(overrides: Partial<InvoiceRowActionsProps> = {}): InvoiceRowActionsProps {
  return {
    invoice: { id: "i1", invoice_number: "INV-1", status: "sent", email_status: null },
    isPreviewLoading: false,
    onDownload: vi.fn(),
    onViewAudit: vi.fn(),
    onRetryEmail: vi.fn(),
    onPreviewAndSend: vi.fn(),
    onMarkPaid: vi.fn(),
    onCancel: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  };
}

function renderTree(props: InvoiceRowActionsProps) {
  const root = (InvoiceRowActions as unknown as (p: InvoiceRowActionsProps) => AnyEl)(props);
  return walk(root);
}

describe("InvoiceRowActions", () => {
  it("renders Download and View email audit for every invoice", () => {
    const props = renderProps();
    const items = menuItems(renderTree(props));
    const labels = items.map(labelOf).join(" | ");
    expect(labels).toContain("Download PDF");
    expect(labels).toContain("View email audit");
  });

  it("hides the retry action when email_status is not 'failed'", () => {
    const labels = menuItems(renderTree(renderProps({
      invoice: { id: "i1", invoice_number: "INV-1", status: "sent", email_status: "sent" },
    }))).map(labelOf).join(" | ");
    expect(labels).not.toContain("Retry failed email");
  });

  it("shows the retry action only when email_status is 'failed'", () => {
    const labels = menuItems(renderTree(renderProps({
      invoice: { id: "i1", invoice_number: "INV-1", status: "sent", email_status: "failed" },
    }))).map(labelOf).join(" | ");
    expect(labels).toContain("Retry failed email");
  });

  it("only offers 'Preview & send' for draft invoices", () => {
    const draftLabels = menuItems(renderTree(renderProps({
      invoice: { id: "i1", invoice_number: "INV-1", status: "draft" },
    }))).map(labelOf).join(" | ");
    expect(draftLabels).toContain("Preview & send");

    const sentLabels = menuItems(renderTree(renderProps({
      invoice: { id: "i1", invoice_number: "INV-1", status: "sent" },
    }))).map(labelOf).join(" | ");
    expect(sentLabels).not.toContain("Preview & send");
  });

  it("hides 'Mark as paid' for paid invoices and hides 'Cancel invoice' for cancelled ones", () => {
    const paid = menuItems(renderTree(renderProps({
      invoice: { id: "i1", invoice_number: "INV-1", status: "paid" },
    }))).map(labelOf).join(" | ");
    expect(paid).not.toContain("Mark as paid");
    expect(paid).toContain("Cancel invoice");

    const cancelled = menuItems(renderTree(renderProps({
      invoice: { id: "i1", invoice_number: "INV-1", status: "cancelled" },
    }))).map(labelOf).join(" | ");
    expect(cancelled).toContain("Mark as paid");
    expect(cancelled).not.toContain("Cancel invoice");
  });

  it("always renders the destructive Delete action last", () => {
    const items = menuItems(renderTree(renderProps()));
    const last = items[items.length - 1];
    expect(labelOf(last)).toContain("Delete");
  });

  it("wires the Download handler to onDownload", () => {
    const onDownload = vi.fn();
    const items = menuItems(renderTree(renderProps({ onDownload })));
    const download = items.find((i) => labelOf(i).includes("Download PDF"))!;
    download.props.onClick?.();
    expect(onDownload).toHaveBeenCalledTimes(1);
  });
});
