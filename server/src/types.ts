export interface Hunk {
  index: number;
  oldStart: number;
  oldLines: string[];
  newStart: number;
  newLines: string[];
  raw: string[];
}

export interface Annotation {
  hunkIndex: number;
  line: number;
  text: string;
}

export interface DiffDecision {
  accepted: number[];
  rejected: number[];
  annotations: Annotation[];
}

export interface HookInput {
  session_id: string;
  transcript_path?: string;
  tool_name: string;
  tool_input: Record<string, unknown>;
}

export interface HookResponse {
  decision?: "allow" | "block";
  reason?: string;
  updatedInput?: Record<string, unknown>;
}

export type ServerMessage =
  | { type: "question"; id: string; questions: unknown[]; timeoutMs: number }
  | { type: "diff"; id: string; filePath: string; hunks: Hunk[]; timeoutMs: number }
  | { type: "plan-snapshot"; content: string; filePath: string }
  | { type: "server-status"; status: "ready" | "waiting" };

export type ClientMessage =
  | { type: "answer"; id: string; answers: Record<string, string> }
  | { type: "diff-decision"; id: string; decision: DiffDecision }
  | { type: "annotation"; filePath: string; line: number; text: string };
