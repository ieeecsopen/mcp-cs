import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface InstalledSkill {
  name: string;
  destination: string;
}

export function installSkills(
  targetDir: string = process.cwd(),
  format: "agents" | "cursor" = "agents"
): { installed: InstalledSkill[]; totalCount: number; targetDir: string } {
  // Source skills directory
  let sourceSkillsDir = path.join(__dirname, "../../skills");
  if (!fs.existsSync(sourceSkillsDir)) {
    sourceSkillsDir = path.join(__dirname, "../skills");
  }

  const installed: InstalledSkill[] = [];
  const skillNames = ["algo-stress-testing", "repo-doctor", "db-architect", "security-auditor"];

  if (format === "agents") {
    const destBase = path.join(targetDir, ".agents", "skills");
    fs.mkdirSync(destBase, { recursive: true });

    for (const name of skillNames) {
      const srcFile = path.join(sourceSkillsDir, name, "SKILL.md");
      const destFolder = path.join(destBase, name);
      fs.mkdirSync(destFolder, { recursive: true });
      const destFile = path.join(destFolder, "SKILL.md");

      if (fs.existsSync(srcFile)) {
        fs.copyFileSync(srcFile, destFile);
        installed.push({ name, destination: path.relative(targetDir, destFile) });
      }
    }
  } else {
    // Cursor Rules format (.cursor/rules/)
    const destBase = path.join(targetDir, ".cursor", "rules");
    fs.mkdirSync(destBase, { recursive: true });

    for (const name of skillNames) {
      const srcFile = path.join(sourceSkillsDir, name, "SKILL.md");
      const destFile = path.join(destBase, `${name}.mdc`);

      if (fs.existsSync(srcFile)) {
        fs.copyFileSync(srcFile, destFile);
        installed.push({ name, destination: path.relative(targetDir, destFile) });
      }
    }
  }

  return {
    installed,
    totalCount: installed.length,
    targetDir,
  };
}
