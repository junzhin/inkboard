import type { DiffDecision, Hunk } from "./types.js";

interface PendingQuestion {
  resolve: (answers: Record<string, string>) => void;
  reject: (reason: string) => void;
  timeout: ReturnType<typeof setTimeout>;
  questions: unknown[];
  createdAt: number;
}

interface PendingDiff {
  resolve: (decision: DiffDecision) => void;
  reject: (reason: string) => void;
  timeout: ReturnType<typeof setTimeout>;
  hunks: Hunk[];
  filePath: string;
  createdAt: number;
}

class ServerState {
  pendingQuestions = new Map<string, PendingQuestion>();
  pendingDiffs = new Map<string, PendingDiff>();
  currentPlan: { content: string; filePath: string } | null = null;
  private counter = 0;

  nextId(): string {
    return `ink_${Date.now()}_${++this.counter}`;
  }

  addQuestion(
    id: string,
    questions: unknown[],
    timeoutMs: number
  ): Promise<Record<string, string>> {
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
        createdAt: Date.now(),
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

  addDiff(
    id: string,
    filePath: string,
    hunks: Hunk[],
    timeoutMs: number
  ): Promise<DiffDecision> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingDiffs.delete(id);
        reject(new Error("timeout"));
      }, timeoutMs);

      this.pendingDiffs.set(id, {
        resolve,
        reject,
        timeout,
        hunks,
        filePath,
        createdAt: Date.now(),
      });
    });
  }

  resolveDiff(id: string, decision: DiffDecision): boolean {
    const pending = this.pendingDiffs.get(id);
    if (!pending) return false;
    clearTimeout(pending.timeout);
    this.pendingDiffs.delete(id);
    pending.resolve(decision);
    return true;
  }

  setPlan(content: string, filePath: string): void {
    this.currentPlan = { content, filePath };
  }

  reset(): void {
    for (const [, pending] of this.pendingQuestions) {
      clearTimeout(pending.timeout);
    }
    for (const [, pending] of this.pendingDiffs) {
      clearTimeout(pending.timeout);
    }
    this.pendingQuestions.clear();
    this.pendingDiffs.clear();
    this.currentPlan = null;
    this.counter = 0;
  }
}

export const state = new ServerState();
