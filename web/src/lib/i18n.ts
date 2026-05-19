export type Locale = "en" | "zh";

const STORAGE_KEY = "inkboard-locale";

const en: Record<string, string> = {
  "nav.home": "Home",
  "nav.questions": "Questions",
  "nav.review": "Review",
  "status.live": "Live",
  "status.offline": "Offline",

  "home.badge": "Canvas for Claude Code",
  "home.title.line1": "A quiet desk for",
  "home.title.line2": "plan review.",
  "home.desc": "InkBoard surfaces ExitPlanMode and AskUserQuestion from Claude Code as a browser canvas — annotate plans inline, answer structured questions, keep one window per session.",
  "home.stat.reviews": "Reviews",
  "home.stat.questions": "Questions",
  "home.stat.port": "Port",
  "home.routing.title": "Route questions to canvas",
  "home.routing.on": "AskUserQuestion will appear here. Use the release button to fall back to terminal.",
  "home.routing.off": "Questions stay in terminal only. Toggle on to intercept them here.",
  "home.panel.reviews": "Active plan reviews",
  "home.panel.reviews.waiting": "waiting",
  "home.panel.reviews.open": "Open review →",
  "home.panel.reviews.empty.title": "No plans waiting",
  "home.panel.reviews.empty.hint": "Plans arrive automatically when Claude calls ExitPlanMode in a hooked session.",
  "home.panel.reviews.action": "Review →",
  "home.panel.reviews.inline": "(inline plan)",
  "home.panel.activity": "Recent activity",
  "home.panel.activity.last": "last",
  "home.panel.activity.empty.title": "Nothing yet",
  "home.panel.activity.empty.hint": "Run /inkboard in Claude Code, or trigger a plan with ExitPlanMode.",
  "home.tip1.title": "One window per session",
  "home.tip1.body": "Each Claude window gets its own tab in the Review surface — switch with the tab bar.",
  "home.tip2.title": "Select → annotate",
  "home.tip2.body": "Highlight text in the plan, then choose Comment, Highlight, or Delete from the floating toolbar.",
  "home.tip3.title": "Test without Claude",
  "home.health.connected": "Connected to inkboard",
  "home.health.squatter": "Port answered but is not inkboard",
  "home.health.disconnected": "Disconnected from the InkBoard server. The canvas reconnects automatically; if it doesn't, run `bash scripts/start.sh`.",
  "home.health.error": "did not respond as inkboard",

  "activity.plan-arrived": "Plan arrived",
  "activity.plan-approved": "Plan approved",
  "activity.plan-denied": "Changes requested",
  "activity.question-asked": "Question asked",
  "activity.question-answered": "Question answered",

  "time.just-now": "just now",
  "time.s-ago": "s ago",
  "time.m-ago": "m ago",
  "time.h-ago": "h ago",

  "question.empty.title": "No question pending",
  "question.empty.hint": "Questions appear here automatically when Claude calls AskUserQuestion.",
  "question.header": "Interview",
  "question.title": "Structured questions",
  "question.session": "session",
  "question.context": "Context",
  "question.custom-placeholder": "Or type a custom answer…",
  "question.answered": "answered",
  "question.release": "↳ Answer in terminal",
  "question.submit": "Submit answers →",
  "question.countdown.terminal": "→ terminal",
  "question.countdown.releasing": "releasing…",

  "plan.empty.title": "No active plan",
  "plan.empty.hint": "Plans appear here automatically when Claude calls ExitPlanMode.",
  "plan.header": "Plan Review",
  "plan.session.default": "Active session",
  "plan.no-file": "(no file path)",
  "plan.annotations": "Annotations",
  "plan.annotations.count": "annotation",
  "plan.annotations.counts": "annotations",
  "plan.annotations.no-limit": "no time limit",
  "plan.annotations.empty": "Select text in the plan to annotate.",
  "plan.global-note": "Global note",
  "plan.global-note.hint": "— added to feedback if you Request Changes",
  "plan.global-note.placeholder": "High-level concerns about the whole plan…",
  "plan.action.deny": "Request Changes",
  "plan.action.approve": "Approve",
  "plan.action.auto-edit": "Approve + auto-edit →",
  "plan.toolbar.comment": "Comment",
  "plan.toolbar.highlight": "Highlight",
  "plan.toolbar.delete": "Delete",
  "plan.modal.selected": "Selected text",
  "plan.modal.placeholder": "Your comment (Enter = submit · Shift+Enter = newline · Esc = cancel)…",
  "plan.modal.cancel": "Cancel",
  "plan.modal.add-comment": "Add comment",
  "plan.modal.just-highlight": "Just highlight",
  "plan.edit.placeholder": "Enter = save · Shift+Enter = newline · Esc = cancel",
  "plan.edit.cancel": "Cancel",
  "plan.edit.save": "Save",

  "toast.approved": "Plan approved · sent to Claude",
  "toast.approved.auto-edit": "Approved (auto-edit) · sent to Claude",
  "toast.denied": "Changes requested",
  "toast.annotations-sent": "annotations sent to Claude",
  "toast.disconnected": "Disconnected from server — decision not sent. Reconnect and retry.",
  "toast.released": "Released to terminal — answer there",
};

