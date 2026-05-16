export interface QuestionOption {
  label: string;
  description: string;
  preview?: string;
}

export interface Question {
  question: string;
  header: string;
  options: QuestionOption[];
  multiSelect: boolean;
}

export type AnnotationType = "comment" | "deletion" | "global";

export interface PlanAnnotation {
  id: string;
  type: AnnotationType;
  selectedText: string;
  comment?: string;
  createdAt: number;
}

export interface PlanReviewDecision {
  approved: boolean;
  annotations: PlanAnnotation[];
  autoEdit?: boolean;
}

export type ServerMessage =
  | { type: "question"; id: string; questions: Question[]; timeoutMs: number; canvasTimeoutMs?: number; sessionId?: string; context?: string }
  | { type: "question-released"; id: string }
  | { type: "plan-review"; id: string; content: string; filePath?: string; timeoutMs: number; sessionId?: string; sessionName?: string }
  | { type: "server-status"; status: "ready" | "waiting" }
  | { type: "settings-sync"; questionRoutingEnabled: boolean };

export type ClientMessage =
  | { type: "answer"; id: string; answers: Record<string, string> }
  | { type: "question-release"; id: string }
  | { type: "plan-review-decision"; id: string; decision: PlanReviewDecision }
  | { type: "toggle-question-routing"; enabled: boolean };
