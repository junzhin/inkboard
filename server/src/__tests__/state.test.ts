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

  describe("diff lifecycle", () => {
    it("resolves when decision provided", async () => {
      const id = state.nextId();
      const hunks = [
        {
          index: 0,
          oldStart: 1,
          oldLines: ["old"],
          newStart: 1,
          newLines: ["new"],
          raw: ["-old", "+new"],
        },
      ];

      const promise = state.addDiff(id, "test.txt", hunks, 5000);
      const decision = { accepted: [0], rejected: [], annotations: [] };
      const resolved = state.resolveDiff(id, decision);

      expect(resolved).toBe(true);
      const result = await promise;
      expect(result.accepted).toEqual([0]);
    });

    it("rejects on timeout", async () => {
      const id = state.nextId();

      const promise = state.addDiff(id, "test.txt", [], 50);

      await expect(promise).rejects.toThrow("timeout");
    });

    it("returns false when resolving unknown ID", () => {
      const resolved = state.resolveDiff("nonexistent", {
        accepted: [],
        rejected: [],
        annotations: [],
      });
      expect(resolved).toBe(false);
    });
  });

  describe("plan state", () => {
    it("stores and retrieves plan", () => {
      state.setPlan("# Plan", "/path/to/plan.md");
      expect(state.currentPlan).toEqual({
        content: "# Plan",
        filePath: "/path/to/plan.md",
      });
    });

    it("clears on reset", () => {
      state.setPlan("# Plan", "/path/to/plan.md");
      state.reset();
      expect(state.currentPlan).toBeNull();
    });
  });
});
