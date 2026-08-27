---
name: algo-plagiarism-detector
description: Activate this skill whenever a user asks to check whether two code submissions are plagiarized, copied, cloned, or "too similar" — trigger phrasings include "check if these two submissions are plagiarized", "did team B copy team A's code", "compare these two solutions for academic dishonesty", "is this a clone of that repo", "run a similarity check on this contest entry", or "audit these assignments for copying". Applies to competitive-programming contest judging (hackathon entries, CTF writeups, algorithm-round submissions) and academic integrity reviews of student coursework. Wraps the MCS `algo_check_plagiarism` tool, which performs token-level, identifier-normalized, Winnowing-fingerprint comparison (Jaccard similarity over k-gram hashes) between exactly two source files and returns a calibrated verdict.
version: 1.0.0
author: IEEE Computer Society of SLIIT
tags: [plagiarism-detection, static-analysis, ast-normalization, winnowing, jaccard-similarity, academic-integrity, contest-judging, code-similarity]
---

# Code Plagiarism & AST Similarity Detector

**Mission:** Given exactly two source-code submissions, produce a defensible, reproducible similarity signal that survives the trivial evasion tactics contestants and students actually use — renaming variables, reformatting whitespace, reordering independent statements, swapping equivalent constants, padding with comments — and route the result to the correct human decision (clear / review / escalate). This skill does **not** issue an academic-integrity verdict on its own. It produces evidence. A `SUSPICIOUS` score is the start of a human review, never the end of one.

Use this skill when auditing competitive programming submissions, hackathon entries, CTF writeups, or student assignments where two artifacts need to be compared for copied logic rather than copied text.

---

## Mental Model & Theoretical Foundations

### Why raw text diff fails

A line-based diff (`diff`, `difflib.unified_diff`, a naive Levenshtein distance over raw bytes) treats source code as an unstructured string. It is defeated by any of the following, each of which takes a plagiarist under sixty seconds:

- Renaming `total` to `sum_val` throughout the file.
- Reindenting from 4 spaces to tabs, or reflowing line breaks.
- Reordering two independent variable declarations that have no data dependency.
- Inserting a blank line or a comment every few statements.

None of these change what the program *does*. All of them change every downstream line of a text diff. Raw text diff conflates **formatting** with **logic**, and formatting is exactly the layer a plagiarist can freely rewrite without understanding the algorithm at all.

### Why pure AST-equality also fails

The next instinct is "compare the parsed syntax trees for exact equality." This over-corrects: it is too strict. A single extraneous `pass` statement, a reordered pair of independent `import` lines, or a `for` loop rewritten as a semantically identical `while` loop will all make two ASTs unequal even though the second submission is a near-verbatim, deliberately-obfuscated copy of the first. Exact-match approaches have a precision problem in the opposite direction from text diff: they miss real clones instead of over-reporting fake ones. What is needed is **fuzzy, local structural matching** — a way to say "these two programs share long, specific, non-generic sequences of structure" without demanding the whole tree line up token-for-token.

### The fix: tokenize, normalize, then fingerprint

The approach used by this skill is the same lineage as MOSS (Measure of Software Similarity, Stanford) and JPlag: convert both submissions into a **structural token stream** that is invariant to cosmetic changes, then compare **local overlapping fingerprints** of that stream rather than the stream as a whole.

1. **Tokenization** strips away everything that is not structure: comments, whitespace, string-literal contents. What remains is a flat sequence of typed tokens (`KEYWORD`, `IDENTIFIER`, `LITERAL_NUM`, `OPERATOR`, `PUNCTUATION`).
2. **Identifier normalization** (alpha-renaming) replaces every distinct identifier with a canonical placeholder in order of first appearance (`ID0`, `ID1`, `ID2`, ...). Renaming `arr` to `data` and `n` to `length` in a copied bubble sort now produces the **identical** normalized stream as the original, because both streams read `def ID0(ID1): ID2 = len(ID1)...` regardless of what the author called anything. Numeric literals are likewise canonicalized (`42` and `7` both fold to a normalized placeholder) so that trivially changing a magic constant does not lower the score.
3. **k-gram windows** slide a fixed-width window of `k` consecutive normalized tokens across the stream and hash each window. This converts "is there a shared substructure" into "do these two sets of hashes intersect" — a problem sets are good at.
4. **Winnowing** (Schleimer, Wilkerson & Aiken, SIGMOD 2003 — the algorithm underlying MOSS) selects only the minimum hash within every sliding window of `w` consecutive k-gram hashes. This is the step that makes the technique practical: comparing every k-gram hash between two files is expensive and noisy; winnowing guarantees that any shared region at least `k + w - 1` tokens long produces at least one common selected fingerprint, while bounding the total number of fingerprints kept per document to roughly `2 / (w + 1)` of the k-gram count.
5. **Fingerprint set comparison** via Jaccard similarity (`|A ∩ B| / |A ∪ B|`) turns two fingerprint sets into a single normalized score in `[0, 1]`. Jaccard is preferred over cosine similarity here because fingerprint sets are unweighted (binary presence/absence of a hash, not a frequency vector), and Jaccard has a direct, auditable interpretation: "what fraction of all distinct structural fragments across both submissions are shared."

