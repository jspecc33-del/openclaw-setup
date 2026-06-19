// ============================================================================
// Worktree Isolation — Git worktree create/remove/detect, branch management
// Spec: Section 7.1
// ============================================================================

import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

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
export class WorktreeIsolation {
  /**
   * Generate a short random identifier for branch/worktree naming.
   */
  private generateShortId(): string {
    return Math.random().toString(36).substring(2, 8);
  }

  /**
   * Sanitize a session name for use in Git branch names.
   * Replaces spaces and special chars with hyphens; removes non-alphanumeric.
   */
  private sanitizeSessionName(name: string): string {
    return name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9\-_]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .substring(0, 40);
  }

  /**
   * Execute a git command via execFileSync (argument array — no shell interpretation).
   */
  private execGit(workdir: string, args: string[]): string {
    try {
      return execFileSync("git", ["-C", workdir, ...args], {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();
    } catch (err: any) {
      const stderr = err.stderr?.toString() || "";
      throw new Error(`Git command failed: git -C "${workdir}" ${args.join(" ")}\n${stderr}`);
    }
  }

  /**
   * Check whether a directory is a Git repository.
   */
  isGitRepo(workdir: string): boolean {
    try {
      const gitDir = path.join(workdir, ".git");
      if (fs.existsSync(gitDir)) return true;
      // Also check via git command (handles worktrees / submodules)
      execFileSync("git", ["-C", workdir, "rev-parse", "--git-dir"], {
        encoding: "utf-8",
        stdio: "pipe",
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Detect whether the `gh` CLI tool is installed and available.
   */
  hasGhCli(): boolean {
    try {
      execFileSync("gh", ["--version"], { encoding: "utf-8", stdio: "pipe" });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the current branch of a Git repository.
   */
  getCurrentBranch(workdir: string): string {
    return this.execGit(workdir, ["branch", "--show-current"]);
  }

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
  async create(workdir: string, sessionName: string): Promise<WorktreeCreateResult> {
    if (!this.isGitRepo(workdir)) {
      throw new Error(`Not a Git repository: ${workdir}`);
    }

    const baseBranch = this.getCurrentBranch(workdir);
    const shortId = this.generateShortId();
    const sanitized = this.sanitizeSessionName(sessionName);
    const branch = `oca/${sanitized}-${shortId}`;

    // Derive worktree path: sibling to workdir, or fallback to os.tmpdir()
    const parentDir = path.dirname(workdir);
    const worktreeDirName = `oca-${sanitized}-${shortId}`;
    let worktreePath = path.resolve(parentDir, worktreeDirName);

    // If the derived path already exists or parent is not writable, fall back to temp
    try {
      fs.accessSync(parentDir, fs.constants.W_OK);
      if (fs.existsSync(worktreePath)) {
        worktreePath = path.join(os.tmpdir(), worktreeDirName);
      }
    } catch {
      worktreePath = path.join(os.tmpdir(), worktreeDirName);
    }

    // 4. Create branch
    this.execGit(workdir, ["branch", branch]);

    // 5. Create worktree
    this.execGit(workdir, ["worktree", "add", worktreePath, branch]);

    return { branch, worktreePath, baseBranch };
  }

  /**
   * Remove a worktree and delete its associated branch.
   */
  async remove(worktreePath: string): Promise<void> {
    // Resolve the branch name from the worktree
    let branch: string | undefined;
    try {
      branch = execFileSync("git", ["-C", worktreePath, "branch", "--show-current"], {
        encoding: "utf-8",
        stdio: "pipe",
      }).trim();
    } catch {
      // Worktree may already be removed; try to proceed
    }

    // Remove the worktree directory from git's perspective
    try {
      // Find the main repo path — worktrees have a .git file pointing to the main repo
      const gitFile = path.join(worktreePath, ".git");
      let mainRepoDir: string | undefined;
      if (fs.existsSync(gitFile)) {
        const gitFileContent = fs.readFileSync(gitFile, "utf-8");
        const match = gitFileContent.match(/gitdir:\s*(.+)/);
        if (match) {
          // The main repo is a few levels up from the worktree admin dir
          const worktreeAdminDir = path.resolve(worktreePath, match[1].trim());
          mainRepoDir = path.dirname(path.dirname(worktreeAdminDir));
        }
      }

      if (mainRepoDir) {
        this.execGit(mainRepoDir, ["worktree", "remove", "-f", worktreePath]);
        if (branch) {
          this.execGit(mainRepoDir, ["branch", "-D", branch]);
        }
      } else {
        // Fallback: try direct removal
        try {
          execFileSync("git", ["worktree", "remove", "-f", worktreePath], {
            encoding: "utf-8",
            stdio: "pipe",
          });
        } catch {
          // If git worktree remove fails, manually delete
          fs.rmSync(worktreePath, { recursive: true, force: true });
        }
        if (branch) {
          try {
            execFileSync("git", ["branch", "-D", branch], { encoding: "utf-8", stdio: "pipe" });
          } catch {
            // Branch may already be gone
          }
        }
      }
    } catch (err: any) {
      throw new Error(`Failed to remove worktree at ${worktreePath}: ${err.message}`);
    }
  }
}
