import { referencedVars, requestTemplates } from "../model/variables";
import { Field, KeyValueEditor, Section, TextInput, UndefinedWarning, VariableChips } from "./common";
import type { FormProps } from "./types";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"];
const BUILTINS = new Set(["url", "link"]);

export default function RequestForm({ data, set, vars, report }: FormProps) {
  const known = new Set(vars.map((v) => v.name));
  const undefinedVars = referencedVars(...requestTemplates(data)).filter((n) => !known.has(n) && !BUILTINS.has(n));
  const bodyType = data.body_type || "none";
  const urlEmpty = !data.url?.trim();

  return (
    <>
      <VariableChips variables={vars} />
      <div className="method-url">
        <select value={(data.method || "GET").toUpperCase()} onChange={(e) => set({ method: e.target.value })}>
          {METHODS.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
        <TextInput
          mono
          value={data.url}
          placeholder="https://site.com/api/store/{{store_id}}"
          onChange={(url) => set({ url })}
        />
      </div>
      <p className="hint">
        {urlEmpty
          ? "Empty URL uses {{url}} from upstream (Input URL, Follow links, or pagination)."
          : "Relative URLs (/api/...) resolve against the previous response's URL."}
      </p>
      <UndefinedWarning names={undefinedVars} />

      <Section title={`Query params (${Object.keys(data.params || {}).length})`} open={!!Object.keys(data.params || {}).length}>
        <KeyValueEditor value={data.params} onChange={(params) => set({ params })} />
      </Section>
      <Section title={`Headers (${Object.keys(data.headers || {}).length})`} open={!!Object.keys(data.headers || {}).length}>
        <KeyValueEditor value={data.headers} onChange={(headers) => set({ headers })} keyPlaceholder="Header-Name" />
      </Section>
      <Section title={`Cookies (${Object.keys(data.cookies || {}).length})`} open={!!Object.keys(data.cookies || {}).length}>
        <KeyValueEditor value={data.cookies} onChange={(cookies) => set({ cookies })} />
      </Section>
      <Section title="Body" open={bodyType !== "none"}>
        <Field label="Body type">
          <select value={bodyType} onChange={(e) => set({ body_type: e.target.value as typeof bodyType })}>
            <option value="none">None</option>
            <option value="json">JSON</option>
            <option value="form">Form (x-www-form-urlencoded)</option>
            <option value="raw">Raw text</option>
          </select>
        </Field>
        {(bodyType === "json" || bodyType === "raw") && (
          <Field label={bodyType === "json" ? "JSON body (templated)" : "Raw body"}>
            <textarea
              rows={6}
              value={data.body || ""}
              placeholder={bodyType === "json" ? '{"zip": "{{zipcode}}", "page": {{page|1}}}' : ""}
              onChange={(e) => set({ body: e.target.value })}
            />
          </Field>
        )}
        {bodyType === "form" && <KeyValueEditor value={data.form} onChange={(form) => set({ form })} />}
      </Section>
      <Section title="Advanced" open={!!data.proxy || !!data.dont_filter}>
        <Field label="Proxy" hint="Overrides the workflow proxy. Supports {{variables}}.">
          <TextInput mono value={data.proxy} placeholder="http://user:pass@host:port" onChange={(proxy) => set({ proxy })} />
        </Field>
        <label className="check">
          <input type="checkbox" checked={!!data.dont_filter} onChange={(e) => set({ dont_filter: e.target.checked })} />
          Allow duplicate requests (skip de-duplication)
        </label>
      </Section>

      {report?.request && (
        <Section title="Last request sent" open={false}>
          <pre className="snippet">
            {report.request.method} {report.request.url}
            {Object.entries(report.request.headers || {}).map(([k, v]) => `\n${k}: ${v}`)}
            {report.request.body ? `\n\n${report.request.body}` : ""}
          </pre>
        </Section>
      )}
      {report?.response && (
        <Section title={`Last response · ${report.response.status} · ${report.response.content_type || "?"}`} open={false}>
          <pre className="snippet">{report.response.body.slice(0, 4000)}</pre>
        </Section>
      )}
    </>
  );
}
