import { create } from "zustand";
import type { Question, PlanAnnotation } from "./types";
import { type Theme, getTheme, applyTheme } from "./lib/theme";
import { type Locale, getLocale, setLocale as applyLocale, initLocale } from "./lib/i18n";

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
  theme: Theme;
  locale: Locale;
  toasts: Toast[];
  pushToast: (kind: Toast["kind"], text: string) => void;
  dismissToast: (id: number) => void;
  setTheme: (theme: Theme) => void;
  setLocale: (locale: Locale) => void;

  activity: ActivityEntry[];
  pushActivity: (entry: Omit<ActivityEntry, "id" | "at">) => void;

  pendingQuestions: PendingQuestion[];
  activeQuestionId: string | null;
  answersByQuestion: Record<string, Record<string, string>>;

  // Multi-session plan review
  planReviews: PendingPlanReview[];
  activePlanReviewId: string | null;
  planAnnotationsByReview: Record<string, PlanAnnotation[]>;

  setConnected: (connected: boolean) => void;
  setQuestionRouting: (enabled: boolean) => void;
  upsertQuestion: (q: PendingQuestion) => void;
  setActiveQuestion: (id: string) => void;
  setAnswer: (questionId: string, questionText: string, answer: string) => void;
  clearQuestion: (id: string) => void;

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

function nextActiveAfterRemoval(items: ReadonlyArray<{ id: string }>, removedId: string, currentActive: string | null): string | null {
  if (currentActive !== removedId) return currentActive;
  const remaining = items.filter((r) => r.id !== removedId);
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
  theme: getTheme(),
  locale: (initLocale(), getLocale()),
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

  pendingQuestions: [],
  activeQuestionId: null,
  answersByQuestion: {},

  planReviews: [],
  activePlanReviewId: null,
  planAnnotationsByReview: {},

  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
  },
  setLocale: (locale) => {
    applyLocale(locale);
    set({ locale });
  },
  setConnected: (connected) => set({ connected }),
  setQuestionRouting: (enabled) => set({ questionRoutingEnabled: enabled }),

  upsertQuestion: (q) =>
    set((s) => {
      const exists = s.pendingQuestions.some((pq) => pq.id === q.id);
      const pendingQuestions = exists
        ? s.pendingQuestions.map((pq) => (pq.id === q.id ? q : pq))
        : [...s.pendingQuestions, q];
      const answersByQuestion = exists
        ? s.answersByQuestion
        : { ...s.answersByQuestion, [q.id]: {} };
      return {
        pendingQuestions,
        answersByQuestion,
        activeQuestionId: s.activeQuestionId ?? q.id,
        view: "question",
      };
    }),

  setActiveQuestion: (id) =>
    set((s) => (s.pendingQuestions.some((q) => q.id === id) ? { activeQuestionId: id } : {})),

  setAnswer: (questionId, questionText, answer) =>
    set((s) => ({
      answersByQuestion: {
        ...s.answersByQuestion,
        [questionId]: { ...(s.answersByQuestion[questionId] ?? {}), [questionText]: answer },
      },
    })),

  clearQuestion: (id) =>
    set((s) => {
      const pendingQuestions = s.pendingQuestions.filter((q) => q.id !== id);
      const answersByQuestion = omitKey(s.answersByQuestion, id);
      const activeQuestionId = nextActiveAfterRemoval(s.pendingQuestions, id, s.activeQuestionId);
      return {
        pendingQuestions,
        answersByQuestion,
        activeQuestionId,
        view: pendingQuestions.length === 0 ? "idle" : "question",
      };
    }),

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