This pipeline sits in the sweet spot between the two failure modes above: it is invariant to renaming and reformatting (defeating text diff's weakness) while remaining tolerant of local insertions, deletions, and reorderings (defeating AST-equality's weakness), because a shared long substructure only needs to survive as *contiguous normalized tokens* somewhere in the file, not everywhere.

### Pipeline flow

```
        SOURCE A                                SOURCE B
           |                                        |
           v                                        v
   +-------------------+                   +-------------------+
   |     Tokenize       |                   |     Tokenize       |
   | (strip comments,   |                   | (strip comments,   |
   |  whitespace, mask  |                   |  whitespace, mask  |
   |  string literals)  |                   |  string literals)  |
   +---------+---------+                   +---------+---------+
             v                                        v
   +-------------------+                   +-------------------+
   |    Normalize        |                   |    Normalize        |
   |   Identifiers        |                   |   Identifiers        |
   | (ID0, ID1, ID2, ...) |                   | (ID0, ID1, ID2, ...) |
   +---------+-----------+                   +---------+-----------+
             v                                        v
   +-------------------+                   +-------------------+
   |   k-gram Windows    |                   |   k-gram Windows    |
   |  (hash every window  |                  |  (hash every window  |
   |   of k tokens)        |                  |   of k tokens)        |
   +---------+-----------+                   +---------+-----------+
             v                                        v
   +-------------------+                   +-------------------+
   |     Winnowing         |                   |     Winnowing         |
   | (min hash per window  |                   | (min hash per window  |
   |  of w k-gram hashes)  |                   |  of w k-gram hashes)  |
   +---------+-----------+                   +---------+-----------+
             v                                        v
      Fingerprint Set A                        Fingerprint Set B
             |                                        |
             +--------------------+-------------------+
                                   v
                     +---------------------------+
                     |    Jaccard Similarity       |
                     |    |A intersect B|           |
                     |    ----------------          |
                     |    |A union B|                |
                     +-------------+-------------+
                                   v
                     +---------------------------+
                     |       Threshold Verdict     |
                     |  score <  0.40  -> LOW       |
                     |  0.40 <= score < 0.65        |
                     |            -> MODERATE       |
                     |  score >= 0.65  -> SUSPICIOUS|
                     +---------------------------+
```

---

## Phase 1: Discovery & Static Analysis

Before any similarity math runs, establish *what* is being compared and get it into a clean, comparable shape.

1. **Establish submission context.** Record the contest/assignment ID, the two submitting parties' IDs, and — if the judging platform provides it — the declared language. Contest and coursework submissions frequently arrive as raw pasted text with no filename or extension (stdin blobs from a judge queue, a copy-pasted Google Form answer), so provenance must be tracked separately from the file itself.

2. **Detect the language automatically; do not trust the extension alone.** When a filename is present, map its extension to a language directly (`.py` -> python, `.java` -> java, `.cpp`/`.cc` -> cpp, `.c` -> c, `.js`/`.ts` -> javascript/typescript). When it is absent — the common case for contest paste boxes — fall back to a multi-signal syntax heuristic: score the source against a small set of language-distinctive regular expressions (`public\s+class\s+\w+` and `System\.out\.println` for Java; `#include\s*<\w+>` and `std::` for C++; `def\s+\w+\(.*\):` and Python-style trailing colons for Python; `function\s+\w+\(` and `=>` for JavaScript) and take the language with the highest signal count. Treat a zero-signal result as `unknown` and route to manual review rather than guessing — comparing two files under the wrong grammar produces a meaningless score, not just an inaccurate one.

