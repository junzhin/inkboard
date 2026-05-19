import { useState, useEffect } from "react";
import { useStore } from "../store";
import { wsClient } from "../ws-client";
import { formatSessionLabel } from "../lib/format";

export function QuestionCanvas() {
  const {
    pendingQuestions,
    activeQuestionId,
    answersByQuestion,
    setActiveQuestion,
    setAnswer,
    clearQuestion,
    pushActivity,
  } = useStore();

  const activeQuestion = pendingQuestions.find((q) => q.id === activeQuestionId) ?? null;
  const answers = activeQuestionId ? (answersByQuestion[activeQuestionId] ?? {}) : {};

  const [remaining, setRemaining] = useState(0);
  const [customInputs, setCustomInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!activeQuestion) return;
    setCustomInputs({});

    const effectiveTimeout = activeQuestion.canvasTimeoutMs ?? activeQuestion.timeoutMs;
    const deadline = activeQuestion.receivedAt + effectiveTimeout;
    const tick = () => {
      const left = Math.max(0, deadline - Date.now());
      setRemaining(Math.ceil(left / 1000));
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [activeQuestion]);

  if (!activeQuestion) {
    return (
      <div className="max-w-3xl mx-auto p-12 text-center">
        <div className="font-display text-5xl text-ink-300 mb-3">?</div>
        <h2 className="font-display text-2xl text-ink-700 mb-2">No question pending</h2>
        <p className="text-sm text-ink-400">
          Questions appear here automatically when Claude calls{" "}
          <code className="font-mono text-ink-600">AskUserQuestion</code>.
        </p>
      </div>
    );
  }

  const handleSubmit = () => {
    wsClient.send({
      type: "answer",
      id: activeQuestion.id,
      answers,
    });
    pushActivity({
      kind: "question-answered",
      label: `Answered ${Object.keys(answers).length} question(s)`,
      sessionName: activeQuestion.sessionId,
    });
    clearQuestion(activeQuestion.id);
  };

  const handleRelease = () => {
    wsClient.send({
      type: "question-release",
      id: activeQuestion.id,
    });
    pushActivity({
      kind: "question-answered",
      label: "Released to terminal",
      sessionName: activeQuestion.sessionId,
    });
    clearQuestion(activeQuestion.id);
  };

  const allAnswered = activeQuestion.questions.every(
    (q) => answers[q.question]?.trim()
  );

  const hot = remaining <= 15;

  return (
    <div className="max-w-3xl mx-auto px-6 pb-12">
      {pendingQuestions.length > 1 && (
        <div className="mb-5 flex items-center gap-1 overflow-x-auto border-b border-paper-200 -mx-1 px-1">
          {pendingQuestions.map((pq) => {
            const isActive = pq.id === activeQuestionId;
            const answeredCount = Object.keys(answersByQuestion[pq.id] ?? {}).filter(
              (k) => (answersByQuestion[pq.id]?.[k] ?? "").trim()
            ).length;
            const label = formatSessionLabel(pq);
            return (
              <button
                key={pq.id}
                onClick={() => setActiveQuestion(pq.id)}
                className={`relative px-4 py-2 text-sm whitespace-nowrap transition-colors ${
                  isActive
                    ? "text-ink-800 font-medium"
                    : "text-ink-400 hover:text-ink-700"
                }`}
                title={pq.sessionId ?? pq.id}
              >
                <span className="font-display tracking-tight">{label}</span>
                <span className="ml-2 text-[10px] text-ink-300 font-mono num">
                  {pq.sessionId ? pq.sessionId.slice(0, 6) : pq.id.slice(0, 6)}
                </span>
                {answeredCount > 0 && (
                  <span className="ml-2 inline-flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-ochre-500 text-paper-50 text-[10px] font-semibold num">
                    {answeredCount}
                  </span>
                )}
                {isActive && (
                  <span className="absolute -bottom-px left-2 right-2 h-0.5 bg-ochre-500 rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      )}

      <header className="flex items-end justify-between mb-6 gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-ochre-600 font-medium mb-1">
            Interview
          </div>
          <h2 className="font-display text-3xl md:text-4xl text-ink-800 tracking-tight leading-tight">
            Structured questions
          </h2>
          {activeQuestion.sessionId && (
            <p className="text-xs text-ink-400 font-mono mt-1.5">
              session {activeQuestion.sessionId.slice(0, 12)}
            </p>
          )}
        </div>
        <Countdown remaining={remaining} hot={hot} />
      </header>

      {activeQuestion.context && (
        <div className="mb-5 p-4 surface-paper-flat rounded-md border-l-2 border-l-ochre-400">
          <div className="text-[10px] uppercase tracking-[0.16em] text-ochre-600 font-medium mb-1.5">
            Context
          </div>
          <p className="text-sm text-ink-700 whitespace-pre-wrap leading-relaxed">
            {activeQuestion.context}
          </p>
        </div>
      )}

      <div className="space-y-5">
        {activeQuestion.questions.map((q, qi) => (
          <fieldset
            key={qi}
            className="surface-paper rounded-lg p-5 animate-rise-in"
          >
            <legend className="px-2 -ml-2">
              <div className="inline-flex items-center gap-2">
                <span className="font-mono text-[10px] text-ochre-500 num">
                  Q{String(qi + 1).padStart(2, "0")}
                </span>
                <span className="text-[10px] uppercase tracking-[0.14em] font-medium text-ink-500 bg-paper-100 border border-paper-200 rounded px-2 py-0.5">
                  {q.header}
                </span>
              </div>
            </legend>
            <h3 className="font-display text-xl text-ink-800 tracking-tight leading-snug mt-2 mb-4">
              {q.question}
            </h3>

            <div className="space-y-2">
              {q.options.map((opt, oi) => {
                const selected = answers[q.question] === opt.label;
                return (
                  <label
                    key={oi}
                    className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-all duration-200 ease-out-expo ${
                      selected
                        ? "border-ochre-400 bg-ochre-50 shadow-sm"
                        : "border-paper-200 bg-paper-50/50 hover:border-ink-200 hover:bg-paper-100/40"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`q-${activeQuestion.id}-${qi}`}
                      value={opt.label}
                      checked={selected}
                      onChange={() => setAnswer(activeQuestion.id, q.question, opt.label)}
                      className="mt-1 accent-ochre-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div
                        className={`text-sm font-medium ${
                          selected ? "text-ink-800" : "text-ink-700"
                        }`}
                      >
                        {opt.label}
                      </div>
                      <div className="text-xs text-ink-500 mt-0.5 leading-relaxed">
                        {opt.description}
                      </div>
                    </div>
                  </label>
                );
              })}

              <div className="pt-2">
                <input
                  type="text"
                  placeholder="Or type a custom answer…"
                  value={customInputs[q.question] ?? ""}
                  onChange={(e) => {
                    setCustomInputs((p) => ({
                      ...p,
                      [q.question]: e.target.value,
                    }));
                    setAnswer(activeQuestion.id, q.question, e.target.value);
                  }}
                  className="w-full text-sm px-3 py-2 bg-paper-50 border border-paper-200 rounded-md focus:border-ochre-400 outline-none placeholder-ink-300 transition-colors"
                />
              </div>
            </div>
          </fieldset>
        ))}
      </div>

      <div className="mt-7 flex justify-end items-center gap-3">
        <span className="text-xs text-ink-400 num mr-auto">
          {activeQuestion.questions.filter((q) => answers[q.question]?.trim()).length} /{" "}
          {activeQuestion.questions.length} answered
        </span>
        <button
          onClick={handleRelease}
          className="px-4 py-2.5 bg-paper-50 text-ink-600 rounded-md text-sm font-medium hover:bg-paper-100 hover:text-ink-800 transition-colors border border-paper-200"
          title="Dismiss the web card and let Claude show the terminal picker"
        >
          ↳ Answer in terminal
        </button>
        <button
          onClick={handleSubmit}
          disabled={!allAnswered}
          className="px-5 py-2.5 bg-ink-800 text-paper-100 rounded-md font-medium hover:bg-ink-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-sm border border-ink-900"
        >
          Submit answers →
        </button>
      </div>
    </div>
  );
}

function Countdown({ remaining, hot }: { remaining: number; hot: boolean }) {
  return (
    <div
      className={`px-3 py-1.5 rounded-md border text-sm font-mono num transition-colors ${
        hot
          ? "bg-rust-400/10 border-rust-400/40 text-rust-500 animate-pulse-dot"
          : "bg-paper-100 border-paper-200 text-ink-600"
      }`}
      title="Auto-releases to terminal when countdown reaches 0"
    >
      {remaining > 0 ? `${remaining}s → terminal` : "releasing…"}
    </div>
  );
}
