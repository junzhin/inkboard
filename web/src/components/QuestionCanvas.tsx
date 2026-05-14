import { useState, useEffect } from "react";
import { useStore } from "../store";
import { wsClient } from "../ws-client";

export function QuestionCanvas() {
  const { pendingQuestion, answers, setAnswer, clearQuestion } = useStore();
  const [remaining, setRemaining] = useState(0);
  const [customInputs, setCustomInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!pendingQuestion) return;

    const deadline =
      pendingQuestion.receivedAt + pendingQuestion.timeoutMs;
    const tick = () => {
      const left = Math.max(0, deadline - Date.now());
      setRemaining(Math.ceil(left / 1000));
      if (left <= 0) {
        clearQuestion();
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [pendingQuestion, clearQuestion]);

  if (!pendingQuestion) return null;

  const handleSubmit = () => {
    wsClient.send({
      type: "answer",
      id: pendingQuestion.id,
      answers,
    });
    clearQuestion();
  };

  const allAnswered = pendingQuestion.questions.every(
    (q) => answers[q.question]?.trim()
  );

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-ink-800">
          Interview Questions
        </h2>
        <div
          className={`px-3 py-1 rounded-full text-sm font-mono ${
            remaining <= 15
              ? "bg-red-100 text-red-700 animate-pulse"
              : "bg-ink-100 text-ink-700"
          }`}
        >
          {remaining}s
        </div>
      </div>

      <div className="space-y-6">
        {pendingQuestion.questions.map((q, qi) => (
          <div
            key={qi}
            className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm"
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-medium bg-ink-100 text-ink-700 px-2 py-0.5 rounded">
                {q.header}
              </span>
              <span className="text-sm font-medium text-gray-900">
                {q.question}
              </span>
            </div>

            <div className="space-y-2">
              {q.options.map((opt, oi) => (
                <label
                  key={oi}
                  className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
                    answers[q.question] === opt.label
                      ? "border-ink-500 bg-ink-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <input
                    type="radio"
                    name={`q-${qi}`}
                    value={opt.label}
                    checked={answers[q.question] === opt.label}
                    onChange={() => setAnswer(q.question, opt.label)}
                    className="mt-0.5 accent-ink-600"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {opt.label}
                    </div>
                    <div className="text-xs text-gray-500">
                      {opt.description}
                    </div>
                  </div>
                </label>
              ))}

              <div className="pt-2">
                <input
                  type="text"
                  placeholder="Or type a custom answer..."
                  value={customInputs[q.question] ?? ""}
                  onChange={(e) => {
                    setCustomInputs((p) => ({
                      ...p,
                      [q.question]: e.target.value,
                    }));
                    setAnswer(q.question, e.target.value);
                  }}
                  className="w-full text-sm px-3 py-2 border border-gray-200 rounded-md focus:border-ink-400 focus:ring-1 focus:ring-ink-200 outline-none"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={!allAnswered}
          className="px-6 py-2 bg-ink-600 text-white rounded-md font-medium hover:bg-ink-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Submit Answers
        </button>
      </div>
    </div>
  );
}
