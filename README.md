<div align="center">

# ⚡ MCP-CS (`mcp-cs`)
### The Universal Developer Operations, Diagnostics & AlgoJudge Competitive Platform

[![npm version](https://img.shields.io/npm/v/mcp-cs.svg?color=ffd000&label=npm%20package)](https://www.npmjs.com/package/mcp-cs)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20.0.0-black.svg)](https://nodejs.org)
[![MCP](https://img.shields.io/badge/protocol-Model%20Context%20Protocol-black)](https://modelcontextprotocol.io)
[![Organization](https://img.shields.io/badge/IEEE%20CS-SLIIT-blue)](https://github.com/ieeecsopen)

**An industry-grade [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server & developer console created by the IEEE Computer Society Student Branch.**

[Visual Dashboard](#-1-interactive-local-visual-dashboard) • [Installation & Homebrew](#-installation-guide) • [Dual-Mode Transport](#-dual-mode-transport-stdio--cloud-sse) • [WASM Sandboxes](#-in-process-wasm-sandbox-engine) • [Tool Catalog](#-flagship-tool-catalog) • [Contributing](#-local-development)

</div>

---

## 🌟 Flagship Highlights

```
                       ┌────────────────────────────────────────────────────────┐
                       │               mcp-cs Advanced Platform                 │
                       └───────────────────────────┬────────────────────────────┘
          ┌──────────────────────┬─────────────────┴──────────────┬──────────────────────┐
          ▼                      ▼                                ▼                      ▼
   1. Visual Dashboard    2. WASM Sandboxes               3. Cloud SSE Engine    4. AST Code Fixers
  (`npx mcp-cs --ui`)   (Zero Local Compiler)           (Remote Multi-Tenant)  (Auto-Sanitize Secrets)
```

- 🖥️ **Interactive Visual Dashboard (`npx mcp-cs --ui`)**: Live ERD viewer with zoom/pan and SVG/PNG export, side-by-side differential stress-test visualizer, and live localhost port/process heatmap with 1-click process termination.
- ⚡ **In-Process WASM & VM Sandboxes**: Sub-millisecond JS/TS and raw `.wasm` WebAssembly module execution without requiring local `g++`, `python3`, or `go` compiler toolchains.
- 🌐 **Dual-Mode Transport (Stdio + Cloud Hosted SSE)**: Use standard local stdio in Cursor/Claude or connect directly over remote HTTP/SSE (`https://mcp.ieeecs-sliit.org/sse`).
- 🧩 **Automated AST Code Fixers**: Automatically sanitize exposed secrets into `process.env.*` variables with `.env.example` generation, and repair broken documentation markdown links.
- 📦 **Homebrew Distribution**: Easy 1-line installation with `brew install ieeecsopen/tap/mcp-cs`.

---

## 🖥️ 1. Interactive Local Visual Dashboard

Launch the embedded web console instantly in your browser:

```bash
npx mcp-cs --ui
```

### Dashboard Capabilities
1. **Visual Database ERD Viewer**: Live interactive rendering of SQL DDL schema into Mermaid ERD with zoom/pan controls and instant 1-click export to PNG and SVG.
2. **Stress-Test Visualizer**: Side-by-side output diff viewer comparing optimal vs brute-force logic, execution time comparison charts, and adversarial input inspector.
3. **Port & Process Heatmap**: Live localhost inspection (ports `3000`, `5173`, `8000`, `8080`, etc.), showing active process names, PIDs, and a 1-click **Kill Process** button.

---

## 📦 Installation Guide

### Method 1: Homebrew (macOS & Linux)
```bash
brew tap ieeecsopen/tap
brew install mcp-cs
```

### Method 2: Instant Run via `npx` *(Zero Installation)*
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

### Method 3: Global NPM Installation
```bash
npm install -g mcp-cs
```

---

## 🌐 Dual-Mode Transport (Stdio + Cloud SSE)

### Local Stdio Mode (Default)
Standard Stdio transport for local AI assistants (Claude Desktop, Cursor, Antigravity, Windsurf):
```bash
mcp-cs
```

### Cloud-Hosted SSE Mode
Run as a multi-tenant remote server accessible over HTTP / Server-Sent Events (SSE):
```bash
mcp-cs --sse --port 8080
```
- **SSE Stream**: `http://localhost:8080/sse`
- **Messages Endpoint**: `http://localhost:8080/messages`
- **Healthcheck**: `http://localhost:8080/health`

---

## 🛠️ Flagship Tool Catalog

### ⚡ AlgoJudge & WASM Execution
| Tool | Description |
|------|-------------|
| `algo_run_sandboxed` | Runs code in a sandboxed process with strict timeout and memory limits (Python, JS, TS, C++, C, Go) |
| `algo_run_wasm` | In-process WebAssembly binary evaluator supporting raw `.wasm` modules with sub-millisecond execution |
| `algo_stress_test` | Differential tester: executes optimal vs brute-force baseline on randomized testcases to catch corner-case bugs |
| `algo_check_plagiarism` | Token-normalized code similarity detector with plagiarism risk scoring |
| `algo_generate_edge_cases` | Generates adversarial edge-cases (N=1, max bounds, identical items, extreme negatives, disconnected graphs) |

### 🗄️ Database & Schemas
| Tool | Description |
|------|-------------|
| `db_generate_erd` | Parses SQL table DDL and generates an interactive Mermaid Entity-Relationship Diagram |

### 🛡️ Security & AST Fixers
| Tool | Description |
|------|-------------|
| `security_scan_secrets` | Scans repository for leaked API keys, tokens, and hardcoded private credentials |
| `security_auto_sanitize_secrets` | **Automated Fixer**: Replaces detected secrets with `process.env` references and updates `.env.example` |

### 📚 Documentation & Fixers
| Tool | Description |
|------|-------------|
| `docs_check_broken_links` | Scans markdown files for broken relative links and dead document references |
| `docs_auto_fix_links` | **Automated Fixer**: Automatically corrects broken relative links and generates missing doc stubs |
| `docs_extract_code_snippets` | Extracts all fenced code blocks from markdown documentation for quick inspection |

### 🩺 Diagnostics & Health
| Tool | Description |
|------|-------------|
| `doctor_diagnose_project` | Scans project structure, identifies language/framework, and flags missing dependencies |
| `doctor_check_env` | Compares `.env` against `.env.example` and flags missing or extraneous variables |
| `doctor_port_inspect` | Inspects occupied network ports and reports active process PIDs |

### 🚀 Git, Release & CI
| Tool | Description |
|------|-------------|
| `git_generate_changelog` | Generates structured markdown changelog from conventional git commits |
| `git_pr_readiness_check` | Validates uncommitted files, unpushed commits, and branch health before opening a PR |
| `git_generate_pr_description` | Auto-generates a Pull Request title and structured description |
| `ci_generate_workflow` | Generates production GitHub Actions CI/CD workflows for Next.js, Node, Docker, and Python |

---

## 💻 Local Development

```bash
# Clone the repository
git clone https://github.com/ieeecsopen/mcp-cs.git
cd mcp-cs

# Install dependencies
npm install

# Run Vitest test suite
npm test

# Build production distribution
npm run build

# Launch interactive UI
npm run dev -- --ui
```

---

<div align="center">
  <b>Maintained with ❤️ by IEEE Computer Society Student Branch of SLIIT</b>
</div>
