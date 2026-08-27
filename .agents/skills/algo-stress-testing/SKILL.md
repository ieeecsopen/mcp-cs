---
name: algo-stress-testing
description: "Activate when a competitive-programming or AlgoJudge-style solution is failing hidden/system tests with a Wrong Answer (WA) verdict, an intermittent WA that only reproduces on certain inputs, or a Time Limit Exceeded (TLE) that appears solution-specific rather than universal. Trigger on explicit requests to 'stress test', 'differential test', 'fuzz test', 'random test', or 'compare against brute force'; on phrasings like 'my solution passes the samples but fails hidden tests', 'find a counterexample', 'find the smallest/minimal failing case', 'my AC-looking solution WAs on system tests', or 'this TLEs on some hidden input but I can't find which'. Also trigger when the working files include a fast/optimized solution (solution.cpp, sol.py, fast.py, main.cpp) that needs to be checked against a brute-force reference (brute.cpp, naive.py, slow.py) using a randomized test generator (gen.py, generator.cpp, gen.cpp). Do NOT activate for compile errors, runtime crashes with an obvious stack trace/exception, pure algorithm-design brainstorming with no implementation yet, or performance profiling that is unrelated to output correctness."
version: 1.0.0
author: IEEE Computer Society of SLIIT
tags: [stress-testing, differential-testing, brute-force, competitive-programming, fuzzing, test-generation, debugging, algojudge]
---

# Algorithm Stress-Testing Workflow

Differential (stress) testing finds bugs in a fast, optimized competitive-programming
solution by generating a large volume of randomized inputs, running the fast solution
and a deliberately simple, obviously-correct brute-force solution side by side, and
flagging any input where their outputs disagree. This skill is the operational runbook
for that workflow inside this project: it covers the theory of why this technique
catches bugs that hand-picked unit tests miss, the concrete phases of running it
(discovery, execution, verification, and self-healing when the harness itself
misbehaves), and battle-tested code for the harness and its generators — mirroring the
generate/run/compare/shrink loop that this project's own AlgoJudge engine uses to
grade and sandbox untrusted submissions.

## Mental Model & Theoretical Foundations

**Why differential testing finds bugs that unit tests miss.** A hand-written test suite
only covers the inputs a human thought to write down — usually the sample cases from
the problem statement, plus one or two "obvious" edge cases the author remembered.
The input space of a competitive-programming problem, by contrast, is combinatorially
large: every permutation of array values, every possible graph topology, every
boundary of N. A bug that only manifests when three specific conditions coincide
(e.g. duplicate values *and* N is odd *and* the array is already sorted) is exactly
the kind of bug a human will never think to hand-write, but a generator producing
thousands of randomized inputs per minute will stumble into by sheer coverage. Stress
testing trades the *precision* of a hand-picked test (a human understood why this case
matters) for *volume and blindness* (nobody needs to understand why a case matters
for it to be tried) — and volume wins for the class of bugs that live in the gaps
between the cases a human would think of.

**The generator randomness vs. shrinking tradeoff.** A generator that produces large,
maximally random inputs (N near the upper bound, values spread across the full range)
maximizes the chance of *triggering* a latent bug, because it explores more of the
input space per run. But a large random input is nearly useless for *debugging* —
staring at a 500-line failing case to find which part of it matters is slower than
rewriting the fast solution from scratch. Shrinking (also called delta-debugging or
test-case reduction) resolves this tension: let the generator be as aggressively
random and large as necessary to *find* a failure, then algorithmically strip away
everything about that failing case that isn't necessary to *reproduce* it. The
generator's job is recall (find any failure at all); the shrinker's job is precision
(reduce it to the smallest input a human can reason about). Never try to make the
generator itself produce small cases "to make debugging easier" — that just lowers
your chance of finding the bug in the first place. Generate big, shrink after.

