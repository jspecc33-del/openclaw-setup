import type { Session, WorktreeStrategy } from "../types";
/**
 * Result of a merge operation.
 */
export interface MergeResult {
    success: boolean;
    message: string;
    sha?: string;
}
/**
 * Result of a PR creation operation.
 */
export interface PrResult {
    success: boolean;
    prUrl?: string;
    message: string;
}
/**
 * Result of a discard operation.
 */
export interface DiscardResult {
    success: boolean;
    message: string;
}
/**
 * Handles follow-through actions for worktree sessions:
 * merging back to base, opening PRs, and discarding changes.
 */
export declare class WorktreeFollowThrough {
    private isolation;
    constructor();
    /**
     * Execute a git command via execSync with error handling.
     */
    private execGit;
    /**
     * Check if a branch has any commits not on the base branch.
     */
    private hasCommits;
    /**
     * Merge the session's worktree branch back into the base branch.
     *
     * @param session — the active session with worktree metadata
     * @param strategy — the worktree strategy (e.g. "auto-merge", "manual")
     * @returns merge result with success flag and optional merge commit SHA
     */
    merge(session: Session, strategy: WorktreeStrategy): Promise<MergeResult>;
    /**
     * Open a GitHub Pull Request for the session's worktree branch.
     *
     * @param session — the active session with worktree metadata
     * @param title — optional PR title
     * @param body — optional PR body
     * @returns PR result with success flag and optional PR URL
     */
    openPr(session: Session, title?: string, body?: string): Promise<PrResult>;
    /**
     * Discard a session's worktree and branch entirely.
     *
     * @param session — the active session to discard
     * @returns discard result
     */
    discard(session: Session): Promise<DiscardResult>;
}
//# sourceMappingURL=followthrough.d.ts.map