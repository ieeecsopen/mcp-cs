---
name: campus-dsa-visualizer
description: Activate when a student, TA, or instructor asks to visualize the execution of a data structure or algorithm rather than just read its code — trigger phrasings include "visualize this binary search tree", "show me how quicksort partitions this array step by step", "trace this BFS/DFS on the whiteboard", "draw the DP table for this recurrence", "animate this linked list reversal", "walk through the recursion stack for this function", or "diagram the AVL rotations here". Produces a serializable intermediate representation (parent-pointer array, adjacency list, or execution-snapshot sequence) and renders it as a Mermaid diagram or an ASCII trace, with automatic step-capping for large inputs.
version: 1.0.0
author: IEEE Computer Society of SLIIT
tags: [data-structures, algorithms, visualization, mermaid, education, computer-science, tracing, sliit]
---

# Campus DSA Visualizer

**Mission**: turn an opaque run of code — a recursive tree insert, a quicksort partition, a BFS frontier expansion, a DP table fill — into a sequence of concrete, inspectable snapshots that a student can step through and reconstruct the algorithm's logic from, without re-reading the source. The visualizer never explains *at* the algorithm; it exposes the algorithm's own state, one step at a time, so the student's mental model is built from evidence rather than from prose.

This skill exists because IEEE CS SLIIT tutors and workshop facilitators repeatedly hit the same wall: a student can trace an algorithm correctly on a whiteboard in five minutes but cannot connect that trace to the code in front of them. The fix is not a better explanation — it is a faithful, mechanically-generated bridge between the two: instrument the real code, capture what it actually does, and render that capture as a diagram.

---

## Mental Model & Theoretical Foundations

### Why visualization aids algorithmic intuition

