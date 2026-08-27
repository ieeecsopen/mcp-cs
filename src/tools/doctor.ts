import fs from "fs";
import path from "path";
import { execSync } from "child_process";

export interface DoctorReport {
  projectPath: string;
  projectType: string[];
  issues: string[];
  recommendations: string[];
}

export function diagnoseProject(projectPath: string = process.cwd()): DoctorReport {
  const issues: string[] = [];
  const recommendations: string[] = [];
  const projectType: string[] = [];

  const pkgJsonPath = path.join(projectPath, "package.json");
  if (fs.existsSync(pkgJsonPath)) {
    projectType.push("Node.js / JavaScript / TypeScript");
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
      if (!fs.existsSync(path.join(projectPath, "node_modules"))) {
        issues.push("`node_modules` directory is missing. Dependencies are not installed.");
        recommendations.push("Run `npm install` or `pnpm install` / `yarn install`.");
      }
      if (pkg.dependencies?.next) projectType.push("Next.js");
      if (pkg.dependencies?.react) projectType.push("React");
    } catch {
      issues.push("`package.json` contains malformed JSON.");
    }
  }

  const pyprojectPath = path.join(projectPath, "pyproject.toml");
  const reqPath = path.join(projectPath, "requirements.txt");
  if (fs.existsSync(pyprojectPath) || fs.existsSync(reqPath)) {
    projectType.push("Python");
    if (!fs.existsSync(path.join(projectPath, ".venv")) && !fs.existsSync(path.join(projectPath, "venv"))) {
      issues.push("No local virtualenv (`.venv` / `venv`) detected.");
      recommendations.push("Create a virtualenv with `python3 -m venv .venv` and activate it.");
    }
  }

  const dockerComposePath = path.join(projectPath, "docker-compose.yml");
  if (fs.existsSync(dockerComposePath)) {
    projectType.push("Docker Compose");
  }

  const envPath = path.join(projectPath, ".env");
  const envExamplePath = path.join(projectPath, ".env.example");
  if (fs.existsSync(envExamplePath) && !fs.existsSync(envPath)) {
    issues.push("`.env.example` exists but `.env` is missing.");
    recommendations.push("Copy `.env.example` to `.env` and fill in secrets.");
  }

  return {
    projectPath,
    projectType: projectType.length > 0 ? projectType : ["Generic / Unknown"],
    issues,
    recommendations,
  };
}

export function checkEnvSync(projectPath: string = process.cwd()): { missingKeys: string[]; extraKeys: string[] } {
  const envPath = path.join(projectPath, ".env");
  const envExamplePath = path.join(projectPath, ".env.example");

  if (!fs.existsSync(envExamplePath)) {
    return { missingKeys: [], extraKeys: [] };
  }

  const parseKeys = (filePath: string) => {
    if (!fs.existsSync(filePath)) return new Set<string>();
    const content = fs.readFileSync(filePath, "utf8");
    return new Set(
      content
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#") && line.includes("="))
        .map((line) => line.split("=")[0].trim())
    );
  };

  const exampleKeys = parseKeys(envExamplePath);
  const actualKeys = parseKeys(envPath);

  const missingKeys = [...exampleKeys].filter((key) => !actualKeys.has(key));
  const extraKeys = [...actualKeys].filter((key) => !exampleKeys.has(key));

  return { missingKeys, extraKeys };
}

export function inspectPorts(ports: number[]): Array<{ port: number; inUse: boolean; process?: string }> {
  return ports.map((port) => {
    try {
      const output = execSync(`lsof -i :${port} -sTCP:LISTEN -Fpc`, { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] });
      const lines = output.split("\n");
      const pidLine = lines.find((l) => l.startsWith("p"));
      const cmdLine = lines.find((l) => l.startsWith("c"));
      const processInfo = pidLine && cmdLine ? `${cmdLine.slice(1)} (PID ${pidLine.slice(1)})` : "Active";
      return { port, inUse: true, process: processInfo };
    } catch {
      return { port, inUse: false };
    }
  });
}
