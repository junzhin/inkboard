import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useStore } from "../store";
import { wsClient } from "../ws-client";
import { formatSessionLabel } from "../lib/format";
import type { PlanAnnotation, AnnotationType, PlanReviewDecision } from "../types";

interface ToolbarPos {
  top: number;
  left: number;
  text: string;
}

function newId(): string {
  return `ann_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const ANN_TONE: Record<AnnotationType, string> = {
  deletion: "border-rust-400/40 bg-rust-400/5",
  global:   "border-ochre-300/60 bg-ochre-50",
  comment:  "border-ink-200 bg-paper-50",
};
const ANN_LABEL_TONE: Record<AnnotationType, string> = {
  deletion: "text-rust-500",
  global:   "text-ochre-600",
  comment:  "text-ink-500",
};

export function PlanAnnotator() {
  const {
    planReviews,
    activePlanReviewId,
    planAnnotationsByReview,
    setActivePlanReview,
    addPlanAnnotation,
    removePlanAnnotation,
    updatePlanAnnotation,
    clearPlanReview,
    pushToast,
    pushActivity,
  } = useStore();

  const activeReview = planReviews.find((r) => r.id === activePlanReviewId) ?? null;
  const planAnnotations = activeReview ? planAnnotationsByReview[activeReview.id] ?? [] : [];

  const containerRef = useRef<HTMLDivElement>(null);
  const [toolbar, setToolbar] = useState<ToolbarPos | null>(null);
  const toolbarRef = useRef<ToolbarPos | null>(null);
  toolbarRef.current = toolbar;
  const [commentDraft, setCommentDraft] = useState<{ text: string; value: string } | null>(null);
  const [globalDraft, setGlobalDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  useEffect(() => {
    setToolbar(null);
    setCommentDraft(null);
    setGlobalDraft("");
    setEditingId(null);
    setEditDraft("");
  }, [activePlanReviewId]);

  useEffect(() => {
    function clearToolbar() {
      if (toolbarRef.current !== null) setToolbar(null);
    }
    function handleSelection() {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        clearToolbar();
        return;
      }
      const range = sel.getRangeAt(0);
      const container = containerRef.current;
      if (!container || !container.contains(range.commonAncestorContainer)) {
        clearToolbar();
        return;
      }
      const text = sel.toString().trim();
      if (text.length === 0) {
        clearToolbar();
        return;
      }
      const rect = range.getBoundingClientRect();
      const above = rect.top - 48;
      const top = above < 8 ? rect.bottom + 8 : above;
      setToolbar({ top, left: rect.left + rect.width / 2, text });
    }

    document.addEventListener("selectionchange", handleSelection);
    return () => document.removeEventListener("selectionchange", handleSelection);
  }, []);

  if (!activeReview) {
    return (
      <div className="max-w-3xl mx-auto p-12 text-center">
        <div className="font-display text-5xl text-ink-300 mb-3">◇</div>
        <h2 className="font-display text-2xl text-ink-700 mb-2">No active plan</h2>
        <p className="text-sm text-ink-400">
          Plans appear here automatically when Claude calls <code className="font-mono text-ink-600">ExitPlanMode</code>.
        </p>
      </div>
    );
  }

  const createAnnotation = (type: AnnotationType, comment?: string, sourceText?: string) => {
    const text = sourceText ?? commentDraft?.text ?? toolbar?.text;
    if (!text) return;
    const a: PlanAnnotation = {
      id: newId(),
      type,
      selectedText: text,
      comment,
      createdAt: Date.now(),
    };
    addPlanAnnotation(activeReview.id, a);
    setToolbar(null);
    setCommentDraft(null);
    window.getSelection()?.removeAllRanges();
  };

  const handleCommentClick = () => {
    if (!toolbar) return;
    setCommentDraft({ text: toolbar.text, value: "" });
  };

  const beginEdit = (a: PlanAnnotation) => {
    setEditingId(a.id);
    setEditDraft(a.comment ?? "");
  };

  const saveEdit = (a: PlanAnnotation) => {
    const trimmed = editDraft.trim();
    if (a.type === "deletion" && trimmed.length > 0) {
      updatePlanAnnotation(activeReview.id, a.id, { type: "comment", comment: trimmed });
    } else {
      updatePlanAnnotation(activeReview.id, a.id, {
        comment: trimmed.length > 0 ? trimmed : "(highlight)",
      });
    }
    setEditingId(null);
    setEditDraft("");
  };

  const submitDecision = (
    decision: PlanReviewDecision,
    toast: { kind: "success" | "info"; text: string },
    activity: { kind: "plan-approved" | "plan-denied"; label: string }
  ) => {
    const sent = wsClient.send({
      type: "plan-review-decision",
      id: activeReview.id,
      decision,
    });
    if (!sent) {
      pushToast("error", "Disconnected from server — decision not sent. Reconnect and retry.");
      return;
    }
    pushToast(toast.kind, toast.text);
    pushActivity({
      kind: activity.kind,
      label: activity.label,
      sessionName: activeReview.sessionName ?? activeReview.sessionId,
    });
    clearPlanReview(activeReview.id);
  };

  const handleApprove = (autoEdit: boolean) => {
    submitDecision(
      { approved: true, annotations: planAnnotations, autoEdit },
      {
        kind: "success",
        text: autoEdit
          ? `Approved (auto-edit) · sent to Claude (${planAnnotations.length} annotations)`
          : `Plan approved · sent to Claude (${planAnnotations.length} annotations)`,
      },
      { kind: "plan-approved", label: autoEdit ? "Approved (auto-edit)" : "Approved" }
    );
  };

  const handleDeny = () => {
    const annotations = [...planAnnotations];
    if (globalDraft.trim()) {
      annotations.push({
        id: newId(),
        type: "global",
        selectedText: "(global note)",
        comment: globalDraft.trim(),
        createdAt: Date.now(),
      });
    }
    submitDecision(
      { approved: false, annotations },
      {
        kind: "info",
        text: `Changes requested · ${annotations.length} annotations sent to Claude`,
      },
      { kind: "plan-denied", label: `Changes requested (${annotations.length})` }
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-6 pb-12">
      {planReviews.length > 1 && (
        <div className="mb-5 flex items-center gap-1 overflow-x-auto border-b border-paper-200 -mx-1 px-1">
          {planReviews.map((r) => {
            const annCount = (planAnnotationsByReview[r.id] ?? []).length;
            const isActive = r.id === activePlanReviewId;
            const label = formatSessionLabel(r);
            return (
              <button
                key={r.id}
                onClick={() => setActivePlanReview(r.id)}
                className={`relative px-4 py-2 text-sm whitespace-nowrap transition-colors ${
                  isActive
                    ? "text-ink-800 font-medium"
                    : "text-ink-400 hover:text-ink-700"
                }`}
                title={r.sessionId ?? r.id}
              >
                <span className="font-display tracking-tight">{label}</span>
                <span className="ml-2 text-[10px] text-ink-300 font-mono num">
                  {r.sessionId ? r.sessionId.slice(0, 6) : r.id.slice(0, 6)}
                </span>
                {annCount > 0 && (
                  <span className="ml-2 inline-flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-ochre-500 text-paper-50 text-[10px] font-semibold num">
                    {annCount}
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

      <header className="flex items-end justify-between mb-6 gap-6 flex-wrap">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.18em] text-ochre-600 font-medium mb-1">
            Plan Review
          </div>
          <h2 className="font-display text-3xl md:text-4xl text-ink-800 tracking-tight leading-tight">
            {activeReview.sessionName ?? "Active session"}
          </h2>
          <p className="text-xs text-ink-400 font-mono mt-1.5 truncate">
            {activeReview.filePath ?? "(no file path)"}
            {activeReview.sessionId && (
              <span className="ml-2 text-ink-300">
                · session {activeReview.sessionId.slice(0, 12)}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-ink-400 num">
            {planAnnotations.length} annotation{planAnnotations.length === 1 ? "" : "s"} · no time limit
          </span>
          <div className="h-6 w-px bg-paper-300" />
          <button
            onClick={handleDeny}
            className="px-4 py-2 bg-paper-50 border border-rust-400/50 text-rust-600 text-sm font-medium rounded-md hover:bg-rust-400/10 hover:border-rust-500 transition-colors"
            title="Send annotations back to Claude as feedback"
          >
            Request Changes
          </button>
          <button
            onClick={() => handleApprove(false)}
            className="px-4 py-2 bg-paper-50 border border-moss-500/50 text-moss-600 text-sm font-medium rounded-md hover:bg-moss-400/10 hover:border-moss-500 transition-colors"
            title="Approve plan; Claude will still ask permission for each edit"
          >
            Approve
          </button>
          <button
            onClick={() => handleApprove(true)}
            className="px-4 py-2 bg-ink-800 text-paper-100 text-sm font-medium rounded-md hover:bg-ink-900 transition-colors shadow-sm border border-ink-900"
            title="Approve plan AND signal auto-edit intent"
          >
            Approve + auto-edit →
          </button>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-3 lg:col-span-2 space-y-3">
          <div
            ref={containerRef}
            className="surface-paper rounded-lg p-7 md:p-10 prose prose-ink prose-sm max-w-none select-text"
            style={{ minHeight: "60vh" }}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {activeReview.content}
            </ReactMarkdown>
          </div>
          <div className="surface-paper-flat rounded-md p-3">
            <label className="block text-[10px] uppercase tracking-[0.16em] font-medium text-ink-500 mb-1.5">
              Global note
              <span className="ml-1.5 text-ink-300 normal-case tracking-normal text-[11px]">
                — added to feedback if you Request Changes
              </span>
            </label>
            <textarea
              value={globalDraft}
              onChange={(e) => setGlobalDraft(e.target.value)}
              rows={2}
              placeholder="High-level concerns about the whole plan…"
              className="w-full text-sm bg-transparent border border-paper-200 rounded p-2 focus:border-ochre-400 outline-none placeholder-ink-300 resize-y"
            />
          </div>
        </div>

        <aside className="col-span-3 lg:col-span-1">
          <div className="surface-paper rounded-lg p-4 sticky top-20">
            <div className="flex items-baseline justify-between mb-3 pb-2 border-b border-paper-200">
              <h3 className="font-display text-lg text-ink-800 tracking-tight">Annotations</h3>
              <span className="text-[11px] uppercase tracking-[0.16em] text-ink-400 num">
                {planAnnotations.length}
              </span>
            </div>
            {planAnnotations.length === 0 ? (
              <div className="py-6 text-center">
                <div className="font-display text-2xl text-ink-300 mb-1">◌</div>
                <p className="text-xs text-ink-400 max-w-[200px] mx-auto leading-relaxed">
                  Select text in the plan to annotate.
                </p>
              </div>
            ) : (
              <ul className="space-y-2 max-h-[62vh] overflow-y-auto -mx-1 px-1">
                {planAnnotations.map((a) => (
                  <li
                    key={a.id}
                    className={`p-2.5 text-xs rounded-md border ${ANN_TONE[a.type]} animate-rise-in`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={`font-medium uppercase text-[9px] tracking-[0.14em] ${ANN_LABEL_TONE[a.type]}`}
                      >
                        {a.type}
                      </span>
                      <div className="flex gap-1.5">
                        {editingId !== a.id && a.type !== "global" && (
                          <button
                            onClick={() => beginEdit(a)}
                            className="text-ink-300 hover:text-ochre-600 text-[11px] leading-none"
                            title="Edit comment"
                          >
                            ✎
                          </button>
                        )}
                        <button
                          onClick={() => removePlanAnnotation(activeReview.id, a.id)}
                          className="text-ink-300 hover:text-rust-500 text-[12px] leading-none"
                          title="Delete annotation"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                    <div
                      className={`mt-1.5 leading-snug ${
                        a.type === "deletion" ? "line-through text-ink-400" : "text-ink-700"
                      }`}
                    >
                      <span className="text-ink-300">“</span>
                      {a.selectedText.length > 80
                        ? a.selectedText.slice(0, 80) + "…"
                        : a.selectedText}
                      <span className="text-ink-300">”</span>
                    </div>
                    {editingId === a.id ? (
                      <div className="mt-2">
                        <textarea
                          autoFocus
                          value={editDraft}
                          onChange={(e) => setEditDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              saveEdit(a);
                            } else if (e.key === "Escape") {
                              setEditingId(null);
                            }
                          }}
                          rows={3}
                          placeholder="Enter = save · Shift+Enter = newline · Esc = cancel"
                          className="w-full text-xs bg-paper-50 border border-paper-200 rounded p-1.5 focus:border-ochre-400 outline-none placeholder-ink-300"
                        />
                        <div className="flex justify-end gap-1 mt-1">
                          <button
                            onClick={() => setEditingId(null)}
                            className="px-2 py-0.5 text-[10px] text-ink-500 hover:bg-paper-100 rounded"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => saveEdit(a)}
                            className="px-2 py-0.5 text-[10px] bg-ink-800 text-paper-100 rounded hover:bg-ink-900"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      a.comment && (
                        <div className="mt-1.5 text-ink-600 italic font-display text-[13px] leading-snug">
                          — {a.comment}
                        </div>
                      )
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>

      {toolbar && !commentDraft && (
        <div
          className="fixed z-50 bg-ink-800 text-paper-100 text-xs rounded-md flex shadow-toolbar animate-rise-in overflow-hidden border border-ink-900"
          style={{
            top: toolbar.top,
            left: toolbar.left,
            transform: "translateX(-50%)",
          }}
        >
          <ToolbarBtn onClick={handleCommentClick} icon="💬" label="Comment" />
          <ToolbarBtn
            onClick={() => createAnnotation("comment", "(highlight)", toolbar.text)}
            icon="✨"
            label="Highlight"
          />
          <ToolbarBtn
            onClick={() => createAnnotation("deletion", undefined, toolbar.text)}
            icon="✂"
            label="Delete"
          />
          <button
            onClick={() => {
              setToolbar(null);
              window.getSelection()?.removeAllRanges();
            }}
            className="px-3 py-2 hover:bg-ink-700 border-l border-ink-900 text-paper-300 hover:text-paper-50 transition-colors"
            title="Close"
          >
            ✕
          </button>
        </div>
      )}

      {commentDraft && (
        <div
          className="fixed inset-0 bg-ink-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setCommentDraft(null)}
        >
          <div
            className="surface-paper rounded-lg shadow-paper-lg p-6 w-full max-w-2xl animate-rise-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[10px] uppercase tracking-[0.18em] font-medium text-ochre-600 mb-2">
              Selected text
            </div>
            <div className="text-sm bg-paper-100 border border-paper-200 p-3 rounded mb-4 max-h-40 overflow-y-auto whitespace-pre-wrap text-ink-700 font-display leading-snug">
              <span className="text-ink-300">“</span>
              {commentDraft.text.length > 400
                ? commentDraft.text.slice(0, 400) + "…"
                : commentDraft.text}
              <span className="text-ink-300">”</span>
            </div>
            <textarea
              autoFocus
              value={commentDraft.value}
              onChange={(e) =>
                setCommentDraft({ ...commentDraft, value: e.target.value })
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  createAnnotation(
                    "comment",
                    commentDraft.value.trim() || "(highlight)",
                    commentDraft.text
                  );
                } else if (e.key === "Escape") {
                  setCommentDraft(null);
                }
              }}
              rows={8}
              placeholder="Your comment (Enter = submit · Shift+Enter = newline · Esc = cancel)…"
              className="w-full text-sm leading-relaxed bg-paper-50 border border-paper-200 rounded p-3 focus:border-ochre-400 outline-none resize-y placeholder-ink-300"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setCommentDraft(null)}
                className="px-4 py-2 text-sm text-ink-500 hover:bg-paper-100 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  createAnnotation(
                    "comment",
                    commentDraft.value.trim() || "(highlight)",
                    commentDraft.text
                  )
                }
                className="px-4 py-2 text-sm bg-ink-800 text-paper-100 rounded-md hover:bg-ink-900 transition-colors shadow-sm border border-ink-900"
              >
                {commentDraft.value.trim() ? "Add comment" : "Just highlight"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ToolbarBtn({
  onClick,
  icon,
  label,
}: {
  onClick: () => void;
  icon: string;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-2 hover:bg-ink-700 transition-colors flex items-center gap-1.5 first:rounded-l-md"
    >
      <span className="text-[13px] leading-none">{icon}</span>
      <span>{label}</span>
    </button>
  );
}