**Why the brute force must be trivially, independently correct.** The entire technique
rests on the brute force being a *ground truth*, not just "another implementation."
If the brute force is wrong, every mismatch it reports could be a false positive, and
every case where it agrees with the fast solution could be two solutions sharing the
same bug. This is only safe if the brute force is written using the most direct,
naive translation of the problem statement possible — nested loops instead of a
segment tree, direct recursion instead of memoized DP, checking all subsets instead
of a greedy or DP argument — even if it runs in O(N!) or O(2^N). Correctness must be
verifiable by reading the code once, not by testing it, because there is nothing
"more correct" left to test it against at this stage (see Phase 4 for what to do when
you need to verify the brute force itself).

**The stress-test loop as a state machine:**

```
   ┌────────────┐
   │   START    │
   └─────┬──────┘
         │
         ▼
   ┌───────────────────────┐
   │ GENERATE(seed = i)     │◄────────────────────────────┐
   │  -> input_text         │                              │
   └─────────┬─────────────┘                               │
             ▼                                             │
   ┌───────────────────────┐                               │
   │ RUN fast(input_text)   │                               │
   │ RUN brute(input_text)  │   (each under its own timeout)│
   └─────────┬─────────────┘                                │
             ▼                                              │
   ┌───────────────────────┐        MATCH                   │
   │ COMPARE outputs        ├─────────────────────────────  ┘
   │ (whitespace/numeric-   │        i = i + 1, i < N ?  -- yes, loop
   │  tolerant)             │
   └─────────┬─────────────┘
             │ MISMATCH  /  TIMEOUT  /  NONZERO EXIT
             ▼
   ┌───────────────────────┐
   │ SHRINK failing input   │
   │ (delta-debug / binary  │
   │  search on size)       │
   └─────────┬─────────────┘
             ▼
   ┌───────────────────────┐
   │ REPORT minimal case +  │
   │ both outputs, exit(1)  │
   └───────────────────────┘
```

Every loop iteration is one independent trial; the loop only exits early on the
first reproducible disagreement, at which point control permanently leaves the
"generate" cycle and moves into the one-shot shrink-and-report path.

## Phase 1: Discovery & Static Analysis

Before writing a single line of generator or harness code, spend a few minutes
establishing whether stress testing is even the right tool, and what bounds to use.

1. **Extract constraints from the problem statement.** Pull out every numeric bound
   the statement gives — N, value ranges, number of queries, time limit, memory
   limit — and write them down explicitly. These become the generator's parameter
   bounds; guessing bounds instead of reading them is the single most common cause of
   a stress test that "passes" while the real submission still fails on the judge
   (because the generator never explored the actual constraint range).

2. **Distinguish a WA-class bug from a TLE-class bug before testing.** Estimate the
   fast solution's time complexity from its loop nesting and data structures, then
   sanity-check it against the stated N and time limit using the standard rule of
   thumb of roughly 10^8 simple operations per second:

   | N (constraint)      | Safe complexity budget (TL ≈ 1–2s, ~10^8 ops/s) |
   |----------------------|--------------------------------------------------|
   | N ≤ 10               | O(N!) or O(2^N · N)                               |
   | N ≤ 20–22            | O(2^N · N)                                        |
   | N ≤ 500              | O(N^3)                                            |
   | N ≤ 5,000            | O(N^2)                                            |
   | N ≤ 10^5             | O(N log N)                                        |
   | N ≤ 10^6 – 10^7      | O(N)                                              |
   | N ≤ 10^9 and beyond  | O(log N) or O(√N)                                 |

   If the "fast" solution's actual complexity already exceeds this budget at the
   stated N, the bug is architectural (wrong algorithm family), not a correctness
   edge case — stress testing at small N will report "no mismatches found" and give
   false confidence, because small N never triggers the slowdown. In that situation,
   run a single large-N timing test first (Phase 2 harness supports this by setting
   `--max-n` to the real constraint and watching `RunResult.elapsed`), and only move
   to full differential stress testing once the complexity class itself is confirmed
   sound.

3. **Look for a different-algorithm-family mismatch.** Read the fast solution's core
   approach (greedy, DP, binary search, flow, etc.) and ask whether it silently
   assumes something the problem does not guarantee — sorted input, no duplicates,
   non-negative values, a connected graph. These assumption gaps are exactly what a
   generator that produces adversarial inputs (duplicates, negative values,
   disconnected graphs) will expose, so note them down as generator requirements
   before writing the generator.

