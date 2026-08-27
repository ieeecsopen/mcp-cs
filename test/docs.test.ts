import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { checkBrokenLinks, autoFixBrokenLinks } from "../src/tools/docs.js";

describe("Docs Integrity & Auto-Fixer", () => {
  it("detects broken relative markdown links", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-docs-test-"));
    try {
      const docFile = path.join(tmpDir, "README.md");
      fs.writeFileSync(docFile, "Check out the [Guide](./nonexistent-guide.md) for details.");
      const findings = checkBrokenLinks(tmpDir);
      expect(findings.length).toBe(1);
      expect(findings[0].linkText).toBe("Guide");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("automatically creates markdown stubs when requested", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-docs-fix-"));
    try {
      const docFile = path.join(tmpDir, "README.md");
      fs.writeFileSync(docFile, "Read [Installation](./docs/install.md) first.");

      const result = autoFixBrokenLinks(tmpDir, true, false);
      expect(result.stubsCreated.length).toBe(1);

      const createdStub = path.join(tmpDir, "docs", "install.md");
      expect(fs.existsSync(createdStub)).toBe(true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
