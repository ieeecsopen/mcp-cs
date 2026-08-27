# ⚡ MCP-CS (`mcp-cs`) v2.0.0
### IEEE Computer Society Universal Developer, Repo Operations & AlgoJudge Competitive Execution MCP Server

An open-source, full-featured **Model Context Protocol (MCP)** server providing automated project diagnostics, database ERD generation, web performance audits, competitive problem fetching, live sandboxed code execution, differential stress-testing, and git release workflows for AI assistants (**Antigravity, Cursor, Claude Desktop, Windsurf**).

---

## 🌟 24 Production Tools Included

| Category | Tool | What It Does |
| :--- | :--- | :--- |
| 🗄️ **Database & ERD** | `db_generate_erd` | Parses SQL schema and automatically generates a clean Mermaid ER Diagram. |
| ⚡ **Web Performance** | `perf_audit_assets` | Scans repository for uncompressed raster images (>250KB) and calculates bandwidth savings from WebP/AVIF conversion. |
| ⚡ **Web Performance** | `perf_check_headers` | Audits HTTP response headers of a web app for Gzip/Brotli compression, Cache-Control, and security headers. |
| 🏆 **Contest Importer** | `problem_fetch_codeforces` | Fetches problem statements, sample inputs/outputs, tags, and contest limits from Codeforces. |
| 🤖 **CI/CD Automation** | `ci_generate_workflow` | Generates bulletproof GitHub Actions CI/CD workflows for Next.js, NPM Publishing, Docker, or Python. |
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

## 🧩 MCP Prompts & Resources

### Prompts (Slash Commands)
- `/diagnose-repo`: Runs automated doctor diagnostics and environment checks.
- `/stress-test-solution`: Interactive algorithm stress-testing assistant.
- `/prepare-pr`: Automated pre-flight PR verification and description generator.

### Resources (Live Dynamic Context)
- `resource://system/ports`: Live socket inspector of common ports.
- `resource://git/status`: Real-time repository branch and sync state.

---

## 🚀 Quickstart

Run directly via `npx` in any AI IDE (Antigravity, Cursor, Claude Desktop, Windsurf):

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
