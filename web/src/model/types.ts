export type NodeType =
  | "input"
  | "request"
  | "parser"
  | "pagination"
  | "loop"
  | "follow"
  | "branch"
  | "output";

export type ExtractField = {
  name: string;
  selector: string;
  selector_type: "css" | "xpath" | "jsonpath";
  extract?: "text" | "attr" | "html";
  attr?: string | null;
  multiple?: boolean;
  regex?: string | null;
  default?: string | null;
};

export type KeyValues = Record<string, string>;

export type NodeData = {
  label?: string;

  input_mode?: "single" | "list" | "table" | "range";
  variables?: KeyValues;
  list_var?: string;
  values?: string[];
  table?: string;
  range_var?: string;
  range_start?: number;
  range_end?: number;
  range_step?: number;

  url?: string;
  method?: string;
  params?: KeyValues;
  headers?: KeyValues;
  cookies?: KeyValues;
  body_type?: "none" | "raw" | "json" | "form";
  body?: string;
  form?: KeyValues;
  proxy?: string;
  dont_filter?: boolean;

  parser_type?: "html" | "json";
  source?: string;
  item_selector?: string;
  item_selector_type?: "css" | "xpath";
  record_path?: string;
  fields?: ExtractField[];
  keep_empty?: boolean;
  sample?: string;

  link_selector?: string;
  link_attr?: string;
  allow?: string;
  deny?: string;

  pagination_type?: "next_link" | "page_param" | "json_next" | "increment";
  next_selector?: string;
  next_selector_type?: "css" | "xpath";
  next_path?: string;
  cursor_var?: string;
  page_param?: string;
  page_var?: string;
  page_start?: number;
  page_step?: number;
  page_end?: number | null;
  max_pages?: number | null;
  stop_selector?: string;
  stop_selector_type?: "css" | "xpath" | "jsonpath";

  loop_var?: string;
  item_var?: string;

  field?: string;
  operator?: "exists" | "equals" | "contains" | "gt" | "lt" | "regex";
  value?: string;

  format?: "jsonl" | "json" | "csv";
  path?: string;
  columns?: string[];
  dedupe_key?: string;

  [key: string]: unknown;
};

export type CrawlSettings = {
  user_agent: string;
  headers: KeyValues;
  cookies: KeyValues;
  proxy?: string | null;
  concurrent_requests: number;
  concurrent_requests_per_domain: number;
  download_delay: number;
  randomize_download_delay: boolean;
  robots_txt: boolean;
  cookies_enabled: boolean;
  retry_times: number;
  download_timeout: number;
  autothrottle: boolean;
  http_cache: boolean;
  allowed_domains: string[];
  max_pages?: number | null;
  max_items?: number | null;
  max_depth?: number | null;
  dont_filter: boolean;
};

export type WorkflowNode = {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: NodeData;
};

export type WorkflowEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
};

export type Workflow = {
  id: string;
  name: string;
  settings: CrawlSettings;
  variables: KeyValues;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
};

export type ResponseSample = {
  url: string;
  status: number;
  content_type: string;
  body: string;
  truncated: boolean;
};

export type NodeReport = {
  in: number;
  out: number;
  samples: Record<string, unknown>[];
  errors: string[];
  warnings: string[];
  response?: ResponseSample;
  request?: { method: string; url: string; headers: KeyValues; body: string | null };
};

export type OutputReport = {
  path: string;
  format: string;
  count: number;
  items: Record<string, unknown>[];
};

export type RunReport = {
  count: number;
  outputs: Record<string, OutputReport>;
  nodes: Record<string, NodeReport>;
  reason?: string;
  problems: string[];
  log: string;
  preview?: boolean;
};

export const defaultSettings = (): CrawlSettings => ({
  user_agent: "Crawlflow/0.2 (+local research crawler)",
  headers: {},
  cookies: {},
  proxy: "",
  concurrent_requests: 8,
  concurrent_requests_per_domain: 4,
  download_delay: 0.5,
  randomize_download_delay: true,
  robots_txt: true,
  cookies_enabled: true,
  retry_times: 2,
  download_timeout: 30,
  autothrottle: false,
  http_cache: false,
  allowed_domains: [],
  max_pages: 50,
  max_items: 500,
  max_depth: null,
  dont_filter: false,
});

export const PALETTE: Array<{ type: NodeType; title: string; hint: string; category: string }> = [
  { type: "input", title: "Input", hint: "URL, list, table, range", category: "Sources" },
  { type: "request", title: "Request", hint: "GET / POST with {{vars}}", category: "Fetch" },
  { type: "follow", title: "Follow links", hint: "Link extractor", category: "Fetch" },
  { type: "pagination", title: "Pagination", hint: "Next link, page, cursor", category: "Fetch" },
  { type: "parser", title: "Parser", hint: "HTML or JSON → fields", category: "Transform" },
  { type: "loop", title: "Loop", hint: "Iterate a list variable", category: "Transform" },
  { type: "branch", title: "Branch", hint: "If / else filter", category: "Transform" },
  { type: "output", title: "Output", hint: "CSV / JSON / JSONL", category: "Export" },
];

export function defaultData(type: NodeType): NodeData {
  switch (type) {
    case "input":
      return { label: "Input", input_mode: "single", url: "", variables: {} };
    case "request":
      return { label: "Request", method: "GET", url: "", params: {}, headers: {}, cookies: {}, body_type: "none" };
    case "parser":
      return { label: "Parser", parser_type: "html", item_selector: "", item_selector_type: "css", fields: [] };
    case "pagination":
      return { label: "Pagination", pagination_type: "next_link", next_selector: ".next a", max_pages: 20 };
    case "loop":
      return { label: "Loop", loop_var: "", item_var: "item" };
    case "branch":
      return { label: "Branch", field: "", operator: "exists" };
    case "follow":
      return { label: "Follow links", link_selector: "a", link_attr: "href" };
    case "output":
      return { label: "Output", format: "csv", path: "output/output.csv", columns: [] };
  }
}
