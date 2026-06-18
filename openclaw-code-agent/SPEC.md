# OpenClaw Code Agent — SPEC.md

## 1. Overview

An OpenClaw plugin that orchestrates coding agent sessions as managed background processes.
Launches, monitors, and controls Claude Code and Codex from OpenClaw chat with plan approval,
session lifecycle, worktree isolation, merge/PR follow-through, and explicit goal loops.

## 2. Module Architecture

```
src/
├── plugin.ts              # Entrypoint, manifest registration, config binding
├── types.ts               # All shared interfaces and type definitions
├── config.ts              # Default config, validation, user override merging
├── sessions/
│   ├── lifecycle.ts       # Session CRUD: launch, suspend, resume, kill, fork
│   ├── store.ts           # Persistent JSON store for session metadata + output buffer
│   ├── monitor.ts         # Health checks, timeouts, auto-cleanup triggers
│   └── output-buffer.ts   # Capture stdout/stderr from harness processes
├── harness/
│   ├── base.ts            # Abstract base: start(), stop(), resume(), send(), status()
│   ├── claude-code.ts     # Claude Code CLI harness (child_process spawn)
│   └── codex.ts           # Codex App Server harness (HTTP API + optional CLI)
├── worktree/
│   ├── isolation.ts       # Git worktree create/remove/detect, branch management
│   ├── followthrough.ts   # Merge, PR (gh CLI), decision routing logic
│   └── lifecycle.ts       # State machine: active → pending → merged/released/dismissed
├── plan/
│   ├── approval.ts        # Plan review UX: approve, revise, reject, delegate
│   └── parser.ts          # Extract structured plan artifacts from harness output
├── goals/
│   ├── base.ts            # Shared goal infrastructure
│   ├── verifier.ts        # Verifier-driven repair loop (test until pass)
│   └── ralph.ts           # Ralph-style completion loop (output match until DONE)
├── tools/
│   └── index.ts           # All 16 tool definitions for agent consumption
├── routing/
│   ├── wake.ts            # Orchestrator wake with route/thread metadata
│   └── notifications.ts   # Channel notification formatting
└── commands/
    └── index.ts           # Chat command handlers (/agent, /goal, etc.)
```

## 3. Types (types.ts)

### 3.1 Core Types

```typescript
export type HarnessType = "claude-code" | "codex";

export type PermissionMode = "plan" | "direct";

export type PlanApproval = "delegate" | "ask" | "off";

export type WorktreeStrategy = "delegate" | "ask" | "off" | "manual" | "auto-merge" | "auto-pr";

export type SessionState =
  | "pending"
  | "active"
  | "awaiting_plan_approval"
  | "completing"
  | "completed"
  | "failed"
  | "killed"
  | "suspended";

export type WorktreeLifecycleState =
  | "active"
  | "pending_decision"
  | "pr_open"
  | "merged"
  | "released"
  | "dismissed"
  | "no_change";

export type GoalType = "verifier" | "ralph";

export type GoalState = "running" | "paused" | "completed" | "failed" | "stopped";
```

### 3.2 Session

```typescript
export interface Session {
  id: string;                    // UUID
  name: string;                  // Human-readable name
  harness: HarnessType;
  state: SessionState;
  workdir: string;
  worktreeBranch?: string;       // Isolated branch name (if worktree enabled)
  baseBranch?: string;           // Original branch before worktree
  worktreePath?: string;         // Filesystem path to worktree
  worktreeState?: WorktreeLifecycleState;
  prUrl?: string;                // GitHub PR URL if created
  goalTaskId?: string;           // Associated goal task (if any)
  originRoute?: string;          // Chat route that launched session
  originThreadId?: string;       // Thread ID for routing back
  createdAt: string;             // ISO 8601
  updatedAt: string;
  completedAt?: string;
  costUsd?: number;              // Accumulated cost estimate
  durationMs?: number;
  planApprovalState?: "pending" | "approved" | "rejected" | "revising";
  pendingPlan?: PlanArtifact;
  metadata: Record<string, any>;
}
```

### 3.3 Plan Artifact

```typescript
export interface PlanArtifact {
  id: string;
  sessionId: string;
  content: string;               // The plan text
  createdAt: string;
  approvedAt?: string;
  revisedAt?: string;
  status: "pending" | "approved" | "rejected" | "revising";
}
```

### 3.4 Goal Task

```typescript
export interface GoalTask {
  id: string;
  sessionId: string;
  name: string;
  type: GoalType;
  state: GoalState;
  workdir: string;
  target: string;                // Description of what to achieve
  verifierCommand?: string;      // For verifier type: command to validate
  completionSignal?: string;     // For ralph type: string to match in output
  maxIterations: number;
  currentIteration: number;
  lastOutput?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}
```