4. **Confirm the toolchain is available and matches the judge's build.** Run the
   exact compile/run commands you intend to use in the harness once, standalone,
   before wiring them into a loop of hundreds of iterations:

   ```bash
   python3 --version          # confirm interpreter present; note major.minor
   pypy3 --version             # if the fast solution targets PyPy specifically
   g++ --version                # confirm compiler present
   g++ -O2 -std=c++17 -Wall -Wextra -o fast fast.cpp   # match judge flags exactly
   g++ -O2 -std=c++17 -o brute brute.cpp
   ./fast < /dev/null; echo "exit=$?"                    # sanity: doesn't crash on empty stdin
   ```

   A compile-flag mismatch (e.g. missing `-O2`, or a different `-std`) can hide or
   introduce undefined-behavior bugs (signed integer overflow, uninitialized reads)
   that only manifest under the judge's actual settings — always compile the way the
   judge compiles, not the way that's convenient locally.

5. **Confirm both solutions agree on I/O format.** Verify token order, whether
   trailing newlines matter, and whether output is space- or newline-separated,
   before assuming any mismatch is a logic bug rather than a formatting artifact.

## Phase 2: Execution & Implementation

The harness below implements the full loop from the Mental Model diagram: generate,
run both solutions under a timeout, compare with whitespace/numeric tolerance, and on
the first mismatch, shrink to a minimal reproducible case. It treats both the fast
solution and the brute force as opaque subprocesses invoked exactly the way they'd be
invoked on the judge — no in-process imports, no shared Python state — so it catches
I/O bugs (wrong output format) as well as logic bugs, and works identically whether
the solutions are Python scripts or compiled C++ binaries.

