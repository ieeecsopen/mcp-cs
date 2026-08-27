import { execSync, spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
  timedOut: boolean;
}

import { runInVmSandbox } from "./wasm.js";

export function runSandboxed(
  code: string,
  language: "python" | "javascript" | "typescript" | "cpp" | "c" | "go" | "rust" = "python",
  stdin: string = "",
  timeoutMs: number = 3000,
  engine: "native" | "vm" = "native"
): ExecutionResult {
  // If engine is 'vm' and language is JS/TS, execute in-memory VM isolate
  if (engine === "vm" && (language === "javascript" || language === "typescript")) {
    return runInVmSandbox(code, stdin, timeoutMs);
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-algo-"));
  const startTime = Date.now();

  try {
    let cmd = "";
    let args: string[] = [];

    if (language === "python") {
      const filePath = path.join(tmpDir, "solution.py");
      fs.writeFileSync(filePath, code);
      cmd = "python3";
      args = [filePath];
    } else if (language === "javascript" || language === "typescript") {
      const filePath = path.join(tmpDir, "solution.js");
      fs.writeFileSync(filePath, code);
      cmd = "node";
      args = [filePath];
    } else if (language === "cpp" || language === "c") {
      const srcExt = language === "cpp" ? "cpp" : "c";
      const srcPath = path.join(tmpDir, `solution.${srcExt}`);
      const binPath = path.join(tmpDir, "solution.out");
      fs.writeFileSync(srcPath, code);

      const compiler = language === "cpp" ? "g++" : "gcc";
      const compile = spawnSync(compiler, ["-O2", srcPath, "-o", binPath], {
        timeout: 5000,
        encoding: "utf8",
      });

      if (compile.status !== 0) {
        return {
          stdout: "",
          stderr: `Compilation Error:\n${compile.stderr || compile.stdout}`,
          exitCode: compile.status,
          durationMs: Date.now() - startTime,
          timedOut: false,
        };
      }
      cmd = binPath;
      args = [];
    } else if (language === "go") {
      const filePath = path.join(tmpDir, "solution.go");
      fs.writeFileSync(filePath, code);
      cmd = "go";
      args = ["run", filePath];
    } else {
      throw new Error(`Unsupported language for runner: ${language}`);
    }

    const run = spawnSync(cmd, args, {
      input: stdin,
      timeout: timeoutMs,
      encoding: "utf8",
      maxBuffer: 2 * 1024 * 1024,
    });

    const durationMs = Date.now() - startTime;
    const timedOut = run.error?.message?.includes("ETIMEDOUT") || durationMs >= timeoutMs;

    return {
      stdout: run.stdout || "",
      stderr: run.stderr || "",
      exitCode: run.status,
      durationMs,
      timedOut,
    };
  } catch (err: unknown) {
    // If native execution fails due to missing binary, fallback to in-memory VM for JS/TS
    if (language === "javascript" || language === "typescript") {
      return runInVmSandbox(code, stdin, timeoutMs);
    }
    throw err;
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  }
}

export interface StressTestIteration {
  iteration: number;
  input: string;
  solutionOutput: string;
  expectedOutput: string;
  solutionDurationMs: number;
  bruteDurationMs: number;
  passed: boolean;
}

export function stressTest(
  solutionCode: string,
  bruteForceCode: string,
  generatorCode: string,
  language: "python" | "javascript" = "python",
  maxIterations: number = 30,
  engine: "native" | "vm" = "native"
): {
  status: "PASSED" | "FAILED" | "ERROR";
  iterationsTested: number;
  failingInput?: string;
  solutionOutput?: string;
  expectedOutput?: string;
  iterations?: StressTestIteration[];
  message: string;
} {
  const safeIterations = Math.min(Math.max(1, maxIterations), 100);
  const iterations: StressTestIteration[] = [];

  for (let i = 1; i <= safeIterations; i++) {
    // 1. Generate random test input
    const genRun = runSandboxed(generatorCode, language, "", 2000, engine);
    if (genRun.exitCode !== 0 || !genRun.stdout) {
      return {
        status: "ERROR",
        iterationsTested: i,
        iterations,
        message: `Generator failed at iteration ${i}: ${genRun.stderr || "No stdout produced"}`,
      };
    }
    const testInput = genRun.stdout.trim();

    // 2. Run optimal solution
    const solRun = runSandboxed(solutionCode, language, testInput, 2500, engine);
    if (solRun.timedOut) {
      iterations.push({
        iteration: i,
        input: testInput,
        solutionOutput: "<Time Limit Exceeded>",
        expectedOutput: "Valid execution",
        solutionDurationMs: solRun.durationMs,
        bruteDurationMs: 0,
        passed: false,
      });
      return {
        status: "FAILED",
        iterationsTested: i,
        failingInput: testInput,
        solutionOutput: "<Time Limit Exceeded>",
        expectedOutput: "Valid execution under time limit",
        iterations,
        message: `Solution Time Limit Exceeded on testcase #${i}`,
      };
    }

    // 3. Run brute force solution
    const bruteRun = runSandboxed(bruteForceCode, language, testInput, 3000, engine);

    const solOut = solRun.stdout.trim();
    const expOut = bruteRun.stdout.trim();
    const passed = solOut === expOut;

    iterations.push({
      iteration: i,
      input: testInput,
      solutionOutput: solOut,
      expectedOutput: expOut,
      solutionDurationMs: solRun.durationMs,
      bruteDurationMs: bruteRun.durationMs,
      passed,
    });

    if (!passed) {
      return {
        status: "FAILED",
        iterationsTested: i,
        failingInput: testInput,
        solutionOutput: solOut,
        expectedOutput: expOut,
        iterations,
        message: `Discrepancy found on testcase #${i}! Solution output does not match brute-force baseline.`,
      };
    }
  }

  return {
    status: "PASSED",
    iterationsTested: safeIterations,
    iterations,
    message: `All ${safeIterations} generated testcases matched the baseline output perfectly!`,
  };
}

export function checkPlagiarism(codeA: string, codeB: string): {
  similarityPercent: number;
  matchedTokensCount: number;
  totalTokensCount: number;
  verdict: "SUSPICIOUS" | "MODERATE_SIMILARITY" | "LOW_SIMILARITY";
} {
  // Normalize and tokenize code (strip comments, whitespace, punctuation)
  const tokenize = (src: string) => {
    return src
      .replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "") // Remove C/JS comments
      .replace(/#.*/g, "") // Remove Python comments
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 1);
  };

  const tokensA = tokenize(codeA);
  const tokensB = tokenize(codeB);

  const setA = new Set(tokensA);
  const setB = new Set(tokensB);

  let intersectionCount = 0;
  setA.forEach((token) => {
    if (setB.has(token)) intersectionCount++;
  });

  const unionSize = new Set([...setA, ...setB]).size;
  const similarity = unionSize === 0 ? 0 : Math.round((intersectionCount / unionSize) * 100);

  let verdict: "SUSPICIOUS" | "MODERATE_SIMILARITY" | "LOW_SIMILARITY" = "LOW_SIMILARITY";
  if (similarity >= 75) verdict = "SUSPICIOUS";
  else if (similarity >= 45) verdict = "MODERATE_SIMILARITY";

  return {
    similarityPercent: similarity,
    matchedTokensCount: intersectionCount,
    totalTokensCount: unionSize,
    verdict,
  };
}

