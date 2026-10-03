import { PALETTE, type NodeType } from "../model/types";
import { COLORS, ICONS } from "../canvas/nodes";
import { groupPalette } from "../workflow/helpers";

type Props = {
  onAdd: (type: NodeType) => void;
};

export default function Palette({ onAdd }: Props) {
  return (
    <aside className="palette">
      {groupPalette(PALETTE).map(([category, items]) => (
        <div key={category} className="palette-group">
          <div className="palette-group-title">{category}</div>
          <div className="palette-grid">
            {items.map((p) => {
              const Icon = ICONS[p.type];
              return (
                <button key={p.type} type="button" onClick={() => onAdd(p.type)}>
                  <span className="palette-icon" style={{ color: COLORS[p.type] }}>
                    <Icon size={18} strokeWidth={2.2} />
                  </span>
                  <span className="palette-copy">
                    <strong>{p.title}</strong>
                    <span>{p.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <p className="hint palette-hint">With a node selected, new nodes are added and connected after it.</p>
    </aside>
  );
}
