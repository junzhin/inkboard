import { useEffect } from "react";
import { useStore } from "./store";
import { wsClient } from "./ws-client";
import { Layout } from "./components/Layout";
import { QuestionCanvas } from "./components/QuestionCanvas";
import { DiffReview } from "./components/DiffReview";
import { MarkdownReview } from "./components/MarkdownReview";
import { InterviewProgress } from "./components/InterviewProgress";
import type { ServerMessage, Question } from "./types";

function IdleView() {
  return (
    <div className="max-w-2xl mx-auto p-6 text-center">
      <div className="py-16">
        <div className="text-6xl mb-4 opacity-20">
          <svg viewBox="0 0 100 100" className="w-20 h-20 mx-auto text-ink-300" fill="currentColor">
            <rect x="15" y="10" width="70" height="80" rx="4" fill="none" stroke="currentColor" strokeWidth="3"/>
            <line x1="30" y1="30" x2="70" y2="30" stroke="currentColor" strokeWidth="2"/>
            <line x1="30" y1="42" x2="65" y2="42" stroke="currentColor" strokeWidth="2"/>
            <line x1="30" y1="54" x2="55" y2="54" stroke="currentColor" strokeWidth="2"/>
            <circle cx="72" cy="72" r="18" fill="currentColor" opacity="0.15"/>
            <path d="M 66 72 L 70 76 L 78 68" stroke="currentColor" strokeWidth="2.5" fill="none"/>
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Waiting for Claude Code
        </h2>
        <p className="text-sm text-gray-500 max-w-md mx-auto">
          InkBoard is connected and ready. When Claude asks a question or
          proposes a file edit, it will appear here for review.
        </p>
        <div className="mt-8 text-xs text-gray-400">
          Run <code className="bg-gray-100 px-1.5 py-0.5 rounded">/inkboard</code> in
          Claude Code to start an interview
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const {
    view,
    setConnected,
    setQuestion,
    setDiff,
    setPlan,
    pendingQuestion,
    answers,
  } = useStore();

  useEffect(() => {
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
            receivedAt: Date.now(),
          });
          break;
        case "diff":
          setDiff({
            id: msg.id,
            filePath: msg.filePath,
            hunks: msg.hunks,
            timeoutMs: msg.timeoutMs,
            receivedAt: Date.now(),
          });
          break;
        case "plan-snapshot":
          setPlan(msg.content, msg.filePath);
          break;
      }
    });

    return () => {
      unsubscribe();
      wsClient.disconnect();
    };
  }, [setConnected, setQuestion, setDiff, setPlan]);

  const questionCount = pendingQuestion
    ? Object.keys(answers).length
    : 0;

  return (
    <Layout>
      {view === "question" && (
        <>
          <InterviewProgress currentPhase={1} questionCount={questionCount} />
          <QuestionCanvas />
        </>
      )}
      {view === "diff" && <DiffReview />}
      {view === "plan" && <MarkdownReview />}
      {view === "idle" && <IdleView />}
    </Layout>
  );
}