```python
#!/usr/bin/env python3
"""
stress_test.py -- Differential (stress) testing harness for AlgoJudge-style
competitive programming problems.

Compares a "fast" solution against a brute-force reference on randomly
generated inputs, and on the first mismatch shrinks the failing case to a
minimal reproducible example.

Usage:
    python3 stress_test.py \
        --fast "python3 fast.py" \
        --brute "python3 brute.py" \
        --generator "python3 gen.py" \
        --iterations 2000 \
        --time-limit 2.0 \
        --seed-start 1
"""

from __future__ import annotations

import argparse
import dataclasses
import math
import shlex
import subprocess
import sys
import time
from pathlib import Path
from typing import Callable, Optional


@dataclasses.dataclass
class RunResult:
    stdout: str
    stderr: str
    returncode: int
    elapsed: float
    timed_out: bool


@dataclasses.dataclass
class StressConfig:
    fast_cmd: list[str]
    brute_cmd: list[str]
    generator_cmd: list[str]
    iterations: int = 1000
    time_limit_s: float = 2.0
    float_tolerance: float = 1e-6
    seed_start: int = 1
    verbose: bool = False


def run_process(cmd: list[str], input_text: str, time_limit_s: float) -> RunResult:
    """Run a subprocess with stdin=input_text, enforcing a wall-clock timeout.

    Never trust the target binary: never use shell=True, always pass a
    timeout, always capture rather than inherit stdio.
    """
    start = time.monotonic()
    try:
        proc = subprocess.run(
            cmd,
            input=input_text,
            capture_output=True,
            text=True,
            timeout=time_limit_s,
        )
        return RunResult(
            stdout=proc.stdout,
            stderr=proc.stderr,
            returncode=proc.returncode,
            elapsed=time.monotonic() - start,
            timed_out=False,
        )
    except subprocess.TimeoutExpired as exc:
        out = exc.stdout.decode() if isinstance(exc.stdout, bytes) else (exc.stdout or "")
        err = exc.stderr.decode() if isinstance(exc.stderr, bytes) else (exc.stderr or "")
        return RunResult(
            stdout=out,
            stderr=err,
            returncode=-1,
            elapsed=time.monotonic() - start,
            timed_out=True,
        )


def tokens_equal(a: str, b: str, float_tolerance: float) -> bool:
    """Compare two whitespace-separated tokens with numeric tolerance."""
    if a == b:
        return True
    try:
        fa, fb = float(a), float(b)
    except ValueError:
        return False
    if math.isnan(fa) or math.isnan(fb):
        return False
    return abs(fa - fb) <= float_tolerance * max(1.0, abs(fa), abs(fb))


def outputs_match(expected: str, actual: str, float_tolerance: float) -> bool:
    """Whitespace-tolerant, numeric-tolerant stdout comparison.

    Splits on arbitrary whitespace so trailing newlines, extra blank
    lines, and inconsistent spacing never cause a false-positive
    mismatch, and falls back to per-token float comparison so floating
    point solutions with different but valid precision are not flagged.
    """
    ta, tb = expected.split(), actual.split()
    if len(ta) != len(tb):
        return False
    return all(tokens_equal(x, y, float_tolerance) for x, y in zip(ta, tb))


def compare(cfg: StressConfig, input_text: str) -> Optional[tuple[RunResult, RunResult]]:
    """Run both solutions on input_text.

    Returns (fast_result, brute_result) if they disagree, if either
    crashes, or if the fast solution times out; returns None if they
    agree. The brute force gets a generous multiple of the time limit
    since it is expected to be slow by design.
    """
    fast_res = run_process(cfg.fast_cmd, input_text, cfg.time_limit_s)
    brute_res = run_process(cfg.brute_cmd, input_text, cfg.time_limit_s * 5)

    if fast_res.timed_out:
        return fast_res, brute_res
    if fast_res.returncode != 0 or brute_res.returncode != 0:
        return fast_res, brute_res
    if not outputs_match(brute_res.stdout, fast_res.stdout, cfg.float_tolerance):
        return fast_res, brute_res
    return None


def shrink(cfg: StressConfig, failing_input: str) -> str:
    """Delta-debugging shrink: repeatedly remove chunks of lines from the
    failing input while the mismatch still reproduces.

    Line-based ddmin, well suited to line-oriented competitive
    programming formats (first line = N, following lines = data). It is
    generator-agnostic: it never re-invokes the generator, it only
    deletes content from an input already known to fail.
    """
    lines = failing_input.splitlines()

    def still_fails(candidate_lines: list[str]) -> bool:
        candidate = "\n".join(candidate_lines) + "\n"
        if not candidate.strip():
            return False
        return compare(cfg, candidate) is not None

    chunk_size = max(1, len(lines) // 2)
    while chunk_size >= 1:
        i = 0
        progressed = False
        while i < len(lines):
            candidate = lines[:i] + lines[i + chunk_size:]
            if still_fails(candidate):
                lines = candidate
                progressed = True
                # do not advance i: re-try the same offset on the shrunk list
            else:
                i += chunk_size
        if not progressed:
            chunk_size //= 2
    return "\n".join(lines) + "\n"


def shrink_by_size(
    cfg: StressConfig, make_case: Callable[[int], str], failing_n: int
) -> tuple[int, str]:
    """Binary-search shrink for generators parameterized by a single size
    N (array length, node count, query count).

    Assumes at least one smaller N in [1, failing_n] still reproduces a
    mismatch; this does not always hold (failure can be non-monotonic in
    N), so treat this as a fast first pass and fall back to `shrink()`
    (or to reporting the original case, per Phase 4) if it makes no
    progress.
    """
    lo, hi = 1, failing_n
    best_n, best_case = failing_n, make_case(failing_n)
    while lo < hi:
        mid = (lo + hi) // 2
        case = make_case(mid)
        if compare(cfg, case) is not None:
            best_n, best_case = mid, case
            hi = mid
        else:
            lo = mid + 1
    return best_n, best_case


def run_stress_test(cfg: StressConfig) -> int:
    """Main loop: generate -> run both -> compare -> shrink -> report.

    Returns 0 if no mismatch was found in cfg.iterations runs, 1 if a
    mismatch was found and reported, 2 if the generator itself failed.
    """
    for i in range(cfg.iterations):
        seed = cfg.seed_start + i
        gen_res = run_process(cfg.generator_cmd + [str(seed)], "", cfg.time_limit_s)
        if gen_res.returncode != 0:
            print(f"[FATAL] generator failed on seed={seed}: {gen_res.stderr}", file=sys.stderr)
            return 2
        input_text = gen_res.stdout

        mismatch = compare(cfg, input_text)
        if cfg.verbose:
            status = "OK" if mismatch is None else "MISMATCH"
            print(f"[{i + 1}/{cfg.iterations}] seed={seed} ... {status}")

        if mismatch is not None:
            fast_res, brute_res = mismatch
            print(f"\n=== MISMATCH FOUND on seed={seed} (iteration {i + 1}) ===")
            print("--- Shrinking failing case ---")
            minimal = shrink(cfg, input_text)
            print("--- Minimal failing input ---")
            print(minimal)
            print("--- Fast solution output ---")
            print(fast_res.stdout if not fast_res.timed_out else "<TIMED OUT>")
            print("--- Brute force output ---")
            print(brute_res.stdout if not brute_res.timed_out else "<TIMED OUT>")
            Path("failing_case.txt").write_text(minimal)
            print(f"Original (pre-shrink) seed={seed} -- saved minimal case to failing_case.txt")
            return 1

    print(f"No mismatch found after {cfg.iterations} iterations.")
    return 0


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Differential stress-test harness")
    parser.add_argument("--fast", required=True, help="command to run the fast solution")
    parser.add_argument("--brute", required=True, help="command to run the brute-force solution")
    parser.add_argument("--generator", required=True, help="command to run the generator; seed appended as argv[1]")
    parser.add_argument("--iterations", type=int, default=1000)
    parser.add_argument("--time-limit", type=float, default=2.0)
    parser.add_argument("--float-tolerance", type=float, default=1e-6)
    parser.add_argument("--seed-start", type=int, default=1)
    parser.add_argument("--verbose", action="store_true")
    return parser


def main() -> int:
    args = build_arg_parser().parse_args()
    cfg = StressConfig(
        fast_cmd=shlex.split(args.fast),
        brute_cmd=shlex.split(args.brute),
        generator_cmd=shlex.split(args.generator),
        iterations=args.iterations,
        time_limit_s=args.time_limit,
        float_tolerance=args.float_tolerance,
        seed_start=args.seed_start,
        verbose=args.verbose,
    )
    return run_stress_test(cfg)


if __name__ == "__main__":
    sys.exit(main())
```

