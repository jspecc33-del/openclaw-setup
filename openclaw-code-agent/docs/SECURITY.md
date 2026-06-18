# Security Rationale — OpenClaw Code Agent

This document explains the security model, required permissions, and trust
boundaries of the OpenClaw Code Agent plugin.

---

## Why child_process is Required

The plugin spawns local coding harnesses (`claude`, `codex`) and git
subprocesses as **managed child processes**.  This is fundamental to the
plugin's purpose: it cannot fulfill its role without the ability to:

1. **Spawn harness CLIs** — Claude Code and Codex are local executables that
   must run as child processes to capture their stdout/stderr and send them
   follow-up instructions.
2. **Execute git commands** — Worktree creation, branch management, merge
   operations, and `gh` CLI invocations for PR creation all require
   subprocess access.

These subprocesses run **with the user's own permissions** — there is no
privilege elevation.  The plugin does not execute remote or untrusted code;
all commands target locally-installed, user-controlled binaries.

---

## The `--dangerously-force-unsafe-install` Override

Some deployment environments flag `child_process` usage as unsafe.  If you
see this warning during installation:

```
This plugin uses child_process which may be flagged as unsafe.
Use --dangerously-force-unsafe-install to override.
```

You may pass the override flag **only after reviewing this document** and
confirming that:

- You trust the plugin source (this repository).
- You understand it spawns local CLIs with your user permissions.
- Your environment has the required binaries (`git`, `gh`, `claude`/`codex`).

---

## Trust Model

| Layer | Trust Boundary |
|-------|---------------|
| Plugin Code | Trusted — reviewed by user / org before install |
| Harness CLIs | Trusted — locally installed by user (`claude`, `codex`) |
| Git / gh CLI | Trusted — locally installed by user |
| Session Instructions | **Untrusted** — treat as user input; validated before passing to harness |
| Agent Output | **Untrusted** — reviewed via plan approval before execution |

---

## Permission Boundaries

The plugin operates within these constraints:

- **Filesystem:** Only accesses paths under configured `defaultWorkdir` and
  explicit `workdir` parameters.  No traversal outside these roots.
- **Network:** No direct network access.  Harness CLIs (Claude Code, Codex)
  manage their own network connections to Anthropic/OpenAI APIs.
- **Subprocess:** Only spawns configured harness executables and `git`/`gh`.
  No dynamic command construction from untrusted input.
- **Secrets:** Does not store or transmit API keys.  Keys remain in the
  harness CLIs' own configuration (`~/.claude-code`, `~/.codex`).

---

## Claude Code `execPolicy`

`harnesses.claudeCode.execPolicy` controls how the Claude Code harness
handles tool-permission prompts during unattended background sessions:

| Value | Behavior |
|-------|----------|
| `"allow"` (default) | Passes `--dangerously-skip-permissions` so the session never blocks on a prompt. Claude Code has full access to every tool, regardless of `allowedTools`. |
| `"sandbox"` | Omits that flag. Claude Code's normal permission system applies; with no TTY to answer prompts, any tool not covered by `allowedTools` is auto-denied. |

Set `execPolicy: "sandbox"` for untrusted instructions or third-party
sessions where you want the `allowedTools` whitelist to be a hard ceiling.
Keep the default `"allow"` only for trusted, fully-automated workflows.

---

## Recommendations

- Run the OpenClaw host with the **least-privilege user** sufficient for
  your development workflow.
- Review plan approvals before clicking **Approve** — this is the primary
  control surface for preventing unintended changes.
- Use **worktree isolation** (enabled by default) so session changes are
  sandboxed in a separate git branch until explicitly merged.
- Keep harness CLIs updated to their latest stable versions.