### 3.5 Config

```typescript
export interface PluginConfig {
  defaultWorkdir: string;
  defaultHarness: HarnessType;
  permissionMode: PermissionMode;
  planApproval: PlanApproval;
  defaultWorktreeStrategy: WorktreeStrategy;
  harnesses: {
    claudeCode: {
      executablePath?: string;
      allowedTools?: string[];
      execPolicy?: "sandbox" | "allow";
    };
    codex: {
      executablePath?: string;
      appServerUrl?: string;
      reasoningEffort?: "low" | "medium" | "high";
      fastMode?: boolean;         // Sends service_tier: "fast"
    };
  };
  fallbackChannel?: string;
  agentChannels?: Record<string, string>;
  maxSessionDurationMs: number;
  sessionOutputBufferSize: number;
  autoCleanupCompletedAfterMs: number;
}
```

## 4. Config (config.ts)

Defaults:
- `permissionMode`: "plan"
- `planApproval`: "delegate"
- `defaultWorktreeStrategy`: "delegate"
- `defaultHarness`: "claude-code"
- `maxSessionDurationMs`: 3600000 (1 hour)
- `sessionOutputBufferSize`: 50000 (lines)
- `autoCleanupCompletedAfterMs`: 86400000 (24 hours)

Merge user config from `~/.openclaw/openclaw.json` at `plugins.entries["openclaw-code-agent"].config`.
Validate with zod-like checks (presence check for now, not full zod).

## 5. Sessions Module

### 5.1 Store (store.ts)

Interface:
```typescript
class SessionStore {
  constructor(dataDir: string);
  create(session: Omit<Session, "id" | "createdAt" | "updatedAt">): Session;
  get(id: string): Session | undefined;
  update(id: string, patch: Partial<Session>): Session;
  list(filter?: { state?: SessionState; harness?: HarnessType }): Session[];
  delete(id: string): void;
  appendOutput(sessionId: string, chunk: string): void;
  getOutput(sessionId: string, since?: number): string;
  getOutputLength(sessionId: string): number;
  clearOutput(sessionId: string): void;
}
```

Storage:
- `sessions.json`: Map<string, Session> — persisted on every write
- `output/<sessionId>.log`: Rotating line-buffered output files
- All I/O is synchronous for simplicity (this is a local plugin)

### 5.2 Lifecycle (lifecycle.ts)

Interface:
```typescript
class SessionLifecycle {
  launch(params: LaunchParams): Promise<Session>;
  suspend(sessionId: string): Promise<void>;
  resume(sessionId: string): Promise<void>;
  kill(sessionId: string, reason?: string): Promise<void>;
  fork(fromSessionId: string, newName: string): Promise<Session>;
  respond(sessionId: string, message: string): Promise<void>;
}

type LaunchParams = {
  name: string;
  harness?: HarnessType;
  workdir?: string;
  instructions?: string;
  worktreeStrategy?: WorktreeStrategy;
  planApproval?: PlanApproval;
  originRoute?: string;
  originThreadId?: string;
};
```

Launch flow:
1. Validate workdir exists
2. If worktreeStrategy !== "off" and workdir is git repo → create worktree + branch
3. Create session record in store
4. Spawn harness process with adapter
5. If permissionMode === "plan" → set state to "awaiting_plan_approval"
6. Otherwise → set state to "active"
7. Begin output buffering
8. Return session

### 5.3 Output Buffer (output-buffer.ts)

Captures stdout/stderr from child processes. Maintains rolling buffer of last N lines.
Line-oriented, with timestamp prefix `[YYYY-MM-DD HH:mm:ss] `.

### 5.4 Monitor (monitor.ts)

Runs periodic checks (every 30s):
- Session timeout (exceeds maxSessionDurationMs → kill)
- Zombie detection (process exited but state still active → mark failed/completed)
- Auto-cleanup (completed sessions older than autoCleanupCompletedAfterMs → clear output)

## 6. Harness Module

### 6.1 Base (base.ts)

```typescript
abstract class HarnessAdapter {
  abstract readonly type: HarnessType;
  protected session: Session;
  protected process?: ChildProcess;
  
  constructor(session: Session, config: PluginConfig);
  
  abstract start(instructions?: string): Promise<void>;
  abstract send(message: string): Promise<void>;
  abstract stop(signal?: NodeJS.Signals): Promise<void>;
  abstract resume(): Promise<void>;
  abstract getStatus(): Promise<{ running: boolean; pid?: number }>;
  
  onOutput(handler: (chunk: string) => void): void;
  onExit(handler: (code: number | null, signal: string | null) => void): void;
}
```

