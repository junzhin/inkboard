import type { PlanReviewDecision } from "./types.js";
interface PendingQuestion {
    resolve: (answers: Record<string, string>) => void;
    reject: (reason: string) => void;
    timeout: ReturnType<typeof setTimeout>;
    questions: unknown[];
    deadline: number;
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
declare class ServerState {
    pendingQuestions: Map<string, PendingQuestion>;
    pendingPlanReviews: Map<string, PendingPlanReview>;
    questionRoutingEnabled: boolean;
    private counter;
    nextId(): string;
    addQuestion(id: string, questions: unknown[], timeoutMs: number): Promise<Record<string, string>>;
    resolveQuestion(id: string, answers: Record<string, string>): boolean;
    releaseQuestion(id: string): boolean;
    addPlanReview(opts: AddPlanReviewOptions): Promise<PlanReviewDecision>;
    resolvePlanReview(id: string, decision: PlanReviewDecision): boolean;
    reset(): void;
}
export declare const state: ServerState;
export {};
//# sourceMappingURL=state.d.ts.map