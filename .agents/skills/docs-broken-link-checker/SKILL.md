---
name: docs-broken-link-checker
description: Activate when refactoring documentation, moving markdown files, releasing wiki articles, or preparing open-source READMEs to detect dead internal links, broken file anchors, and missing asset paths — trigger phrasings include "check broken links in docs", "verify all markdown links", "are any image links broken in README", "audit documentation paths", "fix broken relative links", or "scan markdown files for 404s". Uses MCS docs_check_broken_links and docs_auto_fix_links to validate internal file references.
version: 1.0.0
author: IEEE Computer Society of SLIIT
tags: [docs-checker, broken-links, markdown-audit, documentation-hygiene, dead-links, readme-validator]
---

# Documentation & Markdown Broken Link Checker Runbook

## Mission

Maintain pristine documentation integrity across repositories, wikis, and open-source packages. When files are moved or refactored, relative links like `[Guide](./docs/guide.md)` or `<img src="./assets/banner.png">` frequently break, leading to frustrating 404 errors for users and contributors. This skill scans all `.md` and `.mdx` files, resolves target file paths, validates anchor headings (`#section-name`), and automatically rewrites moved paths.

---

## Step-by-Step Validation Protocol

### Phase 1: Markdown Link Extraction
1. Discover all `.md` and `.mdx` files across the repository.
2. Extract all markdown link tokens:
   - Relative File Links: `[Text](./docs/setup.md)`
   - Anchor Links: `[Section](#step-2-installation)`
   - Asset References: `![Image](./assets/logo.png)`

### Phase 2: Path Resolution & Broken Link Detection
1. Call `docs_check_broken_links` on the target directory.
2. Resolve each link against the local filesystem relative to the containing document.
3. Validate anchor headings by converting markdown `# Heading Name` to slugified anchor IDs (`#heading-name`).

### Phase 3: Automated Link Repair
1. Preview fixes using `docs_auto_fix_links` with `dryRun: true`.
2. Apply real path updates (`dryRun: false`) when target files have moved to new folders.

---

## Quality Gate Checklist

- [ ] **100% Valid Internal Links**: No broken relative paths in `README.md` or `docs/`.
- [ ] **All Image Assets Loadable**: All referenced PNG/JPG/SVG assets exist on disk.
- [ ] **Anchor Slugs Matched**: Heading anchors correctly follow GitHub/CommonMark slugification rules.
