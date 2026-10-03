import { useEffect, useRef, useState, type RefObject } from "react";
import { Download, Eye, Pencil, Play, Save, Upload } from "lucide-react";
import type { Listing } from "../api/client";
import logo from "../assets/images/logo/Crawlflow-nobg.png";
import { NEW_PIPELINE_VALUE } from "../constants";

type Props = {
  name: string;
  status: string;
  busy: "run" | "preview" | null;
  listing: Listing[];
  nodeCount: number;
  problemCount: number;
  itemCount: number | null;
  importRef: RefObject<HTMLInputElement | null>;
  onName: (name: string) => void;
  onOpen: (entry: string) => void;
  onSave: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onRun: (preview: boolean) => void;
};

export default function Header({
  name,
  status,
  busy,
  listing,
  nodeCount,
  problemCount,
  itemCount,
  importRef,
  onName,
  onOpen,
  onSave,
  onExport,
  onImport,
  onRun,
}: Props) {
  const saved = listing.filter((l) => l.source === "saved");
  const examples = listing.filter((l) => l.source === "example");
  const [editingName, setEditingName] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingName) nameRef.current?.select();
  }, [editingName]);

  return (
    <header>
      <div className="nav-title">
        <img className="brand" src={logo} alt="Crawlflow" />
        <div className="name-field">
          {editingName ? (
            <input
              ref={nameRef}
              className="name"
              value={name}
              size={Math.max(name.length, 12)}
              onChange={(e) => onName(e.target.value)}
              onBlur={() => setEditingName(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
              }}
              placeholder="Untitled pipeline"
              aria-label="Spider name"
            />
          ) : (
            <span className="name-title">{name || "Untitled pipeline"}</span>
          )}
          <button
            type="button"
            className="name-edit"
            title="Rename spider"
            aria-label="Rename spider"
            onClick={() => setEditingName(true)}
          >
            <Pencil size={14} />
          </button>
        </div>
      </div>
      <div className="nav-tools">
        <select className="open" value="" onChange={(e) => onOpen(e.target.value)} aria-label="Open a pipeline">
          <option value="">Open…</option>
          <option value={NEW_PIPELINE_VALUE}>New blank pipeline</option>
          {saved.length > 0 && (
            <optgroup label="Saved">
              {saved.map((l) => (
                <option key={`s-${l.id}`} value={`saved:${l.id}`}>
                  {l.name}
                </option>
              ))}
            </optgroup>
          )}
          <optgroup label="Examples">
            {examples.map((l) => (
              <option key={`e-${l.id}`} value={`example:${l.id}`}>
                {l.name}
              </option>
            ))}
          </optgroup>
        </select>
        <div className="tool-group">
          <button type="button" className="secondary" onClick={onSave}>
            <Save size={14} /> Save
          </button>
          <button type="button" className="secondary" onClick={() => importRef.current?.click()}>
            <Upload size={14} /> Import
          </button>
          <input
            ref={importRef}
            type="file"
            accept=".json"
            hidden
            onChange={(e) => {
              if (e.target.files?.[0]) onImport(e.target.files[0]);
              e.target.value = "";
            }}
          />
          <button type="button" className="secondary" onClick={onExport}>
            <Download size={14} /> Export
          </button>
        </div>
        <div className="nav-meta">
          <span>{nodeCount} nodes</span>
          <span className={problemCount ? "warn" : ""}>{problemCount ? `${problemCount} problems` : "Valid"}</span>
          {itemCount !== null && <span>{itemCount} items</span>}
          {status && <span className="status">{status}</span>}
        </div>
        <div className="tool-group run-group">
          <button
            type="button"
            className="secondary"
            disabled={!!busy}
            title="Small capped run to fill node samples"
            onClick={() => onRun(true)}
          >
            <Eye size={14} /> {busy === "preview" ? "Previewing…" : "Preview"}
          </button>
          <button type="button" className="run" disabled={!!busy} onClick={() => onRun(false)}>
            <Play size={14} /> {busy === "run" ? "Running…" : "Run"}
          </button>
        </div>
      </div>
    </header>
  );
}