3. **Strip comments, whitespace, and string-literal contents before tokenizing.** This must happen *before* the token stream is built, not as a filter afterward, because comment and string delimiters vary by language and interact with the lexer's quoting rules. Two specific attacks this step defeats:
   - **Comment padding** — inserting explanatory (or junk) comments throughout a copied file to dilute a raw-text similarity score. Comments carry no execution semantics, so they carry no plagiarism signal either.
   - **String-literal noise** — two submissions that both print the same instructor-provided prompt text (`"Enter your name: "`) will otherwise share a run of identical characters that has nothing to do with whether the *logic* was copied. String contents are masked to a placeholder token; the fact that a string literal exists at that position is preserved (it is still structurally meaningful), but its exact text is not compared.

4. **Build the token stream.** Run a lexer over the cleaned source producing a flat sequence of typed tokens: `KEYWORD` (language reserved words), `IDENTIFIER` (variable/function/class names), `LITERAL_NUM`, `LITERAL_STR` placeholder, `OPERATOR`, `PUNCTUATION`. Discard insignificant whitespace and newlines entirely (they carry no structure in every language this skill targets); a token stream, not a character stream, is the unit every later phase operates on.

5. **Sanity-check the stream before proceeding.** A token stream under roughly 30 tokens (a near-empty file, a stub, a submission that failed to save correctly) cannot produce a statistically meaningful Jaccard score — with so few k-grams, a handful of coincidental generic matches (`for ( ID0 = 0 ; ID0 < ID1 ; ID0 ++ )` appears in thousands of unrelated loops) can swing the score arbitrarily. Flag undersized submissions for manual-only review instead of trusting the automated verdict.

6. **Tokenize defensively.** Contest submissions are frequently syntactically broken (a missing brace, an unterminated string, a half-finished function at the time-out buzzer). The lexer built in Phase 2 is regex-based and best-effort: it does not require a submission to *parse* into a valid AST, only to *tokenize* into a stream. This is a deliberate design choice — a full-parser approach (e.g., building a real AST via `ast.parse` or a language-specific parser) would reject exactly the broken-but-still-informative submissions that most need a similarity check, since a student who ran out of time copying someone else's approach is a more, not less, interesting case to review.

---

## Phase 2: Execution & Implementation

The following is the reference implementation embedded in the MCS `algo_check_plagiarism` tool. It is intentionally dependency-free (standard library only: `re`, `hashlib`, `dataclasses`, `enum`, `keyword`) so it can run inside a sandboxed judging worker with no network or package-install access.