A generator must accept a single seed argument and print a valid, in-bounds test
case deterministically for that seed. The example below generates random
graphs/trees with configurable density, biases toward boundary values (N=1, N=max)
that pure uniform sampling under-represents, and guarantees connectivity for graph
cases so connectivity-dependent brute forces are exercised at every density level:

```python
#!/usr/bin/env python3
"""
gen_graph.py -- Randomized test-case generator for graph/tree problems.

Usage:
    python3 gen_graph.py <seed> [--min-n N] [--max-n N] [--density D]
                                  [--tree] [--directed] [--weighted] [--max-weight W]

Prints:
    N M
    u1 v1 [w1]
    ...
    uM vM [wM]

With --tree, M = N - 1 and the graph is guaranteed connected and acyclic.
"""

from __future__ import annotations

import argparse
import random
import sys


def generate_tree(n: int, rng: random.Random) -> list[tuple[int, int]]:
    """Random tree on nodes 1..n via random parent attachment: node i
    (i = 2..n) attaches to a uniformly random earlier node. Produces a
    valid tree in O(N) with no cycle-detection bookkeeping needed."""
    edges: list[tuple[int, int]] = []
    for child in range(2, n + 1):
        parent = rng.randint(1, child - 1)
        edges.append((parent, child))
    return edges


def generate_graph(
    n: int, density: float, directed: bool, rng: random.Random
) -> list[tuple[int, int]]:
    """Random graph on n nodes. density in [0, 1] is the fraction of the
    max possible edge count that gets sampled. Always seeds the edge set
    with a random spanning tree first, so connectivity-dependent brute
    forces aren't starved of connected cases at low density."""
    edges: set[tuple[int, int]] = set(generate_tree(n, rng))

    max_edges = n * (n - 1) // (1 if directed else 2)
    target = max(len(edges), int(density * max_edges))
    attempts, attempt_budget = 0, target * 20 + 100
    while len(edges) < target and attempts < attempt_budget:
        u, v = rng.randint(1, n), rng.randint(1, n)
        attempts += 1
        if u == v:
            continue
        edge = (u, v) if directed else (min(u, v), max(u, v))
        edges.add(edge)
    return list(edges)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("seed", type=int)
    parser.add_argument("--min-n", type=int, default=1)
    parser.add_argument("--max-n", type=int, default=10)
    parser.add_argument("--density", type=float, default=0.3)
    parser.add_argument("--tree", action="store_true")
    parser.add_argument("--directed", action="store_true")
    parser.add_argument("--weighted", action="store_true")
    parser.add_argument("--max-weight", type=int, default=100)
    args = parser.parse_args()

    rng = random.Random(args.seed)

    # Bias 1-in-5 cases to a boundary N (min or max) instead of sampling
    # uniformly -- off-by-one and overflow bugs live at the edges of the
    # input space, and uniform sampling under-represents them.
    if rng.randint(1, 5) == 1:
        n = rng.choice([args.min_n, args.max_n])
    else:
        n = rng.randint(args.min_n, args.max_n)

    if n <= 1:
        edges: list[tuple[int, int]] = []
    elif args.tree:
        edges = generate_tree(n, rng)
    else:
        edges = generate_graph(n, args.density, args.directed, rng)

    out = [f"{n} {len(edges)}"]
    for u, v in edges:
        if args.weighted:
            out.append(f"{u} {v} {rng.randint(1, args.max_weight)}")
        else:
            out.append(f"{u} {v}")

    print("\n".join(out))
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

## Phase 3: Automated Verification

Before trusting the harness against a real bug, prove it can detect a *known* bug
within a bounded number of iterations, and prove it does not add unreasonable
overhead of its own. Set up a throwaway fixture with an intentionally buggy
solution:

```bash
mkdir -p /tmp/stress_selftest && cd /tmp/stress_selftest

