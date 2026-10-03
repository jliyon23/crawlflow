import type { NodeData } from "../model/types";
import { Field, NumberInput, RunInfo, Section, TextInput, VariableChips } from "./common";
import type { FormProps } from "./types";

export function PaginationForm({ data, set, report }: FormProps) {
  const kind = data.pagination_type || "next_link";
  return (
    <>
      <div className="notice info">
        Connect this node <strong>after</strong> a Request, then drag its <code>next</code> handle back to that Request
        to form the loop.
      </div>
      <Field label="Strategy">
        <select value={kind} onChange={(e) => set({ pagination_type: e.target.value as NodeData["pagination_type"] })}>
          <option value="next_link">Next link in HTML</option>
          <option value="page_param">Increment ?page= in the URL</option>
          <option value="increment">Increment a variable ({"{{page}}"}, offset…)</option>
          <option value="json_next">Next URL / cursor from JSON</option>
        </select>
      </Field>

      {kind === "next_link" && (
        <div className="pick-row">
          <TextInput mono value={data.next_selector} placeholder="a.next" onChange={(next_selector) => set({ next_selector })} />
          <select
            className="narrow"
            value={data.next_selector_type || "css"}
            onChange={(e) => set({ next_selector_type: e.target.value as "css" | "xpath" })}
          >
            <option value="css">CSS</option>
            <option value="xpath">XPath</option>
          </select>
        </div>
      )}
      {kind === "page_param" && (
        <Field label="Query parameter">
          <TextInput mono value={data.page_param} placeholder="page" onChange={(page_param) => set({ page_param })} />
        </Field>
      )}
      {kind === "increment" && (
        <>
          <Field
            label="Variable"
            hint={
              <>
                Use it in the Request, e.g. <code>{`?page={{${data.page_var || "page"}|${data.page_start ?? 1}}}`}</code>
              </>
            }
          >
            <TextInput mono value={data.page_var} placeholder="page" onChange={(page_var) => set({ page_var })} />
          </Field>
          <div className="grid2">
            <Field label="Start">
              <NumberInput value={data.page_start ?? 1} onChange={(v) => set({ page_start: v ?? 1 })} />
            </Field>
            <Field label="Step">
              <NumberInput value={data.page_step ?? 1} onChange={(v) => set({ page_step: v || 1 })} />
            </Field>
          </div>
        </>
      )}
      {(kind === "page_param" || kind === "increment") && (
        <Field label="Last page / value (optional)">
          <NumberInput allowEmpty value={data.page_end} onChange={(page_end) => set({ page_end })} />
        </Field>
      )}
      {kind === "json_next" && (
        <>
          <Field label="JSONPath of next URL or cursor">
            <TextInput mono value={data.next_path} placeholder="$.pagination.next" onChange={(next_path) => set({ next_path })} />
          </Field>
          <Field label="Store as variable (optional)" hint="Empty = treat the value as the next URL.">
            <TextInput mono value={data.cursor_var} placeholder="cursor" onChange={(cursor_var) => set({ cursor_var })} />
          </Field>
        </>
      )}

      <Section title="Stop conditions">
        <Field label="Max pages per input row">
          <NumberInput allowEmpty value={data.max_pages} onChange={(max_pages) => set({ max_pages })} />
        </Field>
        <Field label="Stop when this matches nothing" hint="e.g. $.data.stores[*] or .store">
          <div className="pick-row">
            <TextInput mono value={data.stop_selector} onChange={(stop_selector) => set({ stop_selector })} />
            <select
              className="narrow"
              value={data.stop_selector_type || "css"}
              onChange={(e) => set({ stop_selector_type: e.target.value as NodeData["stop_selector_type"] })}
            >
              <option value="css">CSS</option>
              <option value="xpath">XPath</option>
              <option value="jsonpath">JSONPath</option>
            </select>
          </div>
        </Field>
      </Section>
      <RunInfo report={report} />
    </>
  );
}

export function LoopForm({ data, set, vars, report }: FormProps) {
  return (
    <>
      <p className="hint">
        Emits one item per element of a list variable (e.g. a parser field marked <em>list</em>). Records from a Parser
        already flow one by one, so you only need this for list-valued fields.
      </p>
      <Field label="List variable">
        <select value={data.loop_var || ""} onChange={(e) => set({ loop_var: e.target.value })}>
          <option value="">Choose…</option>
          {vars.map((v) => (
            <option key={v.name} value={v.name}>
              {v.name} ({v.from})
            </option>
          ))}
        </select>
      </Field>
      <Field label="Item variable name" hint={`Also sets {{${data.item_var || "item"}_index}}`}>
        <TextInput mono value={data.item_var} placeholder="item" onChange={(item_var) => set({ item_var })} />
      </Field>
      <RunInfo report={report} />
    </>
  );
}