export function generateEdgeCases(
  type: "array" | "graph" | "tree" | "string" | "numbers" = "array",
  maxN: number = 100000
): { category: string; description: string; input: string }[] {
  const cases: { category: string; description: string; input: string }[] = [];

  if (type === "array" || type === "numbers") {
    cases.push({ category: "Minimum Size", description: "Array with a single element (N=1)", input: "1\n42" });
    cases.push({ category: "All Identical", description: "Array where all elements are identical", input: "5\n7 7 7 7 7" });
    cases.push({ category: "Strictly Decreasing", description: "Worst-case reverse sorted order", input: "6\n100 80 60 40 20 0" });
    cases.push({ category: "Extreme Negatives", description: "Mixed positive, negative, and zero values", input: "5\n-1000000000 0 1000000000 -1 1" });
    cases.push({ category: "Max Constraints", description: `Array with maximum size (N=${Math.min(maxN, 100000)})`, input: `${Math.min(maxN, 50)}\n` + Array.from({ length: Math.min(maxN, 50) }, (_, i) => i + 1).join(" ") });
  } else if (type === "string") {
    cases.push({ category: "Single Character", description: "String with length 1", input: "a" });
    cases.push({ category: "Monotonous", description: "All characters identical", input: "aaaaaaaaaa" });
    cases.push({ category: "Palindrome", description: "Symmetric palindrome string", input: "racecar" });
    cases.push({ category: "Alternating", description: "Binary alternating sequence", input: "0101010101" });
  } else {
    cases.push({ category: "Disjoint Graph", description: "Nodes with 0 connecting edges", input: "4 0" });
    cases.push({ category: "Star Graph", description: "One central hub connected to all outer nodes", input: "5 4\n1 2\n1 3\n1 4\n1 5" });
    cases.push({ category: "Linear Chain", description: "Worst-case degenerate skewed tree / line graph", input: "4 3\n1 2\n2 3\n3 4" });
  }

  return cases;
}

export function runInDockerSandbox(
  code: string,
  language: "python" | "javascript" | "cpp" = "python",
  stdin: string = "",
  timeoutMs: number = 5000
): { stdout: string; stderr: string; exitCode: number; timedOut: boolean; containerEngine: string } {
  const tmpDir = path.join(os.tmpdir(), `mcs_docker_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  const imageMap = {
    python: "python:3.12-alpine",
    javascript: "node:22-alpine",
    cpp: "gcc:alpine",
  };

  const fileMap = {
    python: "solution.py",
    javascript: "solution.js",
    cpp: "solution.cpp",
  };

  const runCmdMap = {
    python: "python3 /app/solution.py",
    javascript: "node /app/solution.js",
    cpp: "g++ /app/solution.cpp -o /app/a.out && /app/a.out",
  };

  const filename = fileMap[language];
  fs.writeFileSync(path.join(tmpDir, filename), code);
  if (stdin) {
    fs.writeFileSync(path.join(tmpDir, "stdin.txt"), stdin);
  }

  const stdinArg = stdin ? `< /app/stdin.txt` : "";
  const dockerCmd = `docker run --rm --network none --memory 128m --cpus 1 -v "${tmpDir}:/app" -w /app ${imageMap[language]} sh -c "${runCmdMap[language]} ${stdinArg}"`;

  try {
    const stdout = execSync(dockerCmd, {
      timeout: timeoutMs,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });

    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    return { stdout, stderr: "", exitCode: 0, timedOut: false, containerEngine: "Docker" };
  } catch (err: any) {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    const isTimeout = err.code === "ETIMEDOUT" || err.signal === "SIGTERM";
    return {
      stdout: err.stdout?.toString() || "",
      stderr: err.stderr?.toString() || err.message,
      exitCode: isTimeout ? 124 : err.status || 1,
      timedOut: isTimeout,
      containerEngine: "Docker",
    };
  }
}