cat > buggy.py <<'EOF'
import sys
n = int(sys.stdin.readline())
a = list(map(int, sys.stdin.readline().split()))
print(sum(a[1:]))   # BUG: silently drops a[0]
EOF

cat > brute.py <<'EOF'
import sys
n = int(sys.stdin.readline())
a = list(map(int, sys.stdin.readline().split()))
print(sum(a))
EOF

cat > gen.py <<'EOF'
import random, sys
rng = random.Random(int(sys.argv[1]))
n = rng.randint(1, 20)
print(n)
print(" ".join(str(rng.randint(-100, 100)) for _ in range(n)))
EOF

python3 stress_test.py \
  --fast "python3 buggy.py" --brute "python3 brute.py" \
  --generator "python3 gen.py" --iterations 50 --seed-start 1
echo "exit code: $?"
# EXPECTED: "MISMATCH FOUND" printed, exit code 1, failing_case.txt written,
# almost always on iteration 1 (a[0] != 0 on nearly every random case).
```

Wrap the same fixtures in explicit assertions so this check can run unattended in CI:

```python
import subprocess

TIMEOUT_S = 30

def test_harness_detects_known_bug() -> None:
    result = subprocess.run(
        ["python3", "stress_test.py",
         "--fast", "python3 buggy.py", "--brute", "python3 brute.py",
         "--generator", "python3 gen.py", "--iterations", "50"],
        capture_output=True, text=True, timeout=TIMEOUT_S,
    )
    assert result.returncode == 1, "harness failed to detect a known bug within 50 iterations"
    assert "MISMATCH FOUND" in result.stdout

def test_harness_accepts_identical_solution() -> None:
    """Sanity check against false positives: comparing brute.py to itself
    must never report a mismatch."""
    result = subprocess.run(
        ["python3", "stress_test.py",
         "--fast", "python3 brute.py", "--brute", "python3 brute.py",
         "--generator", "python3 gen.py", "--iterations", "200"],
        capture_output=True, text=True, timeout=TIMEOUT_S * 2,
    )
    assert result.returncode == 0, "harness false-positived comparing a solution to itself"
