import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { installSkills } from "../src/tools/skills.js";

describe("MCS Agent Skills Suite", () => {
  it("installs agent skills into .agents/skills/ directory", () => {
    const tmpDir = path.join(os.tmpdir(), `mcs_test_skills_${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    const result = installSkills(tmpDir, "agents");
    expect(result.totalCount).toBeGreaterThan(0);
    expect(fs.existsSync(path.join(tmpDir, ".agents", "skills", "algo-stress-testing", "SKILL.md"))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, ".agents", "skills", "repo-doctor", "SKILL.md"))).toBe(true);

    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  });

  it("installs cursor rules into .cursor/rules/ directory", () => {
    const tmpDir = path.join(os.tmpdir(), `mcs_test_cursor_${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    const result = installSkills(tmpDir, "cursor");
    expect(result.totalCount).toBeGreaterThan(0);
    expect(fs.existsSync(path.join(tmpDir, ".cursor", "rules", "algo-stress-testing.mdc"))).toBe(true);

    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  });
});
