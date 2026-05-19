import { useEffect, useState } from "react";
import { useStore, type ActivityEntry } from "../store";
import { wsClient } from "../ws-client";
import { formatSessionLabel } from "../lib/format";

function formatRelative(ts: number, now: number): string {
  const d = Math.max(0, now - ts);
  if (d < 5_000) return "just now";
  if (d < 60_000) return `${Math.floor(d / 1000)}s ago`;
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h ago`;
  return new Date(ts).toLocaleString();
}

const KIND_META: Record<
  ActivityEntry["kind"],
  { text: string; tone: "ink" | "moss" | "rust" | "ochre" }
> = {
  "plan-arrived":      { text: "Plan arrived",      tone: "ochre" },
  "plan-approved":     { text: "Plan approved",     tone: "moss" },
  "plan-denied":       { text: "Changes requested", tone: "rust" },
  "question-asked":    { text: "Question asked",    tone: "ink" },
  "question-answered": { text: "Question answered", tone: "moss" },
};

const TONE_BADGE: Record<"ink" | "moss" | "rust" | "ochre", string> = {
  ink:   "border-ink-200 bg-ink-50 text-ink-700",
  moss:  "border-moss-400/30 bg-moss-400/10 text-moss-600",
  rust:  "border-rust-400/30 bg-rust-400/10 text-rust-500",
  ochre: "border-ochre-200 bg-ochre-50 text-ochre-600",
};

interface HealthInfo {
  app?: string;
  version?: string;
  pid?: number;
  port?: number | null;
}

export function Home() {
  const {
    connected,
    questionRoutingEnabled,
    planReviews,
    pendingQuestions,
    activity,
    setActivePlanReview,
    setView,
  } = useStore();
  const [now, setNow] = useState(Date.now());
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const r = await fetch("/health", { cache: "no-store" });
        const body = (await r.json()) as HealthInfo;
        if (cancelled) return;
        if (body.app !== "inkboard") {
          setHealthError(`Port answered but is not inkboard (app=${body.app ?? "unknown"})`);
          setHealth(null);
          return;
        }
        setHealth(body);
        setHealthError(null);
      } catch (err) {
        if (!cancelled) setHealthError(String(err));
      }
    }
    poll();
    const t = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  const port =
    window.location.port ||
    (window.location.protocol === "https:" ? "443" : "80");
  const pendingPlans = planReviews.length;
  const pendingQs = pendingQuestions.length;

  return (
    <div className="max-w-6xl mx-auto px-6 space-y-10">
      {/* Editorial hero */}
      <section className="grid grid-cols-12 gap-6 items-end pb-4 border-b border-paper-200">
        <div className="col-span-12 md:col-span-7 space-y-3">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-ochre-200 bg-ochre-50 text-ochre-600 text-[11px] uppercase tracking-[0.16em] font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-ochre-400" />
            Canvas for Claude Code
          </div>
          <h1 className="font-display text-5xl md:text-6xl text-ink-800 leading-[0.95] tracking-tight">
            A quiet desk for
            <span className="block italic text-ochre-600 mt-1">plan review.</span>
          </h1>
          <p className="text-base text-ink-500 max-w-xl leading-relaxed">
            InkBoard surfaces <em className="text-ink-700 not-italic font-medium">ExitPlanMode</em> and{" "}
            <em className="text-ink-700 not-italic font-medium">AskUserQuestion</em> from Claude Code as a
            browser canvas — annotate plans inline, answer structured questions, keep one window per session.
          </p>
        </div>
        <div className="col-span-12 md:col-span-5 grid grid-cols-3 gap-3">
          <BigStat label="Reviews" value={pendingPlans} hot={pendingPlans > 0} />
          <BigStat label="Questions" value={pendingQs} hot={pendingQs > 0} />
          <BigStat label="Port" value={port} hot={false} mono />
        </div>
      </section>

      {/* Question routing toggle */}
      <section className="surface-paper rounded-lg px-5 py-4 flex items-center justify-between animate-rise-in">
        <div className="space-y-0.5">
          <div className="text-sm font-medium text-ink-800">Route questions to canvas</div>
          <div className="text-xs text-ink-400">
            {questionRoutingEnabled
              ? "AskUserQuestion will appear here. Use the release button to fall back to terminal."
              : "Questions stay in terminal only. Toggle on to intercept them here."}
          </div>
        </div>
        <button
          onClick={() => {
            const next = !questionRoutingEnabled;
            wsClient.send({ type: "toggle-question-routing", enabled: next });
          }}
          className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
            questionRoutingEnabled ? "bg-moss-500" : "bg-ink-200"
          }`}
          aria-pressed={questionRoutingEnabled}
          aria-label="Toggle question routing to canvas"
        >
          <span
            className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
              questionRoutingEnabled ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </section>

      {/* Bento: pending reviews + activity */}
      <section className="grid grid-cols-12 gap-5">
        <div className="col-span-12 lg:col-span-7">
          <Panel
            title="Active plan reviews"
            kicker={pendingPlans > 0 ? `${pendingPlans} waiting` : undefined}
            action={
              planReviews.length > 0 ? (
                <button onClick={() => setView("plan-review")} className="link-ink text-sm">
                  Open review →
                </button>
              ) : undefined
            }
          >
            {planReviews.length === 0 ? (
              <EmptyState
                icon="◇"
                title="No plans waiting"
                hint="Plans arrive automatically when Claude calls ExitPlanMode in a hooked session."
              />
            ) : (
              <ul className="divide-y divide-paper-200">
                {planReviews.map((r) => (
                  <li key={r.id} className="py-3 flex items-center justify-between gap-3 group">
                    <div className="min-w-0">
                      <div className="text-[15px] font-medium text-ink-800 truncate font-display tracking-tight">
                        {formatSessionLabel(r)}
                      </div>
                      <div className="text-xs text-ink-400 truncate font-mono mt-0.5">
                        {r.filePath ?? "(inline plan)"} · {formatRelative(r.receivedAt, now)}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setActivePlanReview(r.id);
                        setView("plan-review");
                      }}
                      className="shrink-0 px-3 py-1.5 text-xs font-medium rounded-md bg-ink-800 text-paper-100 hover:bg-ink-900 transition-colors shadow-sm opacity-90 group-hover:opacity-100"
                    >
                      Review →
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="col-span-12 lg:col-span-5">
          <Panel title="Recent activity" kicker={activity.length > 0 ? `last ${activity.length}` : undefined}>
            {activity.length === 0 ? (
              <EmptyState
                icon="·"
                title="Nothing yet"
                hint={
                  <>
                    Run <Code>/inkboard</Code> in Claude Code, or trigger a plan with <Code>ExitPlanMode</Code>.
                  </>
                }
              />
            ) : (
              <ul className="space-y-1.5 max-h-[360px] overflow-y-auto -mx-1 px-1">
                {activity.map((a) => {
                  const meta = KIND_META[a.kind];
                  return (
                    <li
                      key={a.id}
                      className="flex items-center gap-2.5 text-sm py-1.5 px-2 rounded-md hover:bg-paper-100/60 transition-colors"
                    >
                      <span
                        className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider font-medium border ${TONE_BADGE[meta.tone]}`}
                      >
                        {meta.text}
                      </span>
                      <span className="text-ink-700 truncate flex-1">
                        {a.sessionName ?? a.label}
                      </span>
                      <span className="text-[11px] text-ink-300 whitespace-nowrap num">
                        {formatRelative(a.at, now)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>
      </section>

      {/* Tips strip — editorial three-up */}
      <section className="grid grid-cols-12 gap-5">
        <Tip
          n="01"
          title="One window per session"
          body="Each Claude window gets its own tab in the Review surface — switch with the tab bar."
        />
        <Tip
          n="02"
          title="Select → annotate"
          body={
            <>
              Highlight text in the plan, then choose <em>Comment</em>, <em>Highlight</em>, or <em>Delete</em>{" "}
              from the floating toolbar.
            </>
          }
        />
        <Tip
          n="03"
          title="Test without Claude"
          body={
            <>
              Push a sample plan: <Code>curl http://localhost:{port}/debug/push-plan-review</Code>
            </>
          }
        />
      </section>

      {health && !healthError && (
        <div className="rounded-md border border-moss-400/30 bg-moss-400/10 text-moss-700 px-4 py-2 text-xs flex items-center gap-3 font-mono">
          <span className="h-1.5 w-1.5 rounded-full bg-moss-500 animate-pulse-dot" />
          <span>
            Connected to inkboard v{health.version} · pid={health.pid} · port={health.port ?? port}
          </span>
        </div>
      )}
      {(healthError || !connected) && (
        <div className="rounded-md border border-rust-400/30 bg-rust-400/10 text-rust-600 px-4 py-3 text-sm flex items-center gap-3 animate-rise-in">
          <span className="h-2 w-2 rounded-full bg-rust-500" />
          <span>
            {healthError
              ? `Port ${port} did not respond as inkboard: ${healthError}. Run the uninstall script and reinstall.`
              : "Disconnected from the InkBoard server. The canvas reconnects automatically; if it doesn't, run `bash scripts/start.sh`."}
          </span>
        </div>
      )}
    </div>
  );
}

function BigStat({
  label,
  value,
  hot,
  mono = false,
}: {
  label: string;
  value: number | string;
  hot: boolean;
  mono?: boolean;
}) {
  return (
    <div
      className={`relative rounded-md surface-paper px-3 py-3 overflow-hidden transition-all duration-300 ease-out-expo hover:-translate-y-0.5 hover:shadow-paper-lg ${
        hot ? "ring-1 ring-ochre-300" : ""
      }`}
    >
      <div className="text-[10px] uppercase tracking-[0.16em] text-ink-400 font-medium">{label}</div>
      <div
        className={`mt-1 num leading-none ${
          mono ? "font-mono text-2xl" : "font-display text-4xl"
        } ${hot ? "text-ochre-600" : "text-ink-800"}`}
      >
        {value}
      </div>
      {hot && (
        <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-ochre-400 animate-pulse-dot" />
      )}
    </div>
  );
}

function Panel({
  title,
  kicker,
  action,
  children,
}: {
  title: string;
  kicker?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="surface-paper rounded-lg p-5 animate-rise-in">
      <header className="flex items-center justify-between mb-4 pb-3 border-b border-paper-200">
        <div className="flex items-baseline gap-3">
          <h2 className="font-display text-xl text-ink-800 tracking-tight">{title}</h2>
          {kicker && (
            <span className="text-[11px] uppercase tracking-[0.16em] text-ink-400 num">{kicker}</span>
          )}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

function EmptyState({
  icon,
  title,
  hint,
}: {
  icon: string;
  title: string;
  hint: React.ReactNode;
}) {
  return (
    <div className="py-8 text-center">
      <div className="font-display text-4xl text-ink-300 mb-2">{icon}</div>
      <div className="text-sm text-ink-600 font-medium mb-1">{title}</div>
      <div className="text-xs text-ink-400 max-w-xs mx-auto leading-relaxed">{hint}</div>
    </div>
  );
}

function Tip({ n, title, body }: { n: string; title: string; body: React.ReactNode }) {
  return (
    <div className="col-span-12 sm:col-span-6 lg:col-span-4 surface-paper-flat rounded-md p-4 transition-colors hover:border-ochre-200">
      <div className="flex items-baseline gap-2 mb-1.5">
        <span className="font-mono text-[10px] text-ochre-500 num">{n}</span>
        <h3 className="text-sm font-semibold text-ink-800">{title}</h3>
      </div>
      <p className="text-xs text-ink-500 leading-relaxed">{body}</p>
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="font-mono text-[0.85em] px-1.5 py-0.5 rounded bg-paper-100 border border-paper-200 text-ink-700">
      {children}
    </code>
  );
}
