import type { PlanReviewDecision } from "./types.js";

interface PendingQuestion {
  resolve: (answers: Record<string, string>) => void;
  reject: (reason: string) => void;
  timeout: ReturnType<typeof setTimeout>;
  questions: unknown[];
  deadline: number;
  sessionId?: string;
  context?: string;
}

export interface AddQuestionOptions {
  id: string;
  questions: unknown[];
  timeoutMs: number;
  sessionId?: string;
  context?: string;
}

interface PendingPlanReview {
  resolve: (decision: PlanReviewDecision) => void;
  reject: (reason: string) => void;
  timeout: ReturnType<typeof setTimeout>;
  content: string;
  filePath?: string;
  sessionId?: string;
  sessionName?: string;
  deadline: number;
}

export interface AddPlanReviewOptions {
  id: string;
  content: string;
  filePath?: string;
  timeoutMs: number;
  sessionId?: string;
  sessionName?: string;
}

class ServerState {
  pendingQuestions = new Map<string, PendingQuestion>();
  pendingPlanReviews = new Map<string, PendingPlanReview>();
  questionRoutingEnabled = true;
  boundPort: number | null = null;
  private counter = 0;

  nextId(): string {
    return `ink_${Date.now()}_${++this.counter}`;
  }

  addQuestion(opts: AddQuestionOptions): Promise<Record<string, string>> {
    const { id, questions, timeoutMs, sessionId, context } = opts;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingQuestions.delete(id);
        reject(new Error("timeout"));
      }, timeoutMs);

      this.pendingQuestions.set(id, {
        resolve,
        reject,
        timeout,
        questions,
        deadline: Date.now() + timeoutMs,
        sessionId,
        context,
      });
    });
  }

  resolveQuestion(id: string, answers: Record<string, string>): boolean {
    const pending = this.pendingQuestions.get(id);
    if (!pending) return false;
    clearTimeout(pending.timeout);
    this.pendingQuestions.delete(id);
    pending.resolve(answers);
    return true;
  }

  releaseQuestion(id: string): boolean {
    const pending = this.pendingQuestions.get(id);
    if (!pending) return false;
    clearTimeout(pending.timeout);
    this.pendingQuestions.delete(id);
    pending.reject("released");
    return true;
  }

  addPlanReview(opts: AddPlanReviewOptions): Promise<PlanReviewDecision> {
    const { id, content, filePath, timeoutMs, sessionId, sessionName } = opts;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingPlanReviews.delete(id);
        reject(new Error("timeout"));
      }, timeoutMs);

      this.pendingPlanReviews.set(id, {
        resolve,
        reject,
        timeout,
        content,
        filePath,
        sessionId,
        sessionName,
        deadline: Date.now() + timeoutMs,
      });
    });
  }

  resolvePlanReview(id: string, decision: PlanReviewDecision): boolean {
    const pending = this.pendingPlanReviews.get(id);
    if (!pending) return false;
    clearTimeout(pending.timeout);
    this.pendingPlanReviews.delete(id);
    pending.resolve(decision);
    return true;
  }

  reset(): void {
    for (const [, pending] of this.pendingQuestions) {
      clearTimeout(pending.timeout);
    }
    for (const [, pending] of this.pendingPlanReviews) {
      clearTimeout(pending.timeout);
    }
    this.pendingQuestions.clear();
    this.pendingPlanReviews.clear();
    this.counter = 0;
  }
}

export const state = new ServerState();
