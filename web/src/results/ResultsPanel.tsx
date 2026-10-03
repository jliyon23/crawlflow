import { useEffect, useState } from "react";
import type { RunReport } from "../model/types";
import { RecordsTable } from "../forms/common";

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
            <div className="hint">
              {current.count} records written to <code>{current.path}</code>
              {current.count > current.items.length ? ` · showing first ${current.items.length}` : ""}
            </div>
            <RecordsTable rows={current.items} max={200} />
          </>
        )}
      </div>
    </section>
  );
}
