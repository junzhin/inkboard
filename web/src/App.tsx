import { useEffect } from "react";
import { useStore } from "./store";
import { wsClient } from "./ws-client";
import { Layout } from "./components/Layout";
import { QuestionCanvas } from "./components/QuestionCanvas";
import { PlanAnnotator } from "./components/PlanAnnotator";
import { Home } from "./components/Home";
import { makeTestQuestion, makeTestPlanReview } from "./lib/testFixtures";
import type { ServerMessage, Question } from "./types";

export default function App() {
  const {
    view,
    setConnected,
    setQuestionRouting,
    setQuestion,
    clearQuestion,
    upsertPlanReview,
    pushActivity,
    pushToast,
  } = useStore();

  useEffect(() => {
    const testMode = new URLSearchParams(window.location.search).get("test");
    if (testMode === "question") setQuestion(makeTestQuestion());
    else if (testMode === "plan") upsertPlanReview(makeTestPlanReview());

    wsClient.connect();

    const unsubscribe = wsClient.onMessage((msg: ServerMessage) => {
      switch (msg.type) {
        case "server-status":
          setConnected(msg.status === "ready");
          break;
        case "question":
          setQuestion({
            id: msg.id,
            questions: msg.questions as Question[],
            timeoutMs: msg.timeoutMs,
            canvasTimeoutMs: msg.canvasTimeoutMs,
            receivedAt: Date.now(),
            sessionId: msg.sessionId,
            context: msg.context,
          });
          pushActivity({ kind: "question-asked", label: "Question asked" });
          break;
        case "question-released":
          clearQuestion();
          pushToast("info", "Released to terminal — answer there");
          pushActivity({ kind: "question-answered", label: "Auto-released to terminal" });
          break;
        case "plan-review":
          upsertPlanReview({
            id: msg.id,
            content: msg.content,
            filePath: msg.filePath,
            timeoutMs: msg.timeoutMs,
            receivedAt: Date.now(),
            sessionId: msg.sessionId,
            sessionName: msg.sessionName,
          });
          pushActivity({ kind: "plan-arrived", label: "Plan arrived", sessionName: msg.sessionName ?? msg.sessionId });
          break;
        case "settings-sync":
          setQuestionRouting(msg.questionRoutingEnabled);
          break;
      }
    });

    return () => {
      unsubscribe();
      wsClient.disconnect();
    };
  }, [setConnected, setQuestionRouting, setQuestion, clearQuestion, upsertPlanReview, pushActivity, pushToast]);

  return (
    <Layout>
      {view === "question" && <QuestionCanvas />}
      {view === "plan-review" && <PlanAnnotator />}
      {view === "idle" && <Home />}
    </Layout>
  );
}
