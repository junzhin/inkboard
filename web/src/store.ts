import { create } from "zustand";
import type { Question, PlanAnnotation } from "./types";

type View = "idle" | "question" | "plan-review";

interface PendingPlanReview {
  id: string;
  content: string;
  filePath?: string;
  timeoutMs: number;
  receivedAt: number;
  sessionId?: string;
  sessionName?: string;
}

interface PendingQuestion {
  id: string;
  questions: Question[];
  timeoutMs: number;
  canvasTimeoutMs?: number;
  receivedAt: number;
  sessionId?: string;
  context?: string;
}

interface Toast {
  id: number;
  kind: "success" | "error" | "info";
  text: string;
  timer: ReturnType<typeof setTimeout>;
}

export interface ActivityEntry {
  id: number;
  at: number;
  kind: "plan-arrived" | "plan-approved" | "plan-denied" | "question-asked" | "question-answered";
  label: string;
  sessionName?: string;
}

interface InkBoardState {
  view: View;
  connected: boolean;
  questionRoutingEnabled: boolean;
  toasts: Toast[];
  pushToast: (kind: Toast["kind"], text: string) => void;
  dismissToast: (id: number) => void;

  activity: ActivityEntry[];
  pushActivity: (entry: Omit<ActivityEntry, "id" | "at">) => void;

  pendingQuestion: PendingQuestion | null;
  answers: Record<string, string>;

  // Multi-session plan review
  planReviews: PendingPlanReview[];
  activePlanReviewId: string | null;
  planAnnotationsByReview: Record<string, PlanAnnotation[]>;

  setConnected: (connected: boolean) => void;
  setQuestionRouting: (enabled: boolean) => void;
  setQuestion: (q: PendingQuestion) => void;
  setAnswer: (questionText: string, answer: string) => void;
  clearQuestion: () => void;

  upsertPlanReview: (review: PendingPlanReview) => void;
  setActivePlanReview: (id: string) => void;
  addPlanAnnotation: (reviewId: string, a: PlanAnnotation) => void;
  removePlanAnnotation: (reviewId: string, id: string) => void;
  updatePlanAnnotation: (reviewId: string, id: string, patch: Partial<PlanAnnotation>) => void;
  clearPlanReview: (reviewId: string) => void;

  setView: (view: View) => void;
}

let toastCounter = 0;
let activityCounter = 0;
const MAX_ACTIVITY = 12;
const TOAST_DURATION_MS = 4_000;

function nextActiveAfterRemoval(reviews: PendingPlanReview[], removedId: string, currentActive: string | null): string | null {
  if (currentActive !== removedId) return currentActive;
  const remaining = reviews.filter((r) => r.id !== removedId);
  return remaining.length > 0 ? remaining[0].id : null;
}

function omitKey<V>(record: Record<string, V>, key: string): Record<string, V> {
  if (!(key in record)) return record;
  const out: Record<string, V> = {};
  for (const k of Object.keys(record)) {
    if (k !== key) out[k] = record[k];
  }
  return out;
}

export const useStore = create<InkBoardState>((set, get) => ({
  view: "idle",
  connected: false,
  questionRoutingEnabled: false,
  toasts: [],
  pushToast: (kind, text) => {
    const id = ++toastCounter;
    const timer = setTimeout(() => get().dismissToast(id), TOAST_DURATION_MS);
    set((s) => ({ toasts: [...s.toasts, { id, kind, text, timer }] }));
  },
  dismissToast: (id) =>
    set((s) => {
      const t = s.toasts.find((x) => x.id === id);
      if (!t) return {};
      clearTimeout(t.timer);
      return { toasts: s.toasts.filter((x) => x.id !== id) };
    }),

  activity: [],
  pushActivity: (entry) =>
    set((s) => {
      const next: ActivityEntry = { ...entry, id: ++activityCounter, at: Date.now() };
      const list = [next, ...s.activity].slice(0, MAX_ACTIVITY);
      return { activity: list };
    }),

  pendingQuestion: null,
  answers: {},

  planReviews: [],
  activePlanReviewId: null,
  planAnnotationsByReview: {},

  setConnected: (connected) => set({ connected }),
  setQuestionRouting: (enabled) => set({ questionRoutingEnabled: enabled }),

  setQuestion: (q) =>
    set({ pendingQuestion: q, answers: {}, view: "question" }),

  setAnswer: (questionText, answer) =>
    set((s) => ({ answers: { ...s.answers, [questionText]: answer } })),

  clearQuestion: () =>
    set({ pendingQuestion: null, answers: {}, view: "idle" }),

  upsertPlanReview: (review) =>
    set((s) => {
      const exists = s.planReviews.some((r) => r.id === review.id);
      const planReviews = exists
        ? s.planReviews.map((r) => (r.id === review.id ? review : r))
        : [...s.planReviews, review];
      const planAnnotationsByReview = exists
        ? s.planAnnotationsByReview
        : { ...s.planAnnotationsByReview, [review.id]: [] };
      return {
        planReviews,
        planAnnotationsByReview,
        activePlanReviewId: s.activePlanReviewId ?? review.id,
        view: "plan-review",
      };
    }),

  setActivePlanReview: (id) =>
    set((s) => (s.planReviews.some((r) => r.id === id) ? { activePlanReviewId: id } : {})),

  addPlanAnnotation: (reviewId, a) =>
    set((s) => ({
      planAnnotationsByReview: {
        ...s.planAnnotationsByReview,
        [reviewId]: [...(s.planAnnotationsByReview[reviewId] ?? []), a],
      },
    })),

  removePlanAnnotation: (reviewId, id) =>
    set((s) => ({
      planAnnotationsByReview: {
        ...s.planAnnotationsByReview,
        [reviewId]: (s.planAnnotationsByReview[reviewId] ?? []).filter((a) => a.id !== id),
      },
    })),

  updatePlanAnnotation: (reviewId, id, patch) =>
    set((s) => ({
      planAnnotationsByReview: {
        ...s.planAnnotationsByReview,
        [reviewId]: (s.planAnnotationsByReview[reviewId] ?? []).map((a) =>
          a.id === id ? { ...a, ...patch } : a
        ),
      },
    })),

  clearPlanReview: (reviewId) =>
    set((s) => {
      const planReviews = s.planReviews.filter((r) => r.id !== reviewId);
      const planAnnotationsByReview = omitKey(s.planAnnotationsByReview, reviewId);
      const activePlanReviewId = nextActiveAfterRemoval(s.planReviews, reviewId, s.activePlanReviewId);
      return {
        planReviews,
        planAnnotationsByReview,
        activePlanReviewId,
        view: planReviews.length === 0 ? "idle" : "plan-review",
      };
    }),

  setView: (view) => set({ view }),
}));
