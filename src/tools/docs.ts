import fs from "fs";
import path from "path";

export interface BrokenLinkFinding {
  file: string;
  line: number;
  linkText: string;
  target: string;
  reason: string;
}

export interface DocsFixResult {
  fixedCount: number;
  stubsCreated: string[];
  repairedLinks: Array<{ file: string; line: number; oldTarget: string; newTarget: string }>;
  dryRun: boolean;
}

export function checkBrokenLinks(targetDir: string = process.cwd()): BrokenLinkFinding[] {
  const findings: BrokenLinkFinding[] = [];
  const IGNORED_DIRS = new Set(["node_modules", ".git", ".next", "dist", "build", ".venv"]);

  function scanMarkdown(filePath: string) {
    try {
      const content = fs.readFileSync(filePath, "utf8");
      const lines = content.split("\n");
      const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;

      lines.forEach((line, index) => {
        let match;
        while ((match = linkRegex.exec(line)) !== null) {
          const [_, linkText, target] = match;
          // Ignore external web URLs and anchors in this fast local scan
          if (target.startsWith("http://") || target.startsWith("https://") || target.startsWith("#") || target.startsWith("mailto:")) {
            continue;
          }

          // Check if local file exists relative to the markdown file
          const cleanTarget = target.split("#")[0].split("?")[0];
          if (!cleanTarget) continue;

          const resolvedPath = path.resolve(path.dirname(filePath), cleanTarget);
          if (!fs.existsSync(resolvedPath)) {
            findings.push({
              file: path.relative(targetDir, filePath),
              line: index + 1,
              linkText,
              target,
              reason: `Target file does not exist: ${cleanTarget}`,
            });
          }
        }
      });
    } catch {}
  }

  function traverse(dir: string) {
    let entries: string[] = [];
    try {
      entries = fs.readdirSync(dir);
    } catch {
      return;
    }

    for (const entry of entries) {
      if (IGNORED_DIRS.has(entry)) continue;
      const fullPath = path.join(dir, entry);
      let stat;
      try {
        stat = fs.statSync(fullPath);
      } catch {
        continue;
      }

      if (stat.isDirectory()) {
        traverse(fullPath);
      } else if (stat.isFile() && (entry.endsWith(".md") || entry.endsWith(".mdx"))) {
        scanMarkdown(fullPath);
      }
    }
  }

  traverse(targetDir);
  return findings;
}

/**
 * Automatically repairs broken markdown links by finding closest matching files
 * or creating placeholder markdown stubs if missing.
 */
export function autoFixBrokenLinks(
  targetDir: string = process.cwd(),
  createStubs: boolean = false,
  dryRun: boolean = false
): DocsFixResult {
  const findings = checkBrokenLinks(targetDir);
  const repairedLinks: DocsFixResult["repairedLinks"] = [];
  const stubsCreated: string[] = [];

  // Index all repo files for fast similarity matching
  const allRepoFiles: string[] = [];
  const IGNORED_DIRS = new Set(["node_modules", ".git", ".next", "dist", "build", ".venv"]);

  function indexDir(dir: string) {
    try {
      const entries = fs.readdirSync(dir);
      for (const entry of entries) {
        if (IGNORED_DIRS.has(entry)) continue;
        const fullPath = path.join(dir, entry);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) indexDir(fullPath);
        else allRepoFiles.push(fullPath);
      }
    } catch {}
  }
  indexDir(targetDir);

  for (const finding of findings) {
    const docFullPath = path.resolve(targetDir, finding.file);
    const targetBasename = path.basename(finding.target.split("#")[0].split("?")[0]).toLowerCase();

    // Look for file with exact or similar base name
    const candidate = allRepoFiles.find((f) => path.basename(f).toLowerCase() === targetBasename);

    if (candidate) {
      const relativeTarget = path.relative(path.dirname(docFullPath), candidate);
      const newTarget = relativeTarget.startsWith(".") ? relativeTarget : `./${relativeTarget}`;

      if (!dryRun) {
        let content = fs.readFileSync(docFullPath, "utf8");
        content = content.replace(`](${finding.target})`, `](${newTarget})`);
        fs.writeFileSync(docFullPath, content, "utf8");
      }

      repairedLinks.push({
        file: finding.file,
        line: finding.line,
        oldTarget: finding.target,
        newTarget,
      });
    } else if (createStubs) {
      const targetPath = path.resolve(path.dirname(docFullPath), finding.target.split("#")[0]);
      if (!dryRun) {
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        const title = path.basename(targetPath, path.extname(targetPath));
        fs.writeFileSync(targetPath, `# ${title}\n\nDocumentation placeholder created automatically by mcp-cs.\n`, "utf8");
      }
      stubsCreated.push(path.relative(targetDir, targetPath));
    }
  }

  return {
    fixedCount: repairedLinks.length + stubsCreated.length,
    stubsCreated,
    repairedLinks,
    dryRun,
  };
}

export function extractCodeSnippets(targetDir: string = process.cwd()): Array<{ file: string; language: string; lineCount: number; snippet: string }> {
  const snippets: Array<{ file: string; language: string; lineCount: number; snippet: string }> = [];
  const IGNORED_DIRS = new Set(["node_modules", ".git", ".next", "dist", "build"]);

  function scan(filePath: string) {
    try {
      const content = fs.readFileSync(filePath, "utf8");
      const blockRegex = /```([a-zA-Z0-9_\-]+)?\n([\s\S]*?)```/g;
      let match;
      while ((match = blockRegex.exec(content)) !== null) {
        const lang = match[1] || "text";
        const code = match[2].trim();
        snippets.push({
          file: path.relative(targetDir, filePath),
          language: lang,
          lineCount: code.split("\n").length,
          snippet: code.slice(0, 300) + (code.length > 300 ? "\n..." : ""),
        });
      }
    } catch {}
  }

  function traverse(dir: string) {
    try {
      const entries = fs.readdirSync(dir);
      for (const entry of entries) {
        if (IGNORED_DIRS.has(entry)) continue;
        const fullPath = path.join(dir, entry);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) traverse(fullPath);
        else if (stat.isFile() && (entry.endsWith(".md") || entry.endsWith(".mdx"))) scan(fullPath);
      }
    } catch {}
  }

  traverse(targetDir);
  return snippets;
}