```

Finally, measure the harness's own overhead so a slow harness doesn't get mistaken
for slow solutions. Budget: no more than ~50ms of harness-attributable overhead per
iteration (subprocess-spawn and comparison bookkeeping), separate from the measured
runtime of the generator, fast solution, and brute force themselves:

```bash
python3 - <<'EOF'
import subprocess, time

N = 100
start = time.monotonic()
subprocess.run(
    ["python3", "stress_test.py",
     "--fast", "python3 brute.py", "--brute", "python3 brute.py",
     "--generator", "python3 gen.py", "--iterations", str(N)],
    capture_output=True, text=True, timeout=120,
)
total_s = time.monotonic() - start
per_iter_ms = (total_s / N) * 1000
print(f"{per_iter_ms:.2f} ms/iteration total (includes 3 process spawns)")
# With trivial O(1) python solutions, total time is dominated by process
# startup (~10-30ms per spawn x3), so budget generously here; the real
# signal is a regression against this baseline, not an absolute number.
assert per_iter_ms < 250, "harness overhead grew significantly versus baseline"
EOF
```

## Phase 4: Rollback & Self-Healing

Deterministic responses when the harness itself, rather than the fast solution,
is the thing misbehaving:

- **The harness times out or every iteration reports a timeout on both solutions.**
  This means the generator is producing inputs too large for even the brute force to
  finish within its (generously multiplied) time limit — not a bug, a configuration
  problem. Reduce `--max-n` in the generator toward the smallest value that still
  lets the brute force's complexity class finish in well under a second (recompute
  the budget table from Phase 1 using the brute force's own, much worse, complexity),
  and re-run. Never raise the harness's `--time-limit` to compensate — that hides
  real TLE bugs in the fast solution instead of surfacing them.

- **The brute force itself might be wrong.** If the fast solution keeps "failing"
  in a way that looks suspicious (e.g. it disagrees on every single case, or only on
  cases with a suspicious common property), don't assume the fast solution is at
  fault. Cross-check the brute force against a *third*, even more trivial or
  manually-verified solution on tiny cases (N ≤ 3, small enough to compute the
  expected answer by hand or by exhaustive enumeration in a spreadsheet or REPL).
  If the brute force disagrees with hand-computed ground truth, fix the brute force
  first — every mismatch reported before that fix is suspect and must be re-run.

- **The shrinker makes no progress (chunk_size reaches 0 with no reduction).** Some
  failures are only triggered by properties of the *whole* input (e.g. a checksum,
  a specific total sum, a specific permutation) that line-deletion can't preserve
  while shrinking. In that case, stop shrinking, report the original (pre-shrink)
  input as-is, and add an explicit note: `"NOTE: automatic shrink made no progress;
  reporting original generated case with seed=<seed>."` Do not spend more than one
  shrink pass' worth of time hand-editing a non-shrinkable case — a large-but-valid
  reproducible case is still strictly better than no case.

- **The generator itself crashes or produces out-of-bounds output.** Treat this as a
  fatal harness error (`run_stress_test` already returns exit code 2 for this), not
  a solution bug — fix the generator's own bounds logic before resuming, since every
  case run before the fix used potentially invalid input and its results are not
  trustworthy.

- **A mismatch reproduces only sometimes on the same seed (nondeterminism).** This
  usually means one of the solutions has undefined or unspecified behavior baked in
  (iterating over an unordered hash-based container and relying on iteration order,
  reading uninitialized memory in C++, relying on floating-point rounding that
  differs by build flags). Re-run the exact failing case 5-10 times outside the main
  loop to confirm before reporting; note the nondeterminism explicitly since it
  usually points at the root cause rather than a plain logic error.

## Common Anti-Patterns vs. Gold Standard

