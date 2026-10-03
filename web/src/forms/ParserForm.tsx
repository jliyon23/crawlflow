import { useMemo, useState } from "react";
import JsonTree from "../preview/JsonTree";
import { finish, previewHtml, renderPreview } from "../preview/htmlPreview";
import {
  asRecordSelector,
  findWithPaths,
  recordFor,
  toPath,
  tryFind,
  type Match,
  type Segment,
} from "../preview/jsonpath";
import type { ExtractField, NodeData } from "../model/types";
import { Field, RecordsTable, RunInfo, Section, TextInput, VariableChips, cell } from "./common";
import type { FormProps } from "./types";
import {
  check,
  checkMini,
  cx,
  fields as fieldsBox,
  fieldsHead,
  ghostSmall,
  hint,
  htmlField,
  htmlOpts,
  htmlTop,
  iconBtn,
  linkBtn,
  mapPicking,
  mapPreview,
  mapRow,
  mono,
  narrow,
  noticeError,
  noticeWarn,
  pickRow,
  sampleHead,
  sampleSource,
  segmentBtn,
  segmentOn,
  segmented,
  treeHelp,
} from "../ui";

const STORE_PRESET = [
  "StoreId",
  "Name",
  "Street",
  "City",
  "State",
  "ZipCode",
  "Phone",
  "OpenHours",
  "Latitude",
  "Longitude",
  "Url",
];

export default function ParserForm(props: FormProps) {
  const { data, set, vars, report } = props;
  const kind = data.parser_type || "html";
  const sampleText = data.sample || report?.response?.body || props.sampleResponse?.body || "";
  const sampleOrigin = data.sample
    ? "pasted sample"
    : report?.response
      ? `last run · ${report.response.url}`
      : props.sampleResponse
        ? `upstream request · ${props.sampleResponse.url}`
        : "";

  return (
    <>
      <div className={segmented}>
        {(["html", "json"] as const).map((k) => (
          <button
            key={k}
            type="button"
            className={cx(segmentBtn, kind === k && segmentOn)}
            onClick={() =>
              set({
                parser_type: k,
                fields: (data.fields || []).map((f) => ({
                  ...f,
                  selector_type: k === "json" ? "jsonpath" : f.selector_type === "jsonpath" ? "css" : f.selector_type,
                })),
              })
            }
          >
            {k === "html" ? "HTML · CSS / XPath" : "JSON · JSONPath"}
          </button>
        ))}
      </div>

      <SampleSource data={data} set={set} origin={sampleOrigin} kind={kind} />

      {kind === "json" ? (
        <JsonParser {...props} sampleText={sampleText} />
      ) : (
        <HtmlParser {...props} sampleText={sampleText} />
      )}

      <Section title="Advanced" open={!!data.source || !!data.keep_empty}>
        <Field label="Parse a variable instead of the response" hint="e.g. a field holding embedded JSON or HTML">
          <select value={data.source || ""} onChange={(e) => set({ source: e.target.value || undefined })}>
            <option value="">Response body</option>
            {vars.map((v) => (
              <option key={v.name} value={v.name}>
                {`{{${v.name}}}`}
              </option>
            ))}
          </select>
        </Field>
        <label className={check}>
          <input type="checkbox" checked={!!data.keep_empty} onChange={(e) => set({ keep_empty: e.target.checked })} />
          Continue with empty fields when nothing matches
        </label>
      </Section>
      <RunInfo report={report} />
    </>
  );
}

function SampleSource({
  data,
  set,
  origin,
  kind,
}: {
  data: NodeData;
  set: FormProps["set"];
  origin: string;
  kind: string;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <div className={sampleSource}>
      <div className={sampleHead}>
        <span>Sample: {origin || <em>none. Run a preview or paste one</em>}</span>
        <button type="button" className={linkBtn} onClick={() => setEditing(!editing)}>
          {editing ? "done" : "paste"}
        </button>
        {data.sample && (
          <button type="button" className={linkBtn} onClick={() => set({ sample: undefined })}>
            clear
          </button>
        )}
      </div>
      {editing && (
        <textarea
          rows={6}
          placeholder={kind === "json" ? '{"data": {"stores": [...]}}' : "<html>…</html>"}
          value={data.sample || ""}
          onChange={(e) => set({ sample: e.target.value || undefined })}
        />
      )}
    </div>
  );
}

function updateField(fields: ExtractField[], i: number, patch: Partial<ExtractField>) {
  return fields.map((f, j) => (j === i ? { ...f, ...patch } : f));
}

function uniqueName(base: string, fields: ExtractField[]) {
  const clean = base.replace(/[^\w]/g, "_") || "field";
  let name = clean;
  let n = 2;
  while (fields.some((f) => f.name === name)) name = `${clean}_${n++}`;
  return name;
}

// ---------------------------------------------------------------- JSON

type PickTarget = "record" | number | null;