const zh: Record<string, string> = {
  "nav.home": "首页",
  "nav.questions": "问题",
  "nav.review": "评审",
  "status.live": "已连接",
  "status.offline": "离线",

  "home.badge": "Claude Code 画布",
  "home.title.line1": "一张安静的桌子，",
  "home.title.line2": "用于计划评审。",
  "home.desc": "InkBoard 将 Claude Code 的 ExitPlanMode 和 AskUserQuestion 呈现为浏览器画布 — 在计划中内联批注、回答结构化问题、每个会话一个窗口。",
  "home.stat.reviews": "评审",
  "home.stat.questions": "问题",
  "home.stat.port": "端口",
  "home.routing.title": "将问题路由到画布",
  "home.routing.on": "AskUserQuestion 将在此显示。使用释放按钮回退到终端。",
  "home.routing.off": "问题仅在终端中显示。开启后可在此拦截。",
  "home.panel.reviews": "活跃的计划评审",
  "home.panel.reviews.waiting": "等待中",
  "home.panel.reviews.open": "打开评审 →",
  "home.panel.reviews.empty.title": "暂无等待的计划",
  "home.panel.reviews.empty.hint": "当 Claude 在已启用 hook 的会话中调用 ExitPlanMode 时，计划会自动到达。",
  "home.panel.reviews.action": "评审 →",
  "home.panel.reviews.inline": "（内联计划）",
  "home.panel.activity": "最近活动",
  "home.panel.activity.last": "最近",
  "home.panel.activity.empty.title": "暂无活动",
  "home.panel.activity.empty.hint": "在 Claude Code 中运行 /inkboard，或触发一个 ExitPlanMode 计划。",
  "home.tip1.title": "每个会话一个窗口",
  "home.tip1.body": "每个 Claude 窗口在评审界面中有独立标签 — 通过标签栏切换。",
  "home.tip2.title": "选中 → 批注",
  "home.tip2.body": "在计划中高亮文本，然后从浮动工具栏选择「评论」、「高亮」或「删除」。",
  "home.tip3.title": "无需 Claude 测试",
  "home.health.connected": "已连接到 inkboard",
  "home.health.squatter": "端口有响应但不是 inkboard",
  "home.health.disconnected": "与 InkBoard 服务器断开连接。画布会自动重连；如果没有，请运行 `bash scripts/start.sh`。",
  "home.health.error": "未响应为 inkboard",

  "activity.plan-arrived": "计划到达",
  "activity.plan-approved": "计划已批准",
  "activity.plan-denied": "请求修改",
  "activity.question-asked": "收到问题",
  "activity.question-answered": "已回答问题",

  "time.just-now": "刚刚",
  "time.s-ago": "秒前",
  "time.m-ago": "分钟前",
  "time.h-ago": "小时前",

  "question.empty.title": "暂无待处理问题",
  "question.empty.hint": "当 Claude 调用 AskUserQuestion 时，问题会自动在此显示。",
  "question.header": "访谈",
  "question.title": "结构化问题",
  "question.session": "会话",
  "question.context": "上下文",
  "question.custom-placeholder": "或输入自定义回答…",
  "question.answered": "已回答",
  "question.release": "↳ 在终端回答",
  "question.submit": "提交回答 →",
  "question.countdown.terminal": "→ 终端",
  "question.countdown.releasing": "释放中…",

  "plan.empty.title": "暂无活跃计划",
  "plan.empty.hint": "当 Claude 调用 ExitPlanMode 时，计划会自动在此显示。",
  "plan.header": "计划评审",
  "plan.session.default": "当前会话",
  "plan.no-file": "（无文件路径）",
  "plan.annotations": "批注",
  "plan.annotations.count": "条批注",
  "plan.annotations.counts": "条批注",
  "plan.annotations.no-limit": "无时间限制",
  "plan.annotations.empty": "选中计划中的文本来添加批注。",
  "plan.global-note": "全局备注",
  "plan.global-note.hint": "— 请求修改时会附带发送",
  "plan.global-note.placeholder": "对整个计划的宏观意见…",
  "plan.action.deny": "请求修改",
  "plan.action.approve": "批准",
  "plan.action.auto-edit": "批准并自动编辑 →",
  "plan.toolbar.comment": "评论",
  "plan.toolbar.highlight": "高亮",
  "plan.toolbar.delete": "删除",
  "plan.modal.selected": "选中文本",
  "plan.modal.placeholder": "您的评论（Enter = 提交 · Shift+Enter = 换行 · Esc = 取消）…",
  "plan.modal.cancel": "取消",
  "plan.modal.add-comment": "添加评论",
  "plan.modal.just-highlight": "仅高亮",
  "plan.edit.placeholder": "Enter = 保存 · Shift+Enter = 换行 · Esc = 取消",
  "plan.edit.cancel": "取消",
  "plan.edit.save": "保存",

  "toast.approved": "计划已批准 · 已发送给 Claude",
  "toast.approved.auto-edit": "已批准（自动编辑）· 已发送给 Claude",
  "toast.denied": "请求修改",
  "toast.annotations-sent": "条批注已发送给 Claude",
  "toast.disconnected": "与服务器断开连接 — 决定未发送。请重连后重试。",
  "toast.released": "已释放到终端 — 请在终端回答",
};

const messages: Record<Locale, Record<string, string>> = { en, zh };

let currentLocale: Locale = "en";
const listeners = new Set<() => void>();

export function getLocale(): Locale {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "en" || stored === "zh") return stored;
  return navigator.language.startsWith("zh") ? "zh" : "en";
}

export function setLocale(locale: Locale): void {
  currentLocale = locale;
  localStorage.setItem(STORAGE_KEY, locale);
  listeners.forEach((fn) => fn());
}

export function initLocale(): void {
  currentLocale = getLocale();
}

export function t(key: string): string {
  return messages[currentLocale]?.[key] ?? messages.en[key] ?? key;
}

export function onLocaleChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
