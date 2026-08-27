# Contributing to MCP-CS

Thank you for your interest in contributing to **MCP-CS**! This project is maintained by the **IEEE Computer Society of SLIIT** and the global open-source community.

---

## 🚀 Quickstart for Contributors

### 1. Prerequisites
- **Node.js**: `>= 20.0.0`
- **npm**: `>= 10.0.0`
- **Git**

### 2. Setup
```bash
# Fork & Clone repository
git clone https://github.com/YOUR_USERNAME/mcp-cs.git
cd mcp-cs

# Install dependencies
npm install

# Run automated tests
npm test

# Build TypeScript
npm run build

# Start visual UI console
npm run dev -- --ui
```

---

## 🛠️ Adding a New MCP Tool

1. Create a new tool file in `src/tools/<category>.ts` (e.g. `src/tools/network.ts`).
2. Export your pure TypeScript function and types.
3. Write automated unit tests in `test/<category>.test.ts`.
4. Register the tool schema and handler in `src/index.ts`.
5. Run `npm test` and `npm run build` to verify 0 errors.

---

## 📝 Commit Conventions

We enforce [Conventional Commits](https://www.conventionalcommits.org/):

- `feat(category): add new capability` (e.g. `feat(algo): add CSES problem parser`)
- `fix(category): resolve bug` (e.g. `fix(doctor): fix Windows PID extraction`)
- `docs: update documentation`
- `style: format and CSS improvements`
- `test: add unit tests`
- `ci: update workflows`

---

## 🧪 Testing Guidelines

Every new tool or bugfix must be accompanied by unit tests in `test/`:
```bash
npm test
```
All pull requests must pass 100% of automated Vitest and CodeQL quality gates before merging.

---

## 📄 Pull Request Checklist
- [ ] Code follows TypeScript strict typing guidelines.
- [ ] Unit tests added for all new functions.
- [ ] `npm test` passes with 0 failures.
- [ ] `npm run build` succeeds with 0 type errors.
- [ ] `README.md` updated if adding new tools or features.

Thank you for building the future of AI developer tools with IEEE CS!
