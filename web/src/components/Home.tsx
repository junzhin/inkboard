import { useEffect, useState } from "react";
import { useStore, type ActivityEntry } from "../store";
import { wsClient } from "../ws-client";
import { formatSessionLabel } from "../lib/format";
import { t } from "../lib/i18n";

function formatRelative(ts: number, now: number): string {
  const d = Math.max(0, now - ts);
  if (d < 5_000) return t("time.just-now");
  if (d < 60_000) return `${Math.floor(d / 1000)}${t("time.s-ago")}`;
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}${t("time.m-ago")}`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}${t("time.h-ago")}`;
  return new Date(ts).toLocaleString();
}

function kindText(kind: ActivityEntry["kind"]): string {
  return t(`activity.${kind}`);
}

const KIND_TONE: Record<ActivityEntry["kind"], "ink" | "moss" | "rust" | "ochre"> = {
  "plan-arrived":      "ochre",
  "plan-approved":     "moss",
  "plan-denied":       "rust",
  "question-asked":    "ink",
  "question-answered": "moss",
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
    locale: _locale,
  } = useStore();
  const [now, setNow] = useState(Date.now());
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const r = await fetch("/health", { cache: "no-store" });
        const body = (await r.json()) as HealthInfo;
        if (cancelled) return;
        if (body.app !== "inkboard") {
          setHealthError(`${t("home.health.squatter")} (app=${body.app ?? "unknown"})`);
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
    const timer = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const port =
    window.location.port ||
    (window.location.protocol === "https:" ? "443" : "80");
  const pendingPlans = planReviews.length;
  const pendingQs = pendingQuestions.length;

  return (
    <div className="max-w-6xl mx-auto px-6 space-y-10">
      <section className="grid grid-cols-12 gap-6 items-end pb-4 border-b border-paper-200">
        <div className="col-span-12 md:col-span-7 space-y-3">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-ochre-200 bg-ochre-50 text-ochre-600 text-[11px] uppercase tracking-[0.16em] font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-ochre-400" />
            {t("home.badge")}
          </div>
          <h1 className="font-display text-5xl md:text-6xl text-ink-800 leading-[0.95] tracking-tight">
            {t("home.title.line1")}
            <span className="block italic text-ochre-600 mt-1">{t("home.title.line2")}</span>
          </h1>
          <p className="text-base text-ink-500 max-w-xl leading-relaxed">
            {t("home.desc")}
          </p>
        </div>
        <div className="col-span-12 md:col-span-5 grid grid-cols-3 gap-3">
          <BigStat label={t("home.stat.reviews")} value={pendingPlans} hot={pendingPlans > 0} />
          <BigStat label={t("home.stat.questions")} value={pendingQs} hot={pendingQs > 0} />
          <BigStat label={t("home.stat.port")} value={port} hot={false} mono />
        </div>
      </section>

      <section className="surface-paper rounded-lg px-5 py-4 flex items-center justify-between animate-rise-in">
        <div className="space-y-0.5">
          <div className="text-sm font-medium text-ink-800">{t("home.routing.title")}</div>
          <div className="text-xs text-ink-400">
            {questionRoutingEnabled ? t("home.routing.on") : t("home.routing.off")}
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
          aria-label={t("home.routing.title")}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
              questionRoutingEnabled ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </section>

      <section className="grid grid-cols-12 gap-5">
        <div className="col-span-12 lg:col-span-7">
          <Panel
            title={t("home.panel.reviews")}
            kicker={pendingPlans > 0 ? `${pendingPlans} ${t("home.panel.reviews.waiting")}` : undefined}
            action={
              planReviews.length > 0 ? (
                <button onClick={() => setView("plan-review")} className="link-ink text-sm">
                  {t("home.panel.reviews.open")}
                </button>
              ) : undefined
            }
          >
            {planReviews.length === 0 ? (
              <EmptyState
                icon="◇"
                title={t("home.panel.reviews.empty.title")}
                hint={t("home.panel.reviews.empty.hint")}
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
                        {r.filePath ?? t("home.panel.reviews.inline")} · {formatRelative(r.receivedAt, now)}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setActivePlanReview(r.id);
                        setView("plan-review");
                      }}
                      className="shrink-0 px-3 py-1.5 text-xs font-medium rounded-md bg-ink-800 text-paper-100 hover:bg-ink-900 transition-colors shadow-sm opacity-90 group-hover:opacity-100"
                    >
                      {t("home.panel.reviews.action")}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="col-span-12 lg:col-span-5">
          <Panel title={t("home.panel.activity")} kicker={activity.length > 0 ? `${t("home.panel.activity.last")} ${activity.length}` : undefined}>
            {activity.length === 0 ? (
              <EmptyState
                icon="·"
                title={t("home.panel.activity.empty.title")}
                hint={t("home.panel.activity.empty.hint")}
              />
            ) : (
              <ul className="space-y-1.5 max-h-[360px] overflow-y-auto -mx-1 px-1">
                {activity.map((a) => {
                  const tone = KIND_TONE[a.kind];
                  return (
                    <li
                      key={a.id}
                      className="flex items-center gap-2.5 text-sm py-1.5 px-2 rounded-md hover:bg-paper-100/60 transition-colors"
                    >
                      <span
                        className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider font-medium border ${TONE_BADGE[tone]}`}
                      >
                        {kindText(a.kind)}
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

      <section className="grid grid-cols-12 gap-5">
        <Tip
          n="01"
          title={t("home.tip1.title")}
          body={t("home.tip1.body")}
        />
        <Tip
          n="02"
          title={t("home.tip2.title")}
          body={t("home.tip2.body")}
        />
        <Tip
          n="03"
          title={t("home.tip3.title")}
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
            {t("home.health.connected")} v{health.version} · pid={health.pid} · port={health.port ?? port}
          </span>
        </div>
      )}
      {(healthError || !connected) && (
        <div className="rounded-md border border-rust-400/30 bg-rust-400/10 text-rust-600 px-4 py-3 text-sm flex items-center gap-3 animate-rise-in">
          <span className="h-2 w-2 rounded-full bg-rust-500" />
          <span>
            {healthError
              ? `Port ${port} ${t("home.health.error")}: ${healthError}`
              : t("home.health.disconnected")}
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
