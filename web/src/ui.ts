export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export const fieldControl =
  "min-w-0 rounded-md border border-field-line bg-field px-2 py-1.5 text-xs text-text outline-none focus:border-[#555] focus:outline focus:outline-1 focus:outline-white/30";

export const mono = "font-mono";

export const hint = "text-[11px] leading-snug text-muted";

export const label = "mb-2.5 flex flex-col gap-1 text-xs text-soft";

export const check = "mb-2.5 flex flex-row items-center gap-2 text-xs text-soft";

export const checkMini = "m-0 flex flex-row items-center gap-0.5 text-[11px] text-soft";

export const grid2 = "grid grid-cols-2 gap-x-2";

export const iconBtn =
  "grid h-7 w-7 min-w-7 cursor-pointer place-items-center rounded-md border border-field-line bg-transparent p-0 text-soft";

export const ghost =
  "w-full cursor-pointer rounded-md border border-dashed border-field-line bg-transparent px-1.5 py-1.5 text-soft";

export const ghostSmall = "w-full cursor-pointer rounded-md border border-dashed border-field-line bg-transparent px-1 py-1 text-[11px] text-soft";

export const noticeBase = "mb-2 break-words rounded-md px-2 py-1.5 text-[11px] leading-snug [&_code]:mx-0.5 [&_code]:rounded [&_code]:bg-elevated [&_code]:px-1 [&_code]:font-mono [&_code]:text-[11px]";

export const noticeWarn = cx(noticeBase, "border border-[#3a3220] bg-[#14110a] text-[#e7d5a3]");
export const noticeError = cx(noticeBase, "border border-[#3f1d1d] bg-[#1a0d0d] text-red-300");
export const noticeInfo = cx(noticeBase, "border border-[#2e2e2e] bg-[#0d0d0d] text-soft");

export const secondaryBtn =
  "inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-field-line bg-elevated px-3 py-1.5 text-sm font-medium text-inherit disabled:opacity-60";

export const section = "mb-2.5 rounded-lg border border-line bg-elevated";
export const sectionSummary = "cursor-pointer px-2.5 py-1.5 text-xs font-semibold text-soft";
export const sectionBody = "px-2.5 pb-2.5 pt-1";

export const pickRow = "mb-1.5 flex gap-1.5";
export const narrow = "w-20";

export const segmented = "mb-2.5 flex overflow-hidden rounded-md border border-field-line";
export const segmentBtn = "flex-1 cursor-pointer border-0 bg-transparent px-1.5 py-1.5 text-xs text-soft";
export const segmentOn = "bg-elevated text-text";

export const linkBtn = "cursor-pointer border-0 bg-transparent px-1 text-[11px] text-text";

export const fields = "mb-2.5";
export const fieldsHead = "mb-1.5 flex items-center justify-between text-xs font-semibold text-soft";
export const mapRow = "mb-1.5 grid grid-cols-[1fr_1.5fr_auto_auto_auto] items-center gap-1 rounded-md p-0.5";
export const mapPicking = "outline outline-1 outline-white/40";
export const mapPreview = "col-span-full truncate px-0.5 pb-0.5 font-mono text-[10px] text-soft [&_em]:text-muted";
export const htmlField = "mb-1.5 rounded-md border border-line p-1.5";
export const htmlTop = "mb-1 grid grid-cols-[1fr_1.6fr_auto] gap-1";
export const htmlOpts = "flex items-center gap-1 [&_input]:flex-1 [&_input]:px-1 [&_input]:py-0.5 [&_input]:text-[11px] [&_select]:flex-1 [&_select]:px-1 [&_select]:py-0.5 [&_select]:text-[11px]";
export const sampleSource = "mb-2.5";
export const sampleHead = "mb-1 flex items-center gap-1 text-[11px] text-muted [&>span]:flex-1 [&>span]:truncate";
export const treeHelp = "mb-1 text-[11px] text-text";
export const jsonTree =
  "mb-2.5 max-h-[340px] overflow-auto rounded-md border border-line bg-bg py-1 font-mono text-[11.5px]";
export const methodUrl = "mb-1.5 flex gap-1.5 [&_select]:w-[86px] [&_input]:flex-1";
export const snippet = "m-0 max-h-[220px] overflow-auto whitespace-pre-wrap break-all font-mono text-[11px]";
export const fileLabel = "cursor-pointer rounded-md border border-dashed border-field-line p-1.5 text-center [&_input]:hidden";
export const rowButtons = "-mt-1 mb-2.5 flex gap-1.5";

export const chip =
  "cursor-pointer rounded-full border border-field-line bg-elevated px-2 py-0.5 font-mono text-[11px] text-text";

export const formScope = cx(
  "[&_input]:min-w-0 [&_input]:rounded-md [&_input]:border [&_input]:border-field-line [&_input]:bg-field [&_input]:px-2 [&_input]:py-1.5 [&_input]:text-xs [&_input]:text-text",
  "[&_textarea]:min-h-[72px] [&_textarea]:w-full [&_textarea]:resize-y [&_textarea]:rounded-md [&_textarea]:border [&_textarea]:border-field-line [&_textarea]:bg-field [&_textarea]:px-2 [&_textarea]:py-1.5 [&_textarea]:font-mono [&_textarea]:text-xs [&_textarea]:text-text",
  "[&_select]:min-w-0 [&_select]:rounded-md [&_select]:border [&_select]:border-field-line [&_select]:bg-field [&_select]:px-2 [&_select]:py-1.5 [&_select]:text-xs [&_select]:text-text",
  "[&_input:focus]:border-[#555] [&_input:focus]:outline [&_input:focus]:outline-1 [&_input:focus]:outline-white/30",
  "[&_textarea:focus]:border-[#555] [&_textarea:focus]:outline [&_textarea:focus]:outline-1 [&_textarea:focus]:outline-white/30",
  "[&_select:focus]:border-[#555] [&_select:focus]:outline [&_select:focus]:outline-1 [&_select:focus]:outline-white/30",
);
