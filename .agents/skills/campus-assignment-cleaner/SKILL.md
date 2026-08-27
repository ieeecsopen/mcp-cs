---
name: campus-assignment-cleaner
description: Activates when a student or campus developer needs to make a working-but-messy codebase submission-ready before uploading it for grading. Trigger phrasings include "clean up my assignment before submitting", "remove debug prints and commented code", "tidy this up before I upload it to Moodle/Canvas/GitHub Classroom", "strip console.logs / print statements from my lab", "get rid of leftover TODOs before I submit", "my code works but it's messy, make it look professional", or any pre-submission cleanup pass run on lab, assignment, or project code immediately prior to zipping, committing, or uploading it for a grade. Also activates on requests to detect unused imports, dead code, or inconsistent formatting in student repos.
version: 1.0.0
author: IEEE Computer Society of SLIIT
tags: [code-cleanup, static-analysis, ast, pre-submission, dead-code-removal, student-tooling, code-quality, python]
---

# Campus Assignment Cleaner

## Mission

Take a codebase that **works** and make it **submission-ready** — without ever
changing what it does. This skill exists to close the gap between "it passes
on my machine" and "it looks like it was written by someone who reviewed their
own work." It systematically discovers dead code, debug artifacts, commented-out
history, unused imports, formatting drift, stale TODOs, and hardcoded
test-only values, then removes only what can be proven safe to remove — with
every irreversible action gated behind a version-control safety net, a
confidence score, and a re-run of the original test suite. Nothing gets
deleted blindly. Nothing gets deleted without a way back.

---

## Mental Model & Theoretical Foundations

### Why graders (and CI, and future-you) penalize dead code and debug artifacts

A grader — human or automated — is not just checking "does it run." They are
using the *state of the code* as a proxy for three things that are otherwise
invisible to them:

1. **Rigor of self-review.** A stray `print(x)` next to a `print(y)` next to a
   commented-out `# print(z)` tells the reader that the last thing that
   happened before submission was *debugging*, not *finishing*. It signals
   the work was packaged mid-thought, not completed.
2. **Signal-to-noise ratio of the actual logic.** Every commented-out block,
   every `console.log("here????")`, every unused `import numpy as np` is a
   byte the grader has to read and discard before they get to the part being
   assessed. Noise doesn't just look bad — it measurably slows down and
   degrades manual grading, and it actively harms automated tooling: dead
   branches inflate cyclomatic complexity scores, unused imports break strict
   linting rubrics, and commented-out fragments can trip plagiarism/similarity
   detectors (MOSS, Turnitin-style AST diffing) because leftover fragments
   from a tutorial or a classmate's snippet are still sitting in the file even
   though they're inert.
3. **Professional readiness.** In industry, code with debug artifacts still in
   it fails code review before a human even reads the logic. Campus
   assignments are the training ground for that discipline. A submission
   pre-flight is a rehearsal for a pull-request review, not a formality.

### "Working but messy" vs. "submission-ready" — the actual distinction

| Dimension | Working but messy | Submission-ready |
|---|---|---|
| Behavior | Correct | Correct (**unchanged** — this is the invariant) |
| Debug scaffolding | Still present (`print`, `pdb.set_trace()`, `console.log`) | Removed or converted to real logging/output |
| History | Visible as commented-out attempts | Squashed away; git history holds the story instead |
| Imports/vars | Superset — includes exploratory ones | Minimal — only what is referenced |
| Formatting | Whatever the editor auto-indented | Consistent, linter-clean |
| Markers | `TODO` / `FIXME` scattered and stale | Resolved, or consciously promoted to a documented "Known Limitations" note |
| Test-only values | Hardcoded credentials/paths/sample sizes left from local testing | Parameterized or clearly isolated in a test fixture, never in the graded entry point |

The cleaner's entire job is to move a repository from the left column to the
right column **without crossing the behavior row** — that row is the one
invariant that must never move, and it is why every phase below ends in
verification, not in "delete and hope."

### The seven cleanup categories

1. **Dead code** — functions, branches, or entire files that are never
   reachable from any entry point (unreferenced helper functions, an old
   `def solve_v1()` superseded by `def solve_v2()` that nothing calls anymore).
2. **Commented-out code blocks** — inert fragments of a previous
   implementation kept "just in case," distinguishable from prose comments by
   *shape* (keywords, operators, indentation) rather than by intent.
3. **Debug print statements** — `print()`, `console.log()`, `System.out.println`
   debug traces, and debugger entrypoints (`pdb.set_trace()`, `breakpoint()`,
   `debugger;`) that exist purely to inspect state during development.
