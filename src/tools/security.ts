import fs from "fs";
import path from "path";

const SECRET_PATTERNS = [
  { name: "OpenAI API Key", varPrefix: "OPENAI_API_KEY", regex: /sk-[a-zA-Z0-9]{32,}/g },
  { name: "GitHub Personal Access Token", varPrefix: "GITHUB_TOKEN", regex: /ghp_[a-zA-Z0-9]{36}/g },
  { name: "AWS Access Key ID", varPrefix: "AWS_ACCESS_KEY_ID", regex: /AKIA[0-9A-Z]{16}/g },
  { name: "Private RSA/EC Key", varPrefix: "PRIVATE_KEY", regex: /-----BEGIN [A-Z ]+ PRIVATE KEY-----/g },
  { name: "Generic Secret Key Assignment", varPrefix: "APP_SECRET", regex: /(?:api_key|secret|password|token)\s*[:=]\s*['"]([a-zA-Z0-9_\-]{16,})['"]/gi },
];

export interface SecretFinding {
  file: string;
  line: number;
  type: string;
  preview: string;
}

export interface SanitizationResult {
  modifiedFiles: string[];
  sanitizedCount: number;
  envVariablesAdded: string[];
  dryRun: boolean;
  details: Array<{ file: string; line: number; replacedSecret: string; envVarName: string }>;
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

/**
 * Automatically sanitizes detected hardcoded secrets in source files,
 * replacing them with process.env / os.environ references and updating .env.example.
 */
export function autoSanitizeSecrets(
  targetDir: string = process.cwd(),
  dryRun: boolean = false
): SanitizationResult {
  const IGNORED_DIRS = new Set(["node_modules", ".git", ".next", "dist", "build", ".venv", "venv", ".env", ".env.local", ".env.example"]);
  const modifiedFilesSet = new Set<string>();
  const envVarsToAdd = new Set<string>();
  const details: SanitizationResult["details"] = [];
  let counter = 1;

  function processFile(filePath: string) {
    if (filePath.endsWith(".env") || filePath.endsWith(".env.example") || filePath.endsWith(".env.local")) return;
    
    let content: string;
    try {
      content = fs.readFileSync(filePath, "utf8");
    } catch {
      return;
    }

    const lines = content.split("\n");
    let fileModified = false;
    const isPython = filePath.endsWith(".py");

    const newLines = lines.map((line, lineIdx) => {
      let modifiedLine = line;
      for (const pattern of SECRET_PATTERNS) {
        const match = new RegExp(pattern.regex.source, pattern.regex.flags).exec(line);
        if (match) {
          const rawSecret = match[1] || match[0];
          if (!rawSecret || rawSecret.length < 8) continue;

          const envVarName = `${pattern.varPrefix}_${counter++}`;
          envVarsToAdd.add(envVarName);

          const replacement = isPython
            ? `os.environ.get("${envVarName}", "")`
            : `process.env.${envVarName}`;

          modifiedLine = modifiedLine.replace(rawSecret, replacement);
          fileModified = true;

          details.push({
            file: path.relative(targetDir, filePath),
            line: lineIdx + 1,
            replacedSecret: rawSecret.slice(0, 4) + "..." + rawSecret.slice(-4),
            envVarName,
          });
          break; // Stop after first pattern match for this line
        }
      }
      return modifiedLine;
    });

    if (fileModified) {
      modifiedFilesSet.add(path.relative(targetDir, filePath));
      if (!dryRun) {
        fs.writeFileSync(filePath, newLines.join("\n"), "utf8");
      }
    }
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
      } else if (stat.isFile() && stat.size < 500 * 1024) {
        processFile(fullPath);
      }
    }
  }

  traverse(targetDir);

  // Update or append to .env.example
  if (!dryRun && envVarsToAdd.size > 0) {
    const envExamplePath = path.join(targetDir, ".env.example");
    let envExampleContent = "";
    if (fs.existsSync(envExamplePath)) {
      envExampleContent = fs.readFileSync(envExamplePath, "utf8");
    }

    let appendContent = "\n# Automatically added by mcp-cs auto-sanitizer\n";
    for (const envVar of envVarsToAdd) {
      if (!envExampleContent.includes(envVar)) {
        appendContent += `${envVar}=\n`;
      }
    }

    if (appendContent.trim() !== "# Automatically added by mcp-cs auto-sanitizer") {
      fs.appendFileSync(envExamplePath, appendContent, "utf8");
    }
  }

  return {
    modifiedFiles: Array.from(modifiedFilesSet),
    sanitizedCount: details.length,
    envVariablesAdded: Array.from(envVarsToAdd),
    dryRun,
    details,
  };
}
