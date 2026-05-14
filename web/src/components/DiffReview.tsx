import { useState, useEffect } from "react";
import { useStore } from "../store";
import { wsClient } from "../ws-client";
import type { Annotation } from "../types";

export function DiffReview() {
  const {
    pendingDiff,
    hunkDecisions,
    annotations,
    setHunkDecision,
    addAnnotation,
    clearDiff,
    getDiffDecision,
  } = useStore();

  const [remaining, setRemaining] = useState(0);
  const [annotatingHunk, setAnnotatingHunk] = useState<number | null>(null);
  const [annotationText, setAnnotationText] = useState("");

  useEffect(() => {
    if (!pendingDiff) return;
    const deadline = pendingDiff.receivedAt + pendingDiff.timeoutMs;

    const tick = () => {
      const left = Math.max(0, deadline - Date.now());
      setRemaining(Math.ceil(left / 1000));
      if (left <= 0) clearDiff();
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [pendingDiff, clearDiff]);

  if (!pendingDiff) return null;

  const hasRejections = Array.from(hunkDecisions.values()).some(
    (d) => d === "reject"
  );

  const handleSubmit = () => {
    wsClient.send({
      type: "diff-decision",
      id: pendingDiff.id,
      decision: getDiffDecision(),
    });
    clearDiff();
  };

  const handleAcceptAll = () => {
    for (const h of pendingDiff.hunks) setHunkDecision(h.index, "accept");
  };

  const handleRejectAll = () => {
    for (const h of pendingDiff.hunks) setHunkDecision(h.index, "reject");
  };

  const handleAddAnnotation = (hunkIndex: number) => {
    if (!annotationText.trim()) return;
    const annotation: Annotation = {
      hunkIndex,
      line: 0,
      text: annotationText.trim(),
    };
    addAnnotation(annotation);
    setAnnotationText("");
    setAnnotatingHunk(null);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            Review Changes
          </h2>
          <p className="text-sm text-gray-500 font-mono">
            {pendingDiff.filePath}
          </p>
        </div>
        <div
          className={`px-3 py-1 rounded-full text-sm font-mono ${
            remaining <= 15
              ? "bg-red-100 text-red-700 animate-pulse"
              : "bg-gray-100 text-gray-700"
          }`}
        >
          {remaining}s
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <button
          onClick={handleAcceptAll}
          className="px-3 py-1.5 text-sm bg-green-50 text-green-700 border border-green-200 rounded-md hover:bg-green-100"
        >
          Accept All
        </button>
        <button
          onClick={handleRejectAll}
          className="px-3 py-1.5 text-sm bg-red-50 text-red-700 border border-red-200 rounded-md hover:bg-red-100"
        >
          Reject All
        </button>
      </div>

      <div className="space-y-4">
        {pendingDiff.hunks.map((hunk) => {
          const decision = hunkDecisions.get(hunk.index);
          const hunkAnnotations = annotations.filter(
            (a) => a.hunkIndex === hunk.index
          );

          return (
            <div
              key={hunk.index}
              className={`border rounded-lg overflow-hidden ${
                decision === "accept"
                  ? "border-green-300"
                  : decision === "reject"
                    ? "border-red-300"
                    : "border-gray-200"
              }`}
            >
              <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
                <span className="text-xs text-gray-500 font-mono">
                  @@ -{hunk.oldStart} +{hunk.newStart} @@
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setHunkDecision(hunk.index, "accept")}
                    className={`px-2 py-0.5 text-xs rounded ${
                      decision === "accept"
                        ? "bg-green-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-green-50"
                    }`}
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => setHunkDecision(hunk.index, "reject")}
                    className={`px-2 py-0.5 text-xs rounded ${
                      decision === "reject"
                        ? "bg-red-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-red-50"
                    }`}
                  >
                    Reject
                  </button>
                  <button
                    onClick={() =>
                      setAnnotatingHunk(
                        annotatingHunk === hunk.index ? null : hunk.index
                      )
                    }
                    className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded hover:bg-ink-50"
                  >
                    Comment
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <pre className="text-xs leading-5 p-0 m-0">
                  {hunk.raw.map((line, li) => {
                    let bg = "";
                    let prefix = " ";
                    if (line.startsWith("+")) {
                      bg = "bg-green-50";
                      prefix = "+";
                    } else if (line.startsWith("-")) {
                      bg = "bg-red-50";
                      prefix = "-";
                    }

                    return (
                      <div
                        key={li}
                        className={`px-4 py-0 font-mono whitespace-pre ${bg}`}
                      >
                        <span className="text-gray-400 select-none inline-block w-4">
                          {prefix}
                        </span>
                        {line.slice(1)}
                      </div>
                    );
                  })}
                </pre>
              </div>

              {hunkAnnotations.length > 0 && (
                <div className="border-t border-gray-200 bg-yellow-50 px-4 py-2 space-y-1">
                  {hunkAnnotations.map((a, ai) => (
                    <div key={ai} className="text-xs text-yellow-800">
                      <span className="font-medium">Note:</span> {a.text}
                    </div>
                  ))}
                </div>
              )}

              {annotatingHunk === hunk.index && (
                <div className="border-t border-gray-200 px-4 py-3 bg-gray-50 flex gap-2">
                  <input
                    type="text"
                    value={annotationText}
                    onChange={(e) => setAnnotationText(e.target.value)}
                    placeholder="Add a comment about this change..."
                    className="flex-1 text-sm px-3 py-1.5 border border-gray-200 rounded-md focus:border-ink-400 outline-none"
                    onKeyDown={(e) => {
                      if (e.key === "Enter")
                        handleAddAnnotation(hunk.index);
                    }}
                    autoFocus
                  />
                  <button
                    onClick={() => handleAddAnnotation(hunk.index)}
                    className="px-3 py-1.5 text-sm bg-ink-600 text-white rounded-md hover:bg-ink-700"
                  >
                    Add
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {hasRejections && (
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
          <p className="text-sm text-amber-800">
            <span className="font-medium">Note:</span> Rejecting any hunk blocks the entire edit.
            Claude Code hooks cannot selectively apply hunks. All {pendingDiff.hunks.length} hunks
            will be blocked, and your annotations will be sent as feedback.
          </p>
        </div>
      )}

      <div className="mt-4 flex justify-end gap-3">
        <button
          onClick={() => {
            wsClient.send({
              type: "diff-decision",
              id: pendingDiff.id,
              decision: {
                accepted: [],
                rejected: pendingDiff.hunks.map((h) => h.index),
                annotations: [
                  { hunkIndex: -1, line: 0, text: "All changes rejected" },
                ],
              },
            });
            clearDiff();
          }}
          className="px-4 py-2 text-red-600 border border-red-200 rounded-md hover:bg-red-50"
        >
          Reject All & Skip
        </button>
        <button
          onClick={handleSubmit}
          className="px-6 py-2 bg-ink-600 text-white rounded-md font-medium hover:bg-ink-700 transition-colors"
        >
          Submit Review
        </button>
      </div>
    </div>
  );
}