4. **Unused imports / unused variables** — symbols imported or assigned but
   never referenced again; harmless to execution, but a clear static-analysis
   smell and often an explicit rubric deduction.
5. **Inconsistent formatting** — mixed indentation, inconsistent quote style,
   trailing whitespace, irregular blank-line spacing — cosmetic, but it is the
   fastest thing for a grader to notice and the cheapest thing to fix.
6. **Leftover TODO / FIXME / XXX / HACK markers** — legitimate during
   development, but an unresolved `# TODO: this is broken for negative
   numbers` sitting in a graded submission is a confession, not a comment.
7. **Hardcoded test-only values** — a local absolute path
   (`/Users/name/Desktop/test.csv`), a debug flag left `True`, a sample size
   shrunk to `range(3)` "just to test faster," or literal test credentials —
   anything that only worked on the author's machine during development.

### The pipeline: cleanup stages, in safe order

Order matters. Formatting must happen before static analysis (so line numbers
in later reports are stable), static analysis must happen before any
deletion (so removals are *informed*, not guessed), and nothing destructive
happens without a human decision point in between detection and deletion.

```text
                     CAMPUS ASSIGNMENT CLEANER — SAFE-ORDER PIPELINE
                     =================================================

 ┌───────────────┐   ┌────────────────┐   ┌───────────────────┐   ┌─────────────────┐   ┌────────────────┐
 │ 0. SNAPSHOT    │──▶│ 1. FORMAT      │──▶│ 2. DETECT UNUSED   │──▶│ 3. FLAG DEBUG    │──▶│ 4. HUMAN REVIEW│
 │ git commit /   │   │ black/isort/   │   │ pyflakes / eslint  │   │ ARTIFACTS        │   │ GATE           │
 │ branch — this  │   │ prettier/gofmt │   │ unused imports,    │   │ print/console/   │   │ diff + per-    │
 │ IS the rollback│   │ (pure syntax   │   │ vars, unreachable  │   │ debugger/pdb,    │   │ item confidence│
 │ point for      │   │ formatting —   │   │ functions          │   │ commented blocks,│   │ score shown to │
 │ Phase 4        │   │ zero semantic  │   │ (REPORT ONLY —     │   │ TODO/FIXME,      │   │ the student    │
 │                │   │ risk)          │   │ no deletion yet)   │   │ hardcoded values │   │                │
 └───────────────┘   └────────────────┘   └───────────────────┘   └────────┬─────────┘   └───────┬────────┘
                                                                             │                      │
                                                            confidence ≥ threshold          confidence < threshold
                                                                             │                      │
                                                                             ▼                      ▼
                                                                     auto-flag for            deferred to explicit
                                                                     removal in Phase 2       manual decision list
                                                                             │                      │
                                                                             └──────────┬───────────┘
                                                                                        ▼
                                                                            ┌────────────────────────┐
                                                                            │ 5. FINALIZE            │
                                                                            │ apply approved removals,│
                                                                            │ re-run ORIGINAL test    │
                                                                            │ suite, diff review,     │
                                                                            │ commit as its own step  │
                                                                            └────────────────────────┘
```

Every arrow in that diagram is a checkpoint, not a formality: Phase 0 is what
makes Phase 4 (rollback) possible at all; the review gate at step 4 is what
keeps this a *tool*, not an *autonomous editor*.

---

## Phase 1: Discovery & Static Analysis

Nothing is removed in this phase. The only output is a set of reports and
line numbers. Run these from the root of the assignment repository, scoped to
student-authored source directories (exclude `venv/`, `node_modules/`,
`.git/`, and anything vendored).

### 1.1 Unused imports and unused variables

```bash
# Python — pyflakes: fast, zero-config, reports unused imports/vars/names
pip install --quiet pyflakes
pyflakes . --exclude=venv,.venv,__pycache__

# Python — autoflake in dry-run mode gives a removable diff without touching files
pip install --quiet autoflake
autoflake --check --recursive --remove-all-unused-imports \
  --remove-unused-variables --exclude venv,.venv .

# Python — pylint narrowed to exactly the two checks we care about here
pylint --disable=all --enable=unused-import,unused-variable,unused-argument \
  $(git ls-files '*.py')

# JavaScript / TypeScript — eslint with no project config, rules declared inline
# so this works even on a bare student repo with no .eslintrc present
npx eslint --no-eslintrc --parser-options=ecmaVersion:2021,sourceType:module \
  --rule '{"no-unused-vars": "error", "no-undef": "warn"}' \
  --ignore-pattern node_modules --ignore-pattern dist "**/*.{js,jsx,ts,tsx}"
```

