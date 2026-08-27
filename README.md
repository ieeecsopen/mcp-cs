# ⚡ MCP-CS (`mcp-cs`) v1.2.0
### IEEE Computer Society Universal Developer, Repo Operations & AlgoJudge Competitive Execution MCP Server

An open-source, full-fledged **Model Context Protocol (MCP)** server providing automated project diagnostics, live sandboxed code execution, differential stress-testing, AST plagiarism detection, secret scanning, live HTTP API testing, and git workflows for AI assistants (**Antigravity, Cursor, Claude Desktop, Windsurf**).

---

## 🌟 17 Production Tools Included

| Category | Tool | What It Does |
| :--- | :--- | :--- |
| ⚡ **AlgoJudge Engine** | `algo_run_sandboxed` | Executes code in Python, JS, TS, C++, C, or Go in an isolated process with strict time & memory limits. |
| ⚡ **AlgoJudge Engine** | `algo_stress_test` | **Automated Differential Tester:** Compares an optimal algorithm against a brute-force baseline on randomized inputs to find failing edge cases. |
| ⚡ **AlgoJudge Engine** | `algo_check_plagiarism` | Analyzes code similarity percentage and flags suspicious duplicated logic using AST tokenization. |
| ⚡ **AlgoJudge Engine** | `algo_generate_edge_cases` | Generates adversarial corner cases (min N=1, max bounds, identical items, extreme negatives, disconnected graphs). |
| 🩺 **Diagnostics** | `doctor_diagnose_project` | Auto-detects runtime (Node, Next.js, Python, Docker), missing `node_modules`, missing `.env`, and unconfigured virtual environments. |
| 🩺 **Diagnostics** | `doctor_check_env` | Diffs `.env` against `.env.example` to detect missing or surplus keys. |
| 🩺 **Diagnostics** | `doctor_port_inspect` | Identifies which background processes and PIDs are locking ports (`3000`, `6379`, `5432`). |
| 🛡️ **Security** | `security_scan_secrets` | Scans codebase for leaked OpenAI keys, AWS access tokens, GitHub PATs, and private keys. |
| 🌐 **API & Web** | `api_test_request` | Executes live HTTP calls (`GET`, `POST`, `PUT`, `DELETE`) with headers, auth, and query params — measures latency (TTFB) and formats JSON. |
| 🌐 **API & Web** | `api_generate_mock_data` | Generates realistic synthetic mock datasets (`users`, `products`, `posts`, `transactions`) for frontend and backend testing. |
| 📚 **Docs** | `docs_check_broken_links` | Scans all markdown files (`.md`, `.mdx`) to detect broken internal links and dead file references. |
| 📚 **Docs** | `docs_extract_code_snippets` | Extracts all fenced code blocks from markdown documentation for quick inspection and review. |
| 🔍 **Code Hygiene** | `code_find_todos` | Scans the codebase for `TODO`, `FIXME`, `HACK`, and `BUG` comments with line numbers and file paths. |
| 🔍 **Code Hygiene** | `code_inspect_heavy_dependencies` | Inspects `package.json` to identify bloated dependencies (moment, lodash, monaco, katex) with optimization tips. |
| 🚀 **Git & Release** | `git_generate_changelog` | Parses conventional git commit history between tags and outputs a clean markdown changelog. |
| 🚀 **Git & Release** | `git_pr_readiness_check` | Verifies uncommitted files, unpushed commits, and branch health before opening a Pull Request. |
| 🚀 **Git & Release** | `git_generate_pr_description` | Generates a structured markdown Pull Request description summarizing branch commits and diffs. |

---

## 🚀 Quickstart

Run directly via `npx` with any AI IDE:

```json
{
  "mcpServers": {
    "mcp-cs": {
      "command": "npx",
      "args": ["-y", "mcp-cs"]
    }
  }
}
```

---

## 📄 License
MIT © IEEE Computer Society of SLIIT
