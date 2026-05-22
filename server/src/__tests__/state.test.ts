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

      const promise = state.addQuestion({ id, questions, timeoutMs: 5000 });
      const resolved = state.resolveQuestion(id, {
        "test?": "answer1",
      });

      expect(resolved).toBe(true);
      const result = await promise;
      expect(result).toEqual({ "test?": "answer1" });
    });

    it("rejects on timeout", async () => {
      const id = state.nextId();

      const promise = state.addQuestion({ id, questions: [], timeoutMs: 50 });

      await expect(promise).rejects.toThrow("timeout");
    });

    it("returns false when resolving unknown ID", () => {
      const resolved = state.resolveQuestion("nonexistent", {});
      expect(resolved).toBe(false);
    });

    it("cleans up after reset", () => {
      const id = state.nextId();
      state.addQuestion({ id, questions: [], timeoutMs: 60000 });
      expect(state.pendingQuestions.size).toBe(1);

      state.reset();
      expect(state.pendingQuestions.size).toBe(0);
    });

    // Regression guard: hook-question.ts relies on addQuestion registering
    // the pending entry synchronously so a WebSocket client connecting after
    // the broadcast (or reconnecting) can pick it up via replayPendingItems().
    // If the registration becomes async (e.g. moved into .then), questions
    // race with the broadcast and the canvas Questions tab stays empty.
    it("addQuestion registers pending entry synchronously (replay race guard)", () => {
      const id = state.nextId();
      const questions = [{ question: "test?", header: "h", options: [], multiSelect: false }];
      const p = state.addQuestion({
        id,
        questions,
        timeoutMs: 5000,
        sessionId: "s1",
        context: "Why this question matters",
      });
      expect(state.pendingQuestions.has(id)).toBe(true);
      const pending = state.pendingQuestions.get(id)!;
      expect(pending.questions).toEqual(questions);
      expect(pending.deadline).toBeGreaterThan(Date.now());
      expect(pending.sessionId).toBe("s1");
      expect(pending.context).toBe("Why this question matters");
      state.resolveQuestion(id, { "test?": "ok" });
      return p;
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

  // Regression guard: hook-plan-review.ts relies on addPlanReview registering
  // the pending entry synchronously so that a WebSocket client connecting
  // during the grace period can pick it up via replayPendingItems(). If the
  // registration ever becomes async (e.g. moved inside `.then`), the
  // grace-period flow silently breaks and the canvas Review tab stays empty.
  it("addPlanReview registers pending entry synchronously (replay race guard)", () => {
    const id = state.nextId();
    const p = state.addPlanReview({
      id,
      content: "# plan",
      timeoutMs: 5000,
      sessionId: "s1",
      sessionName: "demo",
    });
    expect(state.pendingPlanReviews.has(id)).toBe(true);
    const pending = state.pendingPlanReviews.get(id)!;
    expect(pending.content).toBe("# plan");
    expect(pending.sessionId).toBe("s1");
    expect(pending.sessionName).toBe("demo");
    state.resolvePlanReview(id, { approved: true, annotations: [] });
    return p;
  });
});
