import type { Question } from "../types";

interface TestPlanReview {
  id: string;
  sessionId: string;
  sessionName: string;
  content: string;
  filePath: string;
  timeoutMs: number;
  receivedAt: number;
}

interface TestQuestion {
  id: string;
  questions: Question[];
  timeoutMs: number;
  receivedAt: number;
}

export function makeTestQuestion(): TestQuestion {
  return {
    id: "test_q",
    questions: [{
      question: "Test render: question canvas shows?",
      header: "Test",
      options: [{ label: "yes", description: "renders ok" }, { label: "no", description: "broken" }],
      multiSelect: false,
    }],
    timeoutMs: 60_000,
    receivedAt: Date.now(),
  };
}

const TEST_PLAN_BODY = `# Long Test Plan

## Section 1: Background

Synthetic plan to verify the floating annotation toolbar at any scroll position. Lorem ipsum dolor sit amet.

## Section 2: Goals

- Goal A — refactor auth
- Goal B — Redis cache
- Goal C — schema migration

## Section 3: Architecture

| Component | Owner |
|-----------|-------|
| Gateway   | Alice |
| Auth      | Bob   |

## Section 4: Code

\`\`\`ts
async function loadTest() {
  for (let i = 0; i < 10000; i++) await fetch('/api/users/' + i);
}
\`\`\`

## Section 10: Bottom Marker

**Select this very last paragraph** to verify the toolbar still appears at bottom.`;

export function makeTestPlanReview(): TestPlanReview {
  return {
    id: "test_p",
    sessionId: "test_session_001",
    sessionName: "inkboard (s001)",
    content: TEST_PLAN_BODY,
    filePath: "/tmp/test.md",
    timeoutMs: 300_000,
    receivedAt: Date.now(),
  };
}
