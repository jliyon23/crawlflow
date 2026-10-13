import { PanelLeft } from "lucide-react";
import { PALETTE, type NodeType } from "../model/types";
import { NodeGlyph } from "../canvas/nodes";

type Props = {
  onAdd: (type: NodeType) => void;
  onCollapse: () => void;
};

export default function Palette({ onAdd, onCollapse }: Props) {
  return (
    <aside className="flex h-full w-full flex-col overflow-hidden border-r border-line bg-panel" aria-label="Add a node">
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-line bg-panel px-3.5 pr-2 text-xs font-semibold text-soft">
        <span>Nodes</span>
        <button type="button" className="grid h-[26px] w-[26px] cursor-pointer place-items-center rounded-md border-0 bg-transparent p-0 text-muted hover:bg-hover hover:text-text" title="Hide nodes" onClick={onCollapse}>
          <PanelLeft size={15} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-white/10">
          {PALETTE.map((p) => (
              <button key={p.type} type="button" title={p.hint} className="flex cursor-pointer flex-col items-center gap-1.5 border-0 bg-panel px-1.5 py-2.5 text-center text-inherit hover:bg-hover" onClick={() => onAdd(p.type)}>
                <NodeGlyph type={p.type} />
                <span className="text-[11px] font-semibold leading-tight">{p.title}</span>
              </button>
            ))}
        </div>
      </div>
    </aside>
  );
}