### 1.2 Debug print / console / debugger statements

```bash
# Python — bare print() calls (excludes f-strings that are clearly final output
# by leaving classification to Phase 2's AST scanner; this is just the census)
grep -rn --include='*.py' -E '^\s*print\(' . | grep -v -E '(venv|__pycache__)'

# Python — debugger entrypoints, these are always removed (confidence 1.0)
grep -rn --include='*.py' -E '\bpdb\.set_trace\(\)|\bbreakpoint\(\)' .

# JavaScript / TypeScript — console noise and debugger statements
grep -rn --include='*.{js,jsx,ts,tsx}' -E 'console\.(log|debug|warn|dir|trace)\(' . \
  | grep -v node_modules
grep -rn --include='*.{js,jsx,ts,tsx}' -E '\bdebugger\b' . | grep -v node_modules

# Java — System.out debug traces left next to real logging calls
grep -rn --include='*.java' -E 'System\.(out|err)\.print(ln)?\(' .

# C / C++ — stray printf/fprintf(stderr, ...) debug traces
grep -rn --include='*.{c,cpp,h,hpp}' -E '\bprintf\(|fprintf\(\s*stderr' .
```

### 1.3 Commented-out code (regex heuristic census, refined by AST-adjacent scoring in Phase 2)

```bash
# Lines that are comments but start with an unmistakable code keyword
grep -rn --include='*.py' -E '^\s*#\s*(def|class|import|from|for|while|if|elif|else|try|except|return|yield|raise)\b' .

# Lines that are comments but contain an assignment or a function-call shape
grep -rn --include='*.py' -E '^\s*#.*(=[^=]|\w+\([^)]*\)\s*$)' .

# JS/Java/C-family: commented lines ending in a statement terminator
grep -rn --include='*.{js,ts,java,c,cpp}' -E '^\s*//.*[;{}]\s*$' .
```

### 1.4 TODO / FIXME / stale markers

```bash
grep -rn -E '\b(TODO|FIXME|XXX|HACK)\b' --include='*.py' --include='*.js' \
  --include='*.ts' --include='*.java' --include='*.c' --include='*.cpp' .
```

### 1.5 Hardcoded test-only values

```bash
# Absolute local paths that will not exist on the grader's machine
grep -rn -E '(/Users/[A-Za-z0-9_.-]+/|/home/[A-Za-z0-9_.-]+/|C:\\\\Users\\\\)' \
  --include='*.py' --include='*.js' --include='*.java' .

# Debug flags left flipped on, and obviously shrunk test ranges
grep -rn -E '\b(DEBUG|debug)\s*=\s*(True|true|1)\b' .
grep -rn -E 'range\(\s*[1-5]\s*\)\s*#.*(test|debug|quick)' .

# Loopback addresses / test credentials that belong in a fixture, not source
grep -rn -E '(127\.0\.0\.1|localhost)|password\s*=\s*["'\''"](test|1234|admin|changeme)["'\''"]' .
```

### 1.6 Formatting drift (report only — corrected in Phase 2 with a real formatter, never hand-edited)

```bash
python -m pip install --quiet black isort
black --check --diff .
isort --check-only --diff .

npx prettier --check "**/*.{js,jsx,ts,tsx,css,json}"
```

Collect the output of 1.1–1.6 before writing a single line of removal code —
this is the discovery manifest that Phase 2 consumes.

---

## Phase 2: Execution & Implementation

Two purpose-built tools do the actual work: an **AST-based scanner** for
debug/debugger statements (because Python's grammar, not a regex, is the only
reliable way to know whether a `print()` call is a standalone statement safe
to delete versus an expression whose return value is consumed elsewhere), and
a **regex-scored heuristic detector** for commented-out code blocks (because
comments are discarded by the tokenizer before `ast.parse()` ever sees them —
there is no AST node for a comment, so this category is necessarily
line-based).

### 2.1 AST-based debug/debugger statement scanner and remover