```python
"""
algo_plagiarism_detector.py
Reference implementation: tokenize -> normalize -> k-gram winnow -> Jaccard.
Standard library only. Python 3.9+.
"""
from __future__ import annotations

import hashlib
import keyword
import re
from dataclasses import dataclass
from enum import Enum, auto


# --------------------------------------------------------------------------
# Token model
# --------------------------------------------------------------------------

class TokenType(Enum):
    KEYWORD = auto()
    IDENTIFIER = auto()
    LITERAL_NUM = auto()
    LITERAL_STR = auto()
    OPERATOR = auto()
    PUNCTUATION = auto()


@dataclass(frozen=True)
class Token:
    type: TokenType
    value: str
    line: int
    col: int


# --------------------------------------------------------------------------
# Phase 1 helpers: language detection, comment/string stripping
# --------------------------------------------------------------------------

_C_STYLE_COMMENT = re.compile(r"//.*?$|/\*.*?\*/", re.MULTILINE | re.DOTALL)
_HASH_COMMENT = re.compile(r"#.*?$", re.MULTILINE)
_STRING_LITERAL = re.compile(
    r'"""(?:\\.|[^"\\])*"""|\'\'\'(?:\\.|[^\'\\])*\'\'\''
    r'|"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'',
    re.DOTALL,
)

_LANGUAGE_SIGNALS: dict[str, list[str]] = {
    "python": [r"^\s*def\s+\w+\(.*\):", r"^\s*import\s+\w+", r":\s*$"],
    "java": [r"public\s+class\s+\w+", r"System\.out\.println", r";\s*$"],
    "cpp": [r"#include\s*<\w+>", r"std::", r"cout\s*<<"],
    "c": [r"#include\s*<stdio\.h>", r"printf\s*\("],
    "javascript": [r"function\s+\w+\(", r"=>", r"console\.log"],
}

_EXTENSION_MAP = {
    ".py": "python", ".java": "java", ".c": "c", ".cpp": "cpp", ".cc": "cpp",
    ".js": "javascript", ".ts": "typescript", ".go": "go", ".rs": "rust",
}

_C_FAMILY = {"c", "cpp", "java", "javascript", "typescript", "go", "rust"}


def detect_language(source: str, filename: str | None = None) -> str:
    """Extension first; multi-signal syntax heuristic fallback for
    extension-less contest pastes. Returns 'unknown' on zero signal."""
    if filename:
        for ext, lang in _EXTENSION_MAP.items():
            if filename.endswith(ext):
                return lang

    scores = {lang: 0 for lang in _LANGUAGE_SIGNALS}
    for lang, patterns in _LANGUAGE_SIGNALS.items():
        for pattern in patterns:
            if re.search(pattern, source, re.MULTILINE):
                scores[lang] += 1
    best = max(scores, key=scores.get)
    return best if scores[best] > 0 else "unknown"


def strip_comments_and_strings(source: str, language: str) -> str:
    """Remove comments and mask string-literal contents before tokenizing,
    so neither can inflate or deflate a structural similarity score."""
    if language in _C_FAMILY:
        source = _C_STYLE_COMMENT.sub(" ", source)
    else:
        source = _HASH_COMMENT.sub(" ", source)
    source = _STRING_LITERAL.sub(" __STR__ ", source)
    return source


# --------------------------------------------------------------------------
# Tokenizer
# --------------------------------------------------------------------------

_TOKEN_SPEC = [
    ("NUMBER", r"\d+(?:\.\d+)?(?:[eE][+-]?\d+)?"),
    ("IDENT", r"[A-Za-z_]\w*"),
    ("OP", r"==|!=|<=|>=|&&|\|\||\+\+|--|->|[-+*/%=<>!&|^~]"),
    ("PUNCT", r"[(){}\[\];,.:]"),
    ("SKIP", r"[ \t]+"),
    ("NEWLINE", r"\n"),
    ("MISMATCH", r"."),
]
_MASTER_RE = re.compile(
    "|".join(f"(?P<{name}>{pattern})" for name, pattern in _TOKEN_SPEC)
)

_KEYWORDS = set(keyword.kwlist) | {
    "public", "private", "static", "void", "class", "int", "float",
    "double", "char", "boolean", "new", "return", "if", "else", "for",
    "while", "switch", "case", "break", "continue", "function", "const",
    "let", "var",
}


def tokenize(source: str, language: str) -> list[Token]:
    """Best-effort regex lexer. Does not require the source to parse into
    a valid AST -- broken/incomplete contest submissions still tokenize."""
    cleaned = strip_comments_and_strings(source, language)
    tokens: list[Token] = []
    line, line_start = 1, 0

    for match in _MASTER_RE.finditer(cleaned):
        kind = match.lastgroup
        value = match.group()
        col = match.start() - line_start

        if kind == "NEWLINE":
            line += 1
            line_start = match.end()
            continue
        if kind in ("SKIP", "MISMATCH"):
            continue
        if kind == "IDENT" and value in _KEYWORDS:
            tokens.append(Token(TokenType.KEYWORD, value, line, col))
        elif kind == "IDENT":
            tokens.append(Token(TokenType.IDENTIFIER, value, line, col))
        elif kind == "NUMBER":
            # Canonicalize numeric literals too: changing a magic constant
            # (e.g. 100 -> 200) is as trivial an evasion as renaming a
            # variable, and should not lower the structural score.
            tokens.append(Token(TokenType.LITERAL_NUM, "0", line, col))
        elif kind == "OP":
            tokens.append(Token(TokenType.OPERATOR, value, line, col))
        elif kind == "PUNCT":
            tokens.append(Token(TokenType.PUNCTUATION, value, line, col))

    return tokens


# --------------------------------------------------------------------------
# Identifier normalization (alpha-renaming)
# --------------------------------------------------------------------------

def normalize_identifiers(tokens: list[Token]) -> list[Token]:
    """Replace every distinct identifier with a canonical placeholder in
    order of first appearance. This single pass defeats the most common
    evasion tactic: renaming variables and functions. Two submissions
    identical in structure produce identical normalized streams even if
    every symbol name differs."""
    rename_map: dict[str, str] = {}
    normalized: list[Token] = []
    for tok in tokens:
        if tok.type is TokenType.IDENTIFIER:
            canonical = rename_map.setdefault(tok.value, f"ID{len(rename_map)}")
            normalized.append(Token(TokenType.IDENTIFIER, canonical, tok.line, tok.col))
        else:
            normalized.append(tok)
    return normalized


# --------------------------------------------------------------------------
# k-gram hashing + Winnowing fingerprint selection
# --------------------------------------------------------------------------

@dataclass(frozen=True)
class Fingerprint:
    hash_value: int
    position: int  # index of the k-gram's start token; useful for
                    # highlighting the matched region to a human reviewer


def _kgram_hashes(symbols: list[str], k: int) -> list[int]:
    """Hash every contiguous k-gram of normalized token values. Uses MD5
    per k-gram rather than an incremental Rabin-Karp rolling hash; this is
    O(n*k) rather than O(n) but is fast enough for typical submissions
    (<5k tokens). For large-batch contest-wide n-to-n scans, swap in an
    incremental polynomial rolling hash -- see Phase 4 scaling note."""
    return [
        int(hashlib.md5(" ".join(symbols[i:i + k]).encode("utf-8")).hexdigest(), 16)
        for i in range(len(symbols) - k + 1)
    ]


def winnow(hashes: list[int], window_size: int) -> set[Fingerprint]:
    """Winnowing (Schleimer, Wilkerson & Aiken, SIGMOD 2003 -- the
    algorithm underlying MOSS). Selects the minimum hash in every window
    of `window_size` consecutive k-gram hashes, breaking ties toward the
    rightmost position. Guarantees any shared substring of at least
    k + window_size - 1 tokens yields at least one common fingerprint,
    while bounding fingerprint density to ~2 / (window_size + 1)."""
    fingerprints: set[Fingerprint] = set()
    if not hashes:
        return fingerprints
    if len(hashes) < window_size:
        idx = min(range(len(hashes)), key=lambda i: (hashes[i], -i))
        fingerprints.add(Fingerprint(hashes[idx], idx))
        return fingerprints

    prev_selected = -1
    for start in range(len(hashes) - window_size + 1):
        window = hashes[start:start + window_size]
        # rightmost minimum within this window
        local_idx = max(range(window_size), key=lambda i: (-window[i], i))
        selected = start + local_idx
        if selected != prev_selected:
            fingerprints.add(Fingerprint(hashes[selected], selected))
            prev_selected = selected
    return fingerprints


def generate_fingerprints(
    source: str, language: str, k: int = 15, window_size: int = 4
) -> set[Fingerprint]:
    """Full pipeline: source -> tokens -> normalized tokens -> k-grams ->
    winnowed fingerprints. k=15 and window_size=4 are the defaults
    calibrated in Phase 3 against the IEEE CS SLIIT contest corpus."""
    tokens = tokenize(source, language)
    normalized = normalize_identifiers(tokens)
    symbols = [tok.value for tok in normalized]
    hashes = _kgram_hashes(symbols, k)
    return winnow(hashes, window_size)


# --------------------------------------------------------------------------
# Similarity scoring
# --------------------------------------------------------------------------

class Verdict(Enum):
    LOW_SIMILARITY = "LOW_SIMILARITY"
    MODERATE_SIMILARITY = "MODERATE_SIMILARITY"
    SUSPICIOUS = "SUSPICIOUS"


@dataclass
class SimilarityResult:
    jaccard: float
    shared_fingerprints: int
    total_fingerprints_a: int
    total_fingerprints_b: int
    verdict: Verdict


# Calibrated on the IEEE CS SLIIT internal corpus (Phase 3): ~40
# known-plagiarized and ~120 known-independent submission pairs collected
# across three annual contest cycles.
FLAG_THRESHOLD = 0.65     # >= this -> SUSPICIOUS, route to human review
REVIEW_THRESHOLD = 0.40   # >= this -> MODERATE_SIMILARITY, spot-check


def jaccard_similarity(
    fp_a: set[Fingerprint], fp_b: set[Fingerprint]
) -> SimilarityResult:
    hashes_a = {fp.hash_value for fp in fp_a}
    hashes_b = {fp.hash_value for fp in fp_b}
    intersection = hashes_a & hashes_b
    union = hashes_a | hashes_b
    score = len(intersection) / len(union) if union else 0.0

    if score >= FLAG_THRESHOLD:
        verdict = Verdict.SUSPICIOUS
    elif score >= REVIEW_THRESHOLD:
        verdict = Verdict.MODERATE_SIMILARITY
    else:
        verdict = Verdict.LOW_SIMILARITY

    return SimilarityResult(
        jaccard=round(score, 4),
        shared_fingerprints=len(intersection),
        total_fingerprints_a=len(hashes_a),
        total_fingerprints_b=len(hashes_b),
        verdict=verdict,
    )


def check_plagiarism(
    source_a: str,
    source_b: str,
    filename_a: str | None = None,
    filename_b: str | None = None,
) -> SimilarityResult:
    """Top-level entry point mirroring the MCS `algo_check_plagiarism`
    tool contract: two raw source strings in, one SimilarityResult out."""
    lang_a = detect_language(source_a, filename_a)
    lang_b = detect_language(source_b, filename_b)
    if lang_a != lang_b:
        # Cross-language comparisons degrade to language A's grammar,
        # which under-tokenizes B. Callers should treat this case as
        # out-of-scope for automated scoring and route to manual review.
        language = lang_a
    else:
        language = lang_a

    fp_a = generate_fingerprints(source_a, language)
    fp_b = generate_fingerprints(source_b, language)
    return jaccard_similarity(fp_a, fp_b)
```