| Anti-Pattern | Gold Standard | Rationale |
|---|---|---|
| Brute force written with the same clever approach as the fast solution, just "less optimized" | Brute force uses a conceptually different, maximally naive algorithm (nested loops, full enumeration, direct recursion) | Correlated bugs in both implementations produce false agreement — the tests still pass with the shared bug intact |
| Generator only produces small-to-medium N, never N=1 or N=max | Generator explicitly biases toward boundary values (N=1, N=max, all-equal elements, sorted/reverse-sorted, empty/negative inputs where legal) | Off-by-one, overflow, and empty-container bugs concentrate at the edges of the input space, which uniform random sampling systematically under-explores |
| Comparing raw stdout with plain string equality (`==`) | Whitespace-tolerant, numeric-tolerant token comparison (`outputs_match`) | Trailing newlines, extra spaces, and valid floating-point precision differences cause false-positive mismatches that erode trust in the harness |
| Running solutions with `shell=True` and string-interpolated commands | Running with an explicit argument list and `shell=False` | `shell=True` on generated/untrusted content is a shell-injection risk and silently mangles quoting on inputs containing spaces or special characters |
| No timeout on subprocess calls | Explicit `timeout=` on every subprocess invocation (generator, fast, brute), each with its own appropriate budget | An infinite loop in either solution deadlocks the entire stress-test session indefinitely with no automatic recovery |
| Fixed random seed reused on every run ("just run it again") | Seed derived from the loop index and logged alongside every result | Reproducibility requires knowing exactly which seed produced a failure; always reusing one seed only ever explores a single point in the input space |
| Manually eyeballing a large failing input to guess what matters | Automated delta-debugging / binary-search shrink (`shrink`, `shrink_by_size`) run to a fixed point before a human looks at it | Manual shrinking is slow, error-prone, and stops at "small enough to read" rather than the true minimal reproducible case |

## Pre-Flight Checklist

- [ ] Both solutions and the generator are invoked as subprocess argument lists with `shell=False` — never via `os.system` or shell string interpolation.
- [ ] Every subprocess call (generator, fast, brute) has an explicit wall-clock `timeout`, with the brute force given a larger multiple since it is expected to be slow by design.
- [ ] A memory ceiling or sandbox (container, cgroup, `resource.setrlimit`) is in place before executing newly-written or otherwise untrusted solution code.
- [ ] The brute-force reference is algorithmically distinct from the fast solution (different technique family), not a "de-optimized" copy of the same logic.
- [ ] The brute force's correctness is independently obvious by inspection alone — readable in under a minute, no cleverness — on constraints small enough to hand-verify.
- [ ] The generator's N and value ranges are bounded to the problem's actual stated constraints, with explicit boundary cases (N=1, N=max, duplicates, all-zero, negative values if legal).
- [ ] Toolchain availability and compile flags have been confirmed up front (`python3 --version`, `g++ --version`, matching the judge's own `-O2`/`-std` flags) so a missing compiler doesn't waste N iterations before failing.
- [ ] The output-comparison policy (exact vs. whitespace-tolerant vs. floating-point epsilon) is decided and matches the judge's own comparison mode before the first run.
- [ ] Generated inputs and failing-case files are written to a scratch directory, never overwriting source files or committed test fixtures.
- [ ] Total run time (iterations × per-iteration timeout) is capped to a sane ceiling so a stuck configuration cannot run unattended for hours.

## Post-Flight Checklist

- [ ] The minimal failing input has been saved to a file (e.g. `failing_case.txt`) and is human-readable.
- [ ] Both solutions' raw stdout/stderr on the failing case are logged side by side with the input for comparison.
- [ ] The original (pre-shrink) seed or generator invocation that produced the failure is recorded, so it can be regenerated from scratch if needed.
- [ ] The failing case has been re-run once more outside the main harness loop to rule out flaky/nondeterministic behavior (unordered iteration, uninitialized memory).
- [ ] If the mismatch was a timeout rather than a wrong output, it's recorded which solution timed out and at what N, distinguishing a correctness bug from a complexity bug.
- [ ] The fast solution has been patched, and the exact same minimal failing case now passes, before the bug is declared fixed.
- [ ] The stress test has been re-run for a fresh batch of iterations (a new seed range) after the fix, with zero mismatches, before considering the fix validated.
- [ ] Temporary/scratch files (compiled binaries, generated inputs, `failing_case.txt`) created during the session are cleaned up or clearly isolated in a scratch directory.
- [ ] The fixed failing case (or its minimal reduced form) has been added to the permanent regression test suite so the bug cannot silently reappear.
- [ ] Any generator bounds or comparison tolerances loosened for debugging purposes have been reverted or reconciled with the original problem constraints before closing out.