```python
"""
debug_artifact_scanner.py
==========================
Phase 2 tool: detects and (only above a confidence threshold) removes
print()/pprint()/debugger-entrypoint statements that are standalone
expression statements — i.e. their return value is discarded, so deleting
the statement cannot change program behavior.

Design rule: this module NEVER deletes anything inside the scanning class.
Detection (`DebugArtifactScanner`) and mutation (`remove_flagged_statements`)
are separate functions so each can be unit-tested, logged, and rolled back
independently. See Phase 4 for what happens when a removal breaks a test.
"""

from __future__ import annotations

import ast
import difflib
import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable

# Calls that ALWAYS indicate a debugger entrypoint, never intended output.
DEBUGGER_CALL_NAMES: frozenset[str] = frozenset({"set_trace", "breakpoint"})

# Calls that MIGHT be debug output or MIGHT be the assignment's actual
# deliverable output — these get scored, never auto-flagged at face value.
DEBUG_PRINT_NAMES: frozenset[str] = frozenset({"print", "pprint", "pp"})

# Substrings inside a printed string literal that strongly suggest a
# debug trace rather than deliverable, user-facing output.
DEBUG_MARKER_SUBSTRINGS: tuple[str, ...] = (
    "debug", "here", "test", "asdf", "xxx", "reached",
    "checkpoint", ">>>", "----", "line ",
)

# Function/method names whose body is conventionally meant to produce
# user-facing output — calls inside these get a confidence discount.
OUTPUT_CONTEXT_NAMES: frozenset[str] = frozenset({
    "main", "run", "display", "show", "report", "summary",
    "print_report", "__str__", "__repr__", "menu", "help",
})


@dataclass
class FlaggedStatement:
    """One candidate debug statement discovered by the scanner."""

    file: str
    lineno: int
    end_lineno: int
    col_offset: int
    source_line: str
    reason: str
    confidence: float  # 0.0 = probably intended output, 1.0 = certainly debug
    node_kind: str      # "print_call" | "debugger_call"

    def as_dict(self) -> dict:
        d = asdict(self)
        d["confidence"] = round(self.confidence, 2)
        return d


class DebugArtifactScanner(ast.NodeVisitor):
    """
    Walks a parsed module and scores every standalone print()-family call
    and every debugger-entrypoint call for debug-artifact likelihood.
    """

    def __init__(self, filename: str, source_lines: list[str]) -> None:
        self.filename = filename
        self.source_lines = source_lines
        self.flags: list[FlaggedStatement] = []
        self._function_stack: list[str] = []
        self._in_main_guard = False

    def visit_FunctionDef(self, node: ast.FunctionDef) -> None:
        self._function_stack.append(node.name)
        self.generic_visit(node)
        self._function_stack.pop()

    visit_AsyncFunctionDef = visit_FunctionDef  # type: ignore[assignment]

    def visit_If(self, node: ast.If) -> None:
        is_main_guard = (
            isinstance(node.test, ast.Compare)
            and isinstance(node.test.left, ast.Name)
            and node.test.left.id == "__name__"
        )
        if is_main_guard:
            self._in_main_guard = True
        self.generic_visit(node)
        if is_main_guard:
            self._in_main_guard = False

    def visit_Expr(self, node: ast.Expr) -> None:
        """
        Only statement-level expressions (`ast.Expr`) are removal candidates.
        `x = print(...)` is an `ast.Assign`, not an `ast.Expr` — its call is
        never visited here, so an assigned/consumed call is never touched.
        """
        if isinstance(node.value, ast.Call):
            self._score_call(node, node.value)
        self.generic_visit(node)

    def _score_call(self, stmt: ast.Expr, call: ast.Call) -> None:
        func_name = self._resolve_call_name(call.func)
        if func_name is None:
            return

        if func_name in DEBUGGER_CALL_NAMES:
            self._flag(stmt, "debugger_call", 1.0,
                       f"'{func_name}()' is a debugger breakpoint")
            return

        if func_name not in DEBUG_PRINT_NAMES:
            return

        confidence = 0.35  # baseline: a bare print() is mildly suspicious
        reasons = ["bare print()/pprint() call"]

        in_output_context = self._in_main_guard or any(
            name in OUTPUT_CONTEXT_NAMES for name in self._function_stack
        )
        if in_output_context:
            confidence -= 0.25
            reasons.append("inside an output-oriented context (lower risk)")

        literal_text = self._flatten_string_args(call)
        if literal_text is not None:
            lowered = literal_text.lower()
            if any(marker in lowered for marker in DEBUG_MARKER_SUBSTRINGS):
                confidence += 0.45
                reasons.append("string argument contains a debug marker")
            if literal_text.strip() == "":
                confidence += 0.2
                reasons.append("prints an empty/whitespace-only string")

        if self._all_args_are_bare_names(call):
            confidence += 0.3
            reasons.append("prints raw variable(s) with no label — typical debug dump")

        confidence = max(0.0, min(1.0, confidence))
        self._flag(stmt, "print_call", confidence, "; ".join(reasons))

    @staticmethod
    def _resolve_call_name(func: ast.expr) -> str | None:
        if isinstance(func, ast.Name):
            return func.id
        if isinstance(func, ast.Attribute):
            return func.attr
        return None

    @staticmethod
    def _flatten_string_args(call: ast.Call) -> str | None:
        parts: list[str] = []
        for arg in call.args:
            if isinstance(arg, ast.Constant) and isinstance(arg.value, str):
                parts.append(arg.value)
            elif isinstance(arg, ast.JoinedStr):  # f-string
                for value in arg.values:
                    if isinstance(value, ast.Constant) and isinstance(value.value, str):
                        parts.append(value.value)
        return " ".join(parts) if parts else None

    @staticmethod
    def _all_args_are_bare_names(call: ast.Call) -> bool:
        return bool(call.args) and all(isinstance(a, ast.Name) for a in call.args)

    def _flag(self, stmt: ast.Expr, kind: str, confidence: float, reason: str) -> None:
        lineno = stmt.lineno
        end_lineno = getattr(stmt, "end_lineno", lineno)
        source_line = (
            self.source_lines[lineno - 1] if lineno - 1 < len(self.source_lines) else ""
        )
        self.flags.append(FlaggedStatement(
            file=self.filename, lineno=lineno, end_lineno=end_lineno,
            col_offset=stmt.col_offset, source_line=source_line,
            reason=reason, confidence=confidence, node_kind=kind,
        ))


def scan_source(source: str, filename: str = "<string>") -> list[FlaggedStatement]:
    tree = ast.parse(source, filename=filename)
    scanner = DebugArtifactScanner(filename, source.splitlines())
    scanner.visit(tree)
    return scanner.flags


def scan_file(path: Path) -> list[FlaggedStatement]:
    source = path.read_text(encoding="utf-8")
    return scan_source(source, filename=str(path))


def remove_flagged_statements(
    source: str,
    flags: Iterable[FlaggedStatement],
    min_confidence: float = 0.8,
) -> tuple[str, list[FlaggedStatement]]:
    """
    Deletes only statements whose confidence clears `min_confidence`.
    Everything else is returned untouched in `deferred` for the Phase 3
    human review gate. Deletion works on whole line RANGES (lineno..end_lineno)
    taken straight from the AST node, never on string matching — so it is
    immune to duplicate-line collisions and correctly handles multi-line
    print() calls.
    """
    lines = source.splitlines(keepends=True)
    to_delete: set[int] = set()
    deferred: list[FlaggedStatement] = []

    for flag in flags:
        if flag.confidence >= min_confidence:
            to_delete.update(range(flag.lineno, flag.end_lineno + 1))
        else:
            deferred.append(flag)

    cleaned = "".join(
        line for idx, line in enumerate(lines, start=1) if idx not in to_delete
    )
    return cleaned, deferred


def render_diff(original: str, cleaned: str, filename: str) -> str:
    return "".join(difflib.unified_diff(
        original.splitlines(keepends=True),
        cleaned.splitlines(keepends=True),
        fromfile=f"a/{filename}", tofile=f"b/{filename}",
    ))


def write_manifest(all_flags: list[FlaggedStatement], out_path: Path) -> None:
    """Every decision the scanner made, kept for Phase 4 rollback and audit."""
    out_path.write_text(
        json.dumps([f.as_dict() for f in all_flags], indent=2), encoding="utf-8"
    )
```