---

## Phase 3: Automated Verification

Every threshold in this skill is only as trustworthy as the fixtures it was calibrated against. Maintain a small, versioned regression corpus with at least one known-plagiarized pair and one known-independent pair per supported language, and run it on every change to the tokenizer, normalizer, or thresholds.

```python
# tests/test_plagiarism_detector.py
from algo_plagiarism_detector import check_plagiarism, Verdict

PLAGIARIZED_PAIR = (
    """
def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        for j in range(0, n - i - 1):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
    return arr
""",
    """
def bs(data):
    length = len(data)
    for x in range(length):
        for y in range(0, length - x - 1):
            if data[y] > data[y + 1]:
                data[y], data[y + 1] = data[y + 1], data[y]
    return data
""",
)

INDEPENDENT_PAIR = (
    PLAGIARIZED_PAIR[0],
    """
def binary_search(arr, target):
    low, high = 0, len(arr) - 1
    while low <= high:
        mid = (low + high) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            low = mid + 1
        else:
            high = mid - 1
    return -1
""",
)


def test_renamed_clone_is_flagged_suspicious():
    code_a, code_b = PLAGIARIZED_PAIR
    result = check_plagiarism(code_a, code_b, "a.py", "b.py")
    assert result.jaccard >= 0.65, f"expected >=0.65, got {result.jaccard}"
    assert result.verdict == Verdict.SUSPICIOUS


def test_unrelated_algorithms_score_low():
    code_a, code_b = INDEPENDENT_PAIR
    result = check_plagiarism(code_a, code_b, "a.py", "b.py")
    assert result.jaccard < 0.40, f"expected <0.40, got {result.jaccard}"
    assert result.verdict == Verdict.LOW_SIMILARITY


def test_identical_submission_is_perfect_match():
    code_a, _ = PLAGIARIZED_PAIR
    result = check_plagiarism(code_a, code_a, "a.py", "a.py")
    assert result.jaccard == 1.0
    assert result.verdict == Verdict.SUSPICIOUS


def test_undersized_submission_flagged_not_scored():
    tiny = "x = 1\n"
    result = check_plagiarism(tiny, tiny, "a.py", "b.py")
    # Structurally identical, but too small to trust automatically --
    # callers must additionally check total_fingerprints_* against a
    # minimum-size gate before accepting a verdict at face value.
    assert result.total_fingerprints_a <= 3
```

