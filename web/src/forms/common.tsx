import { useEffect, useState, type ReactNode } from "react";
import type { KeyValues, NodeReport } from "../model/types";
import type { Variable } from "../model/variables";
import { chip, ghostSmall, hint as hintClass, iconBtn, label as labelClass, mono as monoClass, noticeError, noticeWarn, section, sectionBody, sectionSummary } from "../ui";

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className={labelClass}>
      {label}
      {children}
      {hint && <span className={hintClass}>{hint}</span>}
    </label>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  mono,
}: {
  value: string | undefined | null;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <input
      className={mono ? monoClass : undefined}
      value={value ?? ""}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function NumberInput({
  value,
  onChange,
  placeholder,
  allowEmpty,
}: {
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  placeholder?: string;
  allowEmpty?: boolean;
}) {
  return (
    <input
      type="number"
      value={value ?? ""}
      placeholder={placeholder}
      onChange={(e) => {
        if (e.target.value === "") onChange(allowEmpty ? null : 0);
        else onChange(Number(e.target.value));
      }}
    />
  );
}

export function Section({ title, children, open = true }: { title: string; children: ReactNode; open?: boolean }) {
  return (
    <details className={section} open={open}>
      <summary className={sectionSummary}>{title}</summary>
      <div className={sectionBody}>{children}</div>
    </details>
  );
}

type Row = { key: string; value: string };

export function KeyValueEditor({
  value,
  onChange,
  keyPlaceholder = "name",
  valuePlaceholder = "value or {{variable}}",
}: {
  value: KeyValues | undefined;
  onChange: (v: KeyValues) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}) {
  const toRows = (v: KeyValues | undefined): Row[] => Object.entries(v || {}).map(([key, val]) => ({ key, value: val }));
  const [rows, setRows] = useState<Row[]>(() => toRows(value));

  useEffect(() => {
    const current = Object.fromEntries(rows.filter((r) => r.key).map((r) => [r.key, r.value]));
    if (JSON.stringify(current) !== JSON.stringify(value || {})) setRows(toRows(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const commit = (next: Row[]) => {
    setRows(next);
    onChange(Object.fromEntries(next.filter((r) => r.key.trim()).map((r) => [r.key.trim(), r.value])));
  };

  return (
    <div className="kv">
      {rows.map((row, i) => (
        <div className="mb-1.5 grid grid-cols-[1fr_1.4fr_auto] gap-1.5" key={i}>
          <input
            className={monoClass}
            placeholder={keyPlaceholder}
            value={row.key}
            onChange={(e) => commit(rows.map((r, j) => (j === i ? { ...r, key: e.target.value } : r)))}
          />
          <input
            className={monoClass}
            placeholder={valuePlaceholder}
            value={row.value}
            onChange={(e) => commit(rows.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)))}
          />
          <button type="button" className={iconBtn} title="Remove" onClick={() => commit(rows.filter((_, j) => j !== i))}>
            ×
          </button>
        </div>
      ))}
      <button type="button" className={ghostSmall} onClick={() => setRows([...rows, { key: "", value: "" }])}>
        + Add
      </button>
    </div>
  );
}

function insertAtCursor(text: string): boolean {
  const el = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null;
  if (!el || !("selectionStart" in el) || !el.closest("[data-inspector]")) return false;
  el.focus();
  return document.execCommand("insertText", false, text);
}

export function VariableChips({ variables, title = "Available variables" }: { variables: Variable[]; title?: string }) {
  const [copied, setCopied] = useState<string | null>(null);
  if (!variables.length) {
    return <div className="mb-2.5 rounded-lg border border-line bg-elevated p-2 text-[11px] text-muted">No upstream variables yet. Connect an Input or Parser node.</div>;
  }
  return (
    <div className="mb-2.5 rounded-lg border border-line bg-elevated p-2">
      <div className="mb-1.5 text-[11px] text-soft">
        {title} <span className={hintClass}>click to insert at cursor</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {variables.map((v) => (
          <button
            key={v.name}
            type="button"
            className={chip}
            title={`from ${v.from}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              const text = `{{${v.name}}}`;
              if (!insertAtCursor(text)) {
                void navigator.clipboard?.writeText(text);
                setCopied(v.name);
                setTimeout(() => setCopied(null), 1200);
              }
            }}
          >
            {copied === v.name ? "copied" : `{{${v.name}}}`}
          </button>
        ))}
      </div>
    </div>
  );
}

export function UndefinedWarning({ names }: { names: string[] }) {
  if (!names.length) return null;
  return (
    <div className={noticeWarn}>
      Undefined variable{names.length > 1 ? "s" : ""}: {names.map((n) => `{{${n}}}`).join(", ")}. Add a default with{" "}
      <code>{"{{name|default}}"}</code> or produce it upstream.
    </div>
  );
}

export function RecordsTable({ rows, max = 8 }: { rows: Record<string, unknown>[]; max?: number }) {
  if (!rows.length) return <div className={hintClass}>No records.</div>;
  const columns: string[] = [];
  for (const r of rows.slice(0, max)) for (const k of Object.keys(r)) if (!columns.includes(k)) columns.push(k);
  return (
    <div className="max-h-[260px] overflow-auto rounded-md border border-line">
      <table className="w-max min-w-full border-collapse text-[11px] [&_td]:max-w-60 [&_td]:overflow-hidden [&_td]:text-ellipsis [&_td]:whitespace-nowrap [&_td]:border-b [&_td]:border-line [&_td]:px-2 [&_td]:py-1 [&_td]:text-left [&_th]:sticky [&_th]:top-0 [&_th]:border-b [&_th]:border-line [&_th]:bg-hover [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:text-soft">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, max).map((r, i) => (
            <tr key={i}>
              {columns.map((c) => (
                <td key={c} title={cell(r[c])}>
                  {cell(r[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export function RunInfo({ report }: { report?: NodeReport }) {
  if (!report) return null;
  return (
    <Section title={`Last run · ${report.in} in → ${report.out} out`}>
      {report.errors.map((e) => (
        <div key={e} className={noticeError}>
          {e}
        </div>
      ))}
      {report.warnings.map((w) => (
        <div key={w} className={noticeWarn}>
          {w}
        </div>
      ))}
      {report.samples.length > 0 && <RecordsTable rows={report.samples} max={5} />}
    </Section>
  );
}
