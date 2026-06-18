// ============================================================================
// Worktree Follow-Through — Merge, PR (gh CLI), discard logic
// Spec: Section 7.2
// ============================================================================

import { execFileSync } from "child_process";
import type { Session, WorktreeStrategy } from "../types";
import { WorktreeIsolation } from "./isolation";

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
export class WorktreeFollowThrough {
  private isolation: WorktreeIsolation;

  constructor() {
    this.isolation = new WorktreeIsolation();
  }

  /**
   * Execute a git command via execFileSync (argument array — no shell interpretation).
   */
  private execGit(cwd: string, args: string[]): string {
    try {
      return execFileSync("git", ["-C", cwd, ...args], {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();
    } catch (err: any) {
      const stderr = err.stderr?.toString() || "";
      throw new Error(`Git command failed: git -C "${cwd}" ${args.join(" ")}\n${stderr}`);
    }
  }

  /**
   * Check if a branch has any commits not on the base branch.
   */
  private hasCommits(workdir: string, branch: string, baseBranch: string): boolean {
    try {
      const output = this.execGit(workdir, [
        "rev-list",
        "--count",
        `${baseBranch}..${branch}`,
      ]);
      return parseInt(output, 10) > 0;
    } catch {
      return false;
    }
  }

  /**
   * Merge the session's worktree branch back into the base branch.
   *
   * @param session — the active session with worktree metadata
   * @param strategy — the worktree strategy (e.g. "auto-merge", "manual")
   * @returns merge result with success flag and optional merge commit SHA
   */
  async merge(session: Session, strategy: WorktreeStrategy): Promise<MergeResult> {
    const { workdir, worktreeBranch, baseBranch, worktreePath } = session;

    if (!worktreeBranch || !baseBranch) {
      return { success: false, message: "Session has no worktree branch or base branch recorded" };
    }

    // Determine the repo to operate in: use worktreePath if available, else workdir
    const repoPath = worktreePath || workdir;

    try {
      // Check if there are any commits to merge
      if (!this.hasCommits(repoPath, worktreeBranch, baseBranch)) {
        return { success: true, message: "No commits to merge — branches are even" };
      }

      // Checkout the base branch in the main repo (not the worktree)
      // We need the main repo path; worktree's .git file points to it
      const mainRepoPath = workdir;
      this.execGit(mainRepoPath, ["checkout", baseBranch]);

      // Merge the worktree branch
      const mergeMsg = `Merge worktree branch ${worktreeBranch} (session: ${session.name})`;
      this.execGit(mainRepoPath, ["merge", "--no-ff", "-m", mergeMsg, worktreeBranch]);

      // Get the merge commit SHA
      const sha = this.execGit(mainRepoPath, ["rev-parse", "HEAD"]);

      return {
        success: true,
        message: `Successfully merged ${worktreeBranch} into ${baseBranch}`,
        sha,
      };
    } catch (err: any) {
      const msg = err.message || "";

      // Detect merge conflicts
      if (msg.includes("CONFLICT") || msg.includes("conflict")) {
        // Abort the merge to leave repo in clean state
        try {
          this.execGit(workdir, ["merge", "--abort"]);
        } catch {
          // Best-effort abort
        }
        return {
          success: false,
          message: `Merge conflict detected when merging ${worktreeBranch} into ${baseBranch}. Please resolve manually.`,
        };
      }

      return {
        success: false,
        message: `Merge failed: ${msg}`,
      };
    }
  }

  /**
   * Open a GitHub Pull Request for the session's worktree branch.
   *
   * @param session — the active session with worktree metadata
   * @param title — optional PR title
   * @param body — optional PR body
   * @returns PR result with success flag and optional PR URL
   */
  async openPr(session: Session, title?: string, body?: string): Promise<PrResult> {
    const { worktreeBranch, baseBranch, workdir } = session;

    if (!worktreeBranch || !baseBranch) {
      return { success: false, message: "Session has no worktree branch or base branch recorded" };
    }

    if (!this.isolation.hasGhCli()) {
      return {
        success: false,
        message: "GitHub CLI (`gh`) is not installed. Install it from https://cli.github.com/",
      };
    }

    try {
      // Push the branch to origin first
      this.execGit(workdir || ".", ["push", "-u", "origin", worktreeBranch]);

      // Build gh pr create command
      const prTitle = title || `OpenClaw: ${session.name}`;
      const prBody = body || `Changes from OpenClaw Code Agent session "${session.name}".`;

      const output = execFileSync(
        "gh",
        ["pr", "create", "--title", prTitle, "--body", prBody, "--base", baseBranch, "--head", worktreeBranch],
        { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }
      ).trim();

      // Extract PR URL from gh output
      const prUrlMatch = output.match(/https:\/\/github\.com\/[^\s]+/);
      const prUrl = prUrlMatch ? prUrlMatch[0] : undefined;

      return {
        success: true,
        prUrl,
        message: prUrl ? `PR created: ${prUrl}` : `PR created successfully`,
      };
    } catch (err: any) {
      const stderr = err.stderr?.toString() || err.message || "";
      return {
        success: false,
        message: `Failed to create PR: ${stderr}`,
      };
    }
  }

  /**
   * Discard a session's worktree and branch entirely.
   *
   * @param session — the active session to discard
   * @returns discard result
   */
  async discard(session: Session): Promise<DiscardResult> {
    const { worktreePath, worktreeBranch } = session;

    if (!worktreePath || !worktreeBranch) {
      return { success: false, message: "Session has no worktree to discard" };
    }

    try {
      await this.isolation.remove(worktreePath);
      return {
        success: true,
        message: `Discarded worktree at ${worktreePath} and branch ${worktreeBranch}`,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Failed to discard worktree: ${err.message}`,
      };
    }
  }
}
