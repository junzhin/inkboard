import { type ReactNode } from "react";
import { useStore } from "../store";

interface LayoutProps {
  children: ReactNode;
}

type ViewKey = "idle" | "question" | "plan-review";

const NAV: ReadonlyArray<{ key: ViewKey; label: string }> = [
  { key: "idle", label: "Home" },
  { key: "question", label: "Questions" },
  { key: "plan-review", label: "Review" },
];

export function Layout({ children }: LayoutProps) {
  const { connected, view, setView, toasts, dismissToast, planReviews, pendingQuestions } = useStore();
  const pendingPlans = planReviews.length;
  const pendingQs = pendingQuestions.length;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-paper-200 bg-paper-50/85 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <button
            onClick={() => setView("idle")}
            className="flex items-baseline gap-2 group"
            title="Home"
          >
            <span className="relative inline-flex h-7 w-7 items-center justify-center rounded-md bg-ink-800 text-paper-100 shadow-inset">
              <span className="font-display text-[15px] leading-none">I</span>
              <span className="absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-ochre-400 ring-1 ring-paper-50" />
            </span>
            <span className="font-display text-2xl text-ink-800 leading-none tracking-tight group-hover:text-ink-900 transition-colors">
              InkBoard
            </span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-ink-300 font-medium ml-1">
              v0.1
            </span>
          </button>

          <div className="flex items-center gap-5">
            <nav className="hidden sm:flex items-center gap-1 p-1 rounded-md bg-paper-100/60 border border-paper-200">
              {NAV.map(({ key, label }) => {
                const isActive = view === key;
                const badge =
                  key === "plan-review" ? pendingPlans : key === "question" ? pendingQs : 0;
                return (
                  <button
                    key={key}
                    onClick={() => setView(key)}
                    className={`relative px-3 py-1 text-sm rounded transition-all duration-200 ease-out-expo ${
                      isActive
                        ? "bg-paper-50 text-ink-800 font-medium shadow-sm border border-paper-200"
                        : "text-ink-400 hover:text-ink-700"
                    }`}
                  >
                    {label}
                    {badge > 0 && (
                      <span className="absolute -top-1 -right-1 inline-flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-ochre-500 text-paper-50 text-[10px] font-semibold num">
                        {badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            <ConnectionPill connected={connected} />
          </div>
        </div>
      </header>

      <main className="py-8">{children}</main>

      <div className="fixed bottom-6 right-6 z-[60] flex flex-col gap-2 pointer-events-none w-[min(360px,calc(100vw-2rem))]">
        {toasts.map((t) => (
          <button
            key={t.id}
            onClick={() => dismissToast(t.id)}
            className={`pointer-events-auto text-left px-4 py-3 rounded-md text-sm font-medium animate-toast-in shadow-paper-lg border ${
              t.kind === "success"
                ? "bg-moss-500 border-moss-600 text-paper-50"
                : t.kind === "error"
                ? "bg-rust-500 border-rust-600 text-paper-50"
                : "bg-ink-800 border-ink-700 text-paper-100"
            }`}
          >
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 text-base leading-none">
                {t.kind === "success" ? "✓" : t.kind === "error" ? "!" : "·"}
              </span>
              <span className="flex-1">{t.text}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function ConnectionPill({ connected }: { connected: boolean }) {
  return (
    <div
      className={`flex items-center gap-2 pl-2 pr-3 py-1 rounded-full border text-[11px] uppercase tracking-[0.14em] font-medium transition-colors ${
        connected
          ? "border-moss-400/40 bg-moss-400/10 text-moss-600"
          : "border-rust-400/40 bg-rust-400/10 text-rust-500"
      }`}
      title={connected ? "WebSocket connected" : "WebSocket disconnected"}
    >
      <span className="relative inline-flex h-2 w-2">
        <span
          className={`absolute inset-0 rounded-full ${
            connected ? "bg-moss-500 animate-pulse-dot" : "bg-rust-500"
          }`}
        />
        {connected && (
          <span className="absolute -inset-1 rounded-full bg-moss-400/30 animate-ping" />
        )}
      </span>
      {connected ? "Live" : "Offline"}
    </div>
  );
}
