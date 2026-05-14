# InkBoard Development Log

## 2026-05-14 — v0.1.0 MVP

### Session Overview

**Duration:** ~1.5 hours
**Goal:** Build a canvas-based Markdown review, brainstorming interview, and per-hunk diff approval tool for Claude Code ecosystem.

### Background & Motivation

Claude Code 生态已具备成熟扩展性（hooks + skills + plugins + MCP + AskUserQuestion），但存在三个明显产品空白：

1. **无画布式 Markdown 评审 UI** — AI 生成 plan/spec 后，用户只能在编辑器里普通查看，无法内联批注再回灌给 AI
2. **无逐 hunk 接受/拒绝** — 终端 diff 只有 y/n 全量二选一（GitHub Issues #31395, #33932 用户呼声最高）
3. **无结构化访谈流程** — Plan Mode 不强制 AI 主动问 10-20 个问题再动手

InkBoard 定位：**SKILL.md（纯终端可用）+ Plugin + 本地 Web 服务（画布 UI）**，两层解耦。

### Architecture

```
Claude Code ──HTTP Hook──> InkBoard Server (:7777) ──WebSocket──> Browser UI
                                 │
                           In-memory State
                        (questions, diffs, plan)
```

- **Layer 1**: `SKILL.md` — 驱动 AskUserQuestion 循环（3-5 轮 × 4 题 = 12-20 题），0 依赖独立工作
- **Layer 2**: HTTP hooks 拦截 `AskUserQuestion` / `Edit|Write`，推送到浏览器画布
- **降级策略**: 服务未运行时 hook 桥接脚本静默退出，Claude Code 回退终端默认行为

### Implementation Phases

#### Phase 1: SKILL.md + Plugin Manifest (Day 1)

- 编写 `skills/inkboard-interview/SKILL.md` — 5 阶段访谈 skill
  - Phase 1 Scope Discovery / Phase 2 Requirements / Phase 3 Architecture / Phase 4 Plan Draft / Phase 5 Review
  - 每阶段 3-5 题 via AskUserQuestion
  - 输出 `docs/plans/<feature>.md` with `<!-- DECISION:key=value -->` 锚点
- 编写 `.claude-plugin/plugin.json`
- 编写 `commands/inkboard.md` — `/inkboard` 启动命令

#### Phase 2: Server 骨架 (Day 1)

技术选型：
- **Node.js 18** (系统已有，Bun 未装)
- **Express 4.x** — HTTP 服务
- **ws 8.x** — WebSocket
- **diff 7.x** — unified diff 计算

核心模块：
- `src/index.ts` — Express + WS on :7777-7787，端口自动探测
- `src/state.ts` — 内存状态管理，Promise-based 长轮询
- `src/diff-parser.ts` — Edit tool_input → visual hunks
- `src/ws.ts` — WebSocket handler + 重连重播
- `src/routes/hook-question.ts` — AskUserQuestion hook endpoint
- `src/routes/hook-diff.ts` — Edit/Write hook endpoint
- `src/routes/hook-prompt.ts` — UserPromptSubmit hook endpoint

Hook 桥接方案：
- `src/hooks/hook-bridge.ts` — 通用 CLI 桥接，stdin→HTTP POST→stdout
- 三个薄 CLI 入口：`question-hook.ts`, `diff-hook.ts`, `prompt-hook.ts`
- 通过 `/tmp/inkboard.port` 发现实际端口

#### Phase 3: Web UI (Day 1)

技术选型：
- **React 18 + Vite 5** — 前端框架
- **Tailwind 3** — CSS
- **Zustand 4** — 状态管理

组件：
- `QuestionCanvas.tsx` — 问题渲染 + 多选/自定义输入 + 55s 倒计时
- `DiffReview.tsx` — 分栏 diff + 逐 hunk accept/reject + 内联批注 + 部分拒绝警告
- `MarkdownReview.tsx` — plan 文件展示 + DECISION 锚点渲染
- `InterviewProgress.tsx` — 5 阶段进度条
- `Layout.tsx` — 导航 + 连接状态指示

Build 产物：CSS 3.47KB + JS 51.87KB (gzipped) — 远低于 150KB JS budget。

#### Phase 4: Scripts (Day 1)

- `scripts/start.sh` — 构建 + 启动 + health check 轮询 + 自动开浏览器
- `scripts/stop.sh` — PID 文件管理 + graceful shutdown
- `scripts/install.sh` — 一键安装所有依赖并构建

### Testing (TDD)

使用 vitest 2.x (Node 18 兼容，vitest 4.x 需 Node 20+)。

| 测试文件 | 测试数 | 覆盖 |
|---------|--------|------|
| `diff-parser.test.ts` | 8 | 简单替换、未找到、相同内容、新文件、多行替换 |
| `state.test.ts` | 10 | 唯一 ID、问题生命周期、diff 生命周期、超时、reset |
| **Total** | **18** | **全绿** |

