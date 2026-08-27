import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { scanSecrets, autoSanitizeSecrets } from "../src/tools/security.js";

describe("Security Scanner & AST Secret Auto-Sanitizer", () => {
  it("detects hardcoded API keys in files", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-sec-test-"));
    try {
      const file = path.join(tmpDir, "api.js");
      fs.writeFileSync(file, 'const apiKey = "sk-1234567890abcdef1234567890abcdef";');
      const findings = scanSecrets(tmpDir);
      expect(findings.length).toBe(1);
      expect(findings[0].type).toBe("OpenAI API Key");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("automatically replaces secrets with process.env and updates .env.example", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-sec-sanitize-"));
    try {
      const srcFile = path.join(tmpDir, "config.js");
      fs.writeFileSync(srcFile, 'const secret = "sk-1234567890abcdef1234567890abcdef";\nconst token = "ghp_123456789012345678901234567890123456";');

      const result = autoSanitizeSecrets(tmpDir, false);
      expect(result.sanitizedCount).toBe(2);
      expect(result.modifiedFiles.length).toBe(1);

      const modifiedCode = fs.readFileSync(srcFile, "utf8");
      expect(modifiedCode).toContain("process.env.OPENAI_API_KEY_");
      expect(modifiedCode).toContain("process.env.GITHUB_TOKEN_");
      expect(modifiedCode).not.toContain("sk-1234567890abcdef");

      const envExample = path.join(tmpDir, ".env.example");
      expect(fs.existsSync(envExample)).toBe(true);
      const envContent = fs.readFileSync(envExample, "utf8");
      expect(envContent).toContain("OPENAI_API_KEY_");
      expect(envContent).toContain("GITHUB_TOKEN_");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
