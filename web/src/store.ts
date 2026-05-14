import { create } from "zustand";
import type { Question, Hunk, DiffDecision, Annotation } from "./types";

type View = "idle" | "question" | "diff" | "plan";

interface PendingQuestion {
  id: string;
  questions: Question[];
  timeoutMs: number;
  receivedAt: number;
}

interface PendingDiff {
  id: string;
  filePath: string;
  hunks: Hunk[];
  timeoutMs: number;
  receivedAt: number;
}

interface InkBoardState {
  view: View;
  connected: boolean;

  pendingQuestion: PendingQuestion | null;
  answers: Record<string, string>;

  pendingDiff: PendingDiff | null;
  hunkDecisions: Map<number, "accept" | "reject">;
  annotations: Annotation[];

  planContent: string;
  planFilePath: string;

  setConnected: (connected: boolean) => void;
  setQuestion: (q: PendingQuestion) => void;
  setAnswer: (questionText: string, answer: string) => void;
  clearQuestion: () => void;

  setDiff: (d: PendingDiff) => void;
  setHunkDecision: (index: number, decision: "accept" | "reject") => void;
  addAnnotation: (annotation: Annotation) => void;
  clearDiff: () => void;
  getDiffDecision: () => DiffDecision;

  setPlan: (content: string, filePath: string) => void;
  setView: (view: View) => void;
}

export const useStore = create<InkBoardState>((set, get) => ({
  view: "idle",
  connected: false,

  pendingQuestion: null,
  answers: {},

  pendingDiff: null,
  hunkDecisions: new Map(),
  annotations: [],

  planContent: "",
  planFilePath: "",

  setConnected: (connected) => set({ connected }),

  setQuestion: (q) =>
    set({ pendingQuestion: q, answers: {}, view: "question" }),

  setAnswer: (questionText, answer) =>
    set((s) => ({ answers: { ...s.answers, [questionText]: answer } })),

  clearQuestion: () =>
    set({ pendingQuestion: null, answers: {}, view: "idle" }),

  setDiff: (d) =>
    set({
      pendingDiff: d,
      hunkDecisions: new Map(),
      annotations: [],
      view: "diff",
    }),

  setHunkDecision: (index, decision) =>
    set((s) => {
      const newMap = new Map(s.hunkDecisions);
      newMap.set(index, decision);
      return { hunkDecisions: newMap };
    }),

  addAnnotation: (annotation) =>
    set((s) => ({ annotations: [...s.annotations, annotation] })),

  clearDiff: () =>
    set({
      pendingDiff: null,
      hunkDecisions: new Map(),
      annotations: [],
      view: "idle",
    }),

  getDiffDecision: () => {
    const s = get();
    const accepted: number[] = [];
    const rejected: number[] = [];

    if (s.pendingDiff) {
      for (const hunk of s.pendingDiff.hunks) {
        const decision = s.hunkDecisions.get(hunk.index);
        if (decision === "reject") {
          rejected.push(hunk.index);
        } else if (decision === "accept") {
          accepted.push(hunk.index);
        } else {
          accepted.push(hunk.index);
        }
      }
    }

    return { accepted, rejected, annotations: s.annotations };
  },

  setPlan: (content, filePath) =>
    set({ planContent: content, planFilePath: filePath, view: "plan" }),

  setView: (view) => set({ view }),
}));
