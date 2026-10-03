import { tableHeader } from "../model/variables";
import { Field, KeyValueEditor, NumberInput, Section, TextInput } from "./common";
import type { FormProps } from "./types";

export default function InputForm({ data, set }: FormProps) {
  const mode = data.input_mode || "single";
  const columns = tableHeader(data.table);
  const rowCount = Math.max(0, (data.table || "").split("\n").filter((l) => l.trim()).length - 1);

  const loadFile = (file: File) => {
    void file.text().then((text) => set({ table: text.trim() }));
  };

  return (
    <>
      <Field label="Mode">
        <select value={mode} onChange={(e) => set({ input_mode: e.target.value as FormProps["data"]["input_mode"] })}>
          <option value="single">Single run / URL</option>
          <option value="list">List of values (one variable)</option>
          <option value="table">Table / CSV (several variables per row)</option>
          <option value="range">Number range</option>
        </select>
      </Field>

      {mode === "single" && (
        <Field label="URL (optional)" hint="Available downstream as {{url}}.">
          <TextInput mono value={data.url} placeholder="https://example.com/" onChange={(url) => set({ url })} />
        </Field>
      )}

      {mode === "list" && (
        <>
          <Field label="Variable name">
            <TextInput mono value={data.list_var} placeholder="zipcode" onChange={(list_var) => set({ list_var })} />
          </Field>
          <Field label={`Values (one per line) · ${(data.values || []).length} rows`}>
            <textarea
              rows={8}
              value={(data.values || []).join("\n")}
              placeholder={"10001\n60601\n73301"}
              onChange={(e) => set({ values: e.target.value.split("\n") })}
            />
          </Field>
        </>
      )}

      {mode === "table" && (
        <>
          <Field
            label={`Rows · ${rowCount} rows`}
            hint={
              columns.length ? (
                <>
                  Columns become variables: {columns.map((c) => <code key={c}>{`{{${c}}}`}</code>)}
                </>
              ) : (
                "First line is the header, e.g. latitude,longitude"
              )
            }
          >
            <textarea
              rows={9}
              value={data.table || ""}
              placeholder={"latitude,longitude\n40.7128,-74.0060\n41.8781,-87.6298"}
              onChange={(e) => set({ table: e.target.value })}
            />
          </Field>
          <label className="file">
            Load CSV file…
            <input
              type="file"
              accept=".csv,.tsv,.txt"
              onChange={(e) => e.target.files?.[0] && loadFile(e.target.files[0])}
            />
          </label>
        </>
      )}

      {mode === "range" && (
        <div className="grid2">
          <Field label="Variable">
            <TextInput mono value={data.range_var} placeholder="page" onChange={(range_var) => set({ range_var })} />
          </Field>
          <Field label="Step">
            <NumberInput value={data.range_step ?? 1} onChange={(v) => set({ range_step: v || 1 })} />
          </Field>
          <Field label="From">
            <NumberInput value={data.range_start ?? 1} onChange={(v) => set({ range_start: v ?? 1 })} />
          </Field>
          <Field label="To (inclusive)">
            <NumberInput value={data.range_end ?? 1} onChange={(v) => set({ range_end: v ?? 1 })} />
          </Field>
        </div>
      )}

      <Section title="Constant variables" open={Object.keys(data.variables || {}).length > 0}>
        <p className="hint">Added to every row, e.g. an API key or country code.</p>
        <KeyValueEditor value={data.variables} onChange={(variables) => set({ variables })} valuePlaceholder="value" />
      </Section>
    </>
  );
}
