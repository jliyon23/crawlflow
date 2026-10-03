import type { RefObject } from "react";
import type { Listing } from "../api/client";
import { NEW_PIPELINE_VALUE } from "../constants";

type Props = {
  name: string;
  status: string;
  busy: "run" | "preview" | null;
  listing: Listing[];
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

  return (
    <header>
      <div className="brand">Crawlflow</div>
      <select className="open" value="" onChange={(e) => onOpen(e.target.value)}>
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
      <input className="name" value={name} onChange={(e) => onName(e.target.value)} />
      {status && <span className="status">{status}</span>}
      <button type="button" className="secondary" onClick={onSave}>
        Save
      </button>
      <button type="button" className="secondary" onClick={() => importRef.current?.click()}>
        Import
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
        Export
      </button>
      <button
        type="button"
        className="secondary accent"
        disabled={!!busy}
        title="Small capped run to fill node samples"
        onClick={() => onRun(true)}
      >
        {busy === "preview" ? "Previewing…" : "Preview"}
      </button>
      <button type="button" className="run" disabled={!!busy} onClick={() => onRun(false)}>
        {busy === "run" ? "Running…" : "Run"}
      </button>
    </header>
  );
}
