#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { diagnoseProject, checkEnvSync, inspectPorts } from "./tools/doctor.js";
import { scanSecrets } from "./tools/security.js";
import { generateChangelog, checkPrReadiness, generatePrDescription } from "./tools/git.js";
import { testApiRequest, generateMockData } from "./tools/api.js";
import { checkBrokenLinks, extractCodeSnippets } from "./tools/docs.js";
import { findTodos, inspectHeavyDependencies } from "./tools/code.js";
import { runSandboxed, stressTest, checkPlagiarism, generateEdgeCases } from "./tools/algo.js";

const server = new Server(
  {
    name: "mcp-cs",
    version: "1.2.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // --- ⚡ AlgoJudge Competitive & Algorithm Engine ---
      {
        name: "algo_run_sandboxed",
        description: "Executes code in a sandboxed process with strict timeout and memory limits (supports python, javascript, typescript, cpp, c, go)",
        inputSchema: {
          type: "object",
          properties: {
            code: { type: "string", description: "Source code to execute" },
            language: { type: "string", enum: ["python", "javascript", "typescript", "cpp", "c", "go"], description: "Programming language" },
            stdin: { type: "string", description: "Standard input provided to the process" },
            timeoutMs: { type: "number", description: "Execution timeout in ms (default: 3000)" },
          },
          required: ["code"],
        },
      },
      {
        name: "algo_stress_test",
        description: "Automated differential tester: runs a fast solution against a brute-force baseline using randomized inputs until a failing edge case is found",
        inputSchema: {
          type: "object",
          properties: {
            solutionCode: { type: "string", description: "Fast algorithm to test" },
            bruteForceCode: { type: "string", description: "Slow but 100% correct reference algorithm" },
            generatorCode: { type: "string", description: "Random testcase generator code" },
            language: { type: "string", enum: ["python", "javascript"], description: "Language used (default: python)" },
            maxIterations: { type: "number", description: "Max randomized iterations to run (default: 30)" },
          },
          required: ["solutionCode", "bruteForceCode", "generatorCode"],
        },
      },
      {
        name: "algo_check_plagiarism",
        description: "Compares two code snippets using normalized token analysis and returns similarity percentage and plagiarism verdict",
        inputSchema: {
          type: "object",
          properties: {
            codeA: { type: "string", description: "First code snippet" },
            codeB: { type: "string", description: "Second code snippet" },
          },
          required: ["codeA", "codeB"],
        },
      },
      {
        name: "algo_generate_edge_cases",
        description: "Generates adversarial corner cases (min N=1, max constraints, identical items, extreme negatives, disconnected graphs)",
        inputSchema: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["array", "graph", "tree", "string", "numbers"], description: "Data structure type" },
            maxN: { type: "number", description: "Maximum constraint bound (e.g. 100000)" },
          },
        },
      },

      // --- 🩺 Diagnostics Suite ---
      {
        name: "doctor_diagnose_project",
        description: "Scans project structure, detects language/framework, missing dependencies, and setup issues",
        inputSchema: {
          type: "object",
          properties: {
            projectPath: { type: "string", description: "Absolute path to project root (defaults to cwd)" },
          },
        },
      },
      {
        name: "doctor_check_env",
        description: "Compares .env against .env.example and flags missing or extra environment keys",
        inputSchema: {
          type: "object",
          properties: {
            projectPath: { type: "string", description: "Absolute path to project root (defaults to cwd)" },
          },
        },
      },
      {
        name: "doctor_port_inspect",
        description: "Checks if specific network ports (e.g. 3000, 6379, 5432) are occupied and by which process PID",
        inputSchema: {
          type: "object",
          properties: {
            ports: {
              type: "array",
              items: { type: "number" },
              description: "Array of port numbers to check (e.g. [3000, 6379, 5432])",
            },
          },
          required: ["ports"],
        },
      },

      // --- 🛡️ Security Suite ---
      {
        name: "security_scan_secrets",
        description: "Scans repository text files for accidentally hardcoded API keys, JWTs, and private tokens",
        inputSchema: {
          type: "object",
          properties: {
            targetDir: { type: "string", description: "Target directory to scan (defaults to cwd)" },
          },
        },
      },

      // --- 🌐 API & Web Suite ---
      {
        name: "api_test_request",
        description: "Executes an HTTP request (GET, POST, PUT, DELETE, PATCH) and measures latency & formats response data",
        inputSchema: {
          type: "object",
          properties: {
            url: { type: "string", description: "Target URL (e.g. 'https://api.github.com/zen')" },
            method: { type: "string", enum: ["GET", "POST", "PUT", "DELETE", "PATCH"], description: "HTTP method" },
            headers: { type: "object", description: "Optional request headers as key-value pairs" },
            body: { type: "object", description: "Optional request body (for POST/PUT)" },
            timeoutMs: { type: "number", description: "Request timeout in milliseconds (default: 10000)" },
          },
          required: ["url"],
        },
      },
      {
        name: "api_generate_mock_data",
        description: "Generates realistic synthetic mock data (users, products, posts, transactions) for testing",
        inputSchema: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["users", "products", "posts", "transactions"], description: "Entity type" },
            count: { type: "number", description: "Number of mock items to generate (1-50)" },
          },
        },
      },

      // --- 📚 Documentation Suite ---
      {
        name: "docs_check_broken_links",
        description: "Scans all markdown files (.md, .mdx) in the project to detect broken internal links and dead file references",
        inputSchema: {
          type: "object",
          properties: {
            targetDir: { type: "string", description: "Directory to scan (defaults to cwd)" },
          },
        },
      },
      {
        name: "docs_extract_code_snippets",
        description: "Extracts all fenced code blocks from markdown documentation for quick inspection and review",
        inputSchema: {
          type: "object",
          properties: {
            targetDir: { type: "string", description: "Directory to scan (defaults to cwd)" },
          },
        },
      },

      // --- 🔍 Code Hygiene Suite ---
      {
        name: "code_find_todos",
        description: "Scans the codebase for TODO, FIXME, HACK, and BUG comments with line numbers and file paths",
        inputSchema: {
          type: "object",
          properties: {
            targetDir: { type: "string", description: "Directory to scan (defaults to cwd)" },
          },
        },
      },
      {
        name: "code_inspect_heavy_dependencies",
        description: "Inspects package.json to identify notoriously heavy dependencies (moment, lodash, monaco, katex) with optimization tips",
        inputSchema: {
          type: "object",
          properties: {
            projectPath: { type: "string", description: "Path to project root with package.json" },
          },
        },
      },

      // --- 🚀 Git & Release Suite ---
      {
        name: "git_generate_changelog",
        description: "Parses conventional git commit history between tags and outputs a clean markdown changelog",
        inputSchema: {
          type: "object",
          properties: {
            fromTag: { type: "string", description: "Starting git commit or tag (e.g. 'v1.0.0')" },
            toTag: { type: "string", description: "Ending git commit or tag (defaults to 'HEAD')" },
          },
        },
      },
      {
        name: "git_pr_readiness_check",
        description: "Verifies uncommitted files, unpushed commits, and branch health before opening a Pull Request",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "git_generate_pr_description",
        description: "Generates a structured markdown Pull Request description summarizing branch commits and diffs",
        inputSchema: {
          type: "object",
          properties: {
            targetBranch: { type: "string", description: "Target merge branch (default: 'main')" },
          },
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    // ⚡ AlgoJudge Suite
    if (name === "algo_run_sandboxed") {
      const res = runSandboxed(
        args?.code as string,
        (args?.language as "python" | "javascript" | "typescript" | "cpp" | "c" | "go") || "python",
        (args?.stdin as string) || "",
        (args?.timeoutMs as number) || 3000
      );
      return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
    }
    if (name === "algo_stress_test") {
      const res = stressTest(
        args?.solutionCode as string,
        args?.bruteForceCode as string,
        args?.generatorCode as string,
        (args?.language as "python" | "javascript") || "python",
        (args?.maxIterations as number) || 30
      );
      return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
    }
    if (name === "algo_check_plagiarism") {
      const res = checkPlagiarism(args?.codeA as string, args?.codeB as string);
      return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
    }
    if (name === "algo_generate_edge_cases") {
      const res = generateEdgeCases(
        (args?.type as "array" | "graph" | "tree" | "string" | "numbers") || "array",
        (args?.maxN as number) || 100000
      );
      return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
    }

    // 🩺 Doctor
    if (name === "doctor_diagnose_project") {
      const report = diagnoseProject((args?.projectPath as string) || process.cwd());
      return { content: [{ type: "text", text: JSON.stringify(report, null, 2) }] };
    }
    if (name === "doctor_check_env") {
      const diff = checkEnvSync((args?.projectPath as string) || process.cwd());
      return { content: [{ type: "text", text: JSON.stringify(diff, null, 2) }] };
    }
    if (name === "doctor_port_inspect") {
      const ports = (args?.ports as number[]) || [3000, 6379, 5432];
      const results = inspectPorts(ports);
      return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
    }

    // 🛡️ Security
    if (name === "security_scan_secrets") {
      const findings = scanSecrets((args?.targetDir as string) || process.cwd());
      return { content: [{ type: "text", text: JSON.stringify(findings, null, 2) }] };
    }

    // 🌐 API
    if (name === "api_test_request") {
      const response = await testApiRequest(
        args?.url as string,
        (args?.method as "GET" | "POST" | "PUT" | "DELETE" | "PATCH") || "GET",
        (args?.headers as Record<string, string>) || {},
        args?.body as string | Record<string, unknown> | undefined,
        (args?.timeoutMs as number) || 10000
      );
      return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
    }
    if (name === "api_generate_mock_data") {
      const data = generateMockData(
        (args?.type as "users" | "products" | "posts" | "transactions") || "users",
        (args?.count as number) || 5
      );
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }

    // 📚 Docs
    if (name === "docs_check_broken_links") {
      const findings = checkBrokenLinks((args?.targetDir as string) || process.cwd());
      return { content: [{ type: "text", text: JSON.stringify(findings, null, 2) }] };
    }
    if (name === "docs_extract_code_snippets") {
      const snippets = extractCodeSnippets((args?.targetDir as string) || process.cwd());
      return { content: [{ type: "text", text: JSON.stringify(snippets, null, 2) }] };
    }

    // 🔍 Code
    if (name === "code_find_todos") {
      const todos = findTodos((args?.targetDir as string) || process.cwd());
      return { content: [{ type: "text", text: JSON.stringify(todos, null, 2) }] };
    }
    if (name === "code_inspect_heavy_dependencies") {
      const result = inspectHeavyDependencies((args?.projectPath as string) || process.cwd());
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }

    // 🚀 Git
    if (name === "git_generate_changelog") {
      const changelog = generateChangelog(args?.fromTag as string | undefined, (args?.toTag as string) || "HEAD");
      return { content: [{ type: "text", text: changelog }] };
    }
    if (name === "git_pr_readiness_check") {
      const status = checkPrReadiness();
      return { content: [{ type: "text", text: JSON.stringify(status, null, 2) }] };
    }
    if (name === "git_generate_pr_description") {
      const prDesc = generatePrDescription((args?.targetBranch as string) || "main");
      return { content: [{ type: "text", text: prDesc }] };
    }

    throw new Error(`Tool not found: ${name}`);
  } catch (error: unknown) {
    return {
      isError: true,
      content: [{ type: "text", text: `Error executing ${name}: ${error instanceof Error ? error.message : String(error)}` }],
    };
  }
});

async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

run().catch((error) => {
  console.error("Fatal MCP Server Error:", error);
  process.exit(1);
});