### 6.2 Claude Code Harness (claude-code.ts)

Spawns `claude` CLI process:
- Executable: `claude` or config.harnesses.claudeCode.executablePath
- Args: `claude -p "<instructions>" --allowedTools <tools> --cwd <workdir>`
- For interactive: `claude` in cwd with stdin/stdout pipes
- Environment: inherits plus CLAUDE_CODE_DEBUG=1 if needed
- Resume: re-attach via `claude --resume <sessionId>` if supported, else spawn new
- Plan mode: watches for plan markers in output (--- PLAN BEGIN --- ... --- PLAN END ---)

### 6.3 Codex Harness (codex.ts)

Two modes:
1. **CLI mode**: Spawns `codex` process similar to Claude Code
2. **App Server mode**: HTTP API to local Codex App Server
   - Base URL: config.harnesses.codex.appServerUrl || "http://localhost:8080"
   - Thread creation, message sending, status polling
   - Sends `reasoningEffort` and `service_tier: "fast"` when fastMode enabled
   - Resume: POST /threads/{id}/resume

Both adapters capture output and feed into the output buffer.

## 7. Worktree Module

### 7.1 Isolation (isolation.ts)

```typescript
class WorktreeIsolation {
  create(workdir: string, sessionName: string): Promise<{
    branch: string;
    worktreePath: string;
    baseBranch: string;
  }>;
  remove(worktreePath: string): Promise<void>;
  isGitRepo(workdir: string): boolean;
  hasGhCli(): boolean;
  getCurrentBranch(workdir: string): string;
}
```

Worktree naming: `oca/<session-name>-<short-id>`
Branch naming: `oca/<session-name>-<short-id>`

### 7.2 Follow-Through (followthrough.ts)

```typescript
class WorktreeFollowThrough {
  merge(session: Session, strategy: WorktreeStrategy): Promise<{
    success: boolean;
    message: string;
    sha?: string;
  }>;
  openPr(session: Session, title?: string, body?: string): Promise<{
    success: boolean;
    prUrl?: string;
    message: string;
  }>;
  discard(session: Session): Promise<{ success: boolean; message: string }>;
}
```

### 7.3 Lifecycle State Machine (lifecycle.ts)

Transitions:
```
active → pending_decision  (agent finishes, worktree has changes)
active → no_change         (agent finishes, no committed changes)
active → dismissed         (user discards while active)
pending_decision → merged  (user/orchestrator merges)
pending_decision → pr_open (user opens PR)
pending_decision → released (content already on base via rebase/squash)
pending_decision → dismissed (user discards)
pr_open → merged           (PR merged)
pr_open → released         (PR squashed/rebased)
```

## 8. Plan Module

### 8.1 Parser (parser.ts)

Extracts plan artifacts from harness output. Supports markers:
- Claude Code: `--- PLAN BEGIN ---` / `--- PLAN END ---`
- Codex: `## Plan` / `## Implementation`
- Fallback: numbered list pattern detection

### 8.2 Approval (approval.ts)

```typescript
class PlanApprovalFlow {
  handlePlanDetected(sessionId: string, plan: PlanArtifact): Promise<void>;
  approve(sessionId: string): Promise<void>;
  reject(sessionId: string): Promise<void>;
  requestRevision(sessionId: string, feedback: string): Promise<void>;
}
```

Delegate flow:
1. Plan detected → set state "awaiting_plan_approval"
2. Orchestrator reviews via agent_request_plan_approval or chat
3. User/orchestrator: Approve → harness continues, Revise → harness replans, Reject → session killed
4. All actions stay on same session

## 9. Goals Module

### 9.1 Verifier Goal (goals/verifier.ts)

```typescript
class VerifierGoal {
  start(task: GoalTask): Promise<void>;
  iterate(): Promise<{ passed: boolean; output: string }>;
  stop(): void;
}
```

Loop:
1. Launch coding session with instructions
2. Wait for completion
3. Run verifierCommand (e.g., `pnpm test`)
4. If passes → mark completed
5. If fails → send output back to session as follow-up, increment iteration
6. If maxIterations reached → mark failed

### 9.2 Ralph Goal (goals/ralph.ts)

```typescript
class RalphGoal {
  start(task: GoalTask): Promise<void>;
  iterate(): Promise<{ completed: boolean; output: string }>;
  stop(): void;
}
```

