import fs from "fs";
import path from "path";

export interface BrokenLinkFinding {
  file: string;
  line: number;
  linkText: string;
  target: string;
  reason: string;
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