Run the fixture suite and require both directions of failure to be caught — a threshold that never flags real clones is as broken as one that flags everything:

```bash
# Full regression suite, verbose
pytest tests/test_plagiarism_detector.py -v

# Isolate the true-positive fixture only
pytest tests/test_plagiarism_detector.py -k "renamed_clone" -v --tb=short

# Isolate the true-negative fixture only
pytest tests/test_plagiarism_detector.py -k "unrelated_algorithms" -v --tb=short

# Smoke-test the live MCP tool against the same fixture pair
mcp-cs invoke algo_check_plagiarism --file-a fixtures/plagiarized/a.py --file-b fixtures/plagiarized/b.py
mcp-cs invoke algo_check_plagiarism --file-a fixtures/independent/a.py --file-b fixtures/independent/b.py
```

Acceptance gate before shipping any change to tokenization, normalization, `k`, or `window_size`: the known-plagiarized fixture must score `>= FLAG_THRESHOLD` and the known-independent fixture must score `< REVIEW_THRESHOLD`. If a change narrows or closes that gap, do not ship it — recalibrate against the full corpus first (see Phase 4).

---

## Phase 4: Rollback & Self-Healing

### The dominant failure mode: boilerplate-inflated false positives

The single most common false positive in contest and coursework judging is not clever plagiarism evading detection — it is **shared starter code** inflating the score of two submissions that never saw each other. If an instructor hands out a function stub, an I/O harness, or a fixed `class Solution:` scaffold, every honest submission's fingerprint set will contain the boilerplate's fingerprints. Two students who never communicated can land at 0.50+ Jaccard purely from the parts of the file neither of them wrote.

**Detection signal:** a `MODERATE_SIMILARITY` or `SUSPICIOUS` verdict where the shared fingerprints cluster entirely within the first/last N lines, or where the same fingerprints recur at that same similarity level across a large fraction of *all* pairs in the batch (a real clone is an outlier against the batch; boilerplate inflation is a batch-wide floor).

