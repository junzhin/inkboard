import { describe, it, expect, beforeEach } from "vitest";
import { state } from "../state.js";

beforeEach(() => {
  state.reset();
});

describe("ServerState", () => {
  describe("nextId", () => {
    it("generates unique IDs", () => {
      const id1 = state.nextId();
      const id2 = state.nextId();
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^ink_\d+_\d+$/);
    });
  });

  describe("question lifecycle", () => {
    it("resolves when answer provided", async () => {
      const id = state.nextId();
      const questions = [{ question: "test?", options: [] }];

      const promise = state.addQuestion(id, questions, 5000);
      const resolved = state.resolveQuestion(id, {
        "test?": "answer1",
      });

      expect(resolved).toBe(true);
      const result = await promise;
      expect(result).toEqual({ "test?": "answer1" });
    });

    it("rejects on timeout", async () => {
      const id = state.nextId();

      const promise = state.addQuestion(id, [], 50);

      await expect(promise).rejects.toThrow("timeout");
    });

    it("returns false when resolving unknown ID", () => {
      const resolved = state.resolveQuestion("nonexistent", {});
      expect(resolved).toBe(false);
    });

    it("cleans up after reset", () => {
      const id = state.nextId();
      state.addQuestion(id, [], 60000);
      expect(state.pendingQuestions.size).toBe(1);

      state.reset();
      expect(state.pendingQuestions.size).toBe(0);
    });
  });

});

describe("plan review lifecycle", () => {
  it("resolves with approve decision", async () => {
    const id = state.nextId();
    const promise = state.addPlanReview({ id, content: "# plan", filePath: "/tmp/p.md", timeoutMs: 5000 });
    const ok = state.resolvePlanReview(id, { approved: true, annotations: [] });
    expect(ok).toBe(true);
    await expect(promise).resolves.toEqual({ approved: true, annotations: [] });
  });

  it("resolves with deny + annotations", async () => {
    const id = state.nextId();
    const promise = state.addPlanReview({ id, content: "# plan", timeoutMs: 5000 });
    const ann = [{ id: "a1", type: "comment" as const, selectedText: "x", comment: "fix", createdAt: 1 }];
    state.resolvePlanReview(id, { approved: false, annotations: ann });
    await expect(promise).resolves.toEqual({ approved: false, annotations: ann });
  });

  it("rejects on timeout", async () => {
    const id = state.nextId();
    const promise = state.addPlanReview({ id, content: "# plan", timeoutMs: 50 });
    await expect(promise).rejects.toThrow("timeout");
    expect(state.pendingPlanReviews.has(id)).toBe(false);
  });

  it("returns false for unknown id", () => {
    expect(state.resolvePlanReview("missing", { approved: true, annotations: [] })).toBe(false);
  });

  it("reset clears pending plan reviews", () => {
    const id = state.nextId();
    state.addPlanReview({ id, content: "x", timeoutMs: 5000 }).catch(() => {});
    expect(state.pendingPlanReviews.size).toBe(1);
    state.reset();
    expect(state.pendingPlanReviews.size).toBe(0);
  });
});
