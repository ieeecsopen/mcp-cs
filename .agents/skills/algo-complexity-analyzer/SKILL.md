---
name: algo-complexity-analyzer
description: >
  Activate this skill whenever a user asks to reason about the asymptotic time or
  space complexity of a specific function, snippet, algorithm, or diff. Trigger on
  exact phrasings such as: "what's the complexity of this function", "is this
  O(n) or O(n^2)", "will this TLE on N=10^6", "why am I getting Time Limit
  Exceeded", "can this brute force pass within the time limit", "how do I make
  this loop faster", "does this recursion blow up", "is there a hidden O(n)
  inside this loop", "is there a faster algorithm for this", "big-O this code",
  "how many operations does this do", "will this scale to a million rows", and
  "review this PR for performance regressions before merge". Also trigger on
  symptom signatures surfaced by judges/CI/profilers: a "TLE verdict", "MLE
  verdict", "exceeded time limit", a profiler flagging a hot nested loop, or a
  code-review comment asking for a Big-O justification. Use during static code
  review (reading a function/diff without running it) AND during empirical
  triage (a solution is slow in production or on a judge and the root cause
  asymptotic class needs to be confirmed by benchmarking, not guessed).
version: 1.0.0
author: IEEE Computer Society of SLIIT
tags:
  - algorithms
  - complexity-analysis
  - big-o
  - performance
  - competitive-programming
  - code-review
  - benchmarking
  - static-analysis
---

# Algorithmic Complexity Analyzer