**Remediation — baseline corpus diff:**

```python
def load_baseline_fingerprints(
    starter_code_paths: list[str], language: str
) -> set[int]:
    """Precompute the fingerprint set of every piece of instructor-issued
    boilerplate (starter templates, provided I/O harnesses, stub
    signatures). This baseline is subtracted from every pairwise
    comparison so two submissions are never flagged merely because both
    correctly used the scaffolding they were both handed."""
    baseline: set[int] = set()
    for path in starter_code_paths:
        with open(path, "r", encoding="utf-8") as f:
            source = f.read()
        baseline |= {fp.hash_value for fp in generate_fingerprints(source, language)}
    return baseline


def check_plagiarism_baseline_aware(
    source_a: str,
    source_b: str,
    baseline_fingerprints: set[int],
    filename_a: str | None = None,
    filename_b: str | None = None,
) -> SimilarityResult:
    language = detect_language(source_a, filename_a)
    fp_a = {fp.hash_value for fp in generate_fingerprints(source_a, language)}
    fp_b = {fp.hash_value for fp in generate_fingerprints(source_b, language)}

    fp_a -= baseline_fingerprints
    fp_b -= baseline_fingerprints

    intersection = fp_a & fp_b
    union = fp_a | fp_b
    score = len(intersection) / len(union) if union else 0.0
    verdict = (
        Verdict.SUSPICIOUS if score >= FLAG_THRESHOLD
        else Verdict.MODERATE_SIMILARITY if score >= REVIEW_THRESHOLD
        else Verdict.LOW_SIMILARITY
    )
    return SimilarityResult(round(score, 4), len(intersection), len(fp_a), len(fp_b), verdict)
```

**Rollback procedure when a verdict is contested:**

1. Re-run the pair through `check_plagiarism_baseline_aware` with the current contest's starter-code corpus loaded. If the verdict downgrades below `REVIEW_THRESHOLD`, the original flag was boilerplate inflation — auto-clear it and log the correction.
2. If the verdict holds after the baseline diff, escalate to human review with both raw files and the *non-baseline* shared fingerprints highlighted by `Fingerprint.position` — a reviewer should never have to re-derive which lines matched.
3. Never silently downgrade a `SUSPICIOUS` verdict issued to a submitting party without logging why (baseline diff, threshold recalibration, or manual override) — academic integrity findings need an audit trail even when reversed.

**Self-healing loop:** every confirmed false positive should feed back into the system, not just get dismissed once:

- Add the offending shared fingerprints to a **common-idiom watchlist** if the same fingerprint recurs as a "match" across more than a small fraction of all-pairs in a batch (a strong signal it is generic scaffolding or an idiomatic pattern like a standard fast-I/O template, not evidence of copying), even when it wasn't in the originally-supplied starter file.
- If starter code changes between contest years, regenerate the baseline corpus — a stale baseline both under-protects (new boilerplate not yet in the corpus) and over-protects (old boilerplate fingerprints incorrectly suppressing a real match that happens to collide).
- If a language's `_LANGUAGE_SIGNALS` heuristic misclassifies a submission (Phase 1), add the misclassified sample's distinguishing pattern to the signal list rather than hand-patching that one case — the goal is a self-improving detector, not a detector plus a pile of one-off exceptions.

**Scaling note:** for contest-wide n-to-n scans (every submission against every other), the `O(n*k)` per-file hashing in `_kgram_hashes` and the `O(m^2)` pairwise comparisons across `m` submissions both become the bottleneck well before a few hundred entries. At that scale, replace MD5-per-k-gram with an incremental Rabin-Karp rolling hash, and index fingerprints in an inverted table (`hash -> [submission_ids]`) so that shared fingerprints across the whole batch are found in one pass instead of `m` choose `2` pairwise passes.

---

## Common Anti-Patterns vs. Gold Standard

