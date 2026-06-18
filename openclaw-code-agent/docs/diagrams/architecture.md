# OpenClaw Code Agent — Architecture Diagrams

Generated diagrams for the `openclaw-code-agent` plugin. Rendered SVGs live
alongside this file (`*.svg`); GitHub also renders the Mermaid blocks below
inline.

## System Architecture

How `plugin.ts` wires the subsystems together in `onLoad(ctx)`.

```mermaid
flowchart TB
    subgraph entry["plugin.ts (onLoad)"]
        ctx["ToolContext"]
    end

    subgraph sessions["sessions/"]
        store["SessionStore\n(JSON persistence)"]
        lifecycle["SessionLifecycle\nlaunch/suspend/resume/kill/fork/respond"]
        monitor["Monitor\n30s health-check loop"]
        outbuf["OutputBuffer"]
    end

    subgraph harness["harness/"]
        base["HarnessAdapter (abstract)"]
        claude["ClaudeCodeHarness"]
        codex["CodexHarness"]
    end

    subgraph worktree["worktree/"]
        isolation["WorktreeIsolation\noca/name-id branches"]
        follow["WorktreeFollowThrough\nmerge / PR / discard"]
        wtlifecycle["WorktreeLifecycle\nstate machine"]
    end

    subgraph plan["plan/"]
        parser["PlanParser"]
        approval["PlanApprovalFlow\napprove/revise/reject"]
    end

    subgraph goals["goals/"]
        engine["GoalEngine (base)"]
        verifier["VerifierGoal\ntest-until-pass"]
        ralph["RalphGoal\ncompletion-signal"]
    end

    subgraph routing["routing/"]
        wake["WakeRouter"]
        notify["NotificationFormatter"]
    end

    subgraph tools["tools/ + commands/"]
        alltools["15 tools\nagent_*, goal_*"]
        cmds["/agent, /goal, ... commands"]
    end

    ctx --> lifecycle
    ctx --> store
    ctx --> isolation
    ctx --> follow
    ctx --> wtlifecycle
    ctx --> approval
    ctx --> parser
    ctx --> wake
    ctx --> notify
    ctx --> alltools
    ctx --> cmds

    lifecycle --> store
    lifecycle --> outbuf
    lifecycle -- "createHarnessAdapter()" --> base
    base --> claude
    base --> codex
    lifecycle --> isolation
    monitor --> store
    monitor --> lifecycle

    approval --> store
    approval -- "harnessLike.send" --> lifecycle
    parser -- "scrapes harness output" --> approval

    verifier --> engine
    ralph --> engine
    engine --> lifecycle

    follow --> isolation
    follow --> wtlifecycle

    alltools --> ctx
    cmds --> ctx
    wake --> notify
```

## Session Lifecycle

`SessionState` transitions driven by `SessionLifecycle`, `Monitor`, and
`PlanApprovalFlow`.

```mermaid
stateDiagram-v2
    [*] --> pending: agent_launch

    pending --> active: harness spawned (plan approval off)
    pending --> awaiting_plan_approval: plan detected in harness output

    awaiting_plan_approval --> active: approve / revise (harness continues)
    awaiting_plan_approval --> killed: reject

    active --> suspended: suspend (SIGSTOP)
    suspended --> active: resume (re-attach)

    active --> completing: agent wrapping up
    completing --> completed: clean exit (code 0)
    completing --> failed: non-zero exit
    active --> completed: clean exit (code 0)
    active --> failed: non-zero exit / zombie timeout (Monitor)

    active --> killed: agent_kill / SIGTERM
    suspended --> killed: agent_kill
    awaiting_plan_approval --> killed: agent_kill

    completed --> [*]
    failed --> [*]
    killed --> [*]
```

## Worktree Follow-Through Lifecycle

`WorktreeLifecycleState` transitions enforced by `WorktreeLifecycle`
(`TRANSITIONS` table in `worktree/lifecycle.ts`).

```mermaid
stateDiagram-v2
    [*] --> active: worktree created (oca/name-id)

    active --> pending_decision: agent finished, changes present
    active --> no_change: agent finished, no committed changes
    active --> dismissed: discarded mid-session

    pending_decision --> merged: merge (merge commit into base)
    pending_decision --> pr_open: openPr (gh CLI)
    pending_decision --> released: rebase/squash onto base
    pending_decision --> dismissed: discard

    pr_open --> merged: PR merged
    pr_open --> released: PR squash-merged

    merged --> [*]
    released --> [*]
    dismissed --> [*]
    no_change --> [*]
```