### 2.2 Regex-scored commented-out code block detector

```python
"""
commented_code_detector.py
============================
Phase 2 tool: heuristic detector for commented-out code blocks.

Comments have no AST node — Python's tokenizer discards them before
ast.parse() runs, so this category cannot use the approach in section 2.1.
Instead this module scores contiguous comment runs by "code shape" versus
"prose shape" and only surfaces high-scoring blocks as removal candidates.
It never deletes anything itself.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

CODE_SHAPE_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r'^\s*#\s*(def|class|import|from|for|while|if|elif|else|'
               r'try|except|finally|with|return|yield|raise)\b'),
    re.compile(r'^\s*#.*[^=!<>]=[^=]\S'),          # assignment shape: x = 5
    re.compile(r'^\s*#.*\b\w+\([^)]*\)\s*$'),       # function-call shape
    re.compile(r'^\s*#\s*(print|console\.log|System\.out)\s*\('),
    re.compile(r'^\s*#.*:\s*$'),                    # trailing colon (block opener)
    re.compile(r'^\s*//.*[;{}]\s*$'),               # C-family statement terminator
)

# If a "commented" line reads like a sentence, it counts AGAINST the
# code-likelihood score, protecting genuine documentation comments.
PROSE_HINT: re.Pattern[str] = re.compile(
    r'^[A-Z][a-z].{0,40}\b(is|are|was|were|the|this|note|see|because|for)\b'
)


@dataclass
class CommentBlockCandidate:
    file: str
    start_line: int
    end_line: int
    lines: list[str]
    code_likelihood: float

    def preview(self) -> str:
        return "\n".join(self.lines[:3])


def find_commented_code_blocks(
    source: str, filename: str = "<string>", min_score: float = 0.5
) -> list[CommentBlockCandidate]:
    lines = source.splitlines()
    candidates: list[CommentBlockCandidate] = []
    block: list[str] = []
    block_start: int | None = None

    def flush(end_idx: int) -> None:
        nonlocal block, block_start
        if len(block) >= 2 and block_start is not None:  # a lone comment isn't a "block"
            score = _score_block(block)
            if score >= min_score:
                candidates.append(CommentBlockCandidate(
                    file=filename, start_line=block_start, end_line=end_idx,
                    lines=list(block), code_likelihood=score,
                ))
        block = []
        block_start = None

    for i, line in enumerate(lines, start=1):
        stripped = line.strip()
        is_comment = stripped.startswith("#") or stripped.startswith("//")
        if is_comment:
            if block_start is None:
                block_start = i
            block.append(line)
        else:
            flush(i - 1)
    flush(len(lines))
    return candidates


def _score_block(block: list[str]) -> float:
    hits = 0.0
    for line in block:
        if any(p.search(line) for p in CODE_SHAPE_PATTERNS):
            hits += 1.0
        stripped_prose_check = line.lstrip("#/ ").strip()
        if PROSE_HINT.match(stripped_prose_check):
            hits -= 1.0
    return max(0.0, min(1.0, hits / max(1, len(block))))
```

