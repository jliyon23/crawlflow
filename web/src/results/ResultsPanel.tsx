import { useEffect, useState } from "react";
import type { OutputReport, RunReport } from "../model/types";
import { RecordsTable } from "../forms/common";

function serializeItems(output: OutputReport): string {
  const rows = output.items || [];
  if (output.format === "json") return JSON.stringify(rows, null, 2);
  if (output.format === "csv") {
    const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
    const cell = (value: unknown) => {
      const text = value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    return [columns.join(","), ...rows.map((row) => columns.map((key) => cell(row[key])).join(","))].join("\n");
  }
  return rows.map((row) => JSON.stringify(row)).join("\n");
}

function downloadOutput(output: OutputReport, label: string) {
  const filename = output.filename || output.path || `${label}.${output.format || "json"}`;
  const blob = new Blob([output.content || serializeItems(output)], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

type Props = {
  report: RunReport | null;
  error: string | null;
  labels: Record<string, string>;
  onClose: () => void;
};

export default function ResultsPanel({ report, error, labels, onClose }: Props) {
  const outputIds = Object.keys(report?.outputs || {});
  const [tab, setTab] = useState<string>("");
  useEffect(() => {
    setTab(error ? "log" : outputIds[0] || "log");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report, error]);

  if (!report && !error) return null;
  const nodeErrors = Object.entries(report?.nodes || {}).flatMap(([id, n]) =>
    n.errors.map((e) => `${labels[id] || id}: ${e}`),
  );
  const current = report?.outputs[tab];

  return (
    <section className="results">
      <div className="results-head">
        <strong>
          {error
            ? "Run failed"
            : `${report?.preview ? "Preview" : "Run"} finished · ${report?.count ?? 0} records${
                report?.reason && report.reason !== "finished" ? ` · stopped: ${report.reason}` : ""
              }`}
        </strong>
        <div className="tabs">
          {outputIds.map((id) => (
            <button key={id} type="button" className={tab === id ? "active" : ""} onClick={() => setTab(id)}>
              {labels[id] || id} ({report!.outputs[id].count})
            </button>
          ))}
          {nodeErrors.length > 0 && (
            <button type="button" className={tab === "errors" ? "active" : ""} onClick={() => setTab("errors")}>
              Errors ({nodeErrors.length})
            </button>
          )}
          <button type="button" className={tab === "log" ? "active" : ""} onClick={() => setTab("log")}>
            Log
          </button>
        </div>
        <button type="button" className="icon" title="Close" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="results-body">
        {error && tab === "log" && <pre className="log">{error}</pre>}
        {!error && tab === "log" && <pre className="log">{report?.log}</pre>}
        {tab === "errors" &&
          nodeErrors.map((e) => (
            <div key={e} className="notice error">
              {e}
            </div>
          ))}
        {current && (
          <>
            <div className="hint results-file">
              <span>
                {current.count} records
                {current.count > current.items.length ? ` · showing first ${current.items.length}` : ""}
              </span>
              <button type="button" className="secondary" onClick={() => downloadOutput(current, labels[tab] || tab)}>
                Download {current.filename || current.path}
              </button>
            </div>
            <RecordsTable rows={current.items} max={200} />
          </>
        )}
      </div>
    </section>
  );
}