function mapRecord(record: unknown, fields: ExtractField[], scope: Record<string, unknown>) {
  if (!fields.length) return record && typeof record === "object" && !Array.isArray(record) ? (record as Record<string, unknown>) : { value: record };
  const row: Record<string, unknown> = {};
  const base = { ...scope, ...(record && typeof record === "object" && !Array.isArray(record) ? (record as object) : { value: record }) };
  for (const f of fields) {
    if (!f.name) continue;
    if (f.selector.includes("{{")) row[f.name] = finish([renderPreview(f.selector, { ...base, ...row })], f);
    else row[f.name] = finish(tryFind(record, f.selector || f.name).values.filter((v) => v !== null && v !== undefined), f);
  }
  return row;
}

function JsonParser({ data, set, vars, sampleText, sampleScope }: FormProps & { sampleText: string }) {
  const [target, setTarget] = useState<PickTarget>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fields = data.fields || [];

  const parsed = useMemo(() => {
    if (!sampleText.trim()) return { ok: false as const, error: "" };
    try {
      return { ok: true as const, value: JSON.parse(sampleText) as unknown };
    } catch (err) {
      return { ok: false as const, error: `Sample is not JSON: ${(err as Error).message}` };
    }
  }, [sampleText]);

  const records: { matches: Match[]; error?: string } = useMemo(() => {
    if (!parsed.ok) return { matches: [] };
    if (!data.record_path?.trim()) return { matches: [{ value: parsed.value, path: [] }] };
    try {
      return { matches: findWithPaths(parsed.value, data.record_path) };
    } catch (err) {
      return { matches: [], error: (err as Error).message };
    }
  }, [parsed, data.record_path]);

  const first = records.matches[0];
  const highlighted: Segment[][] = useMemo(() => {
    if (!first) return [];
    return fields.flatMap((f) => {
      if (!f.selector || f.selector.includes("{{")) return [];
      try {
        return findWithPaths(first.value, f.selector).map((m) => [...first.path, ...m.path]);
      } catch {
        return [];
      }
    });
  }, [first, fields]);

  const preview = records.matches.slice(0, 5).map((m) => mapRecord(m.value, fields, sampleScope || {}));

  const onPick = (path: Segment[], value: unknown) => {
    setNotice(null);
    if (target === "record" || (target === null && !data.record_path && Array.isArray(value))) {
      set({ record_path: asRecordSelector(path, value) });
      setTarget(null);
      return;
    }
    const record = recordFor(path, records.matches);
    if (!record) {
      setNotice("That value is outside the matched records. Change the record selector or pick inside a highlighted record.");
      return;
    }
    const rel = toPath(path.slice(record.path.length));
    if (typeof target === "number") {
      set({ fields: updateField(fields, target, { selector: rel, selector_type: "jsonpath" }) });
      setTarget(null);
      return;
    }
    const last = [...path].reverse().find((s) => typeof s === "string") as string | undefined;
    set({
      fields: [...fields, { name: uniqueName(last || "value", fields), selector: rel, selector_type: "jsonpath" }],
    });
  };

  return (
    <>
      <Field
        label="Record selector"
        hint={
          records.error ? (
            <span className="text-danger">{records.error}</span>
          ) : parsed.ok ? (
            `${records.matches.length} record${records.matches.length === 1 ? "" : "s"} matched. Each one flows downstream separately.`
          ) : (
            "JSONPath to the list of records, e.g. $.data.stores[*]. Empty = whole document is one record."
          )
        }
      >
        <div className={pickRow}>
          <TextInput
            mono
            value={data.record_path}
            placeholder="$.data.stores[*]"
            onChange={(record_path) => set({ record_path })}
          />
          <PickButton active={target === "record"} onClick={() => setTarget(target === "record" ? null : "record")} />
        </div>
      </Field>

      {parsed.ok ? (
        <>
          <div className={treeHelp}>
            {target === "record"
              ? "Click an array (or one of its items) to use as the record list."
              : typeof target === "number"
                ? `Click a value to map it to "${fields[target]?.name || "field"}".`
                : "Click any key or value to add it as a field (path is relative to its record)."}
          </div>
          <JsonTree
            data={parsed.value}
            records={records.matches.map((m) => m.path)}
            selected={highlighted}
            onPick={onPick}
          />
        </>
      ) : (
        parsed.error && <div className={noticeError}>{parsed.error}</div>
      )}
      {notice && <div className={noticeWarn}>{notice}</div>}

      <div className={fieldsBox}>
        <div className={fieldsHead}>
          <span>Field mapping</span>
          <button
            type="button"
            className={linkBtn}
            onClick={() =>
              set({
                fields: [
                  ...fields,
                  ...STORE_PRESET.filter((n) => !fields.some((f) => f.name === n)).map((name) => ({
                    name,
                    selector: "",
                    selector_type: "jsonpath" as const,
                  })),
                ],
              })
            }
          >
            + store fields preset
          </button>
        </div>
        {fields.map((f, i) => (
          <div key={i} className={cx(mapRow, target === i && mapPicking)}>
            <input
              className={mono}
              placeholder="OutputName"
              value={f.name}
              onChange={(e) => set({ fields: updateField(fields, i, { name: e.target.value }) })}
            />
            <input
              className={mono}
              placeholder="$.address.city or {{var}}"
              value={f.selector}
              onChange={(e) => set({ fields: updateField(fields, i, { selector: e.target.value })})}
            />
            <PickButton active={target === i} onClick={() => setTarget(target === i ? null : i)} />
            <label className={checkMini} title="Keep all matches as a list">
              <input
                type="checkbox"
                checked={!!f.multiple}
                onChange={(e) => set({ fields: updateField(fields, i, { multiple: e.target.checked }) })}
              />
              list
            </label>
            <button type="button" className={iconBtn} title="Remove" onClick={() => set({ fields: fields.filter((_, j) => j !== i) })}>
              ×
            </button>
            {first && f.name && <div className={mapPreview}>{cell(preview[0]?.[f.name]) || <em>no value</em>}</div>}
          </div>
        ))}
        <button
          type="button"
          className={ghostSmall}
          onClick={() => set({ fields: [...fields, { name: "", selector: "", selector_type: "jsonpath" }] })}
        >
          + Add field
        </button>
      </div>
      <VariableChips variables={vars} title="Upstream variables (usable in {{templates}})" />
      {preview.length > 0 && (
        <Section title={`Preview · first ${preview.length} of ${records.matches.length} records`}>
          <RecordsTable rows={preview} />
        </Section>
      )}
    </>
  );
}

function PickButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button type="button" className={cx(iconBtn, active && "border-white bg-white text-black")} title="Pick from the JSON tree" onClick={onClick}>
      ◎
    </button>
  );
}

// ---------------------------------------------------------------- HTML

function HtmlParser({ data, set, vars, sampleText, sampleScope }: FormProps & { sampleText: string }) {
  const fields = data.fields || [];
  const preview = useMemo(
    () => (sampleText ? previewHtml(sampleText, data, sampleScope || {}) : null),
    [sampleText, data, sampleScope],
  );

  return (
    <>
      <Field
        label="Record selector (optional)"
        hint={
          preview && data.item_selector
            ? `${preview.count} element${preview.count === 1 ? "" : "s"} matched in sample`
            : "One record per matched element, e.g. .store-card. Empty = one record per page."
        }
      >
        <div className={pickRow}>
          <TextInput mono value={data.item_selector} placeholder=".store" onChange={(item_selector) => set({ item_selector })} />
          <select
            className={narrow}
            value={data.item_selector_type || "css"}
            onChange={(e) => set({ item_selector_type: e.target.value as "css" | "xpath" })}
          >
            <option value="css">CSS</option>
            <option value="xpath">XPath</option>
          </select>
        </div>
      </Field>

      <div className={fieldsBox}>
        <div className={fieldsHead}>
          <span>Output fields</span>
          <span className={hint}>each becomes {"{{name}}"} downstream</span>
        </div>
        {fields.map((f, i) => {
          const patch = (p: Partial<ExtractField>) => set({ fields: updateField(fields, i, p) });
          return (
            <div key={i} className={htmlField}>
              <div className={htmlTop}>
                <input className={mono} placeholder="store_id" value={f.name} onChange={(e) => patch({ name: e.target.value })} />
                <input
                  className={mono}
                  placeholder={f.selector_type === "xpath" ? "./@data-store-id" : ".name"}
                  value={f.selector}
                  onChange={(e) => patch({ selector: e.target.value })}
                />
                <button type="button" className={iconBtn} title="Remove" onClick={() => set({ fields: fields.filter((_, j) => j !== i) })}>
                  ×
                </button>
              </div>
              <div className={htmlOpts}>
                <select value={f.selector_type} onChange={(e) => patch({ selector_type: e.target.value as "css" | "xpath" })}>
                  <option value="css">CSS</option>
                  <option value="xpath">XPath</option>
                </select>
                <select value={f.extract || "text"} onChange={(e) => patch({ extract: e.target.value as ExtractField["extract"] })}>
                  <option value="text">text</option>
                  <option value="attr">attribute</option>
                  <option value="html">html</option>
                </select>
                {f.extract === "attr" && (
                  <input className={mono} placeholder="href" value={f.attr || ""} onChange={(e) => patch({ attr: e.target.value })} />
                )}
                <input className={mono} placeholder="regex" value={f.regex || ""} onChange={(e) => patch({ regex: e.target.value || null })} />
                <label className={checkMini}>
                  <input type="checkbox" checked={!!f.multiple} onChange={(e) => patch({ multiple: e.target.checked })} />
                  list
                </label>
              </div>
              {preview && f.name && (
                <div className={mapPreview}>{cell(preview.rows[0]?.[f.name]) || <em>no value in first record</em>}</div>
              )}
            </div>
          );
        })}
        <button
          type="button"
          className={ghostSmall}
          onClick={() => set({ fields: [...fields, { name: "", selector: "", selector_type: "css", extract: "text" }] })}
        >
          + Add field
        </button>
      </div>
      <VariableChips variables={vars} title="Upstream variables (usable in {{templates}})" />
      {preview?.error && <div className={noticeError}>{preview.error}</div>}
      {preview && !preview.error && (
        <Section title={`Preview · ${preview.count} record${preview.count === 1 ? "" : "s"} in sample`}>
          <RecordsTable rows={preview.rows} />
        </Section>
      )}
    </>
  );
}
