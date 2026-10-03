import type { ExtractField, NodeData } from "../model/types";
import { TEMPLATE_RE } from "../model/variables";

type Row = Record<string, unknown>;

function select(ctx: Node, selector: string, kind: string): Node[] {
  if (kind === "xpath") {
    const doc = ctx.ownerDocument || (ctx as Document);
    const res = doc.evaluate(selector, ctx, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    return Array.from({ length: res.snapshotLength }, (_, i) => res.snapshotItem(i)!);
  }
  const root = ctx as Element | Document;
  return Array.from(root.querySelectorAll(selector));
}

function textOf(node: Node): string {
  return (node.textContent || "").replace(/\s+/g, " ").trim();
}

export function renderPreview(template: string, scope: Row): string {
  return template.replace(TEMPLATE_RE, (_, name: string, def?: string) => {
    const v = name.split(".").reduce<unknown>((acc, k) => (acc as Row | undefined)?.[k], scope);
    if (v === undefined || v === null || v === "") return def ? def.slice(1).trim() : "";
    return typeof v === "object" ? JSON.stringify(v) : String(v);
  });
}

export function finish(values: unknown[], field: ExtractField): unknown {
  let out = values;
  if (field.regex) {
    try {
      const re = new RegExp(field.regex);
      out = values.flatMap((v) => {
        const m = re.exec(typeof v === "string" ? v : JSON.stringify(v));
        return m ? [m[1] ?? m[0]] : [];
      });
    } catch {
      /* invalid regex while typing */
    }
  }
  if (field.multiple) return out;
  const v = out[0];
  return v === undefined || v === null || v === "" ? field.default || null : v;
}

function fieldValue(block: Node, field: ExtractField, scope: Row): unknown {
  if (field.selector.includes("{{")) {
    return finish([renderPreview(field.selector, scope)], field);
  }
  let selector = field.selector.trim();
  let extract = field.extract || "text";
  let attr = field.attr || "";
  const pseudo = /::(text|attr\(([^)]+)\))\s*$/.exec(selector);
  if (pseudo && field.selector_type === "css") {
    selector = selector.slice(0, pseudo.index).trim();
    if (pseudo[2]) {
      extract = "attr";
      attr = pseudo[2];
    } else extract = "text";
  }
  const nodes = selector ? select(block, selector, field.selector_type) : [block];
  const values = nodes
    .map((n) => {
      if (n.nodeType === Node.ATTRIBUTE_NODE || n.nodeType === Node.TEXT_NODE) return textOf(n);
      const el = n as Element;
      if (extract === "attr" && attr) return el.getAttribute?.(attr) || "";
      if (extract === "html") return el.outerHTML || "";
      return textOf(el);
    })
    .filter((v) => v);
  return finish(values, field);
}

export function previewHtml(html: string, d: NodeData, scope: Row = {}, limit = 8) {
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const blocks = d.item_selector ? select(doc, d.item_selector, d.item_selector_type || "css") : [doc];
    const rows = blocks.slice(0, limit).map((block) => {
      const row: Row = {};
      for (const f of d.fields || []) if (f.name) row[f.name] = fieldValue(block, f, { ...scope, ...row });
      return row;
    });
    return { rows, count: blocks.length, error: undefined as string | undefined };
  } catch (err) {
    return { rows: [] as Row[], count: 0, error: (err as Error).message };
  }
}