## Session Launch Sequence

How `agent_launch` flows through `SessionLifecycle.launch()`: optional
worktree creation, session record creation, harness spawn, output
streaming, and the final state split between `active` and
`awaiting_plan_approval` based on `config.permissionMode`.

```mermaid
sequenceDiagram
    actor Caller
    participant Tool as agent_launch tool
    participant Lifecycle as SessionLifecycle
    participant Worktree as WorktreeIsolation
    participant Store as SessionStore
    participant Adapter as HarnessAdapter
    participant Proc as harness CLI process

    Caller->>Tool: agent_launch(name, workdir, instructions)
    Tool->>Lifecycle: launch(params)
    Lifecycle->>Lifecycle: validate workdir exists

    opt worktree strategy enabled and workdir is a git repo
        Lifecycle->>Worktree: create(workdir, name)
        Worktree-->>Lifecycle: branch, worktreePath, baseBranch
    end

    Lifecycle->>Store: create(session) state pending
    Lifecycle->>Lifecycle: harnessFactory(session, config)
    Lifecycle->>Adapter: construct ClaudeCodeHarness or CodexHarness
    Lifecycle->>Lifecycle: register onOutput and onExit handlers
    Lifecycle->>Adapter: start(instructions)
    Adapter->>Proc: spawn claude or codex CLI

    loop streaming output
        Proc-->>Adapter: stdout or stderr chunk
        Adapter-->>Lifecycle: onOutput(chunk)
        Lifecycle->>Store: appendOutput(sessionId, chunk)
    end

    alt permissionMode is plan
        Lifecycle->>Store: update state awaiting_plan_approval
    else
        Lifecycle->>Store: update state active
    end

    Lifecycle-->>Tool: Session
    Tool-->>Caller: session summary
```

## Harness & Goal Engine Class Hierarchy

The two abstract bases (`HarnessAdapter`, `GoalEngine`) and their concrete
subclasses, plus the core data interfaces from `types.ts` they operate on.

```mermaid
classDiagram
    class HarnessAdapter {
        <<abstract>>
        +HarnessType type
        +Session session
        +PluginConfig config
        +ChildProcess process
        +start(instructions?) void*
        +send(message) void*
        +stop(signal?) void*
        +resume() void*
        +getStatus() string*
        +onOutput(callback) void
        +onExit(callback) void
    }

    class ClaudeCodeHarness {
        -claudeSessionId string
        -stderrBuffer string
        +start(instructions?) void
        +send(message) void
        +getClaudeSessionId() string
    }

    class CodexHarness {
        -threadId string
        -appServerUrl string
        -sendQueue Promise
        +start(instructions?) void
        +send(message) void
    }

    class GoalEngine {
        <<abstract>>
        #GoalTask task
        #GoalState _status
        +start(task) void*
        +stop() void*
        +getStatus() GoalState
        +getTask() GoalTask
    }

    class VerifierGoal {
        -SessionLifecycle lifecycle
        -SessionStore store
        -iterationDelayMs number
        -sessionWorkdir string
        +start(task) void
        +stop() void
    }

    class RalphGoal {
        -SessionLifecycle lifecycle
        -SessionStore store
        -iterationDelayMs number
        +start(task) void
        +stop() void
    }

    class Session {
        +string id
        +string name
        +HarnessType harness
        +SessionState state
        +string workdir
        +string worktreeBranch
        +string baseBranch
        +PlanArtifact pendingPlan
        +Record metadata
    }

    class PlanArtifact {
        +string id
        +string sessionId
        +string content
        +string status
    }

    class GoalTask {
        +string id
        +string sessionId
        +GoalType type
        +GoalState state
        +string target
        +string verifierCommand
        +string completionSignal
        +number maxIterations
        +number currentIteration
    }

    HarnessAdapter <|-- ClaudeCodeHarness
    HarnessAdapter <|-- CodexHarness
    GoalEngine <|-- VerifierGoal
    GoalEngine <|-- RalphGoal
    HarnessAdapter --> Session : session
    GoalEngine --> GoalTask : task
    Session --> PlanArtifact : pendingPlan
    GoalTask ..> Session : sessionId reference
```
