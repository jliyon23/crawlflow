import type { ComponentType } from "react";
import type { CrawlSettings, KeyValues, NodeData, NodeReport, NodeType, ResponseSample } from "./types";
import type { Variable } from "./variables";
import { Field, KeyValueEditor, NumberInput, RunInfo, Section } from "./forms/common";
import InputForm from "./forms/InputForm";
import RequestForm from "./forms/RequestForm";
import ParserForm from "./forms/ParserForm";
import { BranchForm, FollowForm, LoopForm, OutputForm, PaginationForm } from "./forms/FlowForms";
import type { FormProps } from "./forms/types";
import { COLORS } from "./nodes";

type SelectedNode = {
  id: string;
  type: NodeType;
  data: NodeData;
  vars: Variable[];
  report?: NodeReport;
  sampleResponse?: ResponseSample;
  sampleScope?: Record<string, unknown>;
};

type Props = {
  settings: CrawlSettings;
  onSettings: (s: CrawlSettings) => void;
  globals: KeyValues;
  onGlobals: (v: KeyValues) => void;
  problems: string[];
  selected: SelectedNode | null;
  onNodeData: (data: NodeData) => void;
  onDelete: () => void;
};

const FORMS: Record<NodeType, ComponentType<FormProps>> = {
  input: InputForm,
  request: RequestForm,
  parser: ParserForm,
  pagination: PaginationForm,
  loop: LoopForm,
  branch: BranchForm,
  follow: FollowForm,
  output: OutputForm,
};

export default function Inspector({ settings, onSettings, globals, onGlobals, problems, selected, onNodeData, onDelete }: Props) {
  return (
    <aside className="inspector">
      {selected ? (
        <NodeForm key={selected.id} node={selected} onChange={onNodeData} onDelete={onDelete} />
      ) : (
        <SettingsForm
          settings={settings}
          onChange={onSettings}
          globals={globals}
          onGlobals={onGlobals}
          problems={problems}
        />
      )}
    </aside>
  );
}

function NodeForm({ node, onChange, onDelete }: { node: SelectedNode; onChange: (d: NodeData) => void; onDelete: () => void }) {
  const set = (patch: Partial<NodeData>) => onChange({ ...node.data, ...patch });
  const Form = FORMS[node.type];
  return (
    <>
      <div className="inspector-head">
        <span className="type-badge" style={{ background: COLORS[node.type] }}>
          {node.type}
        </span>
        <input className="title-input" value={node.data.label || ""} onChange={(e) => set({ label: e.target.value })} />
        <button type="button" className="icon danger" title="Delete node" onClick={onDelete}>
          🗑
        </button>
      </div>
      <Form
        nodeId={node.id}
        data={node.data}
        set={set}
        vars={node.vars}
        report={node.report}
        sampleResponse={node.sampleResponse}
        sampleScope={node.sampleScope}
      />
      {(node.type === "input" || node.type === "request") && <RunInfo report={node.report} />}
    </>
  );
}

function SettingsForm({
  settings,
  onChange,
  globals,
  onGlobals,
  problems,
}: {
  settings: CrawlSettings;
  onChange: (s: CrawlSettings) => void;
  globals: KeyValues;
  onGlobals: (v: KeyValues) => void;
  problems: string[];
}) {
  const set = <K extends keyof CrawlSettings>(key: K, value: CrawlSettings[K]) => onChange({ ...settings, [key]: value });
  return (
    <>
      <h2>Workflow</h2>
      {problems.length > 0 && (
        <Section title={`Checks (${problems.length})`}>
          {problems.map((p) => (
            <div key={p} className="notice warn">
              {p}
            </div>
          ))}
        </Section>
      )}
      <Section title="Workflow variables">
        <p className="hint">Constants available everywhere, e.g. {"{{base_url}}"} or {"{{api_key}}"}.</p>
        <KeyValueEditor value={globals} onChange={onGlobals} valuePlaceholder="value" />
      </Section>
      <Section title="HTTP defaults">
        <Field label="User-Agent">
          <input value={settings.user_agent} onChange={(e) => set("user_agent", e.target.value)} />
        </Field>
        <Field label="Default headers">
          <KeyValueEditor value={settings.headers} onChange={(v) => set("headers", v)} keyPlaceholder="Header-Name" />
        </Field>
        <Field label="Default cookies">
          <KeyValueEditor value={settings.cookies} onChange={(v) => set("cookies", v)} />
        </Field>
        <Field label="Proxy">
          <input placeholder="http://host:port" value={settings.proxy || ""} onChange={(e) => set("proxy", e.target.value)} />
        </Field>
      </Section>
      <Section title="Crawl behaviour">
        <div className="grid2">
          <Field label="Concurrent requests">
            <NumberInput value={settings.concurrent_requests} onChange={(v) => set("concurrent_requests", v || 1)} />
          </Field>
          <Field label="Per domain">
            <NumberInput
              value={settings.concurrent_requests_per_domain}
              onChange={(v) => set("concurrent_requests_per_domain", v || 1)}
            />
          </Field>
          <Field label="Download delay (s)">
            <input
              type="number"
              step="0.1"
              value={settings.download_delay}
              onChange={(e) => set("download_delay", Number(e.target.value))}
            />
          </Field>
          <Field label="Timeout (s)">
            <NumberInput value={settings.download_timeout} onChange={(v) => set("download_timeout", v || 30)} />
          </Field>
          <Field label="Retries">
            <NumberInput value={settings.retry_times} onChange={(v) => set("retry_times", v ?? 0)} />
          </Field>
        </div>
        <label className="check">
          <input type="checkbox" checked={settings.robots_txt} onChange={(e) => set("robots_txt", e.target.checked)} />
          Obey robots.txt
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={settings.cookies_enabled}
            onChange={(e) => set("cookies_enabled", e.target.checked)}
          />
          Cookies enabled
        </label>
        <label className="check">
          <input type="checkbox" checked={settings.autothrottle} onChange={(e) => set("autothrottle", e.target.checked)} />
          Autothrottle
        </label>
        <label className="check">
          <input type="checkbox" checked={settings.http_cache} onChange={(e) => set("http_cache", e.target.checked)} />
          HTTP cache (handy while designing)
        </label>
      </Section>
      <Section title="Limits">
        <div className="grid2">
          <Field label="Max responses">
            <NumberInput allowEmpty value={settings.max_pages} onChange={(v) => set("max_pages", v || null)} />
          </Field>
          <Field label="Max records">
            <NumberInput allowEmpty value={settings.max_items} onChange={(v) => set("max_items", v || null)} />
          </Field>
          <Field label="Max depth">
            <NumberInput allowEmpty value={settings.max_depth} onChange={(v) => set("max_depth", v || null)} />
          </Field>
        </div>
        <Field label="Allowed domains (comma)" hint="Empty = derived from static URLs, or unrestricted when URLs are templated.">
          <input
            value={settings.allowed_domains.join(", ")}
            onChange={(e) =>
              set(
                "allowed_domains",
                e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              )
            }
          />
        </Field>
      </Section>
    </>
  );
}
