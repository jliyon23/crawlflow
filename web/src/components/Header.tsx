import { useEffect, useRef, useState, type RefObject } from "react";
import { Download, Eye, Pencil, Play, Save, Upload } from "lucide-react";
import type { Listing } from "../api/client";
import logo from "../assets/images/logo/Crawlflow-text.png";
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

  const quiet =
    "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border-0 bg-transparent px-2 text-[13px] text-soft hover:bg-hover hover:text-text disabled:opacity-60";

  return (
    <header className="flex h-12 items-center gap-2 border-b border-line bg-panel px-3">
      <img className="block h-8 w-auto shrink-0 mix-blend-screen" src={logo} alt="Crawlflow" />
      <div className="flex min-w-0 items-center rounded-md px-1 hover:bg-hover">
        {editingName ? (
          <input
            ref={nameRef}
            className="h-8 max-w-[240px] border-0 bg-transparent px-1.5 text-sm font-semibold outline-none"
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
          <span className="max-w-[240px] truncate px-1.5 text-sm font-semibold">{name || "Untitled pipeline"}</span>
        )}
        <button
          type="button"
          className="grid h-7 w-7 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-muted hover:text-text"
          title="Rename spider"
          aria-label="Rename spider"
          onClick={() => setEditingName(true)}
        >
          <Pencil size={13} />
        </button>
      </div>

      <div className="mx-1 h-5 w-px bg-line" />

      <select
        className="h-8 max-w-52 cursor-pointer appearance-none rounded-md border border-line bg-transparent px-2.5 text-[13px] text-soft outline-none hover:bg-hover hover:text-text"
        value=""
        onChange={(e) => onOpen(e.target.value)}
        aria-label="Open a pipeline"
      >
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

      <div className="flex items-center gap-1">
        <button type="button" className={quiet} onClick={onSave}>
          <Save size={14} /> Save
        </button>
        <button type="button" className={quiet} onClick={() => importRef.current?.click()}>
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
        <button type="button" className={quiet} onClick={onExport}>
          <Download size={14} /> Export
        </button>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <div className="flex items-center gap-2 text-xs text-muted">
          <span>{nodeCount} nodes</span>
          <span className="text-line">·</span>
          <span className={problemCount ? "text-[#f0c674]" : "text-[#3dd68c]"}>{problemCount ? `${problemCount} problems` : "Valid"}</span>
          {itemCount !== null && (
            <>
              <span className="text-line">·</span>
              <span>{itemCount} items</span>
            </>
          )}
          {status && <span className="text-soft">{status}</span>}
        </div>
        <button
          type="button"
          className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-line bg-transparent px-3 text-[13px] text-soft hover:bg-hover hover:text-text disabled:opacity-60"
          disabled={!!busy}
          title="Small capped run to fill node samples"
          onClick={() => onRun(true)}
        >
          <Eye size={14} /> {busy === "preview" ? "Previewing…" : "Preview"}
        </button>
        <button
          type="button"
          className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border-0 bg-coral px-3.5 text-[13px] font-bold text-[#1a0a08] hover:bg-[#ff8575] disabled:opacity-60"
          disabled={!!busy}
          onClick={() => onRun(false)}
        >
          <Play size={14} /> {busy === "run" ? "Running…" : "Run"}
        </button>
      </div>
    </header>
  );
}