Loop:
1. Launch coding session with instructions
2. Wait for completion
3. Check if output contains completionSignal (e.g., "DONE")
4. If yes → mark completed
5. If no → continue session, increment iteration
6. If maxIterations reached → mark failed

## 10. Tools (tools/index.ts)

All 16 tools register with OpenClaw contracts.tools:

1. **agent_launch** — Start a background coding session
2. **agent_respond** — Reply to an active session
3. **agent_request_plan_approval** — Escalate plan to user
4. **agent_send_plan_offer** — Send Start Plan / Dismiss buttons
5. **agent_output** — Read buffered session output
6. **agent_sessions** — List active and recent sessions
7. **agent_kill** — Stop or mark a session completed
8. **agent_stats** — Show aggregate usage and cost
9. **agent_merge** — Merge a worktree branch back to base
10. **agent_pr** — Create or update a GitHub PR
11. **agent_worktree_status** — Show worktree lifecycle state
12. **agent_worktree_cleanup** — Clean safe worktrees or dismiss
13. **goal_launch** — Start an explicit goal loop
14. **goal_status** — Show goal task(s) status
15. **goal_stop** — Stop a running goal task

## 11. Routing (routing/)

### 11.1 Wake (wake.ts)

```typescript
class WakeRouter {
  wakeOrchestrator(session: Session, reason: "plan_approval" | "completed" | "error" | "worktree_decision", context: any): Promise<void>;
  sendCompletionSummary(session: Session, summary: string): Promise<void>;
}
```

Two-step completion contract:
1. Plugin delivers canonical outcome status
2. Orchestrator reads full output, sends concise factual summary to origin

### 11.2 Notifications (notifications.ts)

Format status lines, decision buttons, plan review UI for different channels (Telegram, Discord, generic).

## 12. Commands (commands/index.ts)

Chat commands:
- `/agent <name> <instructions>` — Launch session
- `/agent_sessions` — List sessions
- `/agent_output <name>` — Show output
- `/agent_respond <name> <message>` — Send message
- `/agent_kill <name>` — Kill session
- `/agent_stats` — Show stats
- `/goal <name> <instructions>` — Launch goal
- `/goal_status [name]` — Show goal status
- `/goal_stop <name>` — Stop goal

## 13. Plugin Entrypoint (plugin.ts)

```typescript
import { definePlugin } from "openclaw/plugin-sdk/plugin-entry";

export default definePlugin({
  name: "openclaw-code-agent",
  version: "1.0.0",
  description: "Managed background coding sessions for Claude Code and Codex",
  contracts: {
    tools: [/* all 16 tools */]
  },
  async onLoad(ctx) {
    // Initialize store, monitor, commands
    // Register tool handlers
    // Start monitor loop
  },
  async onUnload() {
    // Cleanup monitor, close stores
  }
});
```

## 14. File Generation Summary

| File | Lines | Purpose |
|------|-------|---------|
| src/types.ts | ~150 | All type definitions |
| src/config.ts | ~80 | Config defaults + merge |
| src/sessions/store.ts | ~120 | Session persistence |
| src/sessions/lifecycle.ts | ~150 | Launch/suspend/resume/kill/fork |
| src/sessions/output-buffer.ts | ~60 | Output capture |
| src/sessions/monitor.ts | ~80 | Health checks |
| src/harness/base.ts | ~50 | Abstract adapter |
| src/harness/claude-code.ts | ~120 | Claude Code spawn |
| src/harness/codex.ts | ~140 | Codex CLI + App Server |
| src/worktree/isolation.ts | ~100 | Worktree create/remove |
| src/worktree/followthrough.ts | ~120 | Merge/PR/discard |
| src/worktree/lifecycle.ts | ~80 | State machine |
| src/plan/parser.ts | ~60 | Plan extraction |
| src/plan/approval.ts | ~100 | Approval flow |
| src/goals/base.ts | ~30 | Shared goal types |
| src/goals/verifier.ts | ~80 | Verifier loop |
| src/goals/ralph.ts | ~70 | Ralph loop |
| src/tools/index.ts | ~300 | Tool definitions |
| src/routing/wake.ts | ~60 | Wake routing |
| src/routing/notifications.ts | ~80 | Notification formatting |
| src/commands/index.ts | ~150 | Chat command handlers |
| src/plugin.ts | ~80 | Entrypoint |
| package.json | ~40 | Package manifest |
| tsconfig.json | ~25 | TS config |
| manifest.json | ~30 | Plugin manifest |
| docs/README.md | ~200 | User documentation |
| docs/SECURITY.md | ~60 | Security rationale |
| docs/ACP-COMPARISON.md | ~80 | Boundary document |

**Total: ~2,765 lines across 27 files**
