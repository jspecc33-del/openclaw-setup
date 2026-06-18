/**
 * Result of creating a worktree isolation environment.
 */
export interface WorktreeCreateResult {
    branch: string;
    worktreePath: string;
    baseBranch: string;
}
/**
 * Manages Git worktree isolation for coding agent sessions.
 * Creates isolated branch + worktree so agents work without polluting the base branch.
 */
export declare class WorktreeIsolation {
    /**
     * Generate a short random identifier for branch/worktree naming.
     */
    private generateShortId;
    /**
     * Sanitize a session name for use in Git branch names.
     * Replaces spaces and special chars with hyphens; removes non-alphanumeric.
     */
    private sanitizeSessionName;
    /**
     * Execute a git command via execFileSync (argument array — no shell interpretation).
     */
    private execGit;
    /**
     * Check whether a directory is a Git repository.
     */
    isGitRepo(workdir: string): boolean;
    /**
     * Detect whether the `gh` CLI tool is installed and available.
     */
    hasGhCli(): boolean;
    /**
     * Get the current branch of a Git repository.
     */
    getCurrentBranch(workdir: string): string;
    /**
     * Create a new worktree with an isolated branch for a session.
     *
     * Steps:
     *  1. Verify workdir is a Git repo
     *  2. Read the current branch as baseBranch
     *  3. Generate branch name: oca/<session-name>-<short-id>
     *  4. Create the branch
     *  5. Create the worktree pointing at the new branch
     *  6. Return metadata
     */
    create(workdir: string, sessionName: string): Promise<WorktreeCreateResult>;
    /**
     * Remove a worktree and delete its associated branch.
     */
    remove(worktreePath: string): Promise<void>;
}
//# sourceMappingURL=isolation.d.ts.map