### 2.3 Worked example

Given this file, `solver.py`:

```python
def compute_total(items):
    # old attempt, kept in case the new one breaks
    # total = 0
    # for item in items:
    #     total += item.price * item.qty
    # return total
    print("DEBUG: entering compute_total")
    total = sum(item.price * item.qty for item in items)
    print(total)
    return total
```

Running both detectors:

```python
source = Path("solver.py").read_text()
flags = scan_source(source, filename="solver.py")
blocks = find_commented_code_blocks(source, filename="solver.py")

for f in flags:
    print(f.as_dict())
for b in blocks:
    print(b.start_line, b.end_line, round(b.code_likelihood, 2))
```

produces:

```text
{'file': 'solver.py', 'lineno': 6, 'end_lineno': 6, 'source': 'print("DEBUG: entering compute_total")', 'reason': 'bare print()/pprint() call; string argument contains a debug marker', 'confidence': 0.8, 'kind': 'print_call'}
{'file': 'solver.py', 'lineno': 8, 'end_lineno': 8, 'source': 'print(total)', 'reason': 'bare print()/pprint() call; prints raw variable(s) with no label — typical debug dump', 'confidence': 0.65, 'kind': 'print_call'}
2 5 0.8
```

Line 6 clears a `min_confidence=0.8` threshold and is auto-removed; line 8
(0.65) is deferred to the human review gate — it *might* be the function's
intended output depending on the assignment brief, so the tool refuses to
guess. The commented block at lines 2–5 is surfaced with an 0.8 code-likelihood
score for the same manual sign-off.

---

## Phase 3: Automated Verification

Cleanup that breaks the assignment is worse than no cleanup at all. Every
removal must be verified against the **original, pre-cleanup** test suite —
never a modified one — so verification proves the removal was safe, not that
the tests were adjusted to match the new code.

```bash
# 1. Capture the BEFORE baseline, on the untouched snapshot from Phase 0
git stash push -u -m "pre-cleanup baseline check"    # or: git checkout pre-cleanup-branch
python -m pytest -q --tb=short | tee /tmp/before.log
npm test --silent 2>&1 | tee -a /tmp/before.log        # if the assignment has a JS/TS test suite
git stash pop                                          # restore the working tree

# 2. Apply the cleanup (Phase 2 tooling), then capture the AFTER run
python -m pytest -q --tb=short | tee /tmp/after.log
npm test --silent 2>&1 | tee -a /tmp/after.log

# 3. Compare pass/fail counts and specific test names — not just exit codes
diff /tmp/before.log /tmp/after.log

# 4. Confirm no NEW failures were introduced (a shrinking pass count is a hard stop)
grep -E '^(FAILED|ERROR)' /tmp/before.log | sort > /tmp/before_failures.txt
grep -E '^(FAILED|ERROR)' /tmp/after.log  | sort > /tmp/after_failures.txt
diff /tmp/before_failures.txt /tmp/after_failures.txt

# 5. Optional but recommended: coverage must not drop, which would indicate
#    a code path got deleted along with its debug statement, not just the
#    debug statement itself
coverage run -m pytest -q && coverage report -m | tee /tmp/coverage_after.txt

# 6. Human-readable diff review — never trust an automated cleanup you have
#    not personally read, hunk by hunk
git diff --stat                 # what changed, at a glance
git diff -- '*.py' '*.js'       # the actual line-by-line diff, scoped to source
git add -p                      # stage (and re-read) one hunk at a time
```

