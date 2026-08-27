import fs from "fs";
import path from "path";

export interface TodoFinding {
  file: string;
  line: number;
  type: "TODO" | "FIXME" | "HACK" | "BUG" | "NOTE";
  text: string;
}

export function findTodos(targetDir: string = process.cwd()): TodoFinding[] {
  const findings: TodoFinding[] = [];
  const IGNORED_DIRS = new Set(["node_modules", ".git", ".next", "dist", "build", ".venv", "coverage"]);
  const TARGET_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".java", ".c", ".cpp", ".sql", ".sh"]);

  const TODO_REGEX = /(?:\/\/|#|\/\*|\*|--)\s*(TODO|FIXME|HACK|BUG|NOTE):?\s*(.+)$/i;

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
      } else if (stat.isFile() && TARGET_EXTENSIONS.has(path.extname(entry).toLowerCase())) {
        try {
          const content = fs.readFileSync(fullPath, "utf8");
          const lines = content.split("\n");
          lines.forEach((line, index) => {
            const match = TODO_REGEX.exec(line);
            if (match) {
              const type = match[1].toUpperCase() as TodoFinding["type"];
              findings.push({
                file: path.relative(targetDir, fullPath),
                line: index + 1,
                type,
                text: match[2].trim(),
              });
            }
          });
        } catch {}
      }
    }
  }

  traverse(targetDir);
  return findings;
}

export function inspectHeavyDependencies(projectPath: string = process.cwd()): {
  totalDependencies: number;
  heavyweightPicks: Array<{ name: string; category: string; tip: string }>;
} {
  const pkgPath = path.join(projectPath, "package.json");
  if (!fs.existsSync(pkgPath)) {
    return { totalDependencies: 0, heavyweightPicks: [] };
  }

  const KNOWN_HEAVY_PACKAGES: Record<string, { category: string; tip: string }> = {
    moment: { category: "Date Manipulation", tip: "Replace with date-fns, dayjs, or native Intl API" },
    lodash: { category: "Utility Library", tip: "Use individual methods (e.g. lodash-es) or modern JS standard library" },
    rxjs: { category: "Reactive Programming", tip: "Verify if full RxJS runtime is strictly needed" },
    "monaco-editor": { category: "Web Code Editor", tip: "Ensure it is loaded dynamically with next/dynamic (ssr: false)" },
    katex: { category: "Math Typesetting", tip: "Lazy-load KaTeX rendering only inside equations or modals" },
    three: { category: "3D Graphics", tip: "Dynamically load 3D canvas only when scrolled into view" },
    "aws-sdk": { category: "Cloud SDK", tip: "Upgrade to modular @aws-sdk/client-* packages instead of monolithic v2" },
  };

  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    const heavyweightPicks: Array<{ name: string; category: string; tip: string }> = [];

    for (const dep of Object.keys(allDeps)) {
      if (KNOWN_HEAVY_PACKAGES[dep]) {
        heavyweightPicks.push({
          name: dep,
          category: KNOWN_HEAVY_PACKAGES[dep].category,
          tip: KNOWN_HEAVY_PACKAGES[dep].tip,
        });
      }
    }

    return {
      totalDependencies: Object.keys(allDeps).length,
      heavyweightPicks,
    };
  } catch {
    return { totalDependencies: 0, heavyweightPicks: [] };
  }
}