export function BranchForm({ data, set, vars, report }: FormProps) {
  return (
    <>
      <Field label="Variable">
        <input list="branch-vars" className="mono" value={data.field || ""} onChange={(e) => set({ field: e.target.value })} />
        <datalist id="branch-vars">
          {vars.map((v) => (
            <option key={v.name} value={v.name} />
          ))}
        </datalist>
      </Field>
      <Field label="Operator">
        <select value={data.operator || "exists"} onChange={(e) => set({ operator: e.target.value as NodeData["operator"] })}>
          <option value="exists">exists / not empty</option>
          <option value="equals">equals</option>
          <option value="contains">contains</option>
          <option value="regex">matches regex</option>
          <option value="gt">greater than</option>
          <option value="lt">less than</option>
        </select>
      </Field>
      {data.operator && data.operator !== "exists" && (
        <Field label="Value">
          <TextInput mono value={data.value} onChange={(value) => set({ value })} />
        </Field>
      )}
      <p className="hint">
        Items go out the <code>true</code> or <code>false</code> handle.
      </p>
      <RunInfo report={report} />
    </>
  );
}

export function FollowForm({ data, set, report }: FormProps) {
  return (
    <>
      <p className="hint">
        Emits every matching link as <code>{"{{link}}"}</code>. Connect to a Request with an empty URL to fetch them.
      </p>
      <Field label="Link selector (CSS)">
        <TextInput mono value={data.link_selector} placeholder="a" onChange={(link_selector) => set({ link_selector })} />
      </Field>
      <Field label="Attribute">
        <TextInput mono value={data.link_attr} placeholder="href" onChange={(link_attr) => set({ link_attr })} />
      </Field>
      <Field label="Allow regex">
        <TextInput mono value={data.allow} onChange={(allow) => set({ allow })} />
      </Field>
      <Field label="Deny regex">
        <TextInput mono value={data.deny} onChange={(deny) => set({ deny })} />
      </Field>
      <RunInfo report={report} />
    </>
  );
}

const EXT: Record<string, string> = { csv: ".csv", json: ".json", jsonl: ".jsonl" };

export function OutputForm({ data, set, vars, report }: FormProps) {
  const format = data.format || "csv";
  const columns = data.columns || [];
  const setFormat = (next: "csv" | "json" | "jsonl") => {
    const path = (data.path || "output/output").replace(/\.(csv|jsonl|json)$/i, "") + EXT[next];
    set({ format: next, path });
  };
  return (
    <>
      <div className="segmented">
        {(["csv", "json", "jsonl"] as const).map((f) => (
          <button key={f} type="button" className={format === f ? "active" : ""} onClick={() => setFormat(f)}>
            {f.toUpperCase()}
          </button>
        ))}
      </div>
      <Field label="File path" hint="Relative to the project folder.">
        <TextInput mono value={data.path} onChange={(path) => set({ path })} />
      </Field>
      <Field
        label="Columns (one per line, optional)"
        hint={
          <>
            Empty = every variable. Rename with <code>Column=variable</code>, nested with <code>geo.lat</code>.
          </>
        }
      >
        <textarea
          rows={Math.min(12, Math.max(4, columns.length + 1))}
          value={columns.join("\n")}
          onChange={(e) => set({ columns: e.target.value.split("\n") })}
        />
      </Field>
      <div className="row-buttons">
        <button type="button" className="ghost small" onClick={() => set({ columns: vars.map((v) => v.name) })}>
          Use all upstream variables
        </button>
        <button type="button" className="ghost small" onClick={() => set({ columns: [] })}>
          Clear
        </button>
      </div>
      <Field label="De-duplicate by (optional)">
        <input list="out-vars" className="mono" value={data.dedupe_key || ""} onChange={(e) => set({ dedupe_key: e.target.value })} />
        <datalist id="out-vars">
          {vars.map((v) => (
            <option key={v.name} value={v.name} />
          ))}
        </datalist>
      </Field>
      <VariableChips variables={vars} title="Variables reaching this output" />
      <RunInfo report={report} />
    </>
  );
}
