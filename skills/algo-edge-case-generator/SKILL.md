---
name: algo-edge-case-generator
description: >
  Activate this skill when a user asks to "generate edge cases for this DSA problem",
  "find corner cases that break my solution", "stress test my algorithm", "what inputs
  would break this function", "give me adversarial test cases", "why does my solution
  fail on hidden test cases", "generate boundary/extreme inputs for this array/graph/string
  problem", or when reviewing a competitive-programming / LeetCode-style submission that
  passed sample tests but needs corner-case coverage before it is trusted (N=1, empty
  input, all-duplicates, max constraint bounds, integer overflow, disconnected graphs,
  self-loops, unicode strings). Also activate when a user pastes a function signature or
  problem statement and asks "what am I missing" or "is this solution correct" for an
  algorithmic task. Do NOT activate for general software test-writing (unit tests for
  business logic, API contract tests) unless the subject is explicitly an algorithmic /
  DSA input domain (arrays, graphs, trees, strings, numeric sequences).
version: 1.0.0
author: IEEE Computer Society of SLIIT
tags:
  - algorithms
  - testing
  - edge-cases
  - adversarial-inputs
  - competitive-programming
  - static-analysis
  - test-generation
  - graph-theory
---

# Algorithmic Edge-Case Generator

## Mission

Correct-looking algorithmic code fails almost exclusively at the boundaries: the empty
container, the singleton, the value sitting exactly on a limit, the graph with no edges,
the string built from one repeated codepoint. Happy-path tests over "normal" inputs
(N≈10, distinct positive integers, a connected graph with a handful of nodes) exercise
the mainline logic but never touch the branches where off-by-one errors, unchecked
null/empty guards, integer overflow, and unfounded uniqueness/connectivity assumptions
actually live. This skill exists to *systematically derive, generate, validate, and
inject* the minimal, maximal, and structurally-degenerate inputs implied by a problem's
declared constraints — turning "I think this handles edge cases" into a reproducible,
falsifiable test artifact. It operates in four phases: understand the problem's
constraint envelope (Discovery), mechanically generate every category of edge case that
envelope permits (Execution), prove the generated cases actually discriminate correct
from buggy implementations (Verification), and reject/repair any case that violates the
problem's own declared constraints before it ever reaches a test runner (Rollback).

---

## Mental Model & Theoretical Foundations

### Why boundaries, specifically

Three failure classes account for the overwhelming majority of algorithmic bugs, and
each has a canonical edge case that exposes it:

| Failure class | Root cause | Canonical exposer |
|---|---|---|
| Off-by-one | Loop bound uses `<` where `<=` was needed (or vice versa), or index arithmetic assumes ≥2 elements | N=1, N=0 |
| Unfounded structural assumption | Code assumes sortedness, distinctness, connectivity, or non-negativity that the spec never guaranteed | all-identical array, disconnected graph, negative values |
| Numeric boundary violation | Accumulator/index exceeds the language's representable range, or a "small" constant overflows when multiplied by N_max | value at `INT_MAX`, N at `N_max`, product `N_max * V_max` |

The skill's taxonomy below is organized by data-structure type because the *generation
mechanics* differ per type, but every category traces back to one of these three roots.

### Taxonomy of edge-case categories