| # | Anti-Pattern | Why It Fails | Gold Standard |
|---|---|---|---|
| 1 | Raw text diff (`difflib`, line-based diff) on unmodified source | Trivially defeated by whitespace reflow and identifier renaming — changes formatting, not logic | Tokenize and normalize identifiers first; diff the normalized token stream, never raw bytes |
| 2 | Exact AST/hash equality between two full trees | Over-corrects: one inserted `pass`, one reordered independent statement, and a real clone reads as "no match" | Fuzzy local matching via k-gram Winnowing fingerprints — tolerant of local edits, still requires long shared structure |
| 3 | Reporting a raw similarity score with no baseline diff | Instructor-issued boilerplate/starter code inflates every honest pair's score identically | Subtract a precomputed baseline-corpus fingerprint set before scoring (Phase 4) |
| 4 | One global similarity threshold for every assignment | A 5-line FizzBuzz has a much higher natural similarity floor than a 200-line project; one threshold either over- or under-flags depending on problem size | Calibrate `FLAG_THRESHOLD`/`REVIEW_THRESHOLD` per assignment/problem against that problem's own historical submission corpus |
| 5 | Comparing only the two submissions named in the request, in isolation | Misses ring/middleman plagiarism spanning three or more submissions that individually look only moderately similar to any one peer | Run full pairwise (or inverted-index) comparison across the entire submission batch, not just the reported pair, when investigating a contest cohort |
| 6 | Skipping comment/string stripping before tokenizing | Identical instructor-provided prompt strings or copy-pasted comments inflate the score independent of logic | Strip comments and mask string-literal contents in Phase 1, before the token stream is built |
| 7 | Trusting file extension alone for language detection | Contest judges frequently accept raw stdin pastes with no filename/extension | Multi-signal syntax heuristic as a fallback (Phase 1's `detect_language`), with an explicit `unknown` outcome routed to manual review |
| 8 | Auto-penalizing on a `SUSPICIOUS` verdict with no human in the loop | The detector produces a similarity signal, not an intent finding; false positives from baseline inflation or coincidental generic idioms are expected | Route every `SUSPICIOUS` (and spot-checked `MODERATE_SIMILARITY`) verdict to mandatory human review before any consequence is applied |

---

## Pre-Flight Checklist

- [ ] Both submissions are confirmed to tokenize without the lexer silently dropping the entire file (near-zero token count is a red flag, not a clean pass).
- [ ] Language detection agrees for both files; if it disagrees, the comparison is explicitly marked out-of-scope for automated scoring rather than silently forced through one grammar.
- [ ] The current contest/assignment's baseline boilerplate corpus (starter code, provided I/O harness, stub signatures) is loaded and up to date before scoring.
- [ ] `k` and `window_size` match the calibrated defaults (`k=15`, `window_size=4`) unless a documented, corpus-validated override exists for this specific contest track or assignment size.
- [ ] Submission provenance (team/student ID, submission timestamp) is attached to each fingerprint set for later auditability — a bare similarity number with no attached identity is not actionable.
- [ ] Submission token count is above the minimum reliability threshold (~30 normalized tokens); undersized files are routed to manual-only review, not scored automatically.
- [ ] Any PII embedded in comments or string literals (names, emails, roll numbers) is stripped or redacted before results are logged or persisted anywhere outside the immediate review context.
- [ ] The MCP tool `algo_check_plagiarism` version/config in use matches the version the current `FLAG_THRESHOLD`/`REVIEW_THRESHOLD` values were calibrated against (Phase 3).
- [ ] The reviewer who will see a flagged result has access to both raw source files and the matched fingerprint positions — not just the numeric score.

## Post-Flight Checklist

- [ ] Verdict, Jaccard score, shared-fingerprint count, and both submission IDs are logged with a timestamp before the result leaves this workflow.
- [ ] Every `SUSPICIOUS` verdict is routed to a human review queue; no automated penalty, grade change, or disqualification is applied on the algorithm's output alone.
- [ ] Every `MODERATE_SIMILARITY` verdict is spot-checked against the current baseline corpus to rule out boilerplate inflation before it reaches a reviewer's queue.
- [ ] Any false positive confirmed during human review is fed back into the baseline corpus or common-idiom watchlist (Phase 4), not just individually dismissed.
- [ ] Raw fingerprint sets (not only the summary score) are retained for the institution's defined retention window, in case of an appeal that requires re-derivation of the match.
- [ ] The aggregate similarity-score distribution for the batch is reviewed for anomalies (an unexpectedly high floor across many pairs signals uncaptured boilerplate, not a wave of collusion) before any threshold is adjusted going forward.
- [ ] A sample of `LOW_SIMILARITY` results is still manually spot-checked; fingerprint-based detection under-detects heavy semantic-preserving refactors (algorithm substitution, control-flow inversion) that a human skim can catch.
- [ ] Access to similarity reports and the underlying submissions is itself logged and auditable — academic integrity data is sensitive and access-controlled independent of the detection pipeline.
- [ ] Submission owners are notified of a finalized verdict per the institution's/contest's stated policy and timeline — this skill produces the evidence, not the notification or the disciplinary process.