Working memory holds roughly four to seven discrete chunks at once (Miller's classic estimate, later refined downward by Cowan to ~4 for unaided recall). A recursive quicksort call on an 8-element array generates a call tree with over a dozen live frames, each carrying `low`, `high`, and a partially-partitioned sub-array. No student tracks that mentally — they lose the thread by the third recursive call and start pattern-matching on the code's *shape* instead of understanding its *behavior*. This is exactly the failure mode cognitive load theory predicts: when intrinsic load (the algorithm's genuine complexity) plus extraneous load (mentally simulating a stack machine) exceeds working-memory capacity, learning stops and rote memorization begins.

A state-snapshot sequence externalizes the stack. Each snapshot is a complete, self-contained picture of "the world at time *t*" — the full array with a pivot marked, the tree with a newly-rotated subtree highlighted, the BFS queue with the just-dequeued node circled. The student no longer holds intermediate state in their head; they hold only "what changed between snapshot *t* and *t+1*", which is a single chunk, not a dozen. This is the same principle behind debugger step-through and video-editing timelines: freeze time, inspect one delta, advance.

For **recursive** algorithms (tree operations, quicksort, mergesort, DFS) the snapshot sequence doubles as an explicit call stack trace — each push/pop of the mental recursion stack becomes a visible frame. For **iterative** algorithms (BFS, bottom-up DP, insertion sort) the snapshot sequence is simpler: one frame per loop iteration, with the loop's induction variables (queue contents, DP indices, sorted-prefix boundary) annotated directly on the frame.

### Representing a data structure as a serializable intermediate form

The visualizer never renders a live, language-native object graph (a `TreeNode` with real pointers, a `dict`-of-`list` adjacency structure with running iterator state) directly to a diagram. Live objects are renderer-hostile: they carry runtime-specific identity (memory addresses, object ids), cyclic references, and mutable state that changes out from under you mid-render. Instead, every structure is first flattened into a **serializable intermediate form** — plain data, no behavior, stable ids — and *that* is what gets handed to a renderer (Mermaid, ASCII, or a future renderer none of us have built yet).

Two canonical intermediate forms cover almost every DSA visualization need:

| Data Structure | Intermediate Form | Shape |
|---|---|---|
| Binary tree / BST / AVL tree | **Parent-pointer array** | `{id, value, parentId, side}[]` — one row per node, no nested references |
| Graph (directed or undirected) | **Adjacency list** | `{nodes: string[], edges: [string, string][]}` plus optional `visited` / `frontier` sets for traversal highlighting |
| Sorting / array algorithm | **Snapshot sequence** | `{kind, array, indices, note}[]` — one full-array copy per meaningful state change |
| Linked list | **Ordered pointer chain** | `{id, value, nextId}[]` — degenerate case of the parent-pointer array with no branching |
| DP table | **Grid snapshot sequence** | `{cell: [row, col], value, dependsOn: [row, col][], table}[]` |

The discipline that makes this work: **serialize once, render many times.** A parent-pointer array can be rendered as a Mermaid `flowchart`, as an indented ASCII tree, or (future work) as an SVG — the serializer doesn't know or care which renderer consumes it. This is why Phase 2 below always produces a typed intermediate structure as an explicit, testable function output, with rendering as a separate, equally testable function.

### Worked example: manually-drawn snapshot sequence

A BST after inserting `5, 3, 8, 1, 4, 7, 9` in that order, drawn as a parent-pointer structure:

```text
            (5)
           /    \
        (3)      (8)
       /   \     /  \
     (1)   (4) (7)  (9)
```

Its parent-pointer array (the actual intermediate form the serializer below produces):

```text
id   value   parentId   side
n0   5       null       ROOT
n1   3       n0         L
n2   8       n0         R
n3   1       n1         L
n4   4       n1         R
n5   7       n2         L
n6   9       n2         R
```

A quicksort partition step sequence over `[8, 3, 5, 1, 9, 2]` with pivot = last element (`2`), Lomuto scheme, drawn as successive array frames with the `i`/`j` pointers annotated:

```text
step 0  (start partition, pivot=2, low=0, high=5)
        [ 8   3   5   1   9   2 ]
          i=-1 j=0

step 1  (compare 8 vs 2 -> no swap, j advances)
        [ 8   3   5   1   9   2 ]
          i=-1     j=1

step 2  (compare 3 vs 2 -> no swap, j advances)
        [ 8   3   5   1   9   2 ]
          i=-1         j=2

... (compares continue; none <= pivot until j reaches the end)

step 5  (place pivot: swap arr[i+1]=arr[0] with arr[high]=arr[5])
        [ 2   3   5   1   9   8 ]
          ^-- pivot now correctly placed at index 0

result  partition boundary at index 0 -> recurse on [] and [3,5,1,9,8]
```

Every row above is one `Snapshot` object in Phase 2's step-recorder — nothing here is hand-waved prose, it is the literal output of `quicksort_recorded()` rendered as ASCII bars.

---

## Phase 1: Discovery & Static Analysis

Before generating any diagram, classify what the student's code actually *is*. Picking the wrong template (e.g., treating a graph BFS as a tree traversal because both use a queue-like structure) produces a diagram that is syntactically fine and semantically misleading — worse than no diagram at all.

### Detection signals

| Code Signal | Likely DS/Algorithm | Visualization Template |
|---|---|---|
| Fields/attributes named `.left` / `.right`, functions named `insert`/`traverse`/`inorder`/`rotate` | Binary tree, BST, or AVL tree | Parent-pointer array -> Mermaid `flowchart TD` |
| A `.next` pointer chain, a `while node is not None` loop | Singly/doubly linked list | Ordered pointer chain -> Mermaid `flowchart LR` |
| A `queue` / `collections.deque`, a `visited` set, level-by-level expansion | Graph or tree BFS | Adjacency list with `frontier` highlighting per dequeue |
| A `stack` (explicit or via recursion), a `visited` set, depth-first branching | Graph or tree DFS | Adjacency list with `visited` highlighting per push/pop |
| A `pivot` variable, a `partition(...)` function, an in-place swap (`arr[i], arr[j] = arr[j], arr[i]`) | Quicksort | Snapshot sequence: `compare` / `swap` / `partition` steps |
| A `mid = (low + high) // 2` split, a `merge(...)` function combining two sorted halves | Mergesort | Snapshot sequence: `merge` steps over a working copy |
| Nested loops over two indices with a recurrence relation (`dp[i][j] = ...`), a `memo` dict | Dynamic programming | Grid snapshot sequence with `dependsOn` cell arrows |
| Single loop with an adjacent-pair comparison and conditional swap, no recursion | Bubble / insertion / selection sort | Snapshot sequence, simpler `compare`/`swap` kinds only |

### Decision procedure

1. **Grep for structural keywords** first (`.left`, `.right`, `.next`, `pivot`, `merge`, `dp[`, `memo`, `queue`, `stack`) — this is cheap and usually decisive.
2. **Check the recursion shape.** Two recursive calls on disjoint index ranges after an in-place mutation → quicksort. Two recursive calls on disjoint index ranges followed by a combine step → mergesort. Two recursive calls on `.left`/`.right` → tree traversal. One recursive call per neighbor → DFS.
3. **Check the loop shape.** A swap-heavy loop with no recursion → an O(n^2) comparison sort (bubble/insertion/selection) rather than quicksort/mergesort — use the simpler snapshot kind set for these (no `partition`/`merge` steps, just `compare`/`swap`).
4. **Disambiguate BFS vs DFS by container, not by "graph-ness".** Both operate over the same adjacency-list intermediate form; only the highlighting semantics (`frontier` = queue contents vs `frontier` = stack/current path) differ.
5. **When signals conflict or score too low, ask rather than guess.** A false-confidence wrong template is a worse outcome than one clarifying question. The reference sniffer below refuses to answer (returns `None`) when no signal group scores at least 2 matches — treat that as "ask the student what algorithm this is" rather than defaulting to a random template.

Reference heuristic classifier (used to decide which Phase 2 code path to invoke; intentionally conservative):

```python
"""dsa_sniffer.py
Lightweight heuristic classifier: given a source snippet, guess which
DSA visualization template applies. False negatives (falling through
to "unknown") are safer than confidently picking the wrong renderer.
"""
import re
from typing import Optional

SIGNALS: list[tuple[str, list[str]]] = [
    ("binary_tree", [r"\.left\b", r"\.right\b", r"def\s+\w*(insert|traverse|inorder|rotate)"]),
    ("linked_list", [r"\.next\b", r"while\s+\w+\s*(!=|is not)\s*None"]),
    ("graph_bfs", [r"\bqueue\b", r"collections\.deque", r"\bvisited\b"]),
    ("graph_dfs", [r"\bstack\b", r"def\s+\w*dfs", r"\bvisited\b"]),
    ("sorting_partition", [r"\bpivot\b", r"def\s+\w*partition\s*\(",
                            r"arr\[\w+\],\s*arr\[\w+\]\s*=\s*arr\[\w+\],\s*arr\[\w+\]"]),
    ("sorting_merge", [r"def\s+\w*merge\s*\(", r"\bmid\s*=", r"\bleft\b[\s\S]{0,80}\bright\b"]),
    ("dp_table", [r"\bdp\[", r"\bmemo\[", r"for\s+\w+\s+in\s+range\([^\)]*\):\s*\n\s*for\s+\w+\s+in\s+range"]),
]


def sniff_dsa_kind(source: str) -> Optional[str]:
    """Return the highest-scoring DSA kind, or None if no group reaches
    the minimum-confidence threshold of 2 matched signals."""
    best_kind, best_score = None, 0
    for kind, patterns in SIGNALS:
        score = sum(1 for p in patterns if re.search(p, source, re.MULTILINE))
        if score > best_score:
            best_kind, best_score = kind, score
    return best_kind if best_score >= 2 else None
```

---

## Phase 2: Execution & Implementation

Two complete reference implementations. Both follow the serialize-once-render-many discipline from the Mental Model section: a pure "build the intermediate form" function, kept fully separate from a pure "render the intermediate form" function.

### 2.1 Generic tree/graph -> Mermaid serializer (TypeScript)

```typescript
// tree-serializer.ts
// Generic binary-tree and graph -> Mermaid flowchart serializer for
// campus-dsa-visualizer. Pure functions only: no I/O, no mutation of inputs.

export interface TreeNode<T> {
  id: string;                    // stable unique id, e.g. "n0", "n1", ...
  value: T;
  left?: TreeNode<T> | null;
  right?: TreeNode<T> | null;
}

export interface ParentPointerRow<T> {
  id: string;
  value: T;
  parentId: string | null;
  side: "L" | "R" | "ROOT";
}

/**
 * Flatten a linked TreeNode structure into a parent-pointer array — a
 * serializable intermediate form that is renderer-agnostic and trivially
 * diffable between recursive calls (see Mental Model, "serialize once").
 */
export function toParentPointerArray<T>(root: TreeNode<T> | null): ParentPointerRow<T>[] {
  const rows: ParentPointerRow<T>[] = [];
  function walk(node: TreeNode<T> | null, parentId: string | null, side: "L" | "R" | "ROOT"): void {
    if (!node) return;
    rows.push({ id: node.id, value: node.value, parentId, side });
    walk(node.left ?? null, node.id, "L");
    walk(node.right ?? null, node.id, "R");
  }
  walk(root, null, "ROOT");
  return rows;
}

function sanitizeLabel(value: unknown): string {
  // Mermaid node labels break on quotes/pipes; escape defensively so a
  // student's data (e.g. a string containing `"` or `|`) never corrupts
  // the diagram syntax.
  return String(value).replace(/"/g, "&quot;").replace(/\|/g, "&#124;");
}

/** Render a parent-pointer array as a top-down Mermaid flowchart. */
export function parentPointerArrayToMermaid<T>(rows: ParentPointerRow<T>[]): string {
  if (rows.length === 0) {
    return 'flowchart TD\n  empty["(empty tree)"]';
  }
  const lines: string[] = ["flowchart TD"];
  for (const row of rows) {
    lines.push(`  ${row.id}["${sanitizeLabel(row.value)}"]`);
  }
  for (const row of rows) {
    if (row.parentId === null) continue;
    lines.push(`  ${row.parentId} -->|${row.side}| ${row.id}`);
  }
  return lines.join("\n");
}

/** Convenience: TreeNode -> Mermaid in one call. */
export function treeToMermaid<T>(root: TreeNode<T> | null): string {
  return parentPointerArrayToMermaid(toParentPointerArray(root));
}

// --- Graph adjacency-list serializer (directed or undirected) ---

export interface GraphSnapshot {
  nodes: string[];
  edges: Array<[string, string]>;
  directed: boolean;
  visited?: Set<string>;   // nodes already fully processed
  frontier?: Set<string>;  // current BFS queue / DFS stack contents
}

/** Render an adjacency-list snapshot as a Mermaid flowchart, with
 * visited/frontier state expressed as Mermaid classDefs so a sequence of
 * these can be diffed frame-to-frame by a student. */
export function adjacencyListToMermaid(snapshot: GraphSnapshot): string {
  const arrow = snapshot.directed ? "-->" : "---";
  const lines: string[] = ["flowchart LR"];
  for (const node of snapshot.nodes) {
    const label = sanitizeLabel(node);
    if (snapshot.visited?.has(node)) {
      lines.push(`  ${node}["${label}"]:::visited`);
    } else if (snapshot.frontier?.has(node)) {
      lines.push(`  ${node}["${label}"]:::frontier`);
    } else {
      lines.push(`  ${node}["${label}"]`);
    }
  }
  const seen = new Set<string>();
  for (const [a, b] of snapshot.edges) {
    const key = snapshot.directed ? `${a}->${b}` : [a, b].sort().join("--");
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(`  ${a} ${arrow} ${b}`);
  }
  lines.push("  classDef visited fill:#2f9e44,color:#fff;");
  lines.push("  classDef frontier fill:#f08c00,color:#fff;");
  return lines.join("\n");
}
```

### 2.2 Instrumented sorting step-recorder (Python)

```python
"""sort_recorder.py
Instrumented quicksort and mergesort that record every meaningful state
transition (comparison, swap, partition boundary, merge) as an immutable
Snapshot, so the recording can be replayed and rendered independently of
the algorithm that produced it (serialize once, render many times).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Literal, Optional, Sequence

SnapshotKind = Literal["compare", "swap", "partition", "merge", "final"]


@dataclass(frozen=True)
class Snapshot:
    kind: SnapshotKind
    array: List[int]          # full array state AFTER this step
    indices: List[int]        # indices touched by this step (for highlighting)
    low: Optional[int] = None
    high: Optional[int] = None
    pivot_index: Optional[int] = None
    note: str = ""


@dataclass
class Recording:
    algorithm: str
    original: List[int]
    snapshots: List[Snapshot] = field(default_factory=list)

    def record(self, kind: SnapshotKind, array: Sequence[int], indices: Sequence[int],
               low: Optional[int] = None, high: Optional[int] = None,
               pivot_index: Optional[int] = None, note: str = "") -> None:
        self.snapshots.append(
            Snapshot(kind=kind, array=list(array), indices=list(indices),
                     low=low, high=high, pivot_index=pivot_index, note=note)
        )


def quicksort_recorded(values: Sequence[int]) -> Recording:
    """Lomuto-partition quicksort; records every compare, swap, and
    partition split as it happens."""
    arr = list(values)
    rec = Recording(algorithm="quicksort", original=list(values))

    def partition(low: int, high: int) -> int:
        pivot = arr[high]
        i = low - 1
        for j in range(low, high):
            rec.record("compare", arr, [j, high], low=low, high=high, pivot_index=high,
                       note=f"compare arr[{j}]={arr[j]} vs pivot={pivot}")
            if arr[j] <= pivot:
                i += 1
                if i != j:
                    arr[i], arr[j] = arr[j], arr[i]
                    rec.record("swap", arr, [i, j], low=low, high=high, pivot_index=high,
                               note=f"swap arr[{i}] and arr[{j}]")
        arr[i + 1], arr[high] = arr[high], arr[i + 1]
        rec.record("swap", arr, [i + 1, high], low=low, high=high, pivot_index=i + 1,
                   note=f"place pivot at index {i + 1}")
        rec.record("partition", arr, list(range(low, high + 1)), low=low, high=high,
                   pivot_index=i + 1, note=f"partitioned [{low}, {high}] around index {i + 1}")
        return i + 1

    def sort(low: int, high: int) -> None:
        if low < high:
            p = partition(low, high)
            sort(low, p - 1)
            sort(p + 1, high)

    if len(arr) > 1:
        sort(0, len(arr) - 1)
    rec.record("final", arr, list(range(len(arr))), note="sorted")
    return rec


def mergesort_recorded(values: Sequence[int]) -> Recording:
    """Top-down mergesort; records each element placement during merge."""
    arr = list(values)
    rec = Recording(algorithm="mergesort", original=list(values))

    def merge(low: int, mid: int, high: int) -> None:
        left = arr[low:mid + 1]
        right = arr[mid + 1:high + 1]
        i = j = 0
        k = low
        while i < len(left) and j < len(right):
            if left[i] <= right[j]:
                arr[k] = left[i]
                i += 1
            else:
                arr[k] = right[j]
                j += 1
            rec.record("merge", arr, [k], low=low, high=high, note=f"place {arr[k]} at index {k}")
            k += 1
        while i < len(left):
            arr[k] = left[i]
            rec.record("merge", arr, [k], low=low, high=high, note=f"drain left {arr[k]}")
            i += 1
            k += 1
        while j < len(right):
            arr[k] = right[j]
            rec.record("merge", arr, [k], low=low, high=high, note=f"drain right {arr[k]}")
            j += 1
            k += 1

    def sort(low: int, high: int) -> None:
        if low >= high:
            return
        mid = (low + high) // 2
        sort(low, mid)
        sort(mid + 1, high)
        merge(low, mid, high)

    if len(arr) > 1:
        sort(0, len(arr) - 1)
    rec.record("final", arr, list(range(len(arr))), note="sorted")
    return rec


# --- Rendering (kept fully separate from recording) ---

def snapshot_to_ascii_bars(snapshot: Snapshot) -> str:
    """Render one snapshot as a horizontal ASCII bar chart, marking
    touched indices with a trailing caret."""
    lines = [f"-- {snapshot.kind.upper()} {snapshot.note} --"]
    for idx, val in enumerate(snapshot.array):
        bar = "#" * max(1, val)
        marker = " <-" if idx in snapshot.indices else ""
        lines.append(f"[{idx:>2}] {val:>4} {bar}{marker}")
    return "\n".join(lines)


def recording_to_mermaid_sequence(rec: Recording, max_steps: Optional[int] = None) -> str:
    """Render a recording as a Mermaid flowchart chaining one node per
    snapshot (capped by max_steps — see Phase 4 for the capping policy)."""
    snapshots = rec.snapshots if max_steps is None else rec.snapshots[:max_steps]
    lines = ["flowchart TD"]
    prev_id: Optional[str] = None
    for step, snap in enumerate(snapshots):
        node_id = f"s{step}"
        label = " ".join(str(v) for v in snap.array)
        touched = ",".join(str(i) for i in snap.indices)
        lines.append(f'  {node_id}["{snap.kind}: [{label}]\\ntouched: {touched}"]')
        if prev_id is not None:
            lines.append(f"  {prev_id} --> {node_id}")
        prev_id = node_id
    return "\n".join(lines)


def replay_reconstructs_sorted(rec: Recording) -> bool:
    """Verification helper: does the final recorded snapshot equal the
    true sorted array, independent of which algorithm produced it?"""
    if not rec.snapshots:
        return sorted(rec.original) == rec.original
    return rec.snapshots[-1].array == sorted(rec.original)
```

---

## Phase 3: Automated Verification

A visualization is a *claim* about what the code does. Ship the diagram without verification and a wrong-but-plausible-looking trace can actively teach a student the wrong algorithm. Two independent checks are mandatory before a diagram is shown: **syntax validity** (does the renderer target accept this string?) and **semantic fidelity** (does replaying the recording actually reproduce the correct result?).

### 3.1 Python: Mermaid syntax validation + replay fidelity

```python
# test_campus_dsa_visualizer.py
import random
import re

import pytest

from sort_recorder import (
    mergesort_recorded,
    quicksort_recorded,
    recording_to_mermaid_sequence,
    replay_reconstructs_sorted,
    snapshot_to_ascii_bars,
)

MERMAID_HEADER_RE = re.compile(r"^(flowchart|graph)\s+(TD|LR|BT|RL)")
NODE_LINE_RE = re.compile(r'^\s*\w+\["[^"]*"\](:::\w+)?\s*$')
EDGE_LINE_RE = re.compile(r'^\s*\w+\s*(-->|---)(\|[^|]*\|)?\s*\w+\s*$')


def assert_valid_mermaid(diagram: str) -> None:
    lines = [line for line in diagram.splitlines() if line.strip()]
    assert lines, "diagram must not be empty"
    assert MERMAID_HEADER_RE.match(lines[0]), f"missing/invalid header: {lines[0]!r}"
    for line in lines[1:]:
        if line.strip().startswith("classDef"):
            continue
        assert NODE_LINE_RE.match(line) or EDGE_LINE_RE.match(line), \
            f"unrecognized mermaid line: {line!r}"


TEST_ARRAYS = [
    [5, 2, 9, 1, 5, 6],
    [1],
    [],
    [3, 3, 3, 3],
    list(range(20, 0, -1)),
]


@pytest.mark.parametrize("values", TEST_ARRAYS)
def test_quicksort_replay_matches_true_sorted_order(values):
    rec = quicksort_recorded(values)
    assert replay_reconstructs_sorted(rec)


@pytest.mark.parametrize("values", TEST_ARRAYS)
def test_mergesort_replay_matches_true_sorted_order(values):
    rec = mergesort_recorded(values)
    assert replay_reconstructs_sorted(rec)


def test_quicksort_and_mergesort_agree_on_random_inputs():
    rng = random.Random(42)
    for _ in range(25):
        values = [rng.randint(-50, 50) for _ in range(rng.randint(0, 15))]
        qs, ms = quicksort_recorded(values), mergesort_recorded(values)
        assert replay_reconstructs_sorted(qs)
        assert replay_reconstructs_sorted(ms)
        if qs.snapshots and ms.snapshots:
            assert qs.snapshots[-1].array == ms.snapshots[-1].array


def test_mermaid_sequence_is_syntactically_valid():
    rec = quicksort_recorded([4, 1, 3, 2])
    assert_valid_mermaid(recording_to_mermaid_sequence(rec))


def test_mermaid_sequence_respects_step_cap():
    rec = quicksort_recorded(list(range(30, 0, -1)))
    capped = recording_to_mermaid_sequence(rec, max_steps=10)
    assert capped.count("-->") <= 9  # at most n-1 edges for n capped nodes
    assert_valid_mermaid(capped)


def test_ascii_bars_mark_touched_indices():
    rec = quicksort_recorded([3, 1, 2])
    assert "<-" in snapshot_to_ascii_bars(rec.snapshots[0])
```

### 3.2 TypeScript: tree/graph Mermaid syntax validation

```typescript
// tree-serializer.test.ts
import { describe, expect, it } from "vitest";
import { adjacencyListToMermaid, GraphSnapshot, treeToMermaid, TreeNode } from "./tree-serializer";

const MERMAID_HEADER = /^flowchart\s+(TD|LR|BT|RL)/;

function assertValidMermaid(diagram: string): void {
  const lines = diagram.split("\n").filter((l) => l.trim().length > 0);
  expect(lines.length).toBeGreaterThan(0);
  expect(MERMAID_HEADER.test(lines[0])).toBe(true);
  for (const line of lines.slice(1)) {
    const trimmed = line.trim();
    if (trimmed.startsWith("classDef")) continue;
    const isNode = /^\w+\["[^"]*"\](:::\w+)?$/.test(trimmed);
    const isEdge = /^\w+\s*(-->|---)(\|[^|]*\|)?\s*\w+$/.test(trimmed);
    expect(isNode || isEdge).toBe(true);
  }
}

describe("treeToMermaid", () => {
  it("renders an empty tree as an explicit placeholder, never an empty string", () => {
    const diagram = treeToMermaid<number>(null);
    assertValidMermaid(diagram);
    expect(diagram).toContain("empty tree");
  });

  it("produces exactly n-1 edges for an n-node tree", () => {
    const root: TreeNode<number> = {
      id: "n0", value: 8,
      left: { id: "n1", value: 4, left: { id: "n3", value: 2 }, right: { id: "n4", value: 6 } },
      right: { id: "n2", value: 12 },
    };
    const diagram = treeToMermaid(root);
    assertValidMermaid(diagram);
    expect((diagram.match(/-->/g) || []).length).toBe(4); // 5 nodes -> 4 edges
  });
});

describe("adjacencyListToMermaid", () => {
  it("dedupes undirected edges and tags visited/frontier classes", () => {
    const snapshot: GraphSnapshot = {
      nodes: ["A", "B", "C"],
      edges: [["A", "B"], ["B", "A"], ["B", "C"]],
      directed: false,
      visited: new Set(["A"]),
      frontier: new Set(["B"]),
    };
    const diagram = adjacencyListToMermaid(snapshot);
    assertValidMermaid(diagram);
    expect((diagram.match(/---/g) || []).length).toBe(2);
    expect(diagram).toContain(":::visited");
    expect(diagram).toContain(":::frontier");
  });
});
```

### Running the checks

```bash
# Python side (sort_recorder.py)
pytest test_campus_dsa_visualizer.py -v

# TypeScript side (tree-serializer.ts)
npx vitest run tree-serializer.test.ts
```

Both suites must pass before a generated diagram is handed to a student. A failing `assert_valid_mermaid` means the renderer target will show a parse error instead of a diagram; a failing `replay_reconstructs_sorted` means the *diagram itself* is teaching an incorrect trace — treat the latter as a release-blocking bug, not a cosmetic one.

---

## Phase 4: Rollback & Self-Healing

Unbounded visualization is a correctness failure, not just an aesthetic one: a Mermaid diagram with 200 nodes or a snapshot sequence with 400 frames renders as an unreadable wall that teaches nothing and may exceed the target surface's render limits entirely. Cap deliberately, and always tell the student you capped.

### Capping policy

| Structure | Threshold | Fallback behavior |
|---|---|---|
| Tree / graph node count | > 25 nodes | Render root/frontier subgraph only; collapse untouched subtrees into a single `"... N nodes collapsed"` node |
| Sort/merge snapshot count | > 40 steps | Keep first *K* and last *K* steps (default K=10), insert one `"— N steps omitted —"` node between them |
| DP table dimensions | > 15 x 15 cells | Render only the cells on the optimal backtrace path plus their direct dependencies, not the full grid |
| Mermaid diagram total line count | > 300 lines | Fall back to the ASCII renderer for that structure entirely — some chat/docs surfaces truncate or refuse to render oversized Mermaid blocks |

Reference implementation of the "first/last K with an omission notice" policy, applied to a `Recording`:

```python
def cap_recording_for_display(rec: "Recording", keep_first: int = 10, keep_last: int = 10) -> "Recording":
    """Return a display-only Recording capped to the first/last K steps,
    with an explicit omission marker in between. Never mutates the
    original recording — verification (Phase 3) always runs against the
    uncapped recording, only *display* is capped."""
    total = len(rec.snapshots)
    if total <= keep_first + keep_last:
        return rec

    omitted_count = total - keep_first - keep_last
    omission_marker = Snapshot(
        kind="partition" if rec.algorithm == "quicksort" else "merge",
        array=rec.snapshots[keep_first - 1].array,
        indices=[],
        note=f"--- {omitted_count} steps omitted for readability ---",
    )
    capped = Recording(algorithm=rec.algorithm, original=rec.original)
    capped.snapshots = [
        *rec.snapshots[:keep_first],
        omission_marker,
        *rec.snapshots[-keep_last:],
    ]
    return capped
```

### Self-healing behaviors

1. **Mermaid render failure → ASCII fallback, never a blank response.** If `assert_valid_mermaid` (Phase 3) would fail on generated output — e.g. a student's data contains a character the sanitizer missed — catch it, log the offending line, and fall back to `snapshot_to_ascii_bars` / a plain indented-text tree rather than showing broken syntax or nothing at all.
2. **Recursion-depth guard for large trees.** Python's default recursion limit (~1000) can be hit by pathologically unbalanced trees (a 2000-node linked-list-shaped BST). Detect depth during `toParentPointerArray`/`walk` and switch to an iterative worklist-based walk once depth exceeds ~500, rather than crashing mid-render.
3. **Duplicate-value ambiguity → switch highlighting mode.** If the input array contains duplicate values and the caller asked for value-based highlighting, silently switch to index-based highlighting (the default in the reference implementation above) and note the switch in the diagram's first frame.
4. **Never silently drop data.** Every capping/collapsing/fallback action must produce a visible marker node or annotation. A diagram that quietly shows 10 of 40 steps with no indication is a correctness bug identical in kind to a wrong Mermaid render — the student cannot tell "the algorithm did only 10 things" from "the visualizer hid 30 things."
5. **Idempotent re-render.** Re-running the same serializer + capper + renderer pipeline on the same recorded `Recording` must always produce byte-identical output. If it doesn't (e.g. because rendering used `Set` iteration order or wall-clock timestamps), that nondeterminism will show up as flaky Phase 3 tests — treat any such flake as a rollback trigger and fix the renderer, not the test.

---

## Common Anti-Patterns vs Gold Standard

| Anti-Pattern | Gold Standard |
|---|---|
| Rendering the full, unbounded recursion trace for large inputs, producing an unreadable wall of nodes | Cap to first/last K steps (Phase 4) with an explicit `"N steps omitted"` marker node, verified separately from the uncapped recording |
| Using language-runtime object identities (Python `id()`, JS object references) as Mermaid node ids | Use stable, human-readable ids (`n0`, `n1`, ...) assigned during traversal order, fully decoupled from runtime internals |
| Showing only the final state of a process-oriented algorithm (e.g. just the sorted array for quicksort) | Always emit the full step-by-step snapshot sequence (`compare`/`swap`/`partition`) — the pedagogical value is in *why* it becomes sorted, not that it is sorted |
| Hand-writing a Mermaid string ad hoc for each request, with rendering logic tangled into traversal logic | Build a typed, serializable intermediate form first (parent-pointer array / adjacency list / snapshot list); keep the renderer a pure function over that form so it is independently testable and reusable across ASCII/Mermaid |
| Assuming array indices stay bound to the same conceptual element across swaps, and highlighting "the value 5" after it has moved | Track and document highlighting as strictly index-based unless values are known-unique; state this assumption in the diagram note |
| Silently truncating a huge diagram with no indication anything was cut | Emit an explicit, counted omission notice (Phase 4) so the student can tell "the algorithm did this much" apart from "the visualizer hid some of it" |
| Recomputing the algorithm from scratch every time a different view (ASCII vs Mermaid vs a future renderer) is needed, risking drift between what was shown before and what is computed now | Record the snapshot sequence exactly once per source run; render as many views as needed from that single immutable `Recording` |
| Skipping Phase 3 verification because "the diagram looks right" | Always run `assert_valid_mermaid` and `replay_reconstructs_sorted` (or the tree/graph structural-invariant equivalents) before showing output — a plausible-looking wrong trace is worse than an error message |

---

## Pre-Flight Checklist

- [ ] Ran Phase 1 detection (keyword grep + recursion/loop shape) and got a confident classification (score >= 2 signals); if ambiguous, asked the student to confirm the algorithm rather than guessing.
- [ ] Confirmed whether the student wants the *process* (step-by-step trace) or just the *final structure* — this decides which Phase 2 code path (snapshot recorder vs one-shot serializer) runs.
- [ ] Checked input size against the Phase 4 capping thresholds (25 nodes / 40 steps / 15x15 grid) and pre-decided the capping strategy before generating anything, rather than discovering the overflow mid-render.
- [ ] Checked for duplicate values in the input when the request implies value-based highlighting ("track where the 5 goes"); planned to switch to index-based highlighting if duplicates are present.
- [ ] Confirmed the target rendering surface supports Mermaid `flowchart` syntax; if the surface is terminal-only or Mermaid-unsupported, planned to use the ASCII renderer as the primary output, not merely as a fallback.
- [ ] Verified the exact algorithm variant in the student's code (Lomuto vs Hoare partition scheme, top-down vs bottom-up mergesort, recursive vs iterative BFS) — these produce visibly different traces, and instrumenting the wrong variant will teach the wrong trace.
- [ ] For recursive structures, sanity-checked that recursion depth is bounded well under language recursion limits, or planned to use the iterative worklist fallback from Phase 4.
- [ ] Confirmed the intermediate serializable form (parent-pointer array / adjacency list / snapshot list) will be built in a separate function from the renderer, per the serialize-once-render-many discipline.
- [ ] Planned to sanitize any student-provided labels/values (`sanitizeLabel`) before they reach Mermaid syntax, to avoid quote/pipe/bracket injection breaking the diagram.

## Post-Flight Checklist

- [ ] Ran `assert_valid_mermaid` (or the TypeScript equivalent) against every generated Mermaid string and confirmed it passes with no unrecognized lines.
- [ ] Ran `replay_reconstructs_sorted` (or the structural equivalent for trees/graphs — e.g. node/edge count invariants) and confirmed the recorded/serialized trace actually reproduces the correct final result.
- [ ] If capping was applied, confirmed the omission notice's stated count matches the actual number of hidden steps/nodes.
- [ ] Confirmed graph-theoretic invariants hold where applicable (an n-node tree has exactly n-1 edges; undirected edges are de-duplicated; directed edges preserve direction).
- [ ] Confirmed no internal or runtime-specific identifiers (memory addresses, iterator objects, raw object ids) leaked into visible labels.
- [ ] Confirmed diagram labels/annotations are pedagogically legible on their own — edge labels (`L`/`R`), highlighting classes (`visited`/`frontier`), and step notes read clearly without needing the source code open side-by-side.
- [ ] Confirmed color/class assignments stay consistent across an entire snapshot sequence (a node marked `visited` in frame 3 should not silently reset to unmarked in frame 4 unless the algorithm genuinely revisits it).
- [ ] Manually spot-checked at least one intermediate snapshot against the source algorithm by hand, to catch instrumentation bugs that automated replay-equality checks could miss (e.g. an off-by-one in which index gets marked "touched").
- [ ] Confirmed a graceful ASCII fallback exists and was exercised at least once if the target rendering surface's Mermaid support is uncertain.
- [ ] Cleaned up any scratch files, debug prints, or intermediate `Recording` dumps used while building the visualization before handing the final diagram back to the student.