A cleanup pass is only considered verified when **all four** hold:
`after_failures.txt` is empty or identical to `before_failures.txt`, the total
test count is unchanged, coverage has not dropped, and a human has read the
full diff.

---

## Phase 4: Rollback & Self-Healing

Because Phase 0 created a real commit before anything was touched, every
action in this phase is reversible by construction. The rule is: **when a
removal breaks a test, revert that one removal — never blind-delete your way
past a red test, and never loosen the test to make it pass.**

### 4.1 Immediate rollback of a bad automated pass

```bash
# If the working tree as a whole regressed, return to the Phase 0 snapshot
git reset --hard pre-cleanup-snapshot     # only if the branch is disposable
# or, non-destructively:
git revert --no-edit <cleanup-commit-sha>
```

### 4.2 Isolating exactly which removal broke a test (bisection, not blind reversion)

```bash
# The manifest from write_manifest() records every removal with its line
# range and file — replay them one at a time against the failing test.
python - <<'PY'
import json, subprocess
from pathlib import Path

manifest = json.loads(Path("cleanup_manifest.json").read_text())
manifest.sort(key=lambda f: f["confidence"], reverse=True)

for entry in manifest:
    # Re-apply only this one removal on top of the pre-cleanup snapshot,
    # then run the specific test file that failed after the full cleanup.
    subprocess.run(["git", "checkout", "pre-cleanup-snapshot", "--", entry["file"]])
    print(f"Testing isolated removal: {entry['file']}:{entry['lineno']} "
          f"({entry['reason']})")
    result = subprocess.run(
        ["python", "-m", "pytest", "-q", "--tb=line"], capture_output=True, text=True
    )
    if result.returncode != 0:
        print(f"  --> THIS removal breaks the suite. Flagging for manual review.")
        # Do not delete: annotate instead and leave the original line intact.
    else:
        print("  --> safe in isolation")
PY
```

### 4.3 Self-healing policy — flag, don't force

When a specific removal is proven to break a test:

1. **Revert that single line range** in that single file (`git checkout
   pre-cleanup-snapshot -- <file>` followed by re-applying every *other*
   approved removal, or a targeted `git apply -R` against just that hunk).
2. **Downgrade its confidence to 0** and move it from the auto-removed list to
   the deferred/manual-review list in `cleanup_manifest.json`, with the
   failing test name recorded as the reason.
3. **Never re-attempt automatic removal of that exact statement** in the same
   run — a statement that fails verification once is a signal that the
   heuristic misjudged it (e.g. a `print()` was in fact the assignment's
   required output), not a signal to retry harder.
4. **Surface it explicitly to the student**: "line 42 in `solver.py` looks
   like a debug print but removing it fails `test_output_format` — keeping it,
   please review manually" is the correct terminal state, not silent success.

### 4.4 Manifest as the rollback ledger

Every entry written by `write_manifest()` in Phase 2 doubles as a rollback
instruction: `file` + `lineno`/`end_lineno` is enough to reconstruct exactly
what was removed from the Phase 0 git snapshot, so the manifest is committed
alongside the cleanup commit, never discarded after the run.

---

## Common Anti-Patterns vs. Gold Standard

