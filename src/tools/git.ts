import { execSync } from "child_process";

export function generateChangelog(fromTag?: string, toTag: string = "HEAD"): string {
  try {
    const range = fromTag ? `${fromTag}..${toTag}` : toTag;
    const logOutput = execSync(`git log ${range} --pretty=format:"%s|%an"`, { encoding: "utf8" });
    const lines = logOutput.split("\n").filter(Boolean);

    const features: string[] = [];
    const fixes: string[] = [];
    const chores: string[] = [];
    const others: string[] = [];

    lines.forEach((line) => {
      const [msg, author] = line.split("|");
      const cleanMsg = `${msg} (@${author})`;
      if (msg.startsWith("feat")) features.push(cleanMsg);
      else if (msg.startsWith("fix")) fixes.push(cleanMsg);
      else if (msg.startsWith("chore") || msg.startsWith("refactor")) chores.push(cleanMsg);
      else others.push(cleanMsg);
    });

    let markdown = `# Release Changelog\n\n`;
    if (features.length) markdown += `### 🚀 New Features\n${features.map((f) => `- ${f}`).join("\n")}\n\n`;
    if (fixes.length) markdown += `### 🐛 Bug Fixes\n${fixes.map((f) => `- ${f}`).join("\n")}\n\n`;
    if (chores.length) markdown += `### 🔧 Maintenance & Refactors\n${chores.map((c) => `- ${c}`).join("\n")}\n\n`;
    if (others.length) markdown += `### 📝 Other Commits\n${others.map((o) => `- ${o}`).join("\n")}\n\n`;

    return markdown;
  } catch (err: unknown) {
    return `Error generating changelog: ${err instanceof Error ? err.message : String(err)}`;
  }
}

export function checkPrReadiness(): {
  currentBranch: string;
  hasUncommittedChanges: boolean;
  uncommittedFiles: string[];
  unpushedCommitsCount: number;
  divergedFromMain: boolean;
  recommendations: string[];
} {
  const recommendations: string[] = [];
  let currentBranch = "unknown";
  let hasUncommittedChanges = false;
  let uncommittedFiles: string[] = [];
  let unpushedCommitsCount = 0;
  let divergedFromMain = false;

  try {
    currentBranch = execSync("git branch --show-current", { encoding: "utf8" }).trim();
    const statusOutput = execSync("git status --porcelain", { encoding: "utf8" }).trim();
    if (statusOutput) {
      hasUncommittedChanges = true;
      uncommittedFiles = statusOutput.split("\n").map((line) => line.trim());
      recommendations.push("You have uncommitted changes. Commit or stash them before creating a PR.");
    }

    try {
      const unpushed = execSync(`git log @{u}..HEAD --oneline`, { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] }).trim();
      if (unpushed) {
        unpushedCommitsCount = unpushed.split("\n").length;
      }
    } catch {
      recommendations.push("Branch does not have an upstream tracking branch configured.");
    }
  } catch (e: unknown) {
    recommendations.push(`Git command error: ${e instanceof Error ? e.message : String(e)}`);
  }

  return {
    currentBranch,
    hasUncommittedChanges,
    uncommittedFiles,
    unpushedCommitsCount,
    divergedFromMain,
    recommendations,
  };
}

export function generatePrDescription(targetBranch: string = "main"): string {
  try {
    const branch = execSync("git branch --show-current", { encoding: "utf8" }).trim();
    const commits = execSync(`git log ${targetBranch}..HEAD --pretty=format:"- %s"`, { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] }).trim();
    const stats = execSync(`git diff --shortstat ${targetBranch}...HEAD`, { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] }).trim();

    return `## 📝 Pull Request: \`${branch}\` -> \`${targetBranch}\`

### 🚀 Overview
${stats ? `**Diff Summary:** ${stats}\n` : ""}

### 📦 Commits Included
${commits || "- Initial branch commits"}

### 🧪 Verification Checklist
- [ ] Code builds without compilation errors
- [ ] Unit & integration tests pass
- [ ] No exposed secrets or API keys
- [ ] Tested locally on clean environment
`;
  } catch {
    return `## 📝 Pull Request Description\n\n- Automated branch diff generated for code review.`;
  }
}