### Code Review Findings & Fixes

Review 由 `code-reviewer` agent 执行，发现 15 个问题：

| 严重度 | 数量 | 修复状态 |
|--------|------|---------|
| CRITICAL | 2 | 全部修复 |
| HIGH | 4 | 全部修复 |
| MEDIUM | 5 | 4 修复 + 1 已知限制 |
| LOW | 4 | 2 修复 + 2 接受 |

关键修复：

1. **[CRITICAL] Hook 脚本不存在** — 新增 `hook-bridge.ts` CLI 桥接层，通过 `/tmp/inkboard.port` 发现服务端口，stdin JSON → HTTP POST → stdout 响应
2. **[CRITICAL] WS 硬编码端口** — 改用 `window.location.host`（包含实际端口）
3. **[HIGH] WS 重连不重播 pending** — 新增 `replayPendingItems()` 函数，连接时重发所有未决问题/diff
4. **[HIGH] 部分 reject = 全部 block 未提示** — 添加 amber 警告框说明 Claude Code hooks 的全量限制
5. **[HIGH] State test 不隔离** — 添加 `reset()` 方法 + `beforeEach` 调用
6. **[MEDIUM] hook-prompt cwd 错误** — 从 HookInput 或 `INKBOARD_PROJECT_DIR` 环境变量读取项目目录

### Known Limitations

1. **逐 hunk 接受/拒绝是 UI 层面的** — Claude Code PreToolUse hook 只能 allow/block 整个工具调用，无法选择性应用部分 hunks。UI 明确提示此限制。
2. **InterviewProgress phase 硬编码为 1** — 需要后续实现 phase 状态追踪（skill 层面的 phase 信息不直接可见于 hook）
3. **MultiEdit 未支持** — 已从 hook matcher 移除，后续版本可解析 `edits[]` 数组
4. **hooks.json 路径依赖环境变量** — `$INKBOARD_HOOKS_DIR` 需在 shell 中 export，start.sh 提示用户添加

### File Inventory

```
inkboard/                           # 项目根目录
├── .claude-plugin/plugin.json      # Plugin manifest
├── hooks/hooks.json                # Hook registrations
├── skills/inkboard-interview/
│   └── SKILL.md                    # 5 阶段访谈 skill (203 行)
├── commands/inkboard.md            # /inkboard 启动命令
├── server/
│   ├── package.json                # Node deps
│   ├── tsconfig.json
│   ├── src/
│   │   ├── types.ts                # 共享类型定义
│   │   ├── index.ts                # 服务入口 (Express + WS)
│   │   ├── state.ts                # 内存状态 + Promise 长轮询
│   │   ├── diff-parser.ts          # Edit → hunks 转换
│   │   ├── ws.ts                   # WebSocket + 重连重播
│   │   ├── routes/
│   │   │   ├── hook-question.ts    # AskUserQuestion endpoint
│   │   │   ├── hook-diff.ts        # Edit/Write endpoint
│   │   │   └── hook-prompt.ts      # UserPromptSubmit endpoint
│   │   ├── hooks/
│   │   │   ├── hook-bridge.ts      # CLI 桥接通用逻辑
│   │   │   ├── question-hook.ts    # CLI 入口
│   │   │   ├── diff-hook.ts        # CLI 入口
│   │   │   └── prompt-hook.ts      # CLI 入口
│   │   └── __tests__/
│   │       ├── diff-parser.test.ts # 8 tests
│   │       └── state.test.ts       # 10 tests
│   └── dist/                       # 编译输出
├── web/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── index.html
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx                 # 主路由
│   │   ├── store.ts                # Zustand 状态
│   │   ├── ws-client.ts            # WS 客户端
│   │   ├── types.ts                # 前端类型
│   │   └── components/
│   │       ├── QuestionCanvas.tsx
│   │       ├── DiffReview.tsx
│   │       ├── MarkdownReview.tsx
│   │       ├── InterviewProgress.tsx
│   │       └── Layout.tsx
│   └── dist/                       # Vite build 输出
├── scripts/
│   ├── start.sh
│   ├── stop.sh
│   └── install.sh
└── DEVLOG.md                       # 本文件
```

### Next Steps (v0.2.0)

- [ ] TipTap 批注回灌 — 用户在画布上批注 plan 文件，注释回流到 Claude Code 对话
- [ ] 持久化存储 — SQLite 或 JSON 文件保存历史 review 记录
- [ ] Phase 状态追踪 — 从 AskUserQuestion 内容推断当前访谈阶段
- [ ] MultiEdit 支持 — 解析 `edits[]` 数组生成多 hunk
- [ ] 协作模式 — 多个浏览器客户端同时 review
- [ ] Marketplace 发布 — 打包为可安装 plugin