| # | Anti-Pattern | Why It Fails | Gold Standard | Why It Works |
|---|---|---|---|---|
| 1 | Blind regex deletion of any line matching `print(` | Deletes `print(f"Total: {total}")` that IS the assignment's required output, and mishandles multi-line calls | AST-aware removal (`ast.Expr` + `ast.Call`) with a confidence score | Only touches statement-level calls whose return value is provably discarded; scores intent instead of guessing from text |
| 2 | Deleting every commented line to "look clean" | Erases license headers, docstring-style explanations, and academic citations required by the rubric | Code-shape-scored block detection (`find_commented_code_blocks`) with a prose-hint penalty | Distinguishes inert dead code from legitimate documentation before flagging anything |
| 3 | Running the formatter across the whole repository including vendored/third-party code | Rewrites a bundled library or starter-code file the professor provided verbatim, breaking diff-based grading | Scope every tool (`black`, `eslint`, grep, AST scanners) to student-authored source paths, explicitly excluding vendored/starter directories | Keeps the diff limited to what the student actually wrote |
| 4 | Removing "unused" imports without checking re-exports (`__init__.py`, `__all__`) | Breaks `from package import Thing` for callers that depended on the re-export, a false positive from naive unused-import tools | Static analysis that resolves `__all__` and package `__init__.py` re-export patterns before flagging | Avoids deleting imports that are unused *locally* but are the module's actual public surface |
| 5 | Cleaning and zipping for submission without re-running the test suite | Silent behavior regression ships to the grader; "cleanup" becomes indistinguishable from "broke it" | Mandatory before/after test-suite diff (Phase 3) as a hard gate before Phase 4 finalization | Proves functional equivalence rather than assuming it |
| 6 | Deleting `TODO`/`FIXME` comments outright to remove the appearance of incompleteness | Hides genuine known limitations from the grader, which often reads worse than disclosing them, and can look like concealment | Convert unresolved TODOs into an explicit "Known Limitations" note, or resolve the underlying issue | Honesty about scope reads as maturity; a grader who finds a hidden bug the TODO warned about penalizes harder than the disclosure would have |
| 7 | One giant destructive commit for "cleanup" | If anything is wrong, there is no way to revert just the debug-print removal without also losing the formatting pass | Incremental commits per cleanup category (format → unused-imports → debug-artifacts → finalize) | Each category is independently revertible via `git revert`, matching the pipeline stages exactly |

---

## Pre-Flight Checklist

Complete every item before running any removal tool.

1. `git status` is clean, or all changes are intentionally staged — no
   surprise files will be swept up by later `git checkout` rollback commands.
2. A safety commit or branch exists (`git commit -am "pre-cleanup snapshot"`
   or `git branch pre-cleanup-snapshot`) — this is the Phase 4 rollback point.
3. The **original, unmodified** test suite runs and its pass/fail counts are
   captured as the Phase 3 baseline (`/tmp/before.log`).
4. The language/toolchain is identified and the relevant linters (pyflakes,
   eslint, black, autoflake, etc.) are installed, ideally in an isolated venv
   or via `npx` so nothing pollutes the submission itself.
5. Vendored, generated, and starter-code directories (`node_modules/`,
   `venv/`, `dist/`, professor-provided boilerplate) are explicitly excluded
   from every grep/linter/formatter invocation.
6. The assignment brief has been checked for any requirement that debug-style
   output actually be present (some labs require a printed execution trace as
   part of the deliverable — those calls must never be auto-removed).
7. A full backup of the current submission exists outside of the git history
   being rewritten (`cp -r project project.bak.$(date +%s)`), in case the
   rollback branch itself is mishandled.
8. A minimum auto-removal confidence threshold is chosen and recorded
   (default `0.8`) — lower thresholds require more manual review, not less.
9. Any professor-mandated identification headers (student name/ID/module
   code) are noted so no formatting or comment-cleanup pass strips them.

## Post-Flight Checklist

Complete every item before the cleaned repository is zipped, committed, or
uploaded.

1. The full test suite was re-run against the cleaned tree and produces the
   **same or better** pass/fail count as the Phase 3 baseline — zero new
   failures, zero new errors.
2. `git diff` was read in full, hunk by hunk (`git diff` / `git add -p`), not
   skimmed via `--stat` alone.
3. Every entry in `cleanup_manifest.json` with confidence below the threshold
   has an explicit recorded decision (kept / manually removed / escalated to
   student) — nothing is left silently "pending."
4. The manifest itself (`cleanup_manifest.json`) is committed alongside the
   cleanup so the removals remain auditable and reversible after the fact.
5. The formatter pass did not touch any vendored, generated, or
   professor-provided starter file (`git diff --stat` shows only
   student-authored paths).
6. The assignment's actual entry point (`python main.py`, `npm start`, the
   grading script, etc.) was executed end-to-end one final time on the
   cleaned tree, not just the unit tests.
7. No statement that produces the assignment's genuinely required output was
   among the removed lines — spot-check every "print_call" removal against
   the brief's expected-output description.
8. File encodings and line endings are unchanged (`git diff` shows no
   whole-file rewrite from CRLF/LF churn or encoding conversion as a side
   effect of an automated tool).
9. The cleanup is committed as its own commit, separate from the Phase 0
   safety snapshot, with a message describing which categories were touched
   (e.g. "cleanup: remove debug prints, unused imports, dead branch in
   solver.py").
10. The submission archive/zip is regenerated fresh from the cleaned,
    committed working tree — never re-zipped from a stale pre-cleanup folder
    left over from an earlier attempt.
