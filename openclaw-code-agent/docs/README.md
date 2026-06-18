# OpenClaw Code Agent

Managed background coding sessions for Claude Code and Codex, with plan
approval, session lifecycle, worktree isolation, merge/PR follow-through,
and explicit goal loops.

---

## Table of Contents

- [Installation](#installation)
- [Capabilities](#capabilities)
- [Workflows](#workflows)
  - [Direct Completion](#direct-completion)
  - [Plan Review](#plan-review)
  - [Worktree Decisions](#worktree-decisions)
  - [Delegated Worktrees](#delegated-worktrees)
  - [Worktree Lifecycle](#worktree-lifecycle)
- [Quick Start](#quick-start)
- [First Session Walkthrough](#first-session-walkthrough)
- [Core Workflows](#core-workflows)
- [Tools Reference](#tools-reference)
- [Commands Reference](#commands-reference)

---

## Installation

```bash
# Install via your OpenClaw plugin manager
openclaw plugin install openclaw-code-agent

# Or clone and link manually
git clone https://github.com/your-org/openclaw-code-agent.git ~/.openclaw/plugins/openclaw-code-agent
cd ~/.openclaw/plugins/openclaw-code-agent && pnpm install

# Enable the plugin in ~/.openclaw/openclaw.json
{
  "plugins": {
    "entries": {
      "openclaw-code-agent": { "enabled": true }
    }
  }
}
```

**Requirements:**
- Node.js 20+
- `git` CLI
- `gh` CLI (for PR creation)
- `claude` or `codex` CLI (for harnesses)

---

## Capabilities

| Feature | Description |
|---------|-------------|
| **Multi-Harness** | Launch Claude Code or Codex sessions |
| **Background Sessions** | Sessions run as managed child processes |
| **Output Buffering** | Rolling capture of stdout/stderr per session |
| **Plan Approval** | Delegate, ask, or bypass plan review |
| **Worktree Isolation** | Git worktree per session for safe branching |
| **Merge/PR Follow-Through** | Merge branches or open GitHub PRs |
| **Goal Loops** | Verifier (test-until-pass) and Ralph (signal-hunt) |
| **Health Monitoring** | Auto-timeout, zombie detection, cleanup |
| **Chat Commands** | `/agent`, `/goal`, `/agent_kill`, etc. |
| **Tool API** | 15 tools for agent consumption |

---

## Workflows

### Direct Completion

The simplest path: a session starts, does work, and completes with no plan
review or worktree changes.

```
User: /agent fix-typo Fix the typo in README.md
Plugin: Session launched: fix-typo (abc-123)
...time passes...
Plugin: Session fix-typo completed. No worktree changes.
```

### Plan Review

When `permissionMode` is `"plan"`, the session pauses after emitting a plan
and waits for approval.

```
User: /agent refactor Rename all "foo" to "bar"
Plugin: Session launched: refactor (def-456)
...harness emits plan...
Plugin: Plan review required for refactor:
        [Approve] [Revise] [Reject]
User clicks "Approve"
Plugin: Plan approved. Session continuing...
...work completes...
```

### Worktree Decisions

When a session with worktree isolation completes, the user decides what to
do with the branch.

```
Plugin: Worktree Decision for refactor:
        Branch: oca/refactor-def456
        [Merge] [Open PR] [Later] [Discard]
User clicks "Open PR"
Plugin: PR created: https://github.com/org/repo/pull/42
```

### Delegated Worktrees

With `worktreeStrategy: "delegate"`, the orchestrator makes worktree
decisions on behalf of the user based on configured rules.

```
Plugin: Worktree for session "hotfix" is ready.
        Delegating decision to orchestrator...
        Auto-merge rule matched. Merging...
Plugin: Branch oca/hotfix-ghi789 merged into main.
```

### Worktree Lifecycle

States a worktree moves through during its lifetime:

```
active → pending_decision → merged
                    └─────→ pr_open → merged
                    └─────→ released
                    └─────→ dismissed
active → no_change
active → dismissed
```

---

## Quick Start

```bash
# 1. Launch a simple session
/agent my-first-task Write a hello-world script

# 2. Check on it
/agent_sessions

# 3. Read output
/agent_output my-first-task

# 4. Send a follow-up
/agent_respond my-first-task "Add error handling too"

# 5. Check stats
/agent_stats
```

---

## First Session Walkthrough

**Step 1 — Launch:**
```
/agent docs-update Update the API docs to reflect v2 changes
```
The plugin creates a session record, spawns the Claude Code harness in a
git worktree, and begins capturing output.

**Step 2 — Monitor:**
```
/agent_output docs-update
```
View buffered stdout/stderr from the harness process.

**Step 3 — Plan Review (if enabled):**
If the harness emits a plan, the plugin escalates it. You see:
```
Plan Review Required:
[Approve] [Revise] [Reject]
```

**Step 4 — Completion:**
When the session finishes, the plugin shows:
```
Session docs-update completed.
Worktree Decision:
[Merge] [Open PR] [Later] [Discard]
```

**Step 5 — Follow-Through:**
Click "Open PR" to create a GitHub PR from the worktree branch.

---

## Core Workflows

1. **Launch → Complete (direct):** No plan, no worktree. Fastest path.
2. **Launch → Plan → Approve → Complete:** Plan review with approval.
3. **Launch → Plan → Revise → Approve → Complete:** Iterative plan revision.
4. **Launch → Work → Worktree Decision → Merge:** Full cycle with merge.
5. **Launch → Work → Worktree Decision → PR:** Full cycle with PR.
6. **Goal (verifier):** Launch → Iterate → Test Pass/Fail → Complete/Fail.
7. **Goal (ralph):** Launch → Poll Output → Signal Found → Complete.

---

## Tools Reference

| # | Tool | Description | Required Params |
|---|------|-------------|-----------------|
| 1 | `agent_launch` | Start a background session | `name` |
| 2 | `agent_respond` | Send message to session | `sessionId`, `message` |
| 3 | `agent_request_plan_approval` | Escalate plan to user | `sessionId` |
| 4 | `agent_send_plan_offer` | Send Start Plan / Dismiss | `sessionId` |
| 5 | `agent_output` | Read buffered output | `sessionId` |
| 6 | `agent_sessions` | List sessions | — |
| 7 | `agent_kill` | Kill a session | `sessionId` |
| 8 | `agent_stats` | Aggregate stats | — |
| 9 | `agent_merge` | Merge worktree branch | `sessionId` |
| 10 | `agent_pr` | Create GitHub PR | `sessionId` |
| 11 | `agent_worktree_status` | Worktree lifecycle state | — |
| 12 | `agent_worktree_cleanup` | Clean/preview worktrees | `mode` |
| 13 | `goal_launch` | Start a goal loop | `name`, `type`, `target` |
| 14 | `goal_status` | Goal status | — |
| 15 | `goal_stop` | Stop a goal | `goalId` |

---

## Commands Reference

| Command | Description | Example |
|---------|-------------|---------|
| `/agent <name> <...instructions>` | Launch session | `/agent fix-bug Fix login error` |
| `/agent_sessions` | List all sessions | `/agent_sessions` |
| `/agent_output <name>` | Show output | `/agent_output fix-bug` |
| `/agent_respond <name> <...msg>` | Send message | `/agent_respond fix-bug "Also check edge case"` |
| `/agent_kill <name>` | Kill session | `/agent_kill fix-bug` |
| `/agent_stats` | Show stats | `/agent_stats` |
| `/goal <name> <...instructions>` | Launch goal | `/goal deploy-task Deploy to staging` |
| `/goal_status [name]` | Goal status | `/goal_status deploy-task` |
| `/goal_stop <name>` | Stop goal | `/goal_stop deploy-task` |

---

*OpenClaw Code Agent — built for reliable, observable, background coding.*
