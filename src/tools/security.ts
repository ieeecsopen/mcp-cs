import fs from "fs";
import path from "path";

const SECRET_PATTERNS = [
  { name: "OpenAI API Key", regex: /sk-[a-zA-Z0-9]{32,}/g },
  { name: "GitHub Personal Access Token", regex: /ghp_[a-zA-Z0-9]{36}/g },
  { name: "AWS Access Key ID", regex: /AKIA[0-9A-Z]{16}/g },
  { name: "Private RSA/EC Key", regex: /-----BEGIN [A-Z ]+ PRIVATE KEY-----/g },
  { name: "Generic Secret Key Assignment", regex: /(?:api_key|secret|password|token)\s*[:=]\s*['"][a-zA-Z0-9_\-]{16,}['"]/gi },
];

export interface SecretFinding {
  file: string;
  line: number;
  type: string;
  preview: string;
}

export function scanSecrets(targetDir: string = process.cwd()): SecretFinding[] {
  const findings: SecretFinding[] = [];
  const IGNORED_DIRS = new Set(["node_modules", ".git", ".next", "dist", "build", ".venv", "venv"]);

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
      } else if (stat.isFile() && stat.size < 500 * 1024) {
        // Only inspect text files under 500KB
        try {
          const content = fs.readFileSync(fullPath, "utf8");
          const lines = content.split("\n");
          lines.forEach((line, index) => {
            for (const pattern of SECRET_PATTERNS) {
              if (pattern.regex.test(line)) {
                findings.push({
                  file: path.relative(targetDir, fullPath),
                  line: index + 1,
                  type: pattern.name,
                  preview: line.slice(0, 80).trim(),
                });
                break;
              }
            }
          });
        } catch {}
      }
    }
  }

  traverse(targetDir);
  return findings;
}
