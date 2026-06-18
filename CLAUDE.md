# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This repo has two unrelated parts:

1. **Root `README.md`** — a companion setup guide for the NetworkChuck "OpenClaw" video. Pure documentation, no code to build or test.
2. **`openclaw-code-agent/`** — the actual codebase: an OpenClaw plugin (TypeScript/ESM) that orchestrates Claude Code and Codex as managed background coding sessions. All development happens here.

## Commands

All commands run from `openclaw-code-agent/`:

```bash
npm install --ignore-scripts   # install devDependencies (typescript, @types/node)
npm run build                  # tsc — compiles src/ + vendor/ to dist/
npm run watch                  # tsc --watch
npx tsc --noEmit                # type-check only, no output (fastest correctness check)
```

There is no test suite or lint config yet — `tsc --noEmit` is the verification gate for changes.

`dist/` is **committed to git** (it's the runtime artifact OpenClaw loads via `manifest.json`'s `entry: dist/src/plugin.js`). After editing `src/`, run `npm run build` and commit the updated `dist/` output alongside the source change.

## Architecture

The plugin entrypoint is `src/plugin.ts`, which wires every subsystem together in `onLoad(ctx)` and tears them down in `onUnload(ctx)`. `SPEC.md` is the authoritative design doc — read it for full type definitions and module-by-module behavior before making structural changes.

Module layout (`src/`):

- **`types.ts`** — all shared interfaces (`Session`, `PlanArtifact`, `GoalTask`, `PluginConfig`, etc.)
- **`config.ts`** — default config + merges user overrides from `~/.openclaw/openclaw.json` (`plugins.entries["openclaw-code-agent"].config`)
- **`sessions/`** — `store.ts` (synchronous JSON persistence + per-session output log files), `lifecycle.ts` (launch/suspend/resume/kill/fork/respond), `monitor.ts` (30s health-check loop: timeouts, zombie detection, auto-cleanup), `output-buffer.ts` (rolling timestamped stdout/stderr capture)
- **`harness/`** — `base.ts` defines the abstract `HarnessAdapter` (start/send/stop/resume/getStatus + onOutput/onExit hooks). `claude-code.ts` and `codex.ts` are concrete adapters spawned via `child_process`.
- **`worktree/`** — `isolation.ts` (creates `oca/<session-name>-<short-id>` git worktrees/branches), `followthrough.ts` (merge/PR via `gh` CLI/discard), `lifecycle.ts` (state machine: `active → pending_decision → merged/pr_open/released/dismissed`)
- **`plan/`** — `parser.ts` extracts plan artifacts from harness output (multiple marker styles); `approval.ts` drives the approve/revise/reject/delegate flow
- **`goals/`** — `base.ts` shared `GoalEngine`; `verifier.ts` (test-until-pass loop) and `ralph.ts` (output-signal-match loop)
- **`tools/index.ts`** — all tool definitions registered with `ctx.tools.register`
- **`routing/`** — `wake.ts` (notifies orchestrator on plan-approval/completion/error/worktree-decision events), `notifications.ts` (per-channel message formatting; imported as a namespace, not a class)
- **`commands/index.ts`** — chat command handlers (`/agent`, `/goal`, etc.), built from the same `ToolContext` as the tools

### Key implementation details

- **ESM + bundler resolution**: `package.json` has `"type": "module"`; `tsconfig.json` uses `module: "ES2022"` and `moduleResolution: "bundler"` — required because the real `openclaw` package uses `exports`-map-only ESM.
- **`vendor/openclaw/plugin-sdk/plugin-entry.ts`**: a local shim providing `definePlugin()`. The real `openclaw` package only exports `definePluginEntry` with a different signature; the shim is mapped via `tsconfig.json`'s `paths` and requires `rootDir: "."` since it lives outside `src/`.
- **Claude Code session continuity** (`harness/claude-code.ts`): the Claude session UUID is scraped from stderr via `SESSION_ID_RE`. Follow-up turns spawn a fresh one-shot `claude --resume <uuid> -p "<message>"` process rather than writing to stdin. The captured UUID is persisted to `session.metadata.claudeSessionId` in `sessions/lifecycle.ts`.
- **Codex harness** supports both a CLI subprocess mode and an HTTP App Server mode (`config.harnesses.codex.appServerUrl`).