**Arrays / Sequences**
- `empty` — length 0. Exposes unguarded `arr[0]` access, `min()`/`max()` on empty, reduce-without-seed.
- `single` — length 1. Exposes pairwise-comparison loops (`for i in range(len(arr)-1)`), two-pointer initialization assuming `left < right`.
- `all_same` — every element identical. Exposes algorithms relying on strict ordering (binary search variants, dedup-via-comparison, median-of-two assumptions).
- `sorted_ascending` / `sorted_descending` — already sorted or reverse-sorted. Exposes quicksort worst-case pivoting, "assume unsorted" shortcuts, monotonic-stack edge conditions.
- `all_duplicates_except_one` — exposes majority-element / distinct-count logic.
- `max_length_min_value` and `max_length_max_value` — stresses both size (performance/overflow) and magnitude simultaneously.
- `negative_extremes` — all values at the most-negative representable bound, exposes `abs()` overflow (`abs(INT_MIN)` in two's-complement).

**Graphs**
- `disconnected` — ≥2 components. Exposes BFS/DFS that assumes single-component reachability, path-existence checks that never verify unreachability.
- `self_loops` — edge `(v, v)`. Exposes cycle detection, degree-counting, and adjacency-set vs adjacency-list dedup bugs.
- `single_node` — |V|=1, |E|=0. Exposes shortest-path/topological-sort base cases.
- `no_edges` — |V|=N, |E|=0. Every node isolated.
- `complete_graph` — every pair connected. Stresses adjacency-matrix vs list performance and multi-edge handling.
- `tree_vs_cyclic` — a spanning tree (no cycles) vs the same edge count plus one back-edge that introduces exactly one cycle. Exposes cycle-detection logic (Union-Find, DFS-color) at its precise decision boundary.
- `multi_edge` / `parallel_edges` — duplicate edges between the same pair, with possibly different weights.
- `directed_vs_undirected_mismatch` — a directed edge set fed to code that assumes symmetry.

**Strings**
- `empty` — `""`. Exposes `s[0]`, `s[-1]`, pattern-matching base cases.
- `single_char`.
- `all_same_char` — exposes run-length / palindrome logic that assumes variety.
- `unicode` / `multi_byte` — codepoints outside ASCII (emoji, combining diacritics, CJK), exposing byte-length vs character-length confusion and indexing that assumes 1 byte = 1 char.
- `whitespace_only` and `leading_trailing_whitespace`.
- `max_length_repeated_pattern` — stresses substring-search worst cases (e.g. naive matcher on `"aaaa...a"` searching for `"aaa...ab"`).

**Numbers**
- `zero` — additive/multiplicative identity edge, division-by-zero triggers.
- `negative` and `negative_boundary` (language's most-negative representable value).
- `positive_boundary` (language's most-positive representable value).
- `overflow_adjacent` — a value one unit away from wrapping when combined with the operation under test (e.g. `INT_MAX - 1` fed into a function that adds 2).

### ASCII decision tree — selecting the applicable edge-case category

```
                        ┌─────────────────────────────┐
                        │  Declared input type from    │
                        │  problem statement /          │
                        │  function signature            │
                        └──────────────┬────────────────┘
                                       │
        ┌──────────────┬──────────────┼──────────────┬───────────────┐
        ▼              ▼              ▼              ▼               ▼
   array/list      graph/tree       string          integer      matrix/2D
        │              │              │              │               │
        ▼              ▼              ▼              ▼               ▼
 ┌─────────────┐ ┌──────────────┐ ┌───────────┐ ┌────────────┐ ┌───────────────┐
 │ N == 0 ?     │ │ V == 0 or 1? │ │ len==0?   │ │ at bound?  │ │ rows==0 or    │
 │  -> empty    │ │  -> single/  │ │ -> empty  │ │  -> ±MAX/  │ │ cols==0?      │
 │ N == 1 ?     │ │     null     │ │ len==1?   │ │     ±MIN   │ │  -> empty grid│
 │  -> single   │ │ E == 0 ?     │ │ -> single │ │ == 0 ?     │ │ rows==1 or    │
 │ all equal?   │ │  -> no_edges │ │ char      │ │  -> zero   │ │ cols==1?      │
 │  -> all_same │ │ components   │ │ all same  │ │ negative?  │ │  -> 1D degen. │
 │ sorted asc/  │ │ >1 ?         │ │ char?     │ │  -> neg    │ │ square vs     │
 │ desc already?│ │  -> disconn. │ │  -> repeat│ │     bound  │ │ rectangular?  │
 │  -> presorted│ │ self-loop    │ │ non-ASCII │ └────────────┘ └───────────────┘
 │ N == N_max ? │ │ present?     │ │ present?  │
 │  -> max size │ │  -> self_loop│ │  -> unicode│
 │ value at     │ │ E == V*(V-1) │ └───────────┘
 │ V_min/V_max? │ │ /2 (or V²)?  │
 │  -> boundary │ │  -> complete │
 └──────────────┘ │ acyclic w/   │
                   │ V-1 edges +1?│
                   │  -> tree_vs_ │
                   │     cyclic   │
                   └──────────────┘
```

Read the tree top-down per declared type; multiple leaves usually apply to the same
problem (e.g. an array problem is almost always tested against `empty`, `single`,
`all_same`, `sorted_ascending`, AND `max_length_max_value` — these are not mutually
exclusive alternatives, they are a checklist to exhaust).

---

## Phase 1: Discovery & Static Analysis

Before generating a single case, extract the problem's **constraint envelope**. Guessing
bounds produces cases that are either too weak (miss real bugs) or invalid (rejected by
the judge / the function's own precondition checks). Three sources, checked in order of
reliability:

1. **Explicit constraints block** (competitive-programming statements almost always have
   one, e.g. `1 <= N <= 10^5`, `-10^9 <= arr[i] <= 10^9`). Parse with a constraint-line
   regex; do not hand-transcribe — transcription is where off-by-one leaks into the test
   generator itself.
2. **Type signature / docstring** (library-style problems). A signature like
   `def solve(nums: list[int]) -> int` with a docstring stating `1 <= len(nums) <= 200000`
   and `-10**9 <= nums[i] <= 10**9` carries the same information in a different shape.
3. **Special guarantees in prose** — sentences like "all values are distinct", "the graph
   is guaranteed connected", "the array is already sorted" *narrow* the envelope and must
   suppress the edge-case categories they rule out (do not generate a duplicate-heavy
   case for a problem that guarantees distinctness — that case is not a bug exposer, it
   is an invalid input the reference solution is entitled to mishandle).

```python
from __future__ import annotations
import re
from dataclasses import dataclass, field


@dataclass
class ConstraintEnvelope:
    """Parameterizes every downstream generator. Nothing is generated without
    an envelope — a bare 'use int bounds' fallback is a last resort, logged
    loudly, never a silent default."""
    n_min: int = 0
    n_max: int = 100
    value_min: int = -10**9
    value_max: int = 10**9
    distinct_required: bool = False
    sorted_required: bool = False          # 'asc' | 'desc' | None handled via literal below
    connected_required: bool = False
    directed: bool = False
    self_loops_allowed: bool = True
    allows_negative_weights: bool = False
    notes: list[str] = field(default_factory=list)


_RANGE_RE = re.compile(
    r"(-?\d+)\s*(?:<=|≤)\s*([A-Za-z_][\w\[\]]*)\s*(?:<=|≤)\s*(-?\d+(?:\^\d+|e\d+)?)"
)
_POW_RE = re.compile(r"(\d+)\^(\d+)")


def _normalize_bound(token: str) -> int:
    m = _POW_RE.fullmatch(token)
    if m:
        base, exp = int(m.group(1)), int(m.group(2))
        return base ** exp
    if "e" in token:
        mantissa, exp = token.split("e")
        return int(float(mantissa) * (10 ** int(exp)))
    return int(token)


def extract_envelope(problem_statement: str) -> ConstraintEnvelope:
    """Static-analysis pass over a problem statement's constraints block.
    Falls back to conservative library-style defaults, and always records
    what it could NOT determine so Phase 4 can refuse to guess silently.
    """
    env = ConstraintEnvelope()
    found_n = False
    found_v = False

    for lo_raw, sym, hi_raw in _RANGE_RE.findall(problem_statement):
        lo, hi = _normalize_bound(lo_raw), _normalize_bound(hi_raw)
        sym_lower = sym.lower()
        if sym_lower in ("n", "len(nums)", "arr.length", "len(arr)", "m", "v", "e"):
            env.n_min, env.n_max = lo, hi
            found_n = True
        elif "[" in sym or "i]" in sym or sym_lower in ("val", "value", "weight"):
            env.value_min, env.value_max = lo, hi
            found_v = True

    lowered = problem_statement.lower()
    env.distinct_required = "distinct" in lowered or "unique" in lowered
    env.sorted_required = "sorted" in lowered or "non-decreasing" in lowered
    env.connected_required = "connected" in lowered and "disconnected" not in lowered
    env.directed = "directed graph" in lowered
    env.self_loops_allowed = "no self-loop" not in lowered and "self loop" not in lowered.replace("no self-loops", "")
    env.allows_negative_weights = "negative weight" in lowered or "negative-weight" in lowered

    if not found_n:
        env.notes.append("N bound not found in statement — using conservative default; "
                          "VERIFY before trusting max_length cases.")
    if not found_v:
        env.notes.append("Value bound not found — using int32-safe default; "
                          "VERIFY against actual language/type used.")
    return env
```

Rules of thumb applied above:
- Never invent a numeric bound — if the regex fails to find one, flag it (`notes`), don't
  silently substitute a guess and proceed as if it were ground truth.
- Prose guarantees (`distinct`, `sorted`, `connected`) actively *remove* edge-case
  categories from the generation plan rather than only adding them — generating an
  invalid case wastes a verification cycle and can produce false-positive "bug found"
  reports against a reference implementation that correctly assumed the guarantee.

---

## Phase 2: Execution & Implementation

Each generator below is pure, typed, deterministic where possible (seeded RNG for any
randomized filler), and returns data structures ready to serialize to a test-case file.
All generators accept the `ConstraintEnvelope` from Phase 1 — no hardcoded bounds.

### 2.1 Array edge-case generator

```python
from __future__ import annotations
from typing import TypedDict
import random


class ArrayCase(TypedDict):
    name: str
    input: list[int]
    category: str


def generate_array_edge_cases(env: ConstraintEnvelope, seed: int = 1337) -> list[ArrayCase]:
    rng = random.Random(seed)
    cases: list[ArrayCase] = []

    def add(name: str, category: str, arr: list[int]) -> None:
        cases.append({"name": name, "input": arr, "category": category})

    # --- size boundaries ---
    if env.n_min == 0:
        add("empty_array", "empty", [])
    add("single_element_min_value", "single", [env.value_min])
    add("single_element_max_value", "single", [env.value_max])

    # --- structural degeneracies ---
    if not env.distinct_required:
        add("all_elements_identical_min", "all_same", [env.value_min] * min(env.n_max, 1000))
        add("all_elements_identical_max", "all_same", [env.value_max] * min(env.n_max, 1000))
        add("all_but_one_duplicate", "near_duplicate",
            [env.value_min] * (min(env.n_max, 1000) - 1) + [env.value_max])

    n_probe = min(env.n_max, 1000)
    ascending = sorted(rng.sample(range(env.value_min, env.value_max), min(n_probe, env.value_max - env.value_min)))
    add("already_sorted_ascending", "sorted_ascending", ascending)
    add("already_sorted_descending", "sorted_descending", list(reversed(ascending)))

    # --- magnitude + size stress combined (catches N_max * V_max overflow) ---
    add("max_length_all_max_value", "overflow_stress", [env.value_max] * env.n_max)
    add("max_length_all_min_value", "overflow_stress", [env.value_min] * env.n_max)

    # --- negative extremes (abs()-overflow class of bug) ---
    add("all_negative_boundary", "negative_extremes", [env.value_min] * min(env.n_max, 100))

    # --- alternating boundary values (stresses comparator branches both ways) ---
    alt = [env.value_min if i % 2 == 0 else env.value_max for i in range(min(env.n_max, 100))]
    add("alternating_min_max", "alternating_boundary", alt)

    return cases
```

### 2.2 Graph edge-case generator (adjacency list)

```python
from typing import TypedDict


class GraphCase(TypedDict):
    name: str
    category: str
    num_nodes: int
    edges: list[tuple[int, int]]
    directed: bool
    weights: list[int] | None


def generate_graph_edge_cases(env: ConstraintEnvelope) -> list[GraphCase]:
    cases: list[GraphCase] = []

    def add(name: str, category: str, n: int, edges: list[tuple[int, int]],
            weights: list[int] | None = None) -> None:
        cases.append({
            "name": name, "category": category, "num_nodes": n,
            "edges": edges, "directed": env.directed, "weights": weights,
        })

    # single node, no edges
    add("single_node_no_edges", "single_node", 1, [])

    # fully disconnected: N isolated nodes
    n_small = max(env.n_min, 4)
    add("no_edges_all_isolated", "no_edges", n_small, [])

    # two disjoint components
    half = n_small // 2
    disconnected_edges = [(i, i + 1) for i in range(half - 1)] + \
                          [(half + i, half + i + 1) for i in range(n_small - half - 1)]
    add("two_disjoint_components", "disconnected", n_small, disconnected_edges)

    # self-loop, only if permitted by constraints
    if env.self_loops_allowed:
        add("self_loop_on_single_node", "self_loops", 3, [(0, 0), (0, 1), (1, 2)])

    # complete graph on a small N (K_n) — combinatorial edge blowup
    k = min(n_small, 6)
    complete_edges = [(i, j) for i in range(k) for j in range(i + 1, k)]
    add("complete_graph_small", "complete_graph", k, complete_edges)

    # spanning tree (acyclic, V-1 edges) vs same graph + 1 extra edge (exactly one cycle)
    tree_edges = [(i, i + 1) for i in range(n_small - 1)]
    add("spanning_tree_acyclic", "tree_vs_cyclic", n_small, tree_edges)
    add("tree_plus_one_back_edge", "tree_vs_cyclic", n_small, tree_edges + [(n_small - 1, 0)])

    # parallel/multi edges between the same pair
    add("parallel_edges_duplicate_pair", "multi_edge", 3, [(0, 1), (0, 1), (1, 2)])

    # negative-weight edges, only if the problem allows them (else invalid, see Phase 4)
    if env.allows_negative_weights:
        neg_edges = [(0, 1), (1, 2), (0, 2)]
        add("negative_weight_triangle", "negative_weights", 3, neg_edges,
            weights=[env.value_min, 1, env.value_max])

    # max-size sparse graph (performance / stack-depth stress for recursive DFS)
    n_max_probe = min(env.n_max, 100_000)
    chain_edges = [(i, i + 1) for i in range(n_max_probe - 1)]
    add("max_size_chain_recursion_stress", "max_bounds", n_max_probe, chain_edges)

    return cases
```

### 2.3 String edge-case generator

```python
class StringCase(TypedDict):
    name: str
    category: str
    input: str


def generate_string_edge_cases(env: ConstraintEnvelope) -> list[StringCase]:
    cases: list[StringCase] = []

    def add(name: str, category: str, s: str) -> None:
        cases.append({"name": name, "category": category, "input": s})

    if env.n_min == 0:
        add("empty_string", "empty", "")
    add("single_char", "single", "a")
    add("all_same_char_max_len", "all_same_char", "a" * min(env.n_max, 10_000))
    add("whitespace_only", "whitespace", " " * 5)
    add("leading_trailing_whitespace", "whitespace", "   payload   ")

    # unicode: emoji (surrogate pair on some platforms), combining diacritic, CJK
    add("unicode_emoji", "unicode", "héllo🔥世界")
    add("unicode_combining_diacritics", "unicode", "é́́")  # e + combining acute x3

    # naive-substring-search worst case: haystack of one repeated char,
    # needle of (len-1) copies + one mismatch at the end
    haystack_len = min(env.n_max, 10_000)
    haystack = "a" * haystack_len
    needle = "a" * (min(haystack_len, 50) - 1) + "b"
    add("naive_search_worst_case_haystack", "pathological_pattern", haystack)
    cases[-1]["category"] = "pathological_pattern"
    add("naive_search_worst_case_needle", "pathological_pattern", needle)

    return cases
```

### 2.4 Numeric boundary generator (language-accurate int limits)

```python
import sys


class NumericCase(TypedDict):
    name: str
    category: str
    value: int


def generate_numeric_edge_cases(env: ConstraintEnvelope, *, bit_width: int = 32) -> list[NumericCase]:
    """Python ints are arbitrary-precision — there is no native overflow to
    trigger. When the *target* language/runtime is fixed-width (C/C++/Java/Rust/
    a 32-bit judge), use the language's real limits, not Python's sys.maxsize.
    """
    cases: list[NumericCase] = []

    def add(name: str, category: str, v: int) -> None:
        cases.append({"name": name, "category": category, "value": v})

    add("zero", "zero", 0)
    add("value_min_bound", "negative_boundary", env.value_min)
    add("value_max_bound", "positive_boundary", env.value_max)

    if bit_width == 32:
        int_min, int_max = -(2 ** 31), 2 ** 31 - 1
    elif bit_width == 64:
        int_min, int_max = -(2 ** 63), 2 ** 63 - 1
    else:
        int_min, int_max = -(2 ** (bit_width - 1)), 2 ** (bit_width - 1) - 1

    add("language_int_min", "language_boundary", int_min)
    add("language_int_max", "language_boundary", int_max)
    add("abs_of_int_min_overflow_trap", "overflow_trap", int_min)  # abs(INT_MIN) overflows in two's complement
    add("one_below_int_max", "overflow_adjacent", int_max - 1)
    add("one_above_int_min", "overflow_adjacent", int_min + 1)

    # a value that overflows only when combined with N_max via the operation
    # under test (classic: sum of N_max copies of value_max overflows int64)
    add("value_that_overflows_when_summed_n_max_times", "product_overflow",
        env.value_max if env.value_max * env.n_max > int_max else env.value_max)

    return cases
```

### 2.5 Emitting real test-case files

```python
import json
from pathlib import Path


def write_test_case_files(cases: list[dict], out_dir: str, problem_id: str) -> list[Path]:
    """Serializes each case as its own JSON file: <problem_id>/<category>__<name>.json
    One file per case (not one giant blob) so a test runner can shard, and a
    single failing case shows up as a single failing file in CI output.
    """
    base = Path(out_dir) / problem_id
    base.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []
    for case in cases:
        fname = f"{case['category']}__{case['name']}.json"
        path = base / fname
        path.write_text(json.dumps(case, indent=2, sort_keys=True))
        written.append(path)
    return written
```

---

## Phase 3: Automated Verification

A generated edge case is worthless until it is proven to actually discriminate a correct
solution from a plausible buggy one. Verification runs every generated case through
(a) a trusted reference implementation and (b) one or more intentionally-buggy
"mutant" implementations representing the exact failure classes from the Mental Model
section — an edge case that neither implementation disagrees on is not adversarial, it's
padding, and should be pruned.

```python
# verify_edge_cases.py — run with: python verify_edge_cases.py <problem_id>
from typing import Callable
import sys


def reference_max_subarray_sum(arr: list[int]) -> int:
    """Correct Kadane's algorithm — handles empty and all-negative correctly."""
    if not arr:
        raise ValueError("undefined on empty array")
    best = cur = arr[0]
    for x in arr[1:]:
        cur = max(x, cur + x)
        best = max(best, cur)
    return best


def buggy_max_subarray_sum_off_by_one(arr: list[int]) -> int:
    """Classic bug: initializes best/cur to 0 instead of arr[0], silently
    returning 0 for all-negative arrays instead of the correct max negative sum."""
    best = cur = 0
    for x in arr:
        cur = max(x, cur + x)
        best = max(best, cur)
    return best


def buggy_max_subarray_sum_no_empty_guard(arr: list[int]) -> int:
    best = cur = arr[0]  # IndexError on empty input — never guarded
    for x in arr[1:]:
        cur = max(x, cur + x)
        best = max(best, cur)
    return best


MUTANTS: dict[str, Callable[[list[int]], int]] = {
    "off_by_one_zero_init": buggy_max_subarray_sum_off_by_one,
    "missing_empty_guard": buggy_max_subarray_sum_no_empty_guard,
}


def verify_case_is_discriminating(case: dict, reference: Callable, mutants: dict) -> dict:
    arr = case["input"]
    result = {"case": case["name"], "discriminates": [], "reference_error": None}
    try:
        expected = reference(arr)
    except Exception as e:
        result["reference_error"] = f"{type(e).__name__}: {e}"
        expected = None

    for mutant_name, mutant_fn in mutants.items():
        try:
            got = mutant_fn(arr)
            triggered = (result["reference_error"] is None and got != expected)
        except Exception:
            triggered = result["reference_error"] is None  # mutant crashed, reference didn't
        if triggered:
            result["discriminates"].append(mutant_name)
    return result


def run_verification_suite(cases: list[dict]) -> None:
    non_discriminating = []
    for case in cases:
        r = verify_case_is_discriminating(case, reference_max_subarray_sum, MUTANTS)
        status = "PASS (adversarial)" if r["discriminates"] or r["reference_error"] else "WEAK"
        print(f"[{status}] {r['case']:<35} discriminates={r['discriminates']} "
              f"ref_error={r['reference_error']}")
        if status == "WEAK":
            non_discriminating.append(r["case"])

    assert not non_discriminating, (
        f"{len(non_discriminating)} generated case(s) discriminate NO known mutant — "
        f"prune or strengthen: {non_discriminating}"
    )
    print(f"\n{len(cases)} cases verified, all adversarial against {len(MUTANTS)} mutants.")


if __name__ == "__main__":
    from pathlib import Path
    import json
    problem_id = sys.argv[1] if len(sys.argv) > 1 else "max_subarray_sum"
    case_dir = Path("test_cases") / problem_id
    loaded = [json.loads(p.read_text()) for p in case_dir.glob("*.json")]
    run_verification_suite(loaded)
```

Shell entry points to wire into CI or run ad hoc:

```bash
# generate + write + verify in one pass
python -c "
from generators import extract_envelope, generate_array_edge_cases, write_test_case_files
env = extract_envelope(open('problem_statement.txt').read())
cases = generate_array_edge_cases(env)
write_test_case_files(cases, 'test_cases', 'max_subarray_sum')
"
python verify_edge_cases.py max_subarray_sum

# fail the build if any generated case is non-adversarial (exit code from assert)
python verify_edge_cases.py max_subarray_sum || exit 1
```

---

## Phase 4: Rollback & Self-Healing

A generated case that violates the problem's *own* declared constraints is not an edge
case — it is a false bug report waiting to happen (a reference solution is allowed to do
anything on an input outside its contract). Every case must be validated against the
`ConstraintEnvelope` before it is written to disk or handed to a test runner.

```python
class InvalidEdgeCaseError(ValueError):
    """Raised when a generated case violates the problem's declared constraints."""


def validate_array_case(case: ArrayCase, env: ConstraintEnvelope) -> ArrayCase:
    arr = case["input"]
    n = len(arr)

    if not (env.n_min <= n <= env.n_max):
        raise InvalidEdgeCaseError(
            f"{case['name']}: length {n} outside declared bounds "
            f"[{env.n_min}, {env.n_max}]"
        )
    for v in arr:
        if not (env.value_min <= v <= env.value_max):
            raise InvalidEdgeCaseError(
                f"{case['name']}: value {v} outside declared bounds "
                f"[{env.value_min}, {env.value_max}]"
            )
    if env.distinct_required and len(set(arr)) != len(arr):
        raise InvalidEdgeCaseError(
            f"{case['name']}: contains duplicates but problem guarantees distinct values"
        )
    if env.sorted_required and arr != sorted(arr):
        raise InvalidEdgeCaseError(
            f"{case['name']}: unsorted but problem guarantees sorted input"
        )
    return case


def self_heal_or_drop(cases: list[ArrayCase], env: ConstraintEnvelope) -> list[ArrayCase]:
    """Self-healing policy, applied in order:
    1. Clamp out-of-range values into bounds (magnitude violations) — this
       preserves the *intent* of the case (still a boundary value, just the
       correct one) rather than discarding it.
    2. Deduplicate-then-pad when distinctness was violated and padding with
       fresh values keeps length in bounds.
    3. Sort in place when sortedness was violated and the problem requires it
       (sortedness violations are almost always a generator bug, not a
       meaningful edge case — 'sorted but with a large jump' is the actual
       edge case, not 'unsorted').
    4. Otherwise: DROP the case and log why. Never silently keep an invalid
       case, and never mutate away an out-of-bounds LENGTH (that changes
       what the case is testing) — length violations are always dropped.
    """
    healed: list[ArrayCase] = []
    for case in cases:
        arr = list(case["input"])
        name = case["name"]

        if not (env.n_min <= len(arr) <= env.n_max):
            print(f"DROP {name}: length {len(arr)} unfixable without changing case intent")
            continue

        clamped = [max(env.value_min, min(env.value_max, v)) for v in arr]
        if clamped != arr:
            print(f"HEAL {name}: clamped {sum(1 for a,b in zip(arr, clamped) if a != b)} "
                  f"value(s) into [{env.value_min}, {env.value_max}]")
            arr = clamped

        if env.distinct_required and len(set(arr)) != len(arr):
            seen = set()
            deduped = []
            next_fill = env.value_min
            for v in arr:
                while v in seen:
                    v = next_fill
                    next_fill += 1
                seen.add(v)
                deduped.append(v)
            print(f"HEAL {name}: de-duplicated to satisfy distinctness guarantee")
            arr = deduped

        if env.sorted_required and arr != sorted(arr):
            print(f"HEAL {name}: sorted in place to satisfy sortedness guarantee "
                  f"(NOTE: re-check this case still targets its intended category)")
            arr = sorted(arr)

        try:
            healed.append(validate_array_case({**case, "input": arr}, env))
        except InvalidEdgeCaseError as e:
            print(f"DROP {name}: unhealable — {e}")
    return healed
```

Rollback checklist when a downstream test run reports a "bug" from a generated case:

1. Re-run `validate_array_case` (or the graph/string equivalent) against the exact case
   that triggered the failure — if validation fails, the report is a **false positive
   from an invalid input**, not a real bug. Discard the report, fix the generator.
2. If validation passes but the reference implementation also fails, the reference is
   wrong, not the case — escalate to the reference author, do not weaken the case.
3. If a category was over-broad (e.g. `all_same` generated with a value outside bounds
   for one specific N), narrow the generator's parameterization rather than special-casing
   the output — the fix belongs in Phase 2, not as a one-off patch to the emitted file.

---

## Common Anti-Patterns vs Gold Standard

| Anti-Pattern | Why it fails | Gold Standard |
|---|---|---|
| Hardcoding `N=100000` / `INT_MAX` as literals across every generator | Silently wrong the moment the problem's actual constraints differ (e.g. `N <= 500`); produces "edge cases" that are invalid inputs | Always derive bounds from a `ConstraintEnvelope` extracted in Phase 1; treat unparsed constraints as a loud warning, never a silent default |
| Generating one "big" array and one "small" array and calling it done | Conflates *size* stress with *structural* stress — misses all-duplicates, sortedness, and negative-magnitude bug classes entirely | Enumerate the full taxonomy per data-structure type (empty, single, all-same, sorted both directions, magnitude extremes) as independent, named categories |
| Treating `random.randint()` output as an edge case | Random-in-range inputs are exactly the *non*-adversarial inputs that already pass — they hit the mainline, not the boundary | Edge cases are deliberately constructed at declared limits and structural degeneracies, not sampled; use randomness only to fill "don't care" positions within an otherwise-engineered case |
| Assuming a generated case is valid because "it looks extreme" | An extreme-looking case (e.g. duplicates) can silently violate a stated guarantee (distinctness) and produce a false bug report against a reference that never claimed to handle it | Every case passes through Phase 4 validation against the actual declared constraints before it is trusted or shipped |
| Shipping edge cases without ever running them against a known-buggy implementation | An untested "edge case" might not actually distinguish correct from incorrect behavior — it's inert padding, not adversarial input | Phase 3: verify every case flips the result (or raises) on at least one intentionally-buggy mutant relative to the reference implementation |
| One monolithic test file containing all cases concatenated | A single failing case is invisible in a wall of assertions; can't shard, can't bisect, can't rerun just the failure | One file per case (`category__name.json`), named so a CI failure log immediately identifies which category regressed |
| Using Python's arbitrary-precision ints as a stand-in for "integer boundary" in a C++/Java target | Python never overflows — a case built from `sys.maxsize` says nothing about `INT_MAX` in the target runtime | Parameterize numeric generators by the target language's actual bit width (`int32`, `int64`) and compute real two's-complement limits |
| Generating disconnected-graph cases for a problem that states "the graph is guaranteed connected" | Produces a structurally invalid input; any "bug" found against it is not reproducible under contest/production conditions | Suppress edge-case categories explicitly ruled out by prose guarantees discovered in Phase 1 (`connected_required`, `distinct_required`, `sorted_required`) |

---

## Pre-Flight Checklist

- [ ] Problem statement, docstring, or type signature has been read in full — not skimmed for just the function name.
- [ ] `ConstraintEnvelope` extracted via Phase 1 static analysis; any bound the extractor could not find is flagged in `notes`, not silently defaulted.
- [ ] Prose guarantees (`distinct`, `sorted`, `connected`, `no self-loops`, `non-negative weights`) explicitly checked and encoded — not assumed absent.
- [ ] Target language/runtime for numeric bounds identified (Python has no overflow; C/C++/Java/Rust do) so `bit_width` is set correctly.
- [ ] Declared input data-structure category confirmed (array vs graph vs string vs numeric vs matrix) so the correct generator module is invoked.
- [ ] A trusted reference implementation exists (or is written) to serve as the ground truth for Phase 3 verification — generation without a reference cannot be verified.
- [ ] At least one intentionally-buggy mutant per known failure class (off-by-one, missing empty guard, unfounded uniqueness/sortedness assumption, overflow) is available or written for verification.
- [ ] Output directory for emitted test-case files is confirmed and does not silently overwrite an unrelated problem's existing case set.

## Post-Flight Checklist

- [ ] Every generated case passed `validate_*_case` against the `ConstraintEnvelope` — zero invalid cases were written to disk (Phase 4 ran, not skipped).
- [ ] Every generated case was run through `run_verification_suite` and discriminates at least one known mutant, or raises the documented reference error (Phase 3 completed, not merely "generated").
- [ ] Any case that failed validation was either healed with a logged, intent-preserving transformation, or dropped with a logged reason — never silently discarded without a trace.
- [ ] Non-discriminating ("WEAK") cases identified by the verification suite were pruned or strengthened, not left in the shipped set as padding.
- [ ] File naming follows `<category>__<name>.json` and each file is independently loadable/runnable (no cross-file dependencies).
- [ ] Numeric boundary cases were generated using the *target* language's actual integer limits, not the generator language's (Python) unbounded ints.
- [ ] Coverage spot-check: for the declared input type, every taxonomy category in the Mental Model section that is NOT excluded by a prose guarantee has at least one corresponding generated case.
- [ ] Summary of what was generated, healed, dropped, and verified is presented back to the requester in plain terms (counts per category, any constraint-envelope ambiguities flagged in Phase 1) — not just a silent file drop.
