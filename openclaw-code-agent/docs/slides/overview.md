---
marp: true
theme: default
paginate: true
size: 16:9
---

<!-- _class: lead -->

# OpenClaw Code Agent

Managed background coding sessions for Claude Code & Codex

---

## What It Is

An OpenClaw plugin that turns Claude Code / Codex into **managed background agents**:

- Launch coding sessions from chat, run them as supervised child processes
- Track full lifecycle: pending → active → completed / failed / killed
- Isolate work in git worktrees, with merge / PR follow-through
- Plan-approval gate before agents make changes
- Goal loops that iterate until tests pass or a completion signal appears

---

## Module Architecture

```
src/
├── plugin.ts        entrypoint — wires everything in onLoad/onUnload
├── types.ts         shared interfaces (Session, PlanArtifact, GoalTask, Config)
├── config.ts        defaults + ~/.openclaw/openclaw.json overrides
├── sessions/        store · lifecycle · monitor · output-buffer
├── harness/         base · claude-code · codex
├── worktree/        isolation · followthrough · lifecycle
├── plan/            parser · approval
├── goals/           base · verifier · ralph
├── tools/           15 tool definitions
├── routing/         wake · notifications
└── commands/        /agent, /goal chat commands
```

---

## Session Lifecycle

`SessionLifecycle` (sessions/lifecycle.ts) drives everything:

1. **launch** — validate workdir → optional worktree → create session record → spawn harness
2. **suspend / resume** — SIGSTOP / re-attach via harness adapter
3. **respond** — send a follow-up message to an active session
4. **fork** — clone a session's config into a new one
5. **kill** — SIGTERM + mark `killed`

`Monitor` runs every 30s: session timeouts, zombie detection, auto-cleanup of old completed sessions.

---

## Harness Adapters

Abstract `HarnessAdapter` (harness/base.ts):
`start · send · stop · resume · getStatus` + `onOutput` / `onExit` hooks

**Claude Code** (`claude-code.ts`)
- One-shot: `claude -p "<instructions>" --cwd <dir>`
- Session UUID scraped from stderr via regex
- Follow-ups: fresh `claude --resume <uuid> -p "<message>"` process — true session continuity

**Codex** (`codex.ts`)
- CLI subprocess mode **or** HTTP App Server mode
- Supports `reasoningEffort` and fast-mode `service_tier`

---

## Worktree Isolation

`WorktreeIsolation` creates per-session git worktrees so agents never touch your working directory directly:

- Branch / worktree naming: `oca/<session-name>-<short-id>`
- Detects whether `workdir` is a git repo before creating a worktree

**Follow-through** (`followthrough.ts`) — once the agent finishes:
- `merge` → fast-forward / merge branch back to base
- `openPr` → create a PR via `gh` CLI
- `discard` → drop the worktree and branch

State machine: `active → pending_decision → merged / pr_open / released / dismissed`

---

## Plan Approval Flow

`PlanParser` extracts plan artifacts from harness output:
- Claude Code: `--- PLAN BEGIN --- ... --- PLAN END ---`
- Codex: `## Plan` / `## Implementation` sections
- Fallback: numbered-list detection

`PlanApprovalFlow` then drives the decision:

```
plan detected → state = "awaiting_plan_approval"
        ↓
  approve → harness continues
  revise  → feedback sent back, harness replans
  reject  → session killed
```

---

## Goal Loops

Two long-running patterns built on `GoalEngine` (goals/base.ts):

**VerifierGoal** — test-until-pass
1. Launch session with instructions
2. Run `verifierCommand` (e.g. `npm test`)
3. Pass → done. Fail → feed output back, iterate (up to `maxIterations`)

**RalphGoal** — completion-signal hunting
1. Launch session, wait for output
2. If output contains `completionSignal` (e.g. "DONE") → done
3. Otherwise continue, iterate

---

## Tools & Chat Commands

**15 tools** registered via `ctx.tools.register` (tools/index.ts):
`agent_launch`, `agent_respond`, `agent_request_plan_approval`, `agent_send_plan_offer`,
`agent_output`, `agent_sessions`, `agent_kill`, `agent_stats`, `agent_merge`, `agent_pr`,
`agent_worktree_status`, `agent_worktree_cleanup`, `goal_launch`, `goal_status`, `goal_stop`

**Chat commands** (commands/index.ts):
`/agent`, `/agent_sessions`, `/agent_output`, `/agent_respond`, `/agent_kill`,
`/agent_stats`, `/goal`, `/goal_status`, `/goal_stop`

`WakeRouter` notifies the orchestrator on plan-approval / completion / error / worktree-decision events.

---

## Security Model

- All subprocesses (`claude`, `codex`, `git`, `gh`) run with the **user's own permissions** — no privilege escalation
- Session instructions are treated as **untrusted input**
- Agent output is **untrusted** until reviewed via plan approval
- No remote/untrusted code execution — only locally-installed, user-controlled binaries

See `docs/SECURITY.md` for the full trust-boundary breakdown.

---

<!-- _class: lead -->

## Status

✅ 22 modules implemented per `SPEC.md`
✅ `tsc --noEmit` — 0 errors
✅ Compiled `dist/` committed as the runtime artifact

PR #1 — `claude/youthful-mayer-kFzRb` → `main`
