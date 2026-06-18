# ACP Comparison — Boundary Document

This document clarifies how the OpenClaw Code Agent plugin differs from
OpenClaw's bundled runtime plugins and why it exists as a separate package.

---

## Comparison Table

| Dimension | `acpx` (bundled runtime) | Core `codex` plugin | `openclaw-code-agent` (this plugin) |
|-----------|--------------------------|---------------------|-------------------------------------|
| **Purpose** | Generic ACP tool-calling runtime | Codex integration (UI + harness) | Managed background sessions for multiple harnesses |
| **Harnesses** | N/A (runtime layer) | Codex only | Claude Code + Codex |
| **Session Lifecycle** | No session concept | Basic session | Full CRUD: launch, suspend, resume, kill, fork |
| **Worktrees** | No | No | Full isolation, merge, PR follow-through |
| **Plan Approval** | No | Inline in UI | Delegated / ask / off modes with routing |
| **Goal Loops** | No | No | Verifier (test-until-pass) + Ralph (signal-hunt) |
| **Output Buffer** | No | No | Persistent rolling stdout/stderr capture |
| **Health Monitor** | No | No | Timeout, zombie detection, auto-cleanup |
| **Chat Commands** | No | No | `/agent`, `/goal`, `/agent_kill`, etc. |
| **Tool Count** | N/A | Handful | 15 dedicated tools |
| **Surface** | Runtime / execution layer | UI + single harness | Orchestration + multi-harness + lifecycle |

---

## Why a Separate Package?

1. **Independent release cycle** — The bundled plugins ship with OpenClaw
   core and follow its release schedule.  This plugin can iterate faster
   on harness support, goal engines, and workflow features.

2. **Broader harness support** — The core Codex plugin only supports Codex.
   This plugin supports both Claude Code and Codex with a unified session
   lifecycle and can add more harnesses (e.g., Aider, Cursor) without
   modifying OpenClaw core.

3. **Deeper workflow features** — Plan approval, worktree isolation, and
   goal loops are too opinionated for the generic runtime.  They belong in
   a dedicated plugin that users can opt into.

4. **Explicit session management** — Background sessions with health
   monitoring, output buffering, and worktree lifecycle are a distinct
   concern from interactive UI-driven coding.

---

## Ownership Boundaries

| Surface | Owner |
|---------|-------|
| ACP protocol runtime | `acpx` (bundled) |
| Codex UI panel | Core `codex` plugin (bundled) |
| Session lifecycle, worktrees, goals | `openclaw-code-agent` (this plugin) |
| Chat routing, wake notifications | `openclaw-code-agent` (this plugin) |
| Tool registry aggregation | OpenClaw core |

---

## Interaction Model

```
User Chat
    │
    ▼
OpenClaw Core  ──routes──▶  openclaw-code-agent (this plugin)
    │                           │
    │    ┌──────────────────────┘
    │    │
    │    ▼
    │  SessionLifecycle
    │    │
    │    ├──▶  claude  CLI  (harness)
    │    └──▶  codex   CLI  (harness)
    │
    └──▶  acpx  (bundled runtime — for non-code-agent tools)
```

The `openclaw-code-agent` plugin registers its 15 tools with OpenClaw's
contract system.  Those tools are available to the orchestrator alongside
tools from other plugins.  The plugin does not replace or conflict with
`acpx` or the core Codex plugin — it complements them by adding
orchestration capabilities they do not provide.