This skill turns "is this fast enough?" from a guess into a verdict: it combines static AST-level reasoning (what the code's structure implies about worst-case growth) with empirical benchmarking (what the code actually does on real hardware, curve-fit in log-log space) to produce a defensible Big-O classification, a list of concrete hidden-cost bugs with line numbers, and a pass/fail call against a stated N and time limit — the same judgment call a competitive-programming judge or a senior reviewer would make, but reproducible and testable.

## Mental Model & Theoretical Foundations

### Asymptotic analysis, precisely

Big-O describes the **growth rate** of work as input size `N` scales, not the actual runtime. `O(f(N))` means the operation count is bounded above by `c * f(N)` for some constant `c` and all `N` beyond some threshold. Three related notations matter for correctness, not just O:

- **O(f(N))** — upper bound (worst case never exceeds this growth rate).
- **Ω(f(N))** — lower bound (best case is at least this).
- **Θ(f(N))** — tight bound (both O and Ω hold; the algorithm truly grows at this rate).

Most "complexity analysis" requests are really asking for the **worst-case Θ** of the dominant code path. Always analyze the worst case unless the user explicitly asks for average/best case (e.g., quicksort is Θ(N log N) average, Θ(N²) worst case — both answers can be "correct" depending on which was asked).

### Amortized complexity: the dynamic array doubling example

A single operation's worst case can be misleading if it happens rarely. **Amortized analysis** spreads cost over a full sequence of operations.

Classic case: appending to a dynamic array (Python `list.append`, `std::vector::push_back`) that **doubles capacity** when full.

- Aggregate method: inserting `N` elements total, resizes happen at sizes `1, 2, 4, 8, ..., N/2`. Each resize of size `k` costs `O(k)` to copy. Total copy cost:

  ```
  1 + 2 + 4 + 8 + ... + N/2 + N  =  2N - 1  =  O(N)
  ```

- Amortized cost per insertion = `O(N) / N = O(1)`.

This is why `list.append()` is documented as "amortized O(1)" — any *individual* call can be O(N) (the one that triggers a resize), but no adversarial sequence of N appends can force more than O(N) total work. Contrast this with `list.insert(0, x)`, which is **always** O(N) with no amortization escape hatch, because every existing element must shift right on every call — this is one of the anti-patterns this skill flags (see Phase 1).

### Why constant factors matter in practice

Big-O deliberately discards constant factors and lower-order terms — but on real hardware those constants decide whether code finishes in 1 second or 10. Two effects dominate:

1. **Cache locality.** Sequential memory access (arrays, contiguous slices) is often 10-50x faster than pointer-chasing/random access (linked lists, hash maps, scattered object graphs) at the same Big-O class, because of L1/L2/L3 cache hit rates. An O(N) algorithm with poor locality can lose to an O(N log N) algorithm with excellent locality for realistic N.
2. **Hidden constant multipliers.** Recursion (function-call overhead), interpreted-language dispatch (Python bytecode vs. C), and allocation churn (creating new objects per iteration) can each add 10-100x, which matters when a judge's time limit is 1-2 seconds.

**Competitive-programming rule of thumb: ~10^8 simple operations per second** (conservative; C++ can hit ~10^9, Python is often 10-50x slower than that). Use this table to translate `N` + a 1-2 second limit into a *safe upper bound* on complexity class:

| Input size `N`          | Safe complexity class(es)         | Typical patterns at this scale                          |
|--------------------------|------------------------------------|-----------------------------------------------------------|
| `N <= 10`                | `O(N!)`, `O(2^N · N)`, `O(N^6)`    | brute-force permutations, exhaustive search over subsets of subsets |
| `N <= 20-25`             | `O(2^N)`, `O(2^N · N)`             | bitmask DP over subsets, meet-in-the-middle                |
| `N <= 300-500`           | `O(N^3)`                            | Floyd-Warshall, triple-nested DP                            |
| `N <= 2,000-5,000`       | `O(N^2 log N)`                     | O(N^2) with a sort or heap operation per step               |
| `N <= 10,000`            | `O(N^2)`                            | all-pairs brute force, naive DP tables                      |
| `N <= 10^5 - 10^6`       | `O(N log N)`, `O(N sqrt N)`        | sorting, segment tree / BIT, sqrt decomposition, binary search per element |
| `N <= 10^7 - 10^8`       | `O(N)`, `O(N log log N)`           | single linear pass, two-pointer, sieve of Eratosthenes       |
| `N > 10^8`               | `O(log N)`, `O(sqrt N)`, `O(1)`    | binary search, closed-form math, precomputed/O(1) lookup     |

This table is a **necessary check, not a sufficient one** — always confirm with the empirical benchmark in Phase 2/3, since constant factors can push a "theoretically safe" class over the limit anyway (see Mental Model, above).

### Decision flowchart: given N and a time limit, what's safe?

```
                         ┌───────────────────────────────┐
                         │   What is N (input size)?      │
                         └────────────────┬────────────────┘
                                          │
   ┌───────────┬───────────────┬─────────┼───────────┬───────────────┬───────────────┐
   ▼           ▼               ▼         ▼           ▼               ▼               ▼
N<=10       N<=20-25       N<=500    N<=10,000   N<=10^5-10^6    N<=10^7-10^8      N>10^8
   │           │               │         │           │               │               │
   ▼           ▼               ▼         ▼           ▼               ▼               ▼
O(N!)      O(2^N)          O(N^3)    O(N^2)      O(N log N)      O(N)          O(log N)/O(1)
brute      bitmask DP,     Floyd-    all-pairs   sort/BIT/       linear pass,  binary search,
permute    subset enum     Warshall  brute force segment tree    sieve, 2-ptr closed-form
```

### Recursion tree analysis and the Master Theorem

For divide-and-conquer recursions of the form `T(N) = a·T(N/b) + f(N)` (a subproblems, each of size N/b, plus f(N) combine work), draw the recursion tree and sum work **level by level**. Merge sort — `T(N) = 2T(N/2) + O(N)` — is the canonical example:

```
T(N) = 2T(N/2) + O(N)             Work done AT each level (not cumulative):

Level 0:                [ N ]                                  ->  N
                        /      \
Level 1:            [N/2]      [N/2]                            -> N/2 + N/2      = N
                    /    \      /    \
Level 2:        [N/4] [N/4] [N/4] [N/4]                          -> 4 * (N/4)      = N
                                ...
Level log2(N):  [1][1][1][1] ....................... [1]        -> N * 1          = N
                (N leaves, each doing O(1) work)

Number of levels  = log2(N) + 1
Work per level    = O(N)   (identical at every level — this is the key insight)
────────────────────────────────────────────────────────────────────────────
Total work        = O(N) * O(log N)  =  O(N log N)
```

**Master Theorem** (for `T(N) = a·T(N/b) + f(N)`, `a >= 1`, `b > 1`): compare `f(N)` against `N^(log_b a)`:

- **Case 1 — leaves dominate:** if `f(N) = O(N^(log_b(a) - ε))` for some `ε > 0`, then `T(N) = Θ(N^(log_b a))`. (Example: `T(N) = 8T(N/2) + O(N^2)` → `log_2 8 = 3 > 2` → `T(N) = Θ(N^3)`.)
- **Case 2 — balanced:** if `f(N) = Θ(N^(log_b a) · log^k N)`, then `T(N) = Θ(N^(log_b a) · log^(k+1) N)`. (Merge sort: `a=2, b=2 → N^1`, `f(N)=Θ(N)=Θ(N^1 log^0 N)` → `T(N) = Θ(N log N)`.)
- **Case 3 — root dominates:** if `f(N) = Ω(N^(log_b(a) + ε))` and the regularity condition `a·f(N/b) <= c·f(N)` holds for some `c<1`, then `T(N) = Θ(f(N))`. (Example: `T(N) = T(N/2) + O(N)` → binary-search-shaped combine work dominates → `T(N) = Θ(N)`.)

For non-divide-and-conquer recursion (e.g., naive Fibonacci `T(N) = T(N-1) + T(N-2) + O(1)`), the recursion tree is **not balanced** — model it as a binary tree of depth N with branching factor ~2, giving `T(N) = O(2^N)`. This is why unmemoized multi-branch recursion is flagged as exponential in Phase 1/2, and why adding memoization (`@lru_cache`, DP table) collapses it to O(distinct subproblems) — typically O(N).

## Phase 1: Discovery & Static Analysis

Before running anything, read the code and scope the analysis to the function(s) actually under review (a full file, a diff hunk, or a pasted snippet). Work through these steps in order:

**Step 1 — locate function boundaries and scope the review.**
```bash
grep -n "^def \|^    def \|^class " target_file.py
```
If reviewing a PR/diff, restrict analysis to functions touched by the diff (`git diff --unified=0 -- target_file.py` to see exactly which lines changed) plus any function they call, since complexity composes.

**Step 2 — map loop nesting depth by eye, then confirm with AST (Phase 2).**
```bash
grep -n "for \|while " target_file.py
```
Every additional level of loop nesting over the *same* input multiplies the polynomial degree by one — two nested loops over an N-sized collection is a strong O(N²) signal, three is O(N³). Watch for loops that only *look* independent but iterate the same collection (e.g., a loop over `edges` nested inside a loop over `nodes`, where `edges` scales with `nodes` too — that's still polynomial in the shared N, not two separate variables).

**Step 3 — grep for hidden-cost patterns that silently add an order of magnitude.** These are the highest-value finds because they are invisible to a casual read:

```bash
# list.index()/count()/remove() inside a loop -> each call is O(n) on its own
grep -n "\.index(\|\.count(\|\.remove(" target_file.py

# string += inside a loop -> O(n) per concat due to string immutability -> O(n^2) total
grep -n "+= " target_file.py | grep -v "+=\s*1\b"

# membership tests against a list/tuple (not set/dict) -> O(n) linear scan per test
grep -n " in \[" target_file.py

# O(n) list mutation at the front -> every remaining element shifts
grep -n "\.pop(0)\|\.insert(0" target_file.py

# sort() / sorted() called inside a loop -> O(n log n) becomes O(n^2 log n)
grep -n "\.sort(\|sorted(" target_file.py

# self-recursion signature (search for the function's own name inside its body)
grep -n "^def \([a-zA-Z_][a-zA-Z0-9_]*\)(" target_file.py

# existing memoization guard (downgrades exponential recursion to ~linear)
grep -n "@lru_cache\|@cache\|memo\[\|memo\.get" target_file.py
```

**Step 4 — for each hit from Step 3, confirm it sits *inside* a loop or recursive path** (grep alone can't see nesting — check indentation/AST context). A `list.index()` call at module scope is O(n) once; the same call inside a `for` loop over the same list makes the whole block O(n²).

**Step 5 — check for early termination and reduction pattern in recursion.** A recursive call passing `n - 1` implies a recursion depth of O(n) (linear tree); a call passing `n // 2` implies O(log n) depth (e.g., binary search). Don't flag logarithmic recursion as expensive just because it "looks recursive."

Once Step 1-5 produce a hypothesis, confirm it mechanically with the tools in Phase 2 rather than trusting eyeballing alone — humans reliably miss nesting depth past 2 levels and miss hidden-cost calls buried in expressions.

## Phase 2: Execution & Implementation

Two complementary tools: a **static AST walker** (structural reasoning, no execution) and an **empirical benchmark harness** (ground truth via timing + log-log regression). Run both; static analysis catches theoretical worst-case shape, benchmarking catches real-world constant-factor and hardware surprises.

### 2a. Static AST walker — `complexity_static_analyzer.py`

```python
"""
complexity_static_analyzer.py

Static analysis engine that estimates the asymptotic time complexity of a
Python function by walking its Abstract Syntax Tree (AST). Does NOT execute
the code. Detects:
  1. Nested loop depth (for/while)          -> polynomial degree estimate.
  2. Recursive self-calls                    -> exponential/recursive candidates.
  3. Hidden O(n) operations inside loops that silently degrade complexity by
     one full order: list.index/count/remove, `in <list>` membership tests,
     str += concatenation, list.pop(0)/insert(0, ...), sort()/sorted() re-runs.
  4. Memoization guards (functools.lru_cache/cache, manual memo dict) that
     downgrade recursive complexity from exponential to near-linear.

Usage:
    python complexity_static_analyzer.py path/to/file.py
"""

from __future__ import annotations

import ast
import sys
import textwrap
from dataclasses import dataclass, field
from enum import Enum


class ComplexityClass(Enum):
    O_1 = "O(1)"
    O_LOG_N = "O(log n)"
    O_N = "O(n)"
    O_N_LOG_N = "O(n log n)"
    O_N2 = "O(n^2)"
    O_N3 = "O(n^3)"
    O_N_K = "O(n^k), k>=4"
    O_2_N = "O(2^n)"
    UNKNOWN = "UNKNOWN (needs empirical benchmark)"


HIDDEN_LINEAR_CALL_NAMES = {"index", "count", "remove"}
HIDDEN_LINEAR_LIST_OPS = {"pop", "insert"}  # pop(0) / insert(0, ...) are O(n)
SORT_CALLS = {"sort", "sorted"}


@dataclass
class Finding:
    line: int
    kind: str
    message: str
    severity: str  # "info" | "warning" | "critical"


@dataclass
class FunctionReport:
    name: str
    max_loop_depth: int = 0
    is_recursive: bool = False
    recursion_arg_shrinks_linearly: bool | None = None       # n - k style
    recursion_arg_shrinks_logarithmically: bool | None = None  # n // 2 style
    is_memoized: bool = False
    findings: list[Finding] = field(default_factory=list)
    estimated_class: ComplexityClass = ComplexityClass.UNKNOWN

    def add(self, line: int, kind: str, message: str, severity: str = "warning") -> None:
        self.findings.append(Finding(line, kind, message, severity))


class LoopDepthVisitor(ast.NodeVisitor):
    """Tracks max for/while nesting depth and flags membership/mutation calls
    that are O(n) but read like O(1) at the call site."""

    def __init__(self, report: FunctionReport):
        self.report = report
        self.depth = 0

    def _enter_loop(self, node: ast.For | ast.While) -> None:
        self.depth += 1
        self.report.max_loop_depth = max(self.report.max_loop_depth, self.depth)
        if self.depth >= 2:
            self.report.add(
                node.lineno, "nested_loop",
                f"Loop nesting depth {self.depth} -> polynomial factor n^{self.depth} candidate.",
                "warning" if self.depth == 2 else "critical",
            )
        self.generic_visit(node)
        self.depth -= 1

    def visit_For(self, node: ast.For) -> None:
        self._enter_loop(node)

    def visit_While(self, node: ast.While) -> None:
        self._enter_loop(node)

    def visit_AugAssign(self, node: ast.AugAssign) -> None:
        if self.depth >= 1 and isinstance(node.op, ast.Add) and isinstance(node.target, ast.Name):
            self.report.add(
                node.lineno, "string_concat_in_loop",
                f"'{node.target.id} += ...' inside a loop (depth {self.depth}). If the "
                "target is a str, this is O(n) per iteration (string immutability) -> "
                "O(n^2) total. Use a list + ''.join() instead.",
                "warning",
            )
        self.generic_visit(node)

    def visit_Call(self, node: ast.Call) -> None:
        if self.depth >= 1:
            if isinstance(node.func, ast.Attribute) and node.func.attr in HIDDEN_LINEAR_CALL_NAMES:
                self.report.add(
                    node.lineno, "hidden_linear_call",
                    f"'.{node.func.attr}(...)' inside a loop (depth {self.depth}) is O(n) "
                    f"per call -> combined complexity O(n^{self.depth + 1}). Use a dict/set "
                    "for O(1) lookup.",
                    "critical",
                )
            if isinstance(node.func, ast.Attribute) and node.func.attr in HIDDEN_LINEAR_LIST_OPS:
                if node.args and isinstance(node.args[0], ast.Constant) and node.args[0].value == 0:
                    self.report.add(
                        node.lineno, "hidden_linear_mutation",
                        f"'.{node.func.attr}(0, ...)' inside a loop (depth {self.depth}) shifts "
                        "every remaining element -> O(n) per call. Use collections.deque for "
                        "O(1) amortized operations at both ends.",
                        "critical",
                    )
            is_sort_call = (isinstance(node.func, ast.Name) and node.func.id in SORT_CALLS) or (
                isinstance(node.func, ast.Attribute) and node.func.attr in SORT_CALLS
            )
            if is_sort_call:
                self.report.add(
                    node.lineno, "sort_in_loop",
                    f"Sort call inside a loop (depth {self.depth}) turns O(n log n) into "
                    f"O(n^{self.depth} log n). Sort once outside the loop if possible.",
                    "warning",
                )
        self.generic_visit(node)

    def visit_Compare(self, node: ast.Compare) -> None:
        if self.depth >= 1:
            for op, comparator in zip(node.ops, node.comparators):
                if isinstance(op, (ast.In, ast.NotIn)) and not isinstance(comparator, (ast.Set, ast.SetComp)):
                    self.report.add(
                        node.lineno, "membership_in_list",
                        f"'in'/'not in' inside a loop (depth {self.depth}) against a "
                        f"non-set/dict collection is O(n) -> total O(n^{self.depth + 1}). "
                        "Use a set/dict for O(1) average membership.",
                        "critical",
                    )
        self.generic_visit(node)


class RecursionVisitor(ast.NodeVisitor):
    """Detects direct self-recursion and classifies how the primary argument
    shrinks between the call site and the recursive call."""

    def __init__(self, func_name: str, report: FunctionReport):
        self.func_name = func_name
        self.report = report
        self.has_manual_memo = False

    def visit_Call(self, node: ast.Call) -> None:
        if isinstance(node.func, ast.Name) and node.func.id == self.func_name:
            self.report.is_recursive = True
            self._classify_shrink(node)
            self.report.add(node.lineno, "recursive_call",
                             f"Direct recursive call to '{self.func_name}'.", "info")
        self.generic_visit(node)

    def visit_Subscript(self, node: ast.Subscript) -> None:
        if isinstance(node.value, ast.Name) and "memo" in node.value.id.lower():
            self.has_manual_memo = True
        self.generic_visit(node)

    def _classify_shrink(self, call_node: ast.Call) -> None:
        if not call_node.args:
            return
        arg0 = call_node.args[0]
        if isinstance(arg0, ast.BinOp) and isinstance(arg0.op, ast.Sub):
            self.report.recursion_arg_shrinks_linearly = True
        elif isinstance(arg0, ast.BinOp) and isinstance(arg0.op, (ast.FloorDiv, ast.Div)):
            self.report.recursion_arg_shrinks_logarithmically = True


def _has_memo_decorator(node: ast.FunctionDef) -> bool:
    for dec in node.decorator_list:
        target = dec.func if isinstance(dec, ast.Call) else dec
        name = target.id if isinstance(target, ast.Name) else getattr(target, "attr", "")
        if name in {"lru_cache", "cache"}:
            return True
    return False


def _count_recursive_self_calls(node: ast.FunctionDef) -> int:
    return sum(
        1 for n in ast.walk(node)
        if isinstance(n, ast.Call) and isinstance(n.func, ast.Name) and n.func.id == node.name
    )


def analyze_function(node: ast.FunctionDef) -> FunctionReport:
    report = FunctionReport(name=node.name)

    LoopDepthVisitor(report).visit(node)

    recursion_visitor = RecursionVisitor(node.name, report)
    recursion_visitor.visit(node)
    report.is_memoized = _has_memo_decorator(node) or recursion_visitor.has_manual_memo
    self_call_count = _count_recursive_self_calls(node)

    if report.is_recursive:
        if report.is_memoized:
            report.estimated_class = ComplexityClass.O_N
            report.add(node.lineno, "memoized_recursion",
                        "Recursion is memoized; collapses from exponential to ~O(n) "
                        "distinct subproblems.", "info")
        elif self_call_count >= 2:
            report.estimated_class = ComplexityClass.O_2_N
            report.add(node.lineno, "branching_recursion",
                        f"{self_call_count} recursive self-calls per invocation with no "
                        "memoization -> exponential call tree (e.g. naive Fibonacci).",
                        "critical")
        elif report.recursion_arg_shrinks_logarithmically:
            report.estimated_class = ComplexityClass.O_LOG_N
        elif report.recursion_arg_shrinks_linearly:
            report.estimated_class = ComplexityClass.O_N
        else:
            report.estimated_class = ComplexityClass.UNKNOWN
    elif report.max_loop_depth == 0:
        report.estimated_class = ComplexityClass.O_1
    elif report.max_loop_depth == 1:
        report.estimated_class = ComplexityClass.O_N
    elif report.max_loop_depth == 2:
        report.estimated_class = ComplexityClass.O_N2
    elif report.max_loop_depth == 3:
        report.estimated_class = ComplexityClass.O_N3
    else:
        report.estimated_class = ComplexityClass.O_N_K

    hidden_cost_kinds = {"hidden_linear_call", "hidden_linear_mutation", "membership_in_list"}
    if report.estimated_class == ComplexityClass.O_N and any(
        f.severity == "critical" and f.kind in hidden_cost_kinds for f in report.findings
    ):
        report.estimated_class = ComplexityClass.O_N2

    return report


def analyze_source(source: str) -> list[FunctionReport]:
    tree = ast.parse(textwrap.dedent(source))
    return [analyze_function(n) for n in ast.walk(tree) if isinstance(n, ast.FunctionDef)]


def main() -> None:
    if len(sys.argv) != 2:
        print("Usage: python complexity_static_analyzer.py <file.py>")
        sys.exit(1)
    with open(sys.argv[1], "r", encoding="utf-8") as f:
        source = f.read()
    for report in analyze_source(source):
        print(f"\n=== {report.name}() -> estimated {report.estimated_class.value} ===")
        for finding in report.findings:
            print(f"  L{finding.line:<4} [{finding.severity:<8}] {finding.kind}: {finding.message}")


if __name__ == "__main__":
    main()
```

### 2b. Empirical benchmark harness — `empirical_complexity_benchmark.py`

```python
"""
empirical_complexity_benchmark.py

Benchmarks a callable at exponentially increasing input sizes N, fits
log(runtime) = k * log(N) + c via ordinary least squares, and maps the
fitted exponent k to the nearest standard complexity class. Also tests a
pure-exponential model (log(t) vs N, not log N) to catch O(c^n) growth.

This is the dynamic counterpart to complexity_static_analyzer.py: static
analysis tells you what the code LOOKS like; this tells you what it
ACTUALLY does on real hardware, including constant-factor effects.
"""

from __future__ import annotations

import gc
import math
import statistics
import time
from dataclasses import dataclass
from typing import Callable, Sequence


@dataclass
class BenchmarkPoint:
    n: int
    seconds: float


@dataclass
class FitResult:
    exponent: float
    r_squared: float
    intercept: float
    is_exponential_fit: bool
    exponential_rate: float | None
    classification: str
    confidence: str  # "high" | "medium" | "low" | "inconclusive"


_POWER_LAW_TABLE: list[tuple[str, float]] = [
    ("O(1)", 0.0),
    ("O(log n)", 0.15),
    ("O(n)", 1.0),
    ("O(n log n)", 1.15),
    ("O(n^2)", 2.0),
    ("O(n^3)", 3.0),
]


def _median_timeit(fn: Callable[[int], object], n: int, repeats: int = 7, warmup: int = 2) -> float:
    """Runs fn(n) `warmup` times to prime caches/interpreter, discards those,
    then returns the median of `repeats` timed runs (median resists GC-pause
    and OS-scheduling outliers far better than the mean)."""
    for _ in range(warmup):
        fn(n)
    samples: list[float] = []
    gc.disable()
    try:
        for _ in range(repeats):
            start = time.perf_counter()
            fn(n)
            samples.append(time.perf_counter() - start)
    finally:
        gc.enable()
    return statistics.median(samples)


def collect_samples(fn: Callable[[int], object], sizes: Sequence[int]) -> list[BenchmarkPoint]:
    if len(sizes) < 5:
        raise ValueError(
            "Need >=5 sample points to fit a stable curve (see Phase 4: Rollback & "
            "Self-Healing -- fewer points make the regression dangerously sensitive to noise)."
        )
    if sizes[-1] < sizes[0] * 100:
        raise ValueError(
            "Sample sizes must span >= 2 orders of magnitude (e.g. 10^2 to 10^4+) so "
            "that O(n) and O(n^2) curves are visibly distinguishable."
        )
    return [BenchmarkPoint(n=n, seconds=_median_timeit(fn, n)) for n in sizes]


def _linear_regression(xs: list[float], ys: list[float]) -> tuple[float, float, float]:
    """Ordinary least squares. Returns (slope, intercept, r_squared)."""
    n = len(xs)
    mean_x, mean_y = sum(xs) / n, sum(ys) / n
    ss_xy = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys))
    ss_xx = sum((x - mean_x) ** 2 for x in xs)
    ss_yy = sum((y - mean_y) ** 2 for y in ys)
    if ss_xx == 0:
        raise ValueError("All sample sizes identical; cannot fit a slope.")
    slope = ss_xy / ss_xx
    intercept = mean_y - slope * mean_x
    r_squared = 0.0 if ss_yy == 0 else (ss_xy ** 2) / (ss_xx * ss_yy)
    return slope, intercept, r_squared


def fit_complexity(points: list[BenchmarkPoint]) -> FitResult:
    clean = [p for p in points if p.seconds > 0]
    if len(clean) < 5:
        return FitResult(0, 0, 0, False, None, "O(1) or below clock resolution", "inconclusive")

    log_n = [math.log(p.n) for p in clean]
    log_t = [math.log(p.seconds) for p in clean]
    slope, intercept, r2 = _linear_regression(log_n, log_t)

    n_vals = [float(p.n) for p in clean]
    exp_slope, _exp_intercept, exp_r2 = _linear_regression(n_vals, log_t)

    if exp_r2 > r2 and exp_r2 > 0.95 and exp_slope > 0.01:
        return FitResult(
            exponent=slope, r_squared=r2, intercept=intercept,
            is_exponential_fit=True, exponential_rate=exp_slope,
            classification=f"O(c^n), c ~= {math.exp(exp_slope):.3f}",
            confidence="high" if exp_r2 > 0.98 else "medium",
        )

    nearest = min(_POWER_LAW_TABLE, key=lambda pair: abs(pair[1] - slope))
    confidence = "high" if r2 >= 0.97 else "medium" if r2 >= 0.90 else "low"
    if r2 < 0.80:
        confidence = "inconclusive"

    return FitResult(
        exponent=slope, r_squared=r2, intercept=intercept,
        is_exponential_fit=False, exponential_rate=None,
        classification=nearest[0], confidence=confidence,
    )


def benchmark_and_classify(
    fn: Callable[[int], object],
    sizes: Sequence[int] = (100, 300, 1000, 3000, 10000, 30000),
) -> FitResult:
    return fit_complexity(collect_samples(fn, sizes))


if __name__ == "__main__":
    def bubble_sort(n: int) -> None:
        data = list(range(n, 0, -1))
        for i in range(len(data)):
            for j in range(len(data) - i - 1):
                if data[j] > data[j + 1]:
                    data[j], data[j + 1] = data[j + 1], data[j]

    result = benchmark_and_classify(bubble_sort)
    print(f"Fitted exponent: {result.exponent:.2f}  R^2={result.r_squared:.3f}")
    print(f"Classification: {result.classification}  (confidence: {result.confidence})")
```

## Phase 3: Automated Verification

The analyzer is only trustworthy if it correctly classifies code with a **known** complexity. Verify it against fixtures before trusting its verdict on unknown code.

```python
"""
test_complexity_analyzer.py -- self-verification suite for the analyzer itself.
Run with: pytest -v test_complexity_analyzer.py
"""

import pytest
from complexity_static_analyzer import analyze_source, ComplexityClass
from empirical_complexity_benchmark import benchmark_and_classify


# ---------- Static analyzer self-checks ----------

def test_flags_naive_on2_nested_loop():
    src = """
def has_duplicate_pair(arr, target):
    for i in range(len(arr)):
        for j in range(len(arr)):
            if i != j and arr[i] + arr[j] == target:
                return True
    return False
"""
    [report] = analyze_source(src)
    assert report.estimated_class == ComplexityClass.O_N2
    assert report.max_loop_depth == 2


def test_flags_hidden_on2_from_index_in_loop():
    src = """
def rank_of_each(arr):
    sorted_arr = sorted(arr)
    ranks = []
    for x in arr:
        ranks.append(sorted_arr.index(x))
    return ranks
"""
    [report] = analyze_source(src)
    assert "hidden_linear_call" in {f.kind for f in report.findings}
    assert report.estimated_class == ComplexityClass.O_N2


def test_flags_string_concat_in_loop():
    src = """
def join_all(words):
    result = ""
    for w in words:
        result += w
    return result
"""
    [report] = analyze_source(src)
    assert any(f.kind == "string_concat_in_loop" for f in report.findings)


def test_recognizes_memoized_recursion_as_linear():
    src = """
from functools import lru_cache

@lru_cache(maxsize=None)
def fib(n):
    if n < 2:
        return n
    return fib(n - 1) + fib(n - 2)
"""
    [report] = analyze_source(src)
    assert report.is_memoized is True
    assert report.estimated_class == ComplexityClass.O_N


def test_flags_naive_fibonacci_as_exponential():
    src = """
def fib(n):
    if n < 2:
        return n
    return fib(n - 1) + fib(n - 2)
"""
    [report] = analyze_source(src)
    assert report.is_memoized is False
    assert report.estimated_class == ComplexityClass.O_2_N


def test_constant_time_function_has_zero_loop_depth():
    src = "def midpoint(a, b):\n    return (a + b) // 2\n"
    [report] = analyze_source(src)
    assert report.estimated_class == ComplexityClass.O_1


# ---------- Empirical benchmark self-checks (real thresholds) ----------

def test_benchmark_identifies_quadratic_bubble_sort():
    def bubble_sort(n):
        data = list(range(n, 0, -1))
        for i in range(len(data)):
            for j in range(len(data) - i - 1):
                if data[j] > data[j + 1]:
                    data[j], data[j + 1] = data[j + 1], data[j]

    result = benchmark_and_classify(bubble_sort, sizes=(50, 150, 400, 1000, 2500))
    assert result.confidence in {"high", "medium"}
    assert 1.7 <= result.exponent <= 2.4, f"expected ~2.0, got {result.exponent}"


def test_benchmark_identifies_linear_scan():
    def linear_scan(n):
        data = list(range(n))
        return sum(1 for x in data if x == -1)

    result = benchmark_and_classify(linear_scan, sizes=(1000, 5000, 20000, 80000, 320000))
    assert 0.7 <= result.exponent <= 1.3, f"expected ~1.0, got {result.exponent}"


def test_benchmark_rejects_too_few_sample_points():
    with pytest.raises(ValueError):
        benchmark_and_classify(lambda n: None, sizes=(10, 20, 30))


def test_benchmark_rejects_narrow_size_range():
    with pytest.raises(ValueError):
        benchmark_and_classify(lambda n: None, sizes=(1000, 1100, 1200, 1300, 1400))
```

Run it:

```bash
pip install pytest
pytest -v test_complexity_analyzer.py

# Quick manual smoke test against a real file:
python complexity_static_analyzer.py target_file.py
```

A clean pass on every test above is the bar for trusting a verdict on unseen code. If any fixture test fails after modifying the visitor logic, treat the analyzer itself as broken — do not report complexity findings to the user until it's green again.

## Phase 4: Rollback & Self-Healing

Both tools can be wrong in specific, predictable ways. Apply these heuristics before finalizing a verdict:

- **Small-N noise in curve fitting.** Never conclude from fewer than 5 sample points, or from points spanning less than 2 orders of magnitude — `collect_samples()` enforces this by raising `ValueError`. At small N, constant-factor overhead (function call setup, list allocation) dominates and can make an O(N) function's timing curve look flat or even slightly superlinear by accident.
- **Low R² means "inconclusive," not "wrong."** If `r_squared < 0.80`, report the classification as `confidence="inconclusive"` and say so explicitly rather than asserting a specific class — a bad fit usually means the timing was too noisy (background CPU load, thermal throttling, an I/O-bound step hidden inside the function) or the sizes chosen straddle a cache-size cliff that distorts the curve locally.
- **O(N) vs O(N log N) confusion at small-to-medium N.** These two curves are visually and numerically close (slope 1.0 vs ~1.1-1.2) until N is large. Widen the sample range (add a point at 10-100x the largest existing size) before distinguishing between them; don't trust a 5-point fit that tops out at N=10,000 to separate O(N) from O(N log N).
- **Static false positive: bounded/constant-size loops.** A `for x in (a, b, c):` or `for i in range(3):` loop is O(1), not O(N), regardless of nesting — the AST walker as written does not distinguish loop bound source, so **manually verify** that any flagged "nested_loop" or "n^k" finding is actually iterating over something that scales with the input, not a fixed-size constant.
- **Static false positive: early-exit loops.** A loop with a `break`/`return` reachable in O(1) or O(log N) expected iterations (e.g., short-circuiting search with a very selective condition) is flagged at its *worst-case* nesting depth, which is correct for worst-case Big-O — but note this explicitly when the practical/expected-case behavior is much better, so the human isn't misled into thinking it's *always* slow.
- **Static false negative: memoization not on the recursive function itself.** The analyzer only checks decorators on the exact `FunctionDef` node and a crude `"memo" in name.lower()` subscript heuristic. A memo table under a differently-named variable (e.g., `cache_dict`, `seen`, `dp`) or memoization implemented via a class attribute will be missed, and the function will be incorrectly flagged as exponential. Grep for any dict-like read-before-compute pattern before trusting an "exponential" verdict on recursive code.
- **Static false negative: indirect/mutual recursion.** `RecursionVisitor` only detects a function calling *itself* by name. `f() -> calls g() -> calls f()` (mutual recursion) is invisible to this check. If the code under review has multiple small recursive-looking functions calling each other, analyze them as a group manually, or extend `RecursionVisitor` to build a call graph before concluding "not recursive."
- **Static false positive: recursion argument shrink heuristic is syntactic, not semantic.** `_classify_shrink` looks for `n - <expr>` or `n // <expr>` textually in the *first* call argument. A recursive call like `f(helper(n))` where `helper` internally halves `n` will not be classified, and will fall through to `UNKNOWN` rather than a wrong answer — treat `UNKNOWN` as "needs the empirical benchmark," not "safe."
- **Environmental noise in benchmarking.** Always discard warm-up runs (JIT/interpreter cache priming) and use the median, not the mean, of repeated trials — a single GC pause or OS context switch can 10x one sample and wreck a mean-based fit; `_median_timeit` already implements this, but if porting to another language/runtime, preserve both the warm-up discard and the median aggregation.
- **When static and empirical disagree, empirical wins for a real deployment decision, static wins for explaining *why*.** If the AST walker says O(N²) but the benchmark fits O(N) with high confidence (e.g., the "N²" branch is dead code, or N never exceeds a small bound in practice), report both: the theoretical worst case (for correctness/defensive review) and the observed practical behavior (for the "will this actually TLE" question).

## Common Anti-Patterns vs. Gold Standard

| # | Anti-Pattern | Complexity | Gold Standard | Complexity | Rationale |
|---|---|---|---|---|---|
| 1 | Nested loop checking every pair for a match (`for i: for j: if a[i]+a[j]==target`) | O(N²) | Single pass with a hash set of "needed complements" | O(N) | Trades an O(N) linear scan of a set for the inner O(N) loop; classic two-sum pattern. |
| 2 | Building a string with `result += chunk` inside a loop | O(N²) | Append chunks to a `list`, then `"".join(list)` once | O(N) | Strings are immutable in Python; each `+=` allocates a new string of growing length. Lists amortize append to O(1). |
| 3 | Repeated `list.index(x)` / `x in some_list` to find or check elements inside a loop | O(N²) | Precompute a `dict`/`set` once, then O(1) lookups inside the loop | O(N) | `list.index`/`in` on a list is a linear scan; a hash-based structure turns each lookup into O(1) average case. |
| 4 | Unmemoized multi-branch recursion (naive Fibonacci: `fib(n-1)+fib(n-2)`) | O(2^N) | Add `@lru_cache` or a bottom-up DP array | O(N) | Without memoization, overlapping subproblems are recomputed exponentially many times; caching collapses it to one computation per distinct input. |
| 5 | Using a `list` as a FIFO queue via `pop(0)` / `insert(0, x)` | O(N) per op, O(N²) total | Use `collections.deque` with `popleft()`/`appendleft()` | O(1) amortized per op | Removing/inserting at index 0 of a list shifts every remaining element; `deque` is a doubly linked structure with O(1) at both ends. |
| 6 | Calling `.sort()` / `sorted()` inside a loop that re-sorts an unchanged or slowly-changing collection | O(N² log N) | Sort once outside the loop, or use a heap/sorted-container for incremental updates | O(N log N) | Sorting is not free; re-running it once per outer iteration multiplies its cost by the loop's trip count. |
| 7 | Recomputing a pure function's result for the same inputs across calls (no caching at all, e.g. repeated `is_prime(n)` checks in a sieve-shaped problem) | O(N · f(N)) redundant work | Precompute once with a sieve/DP table, or memoize | O(N) or O(N log log N) | Redundant recomputation is invisible complexity — the code "looks" correct and O(f(N)) per call, but the *aggregate* cost across the program is what a TLE verdict actually measures. |

## Pre-Flight Checklist

- [ ] Identified the exact function(s)/diff hunk in scope, not the whole file.
- [ ] Ran the Phase 1 grep sweep for hidden-cost patterns (`.index()`, `+=` on strings, `in [list]`, `.pop(0)`/`.insert(0,...)`, `sort()` in loops).
- [ ] Confirmed loop nesting depth manually and cross-checked with the AST walker (`complexity_static_analyzer.py`).
- [ ] Checked whether any flagged loop is actually bounded by a small constant (false-positive guard from Phase 4).
- [ ] Checked for direct AND indirect/mutual recursion, not just self-calls by exact name.
- [ ] Checked for existing memoization (decorator or manual dict) under any variable name, not just `memo`.
- [ ] Established the target `N` and time/memory limit the user actually cares about (competitive judge limit, production SLA, expected row count).
- [ ] Decided whether worst-case, average-case, or amortized complexity is the one the user is actually asking about.
- [ ] Confirmed the pytest fixture suite (Phase 3) is green before trusting the analyzer's verdict on new code.

## Post-Flight Checklist

- [ ] Reported both the static worst-case class AND the empirical benchmark class when they differ, with an explanation of the gap.
- [ ] Cited concrete line numbers for every hidden-cost finding (not just "there might be an O(n^2) somewhere").
- [ ] Cross-referenced the reported N against the rule-of-thumb table to give a concrete pass/fail verdict for the stated time limit.
- [ ] Flagged confidence level explicitly (`high`/`medium`/`low`/`inconclusive`) rather than presenting a curve-fit guess as certain.
- [ ] Suggested the specific gold-standard fix from the Anti-Patterns table (with a code sketch), not just a complexity label.
- [ ] Verified the suggested fix doesn't introduce a new hidden cost (e.g., swapping `list.index()` for a `dict` build that itself sits inside another loop).
- [ ] If benchmarking was used, disclosed the sample sizes and repeat/warm-up counts used, so the result is reproducible.
- [ ] Re-ran the static analyzer on the *proposed fix*, not just the original code, to confirm the new complexity class before declaring victory.
- [ ] Noted any amortized-vs-worst-case caveat if the fix relies on amortization (e.g., dynamic array growth, hash table resizing).
