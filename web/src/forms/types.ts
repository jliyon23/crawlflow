import type { NodeData, NodeReport, ResponseSample } from "../model/types";
import type { Variable } from "../model/variables";

export type FormProps = {
  nodeId: string;
  data: NodeData;
  set: (patch: Partial<NodeData>) => void;
  vars: Variable[];
  report?: NodeReport;
  sampleResponse?: ResponseSample;
  sampleScope?: Record<string, unknown>;
};
