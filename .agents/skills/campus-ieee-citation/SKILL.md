---
name: campus-ieee-citation
description: Activate when a user asks to "format this reference list in IEEE style," "cite this paper/website/dataset/repo in IEEE format," reorder/renumber in-text citations, or build/validate/clean the References or Bibliography section of an academic report, thesis, conference paper, or lab writeup. Also activate for requests to convert APA/MLA/BibTeX references into IEEE, to check whether a reference list is in citation order (not alphabetical), or to fill in missing citation fields (DOI, access date, volume/issue) per IEEE Editorial Style Manual rules. Covers six source types: journal article, conference paper, book, website, dataset, and software/GitHub repository.
version: 1.0.0
author: IEEE Computer Society of SLIIT
tags: [ieee-style, citations, bibliography, academic-writing, references, reference-manager, typescript, python]
---

# IEEE Citation & Reference Formatter

## Mission

Produce IEEE-compliant, machine-verifiable reference lists and in-text citation
markers for academic reports, theses, and conference papers. This skill treats
citation formatting as a **deterministic transformation pipeline**: structured
source metadata goes in, a validated IEEE reference string and a stable
citation number come out. Every entry is either fully correct, or explicitly
flagged as incomplete — never silently wrong, never silently dropped. The
skill covers discovery (what kind of source is this, what fields do I have),
execution (format it correctly, track its citation number), verification
(prove the formatter's output matches known-good IEEE examples), and recovery
(what to do when required fields are missing).

---

## Mental Model & Theoretical Foundations

### 1. The IEEE citation system in one paragraph

IEEE uses a **numbered, bracketed, citation-order** system. Every source gets
exactly one number, assigned the first time it is cited in the body text —
`[1]`, `[2]`, `[3]` — reading left to right, top to bottom, through the
document. The **References** section is then built in that same order: entry
`[1]` in the text corresponds to the first entry in the reference list,
regardless of author surname, title, or publication year. Re-citing the same
source later in the paper reuses its original number; it never gets a new one
and never gets re-listed.

This is the single most important structural fact about IEEE style, and it is
the most common thing people get wrong because they default to habits learned
from other systems.

### 2. Contrast with APA / MLA (why this trips people up)

| Property | IEEE | APA | MLA |
|---|---|---|---|
| In-text marker | `[1]`, `[2]`, `[3]` (bracketed number) | `(Author, Year)` | `(Author page#)` |
| Reference list order | **Order of first citation** (citation order) | Alphabetical by surname | Alphabetical by surname |
| Reference list heading | "References" | "References" | "Works Cited" |
| Multiple citations | `[1], [3], [7]` or `[1]–[3]` | `(Smith, 2020; Lee, 2021)` | Not bracketed |
| Author name format | Initials first: `J. K. Author` | Surname, Initials: `Smith, J. K.` | Full name: `Smith, John K.` |
| Title capitalization | Sentence case, quoted: `"Title of paper,"` | Sentence case, no quotes | Title Case, quoted |
| Page numbers in-text | Not used in-text (only in reference) | Used for direct quotes | Used routinely |

The practical failure mode: someone formats each *individual* reference
correctly (right punctuation, right italics) but then **alphabetizes the
list** out of habit from APA/MLA training. That produces a reference list
that is internally well-formatted but structurally wrong, because `[1]` in
the text no longer points at the first item in the list. Alphabetical
ordering is the single most common IEEE anti-pattern — see the Anti-Patterns
table below.

### 3. Field-order rules by source type

Each IEEE source type has a **fixed field order**. Fields are not
interchangeable or reorderable — a formatter (human or code) must know which
type it is dealing with before it can know which fields to expect and in
what sequence. The canonical field order per type:

```
JOURNAL ARTICLE:
  [n] Author(s), "Title of article," Abbrev. Journal Title, vol. X, no. X,
      pp. XX-XX, Month Year, doi: XX.XXXX/XXXXXXX.

CONFERENCE PAPER:
  [n] Author(s), "Title of paper," in Abbrev. Conference Title, City, State/
      Country, Year, pp. XX-XX.

BOOK:
  [n] Author(s), Title of Book, Xth ed. City, State, Country: Publisher,
      Year, pp. XX-XX.

WEBSITE:
  [n] Author/Org, "Title of page," Name of Site. Accessed: Month DD, YYYY.
      [Online]. Available: https://...

DATASET:
  [n] Author(s), "Title of dataset," Repository/Publisher, Year. [Online].
      Available: https://doi.org/... [Accessed: Month DD, YYYY].

SOFTWARE / GITHUB REPO:
  [n] Author/Org, "Title of project," version X.X, GitHub. [Online].
      Available: https://github.com/org/repo. [Accessed: Month DD, YYYY].
```

Anatomy of a single reference, annotated:

```
[1] A. B. Author, "Title of Article," Abbrev. J. Name, vol. 12, no. 3, pp. 45-52, Mar. 2024, doi: 10.1109/EXAMPLE.2024.1234567.
 │       │                  │                     │        │        │       │         │                    │
 │     Author(s)         Title (quoted,        Journal    Volume  Issue   Page     Month +               DOI
 Number  "F. Last"       sentence case,        (italic,   "vol.   "no.   range     Year
 (order  format;         terminal comma        abbrev.,   X"      X"    "pp. XX-XX"
 of      "and" before    inside quotes)        italic)
 first   last author)
 citation)
```

### 4. Field-order comparison table (all six source types)

`●` = required, `◐` = required if applicable / commonly present, `—` = not used for this type.

| Field | Journal | Conference | Book | Website | Dataset | Software |
|---|---|---|---|---|---|---|
| Author(s) | ● | ● | ● | ● (or Org) | ● | ● (or Org) |
| Title (quoted) | ● | ● | — (italic, not quoted) | ● | ● | ● |
| Book title (italic) | — | — | ● | — | — | — |
| Journal / Conf. name (italic) | ● (abbrev.) | ● (abbrev.) | — | — | — | — |
| Site / Repository name | — | — | — | ● | ● | ● (GitHub) |
| Volume (`vol.`) | ● | ◐ | ◐ | — | — | ◐ (version) |
| Issue/Number (`no.`) | ● | ◐ | — | — | — | — |
| Edition (`xth ed.`) | — | — | ◐ | — | — | — |
| Pages (`pp.`) | ● | ● | ◐ | — | — | — |
| Publisher/City | — | ◐ (conf. location) | ● | — | ◐ | — |
| Month + Year | ● | ● | — (year only) | — (year only) | — (year only) | — (year only) |
| DOI | ● (preferred) | ◐ | — | — | ◐ (preferred) | — |
| URL (`[Online]. Available:`) | ◐ (if no DOI) | ◐ (if online) | — | ● | ● | ● |
| Accessed date | — (DOI is stable) | ◐ (if online-only) | — | ● | ● | ● |

### 5. Why consistent formatting matters for automated bibliometric parsing

IEEE's rigid, positional field order is not stylistic pedantry — it exists
because reference lists get **machine-parsed** downstream: by citation
indexers (Scopus, Web of Science, IEEE Xplore itself), by reference managers
(Zotero, Mendeley, EndNote) doing round-trip import/export, and by
plagiarism/originality checkers that cross-reference bibliographies. A parser
walking a IEEE-formatted string can reliably assume "the text between the
first `A-Z` after the leading `[n]` and the first quotation mark is the
author list" — but only if every entry actually follows the field order.
Inconsistent field order (e.g., placing the year before the volume, or
swapping quoted/italic conventions) breaks regex- and grammar-based
extraction, silently corrupting citation counts and h-index calculations
built on top of them. Treat the field order as a strict schema, not a
suggestion — this is the same reasoning that justifies writing a typed
formatter instead of hand-editing strings inconsistently across a document.

---

## Phase 1: Discovery & Static Analysis

Before formatting anything, classify the source and inventory what metadata
is actually available. Do not guess a source type from a URL alone — a
`.pdf` link can be a journal article, a conference paper, a dataset
supplement, or a standalone report.

### 1.1 Source-type identification signals

| Signal | Indicates | Detection method |
|---|---|---|
| DOI present (`10.xxxx/...`) | Journal article, conference paper, or dataset with a registered DOI | Regex: `^10\.\d{4,9}/[-._;()/:A-Za-z0-9]+$` — then resolve via CrossRef |
| arXiv ID present | Preprint (format as journal-like, note "arXiv preprint" as venue) | Regex: `^\d{4}\.\d{4,5}(v\d+)?$` (2007+) or `^[a-z-]+/\d{7}$` (pre-2007) |
| `github.com` / `gitlab.com` in URL | Software / repository | Hostname match; extract org/repo path segments |
| Journal/conference name absent, bare URL only | Website (needs "Accessed" date — content is mutable) | No DOI, no repo host, no dataset registry domain |
| Hosted on Kaggle, Zenodo, IEEE DataPort, data.gov | Dataset | Domain allowlist match |
| ISBN present | Book | Regex: `^(97[89])?\d{9}(\d|X)$` (with hyphens stripped) |
| "Proceedings of", "Proc.", conference acronym + year in venue name | Conference paper | Keyword match on container title |

### 1.2 DOI resolution workflow

1. Validate DOI shape with the regex above.
2. Query `https://api.crossref.org/works/{doi}` (or `https://doi.org/{doi}`
   with `Accept: application/vnd.citationstyles.csl+json`) to pull
   authoritative title, container-title, volume, issue, page, and
   published-date fields.
3. Prefer registry data over user-typed metadata when they conflict — typos
   in hand-entered titles/page ranges are the most common source of citation
   errors.
4. If the DOI 404s or the registry is unreachable, fall back to
   user-supplied fields and flag the entry (see Phase 4).

### 1.3 arXiv ID handling

arXiv preprints are formatted as journal-like entries with the arXiv
identifier standing in for volume/issue/DOI:

```
[n] A. Author, "Title of preprint," arXiv:2401.12345 [cs.CR], 2024.
```

Pattern-match the ID with `^\d{4}\.\d{4,5}(v\d+)?$`; the first four digits
are `YYMM` and validate against a plausible year range as a sanity check
(e.g., `24` → 2024, reject if it implies a year before arXiv existed in 1991
or after the current year).

### 1.4 URL-only sources and the "Accessed" date rule

Any source whose only stable locator is a URL (personal blog, vendor
documentation, news article, wiki page, standards body page without a DOI)
**requires** an `Accessed: Month DD, YYYY` field, because the content behind
that URL is mutable and unversioned — unlike a DOI or ISBN, the URL alone
does not guarantee the reader sees what the author saw. This applies to
Website, Dataset (when no DOI), and Software/GitHub entry types. Journal and
conference entries with a DOI do **not** need an accessed date, since the DOI
resolves to a fixed, versioned record.

### 1.5 Required-field checklist per source type

Use this before invoking the formatter — an entry missing a `●` field should
go through Phase 4 fallback/flagging rather than being formatted as-is.

- **Journal article**: ● authors, ● title, ● journal name, ● volume, ● issue,
  ● pages, ● month, ● year, ◐ DOI (strongly preferred if it exists)
- **Conference paper**: ● authors, ● title, ● conference name, ● year,
  ● pages, ◐ city/country, ◐ DOI
- **Book**: ● authors, ● title, ● city, ● country/state, ● publisher,
  ● year, ◐ edition, ◐ page range (for a chapter/section citation)
- **Website**: ● author or organization, ● page title, ● site name,
  ● URL, ● accessed date
- **Dataset**: ● authors, ● title, ● repository/publisher, ● year,
  ● URL or DOI, ◐ accessed date (required if no DOI), ◐ version
- **Software/GitHub**: ● author/org, ● project title, ● URL, ● accessed date,
  ◐ version tag

---

## Phase 2: Execution & Implementation

Two complete, drop-in implementations follow — TypeScript and Python — each
covering all six source types, author-list formatting, and an in-text
citation-order tracker. Both expose the same contract: feed a structured
metadata object in, get a fully formatted IEEE reference string and a stable
citation number out.

### 2.1 TypeScript implementation

```typescript
// ieee-citation.ts
// Complete IEEE reference formatter + in-text citation tracker.

export type SourceType =
  | "journal-article"
  | "conference-paper"
  | "book"
  | "website"
  | "dataset"
  | "software";

export interface CitationEntry {
  /** Stable identifier for de-duplication, e.g. a DOI, URL, or slug. */
  key: string;
  type: SourceType;
  authors: string[];          // ["John K. Smith", "Alice B. Lee"]
  organization?: string;      // used when authors[] is empty (e.g. "GitHub, Inc.")
  title: string;
  containerTitle?: string;    // journal / conference / site / repository name
  volume?: string;
  issue?: string;
  pages?: string;             // "45-52"
  month?: string;             // "Mar."
  year?: number | string;     // number, or "n.d." fallback
  doi?: string;
  url?: string;
  accessedDate?: string;      // "Mar. 12, 2026"
  publisher?: string;
  city?: string;
  state?: string;
  country?: string;
  edition?: string;           // "2nd"
  version?: string;           // "v2.3.1"
}

export interface FormatResult {
  reference: string;
  warnings: string[];
  isComplete: boolean;
}

// ---- Author formatting -----------------------------------------------

/** "John K. Smith" -> "J. K. Smith" */
function toInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  const last = parts.pop()!;
  const initials = parts.map((p) => `${p.charAt(0).toUpperCase()}.`).join(" ");
  return initials ? `${initials} ${last}` : last;
}

/**
 * IEEE author-list rule: list all authors up to six, joined with commas and
 * "and" before the last. Beyond six authors, list the first author only,
 * followed by "et al."
 */
export function formatAuthors(entry: CitationEntry): string {
  if (entry.authors.length === 0 && entry.organization) {
    return entry.organization;
  }
  const names = entry.authors.map(toInitials);
  if (names.length === 0) return "[No author]";
  if (names.length === 1) return names[0];
  if (names.length <= 6) {
    return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  }
  return `${names[0]} et al.`;
}

// ---- Per-type builders --------------------------------------------------

function buildJournalArticle(e: CitationEntry): string {
  const authors = formatAuthors(e);
  const doiPart = e.doi ? `, doi: ${e.doi}` : "";
  return (
    `${authors}, "${e.title}," ${e.containerTitle}, vol. ${e.volume}, ` +
    `no. ${e.issue}, pp. ${e.pages}, ${e.month} ${e.year}${doiPart}.`
  );
}

function buildConferencePaper(e: CitationEntry): string {
  const authors = formatAuthors(e);
  const location = [e.city, e.state, e.country].filter(Boolean).join(", ");
  const locationPart = location ? `${location}, ` : "";
  const doiPart = e.doi ? `, doi: ${e.doi}` : "";
  return (
    `${authors}, "${e.title}," in ${e.containerTitle}, ${locationPart}` +
    `${e.year}, pp. ${e.pages}${doiPart}.`
  );
}

function buildBook(e: CitationEntry): string {
  const authors = formatAuthors(e);
  const editionPart = e.edition ? `, ${e.edition} ed.` : "";
  const location = [e.city, e.state, e.country].filter(Boolean).join(", ");
  const pagesPart = e.pages ? `, pp. ${e.pages}` : "";
  return (
    `${authors}, ${e.title}${editionPart}. ${location}: ${e.publisher}, ` +
    `${e.year}${pagesPart}.`
  );
}

function buildWebsite(e: CitationEntry): string {
  const authors = formatAuthors(e);
  return (
    `${authors}, "${e.title}," ${e.containerTitle}. Accessed: ` +
    `${e.accessedDate}. [Online]. Available: ${e.url}`
  );
}

function buildDataset(e: CitationEntry): string {
  const authors = formatAuthors(e);
  const source = e.doi ?? e.url;
  const accessedPart = e.accessedDate ? ` [Accessed: ${e.accessedDate}].` : "";
  return (
    `${authors}, "${e.title}," ${e.containerTitle}, ${e.year}. [Online]. ` +
    `Available: ${source}.${accessedPart}`
  );
}

function buildSoftware(e: CitationEntry): string {
  const authors = formatAuthors(e);
  const versionPart = e.version ? `, version ${e.version}` : "";
  return (
    `${authors}, "${e.title}"${versionPart}, ${e.containerTitle ?? "GitHub"}. ` +
    `[Online]. Available: ${e.url}. [Accessed: ${e.accessedDate}].`
  );
}

const BUILDERS: Record<SourceType, (e: CitationEntry) => string> = {
  "journal-article": buildJournalArticle,
  "conference-paper": buildConferencePaper,
  book: buildBook,
  website: buildWebsite,
  dataset: buildDataset,
  software: buildSoftware,
};

/** Required fields per type, used by the validator in Phase 4. */
export const REQUIRED_FIELDS: Record<SourceType, (keyof CitationEntry)[]> = {
  "journal-article": ["authors", "title", "containerTitle", "volume", "issue", "pages", "year"],
  "conference-paper": ["authors", "title", "containerTitle", "year", "pages"],
  book: ["authors", "title", "city", "publisher", "year"],
  website: ["title", "containerTitle", "url", "accessedDate"],
  dataset: ["authors", "title", "containerTitle", "year"],
  software: ["title", "url", "accessedDate"],
};

/**
 * Format a single entry into a full IEEE reference-list line, e.g.:
 * `[3] J. K. Smith and A. B. Lee, "Title," ...`
 */
export function formatIEEEReference(entry: CitationEntry, number: number): string {
  const body = BUILDERS[entry.type](entry);
  return `[${number}] ${body}`;
}

// ---- In-text citation-order tracker -------------------------------------

/**
 * Assigns and reuses [n] citation numbers in strict order-of-first-citation,
 * per IEEE rules. Call `.cite(entry)` every time a source is referenced in
 * the body text; it returns the correct number whether this is the first
 * citation or a repeat.
 */
export class CitationTracker {
  private order: string[] = [];           // key -> position defines number
  private entries = new Map<string, CitationEntry>();

  /** Returns the citation number for this entry, assigning a new one on first use. */
  cite(entry: CitationEntry): number {
    const existingIndex = this.order.indexOf(entry.key);
    if (existingIndex !== -1) {
      return existingIndex + 1;
    }
    this.order.push(entry.key);
    this.entries.set(entry.key, entry);
    return this.order.length;
  }

  /** In-text marker for one or more citation numbers, e.g. "[1], [3]" or "[1]-[3]". */
  markerFor(keys: string[]): string {
    const numbers = keys
      .map((k) => this.order.indexOf(k) + 1)
      .filter((n) => n > 0)
      .sort((a, b) => a - b);
    return CitationTracker.collapseRuns(numbers);
  }

  private static collapseRuns(numbers: number[]): string {
    const parts: string[] = [];
    let i = 0;
    while (i < numbers.length) {
      let j = i;
      while (j + 1 < numbers.length && numbers[j + 1] === numbers[j] + 1) j++;
      parts.push(j > i ? `[${numbers[i]}]-[${numbers[j]}]` : `[${numbers[i]}]`);
      i = j + 1;
    }
    return parts.join(", ");
  }

  /** Full References section, already in correct citation order. */
  buildReferenceList(): string[] {
    return this.order.map((key, idx) =>
      formatIEEEReference(this.entries.get(key)!, idx + 1)
    );
  }
}
```

### 2.2 Python implementation

```python
# ieee_citation.py
# Complete IEEE reference formatter + in-text citation tracker.

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class SourceType(str, Enum):
    JOURNAL_ARTICLE = "journal-article"
    CONFERENCE_PAPER = "conference-paper"
    BOOK = "book"
    WEBSITE = "website"
    DATASET = "dataset"
    SOFTWARE = "software"


@dataclass
class CitationEntry:
    key: str
    type: SourceType
    authors: list[str] = field(default_factory=list)
    organization: Optional[str] = None
    title: str = ""
    container_title: Optional[str] = None
    volume: Optional[str] = None
    issue: Optional[str] = None
    pages: Optional[str] = None
    month: Optional[str] = None
    year: Optional[str] = None
    doi: Optional[str] = None
    url: Optional[str] = None
    accessed_date: Optional[str] = None
    publisher: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    edition: Optional[str] = None
    version: Optional[str] = None


REQUIRED_FIELDS: dict[SourceType, list[str]] = {
    SourceType.JOURNAL_ARTICLE: ["authors", "title", "container_title", "volume", "issue", "pages", "year"],
    SourceType.CONFERENCE_PAPER: ["authors", "title", "container_title", "year", "pages"],
    SourceType.BOOK: ["authors", "title", "city", "publisher", "year"],
    SourceType.WEBSITE: ["title", "container_title", "url", "accessed_date"],
    SourceType.DATASET: ["authors", "title", "container_title", "year"],
    SourceType.SOFTWARE: ["title", "url", "accessed_date"],
}


def _to_initials(full_name: str) -> str:
    """'John K. Smith' -> 'J. K. Smith'"""
    parts = full_name.strip().split()
    if not parts:
        return full_name
    last = parts.pop()
    initials = " ".join(f"{p[0].upper()}." for p in parts)
    return f"{initials} {last}".strip()


def format_authors(entry: CitationEntry) -> str:
    """IEEE rule: list up to six authors joined with 'and' before the last;
    beyond six, list the first author followed by 'et al.'"""
    if not entry.authors and entry.organization:
        return entry.organization
    names = [_to_initials(n) for n in entry.authors]
    if not names:
        return "[No author]"
    if len(names) == 1:
        return names[0]
    if len(names) <= 6:
        return ", ".join(names[:-1]) + f" and {names[-1]}"
    return f"{names[0]} et al."


def _build_journal_article(e: CitationEntry) -> str:
    authors = format_authors(e)
    doi_part = f", doi: {e.doi}" if e.doi else ""
    return (
        f'{authors}, "{e.title}," {e.container_title}, vol. {e.volume}, '
        f"no. {e.issue}, pp. {e.pages}, {e.month} {e.year}{doi_part}."
    )


def _build_conference_paper(e: CitationEntry) -> str:
    authors = format_authors(e)
    location = ", ".join(x for x in [e.city, e.state, e.country] if x)
    location_part = f"{location}, " if location else ""
    doi_part = f", doi: {e.doi}" if e.doi else ""
    return (
        f'{authors}, "{e.title}," in {e.container_title}, {location_part}'
        f"{e.year}, pp. {e.pages}{doi_part}."
    )


def _build_book(e: CitationEntry) -> str:
    authors = format_authors(e)
    edition_part = f", {e.edition} ed." if e.edition else ""
    location = ", ".join(x for x in [e.city, e.state, e.country] if x)
    pages_part = f", pp. {e.pages}" if e.pages else ""
    return (
        f"{authors}, {e.title}{edition_part}. {location}: {e.publisher}, "
        f"{e.year}{pages_part}."
    )


def _build_website(e: CitationEntry) -> str:
    authors = format_authors(e)
    return (
        f'{authors}, "{e.title}," {e.container_title}. Accessed: '
        f"{e.accessed_date}. [Online]. Available: {e.url}"
    )


def _build_dataset(e: CitationEntry) -> str:
    authors = format_authors(e)
    source = e.doi or e.url
    accessed_part = f" [Accessed: {e.accessed_date}]." if e.accessed_date else ""
    return (
        f'{authors}, "{e.title}," {e.container_title}, {e.year}. [Online]. '
        f"Available: {source}.{accessed_part}"
    )


def _build_software(e: CitationEntry) -> str:
    authors = format_authors(e)
    version_part = f", version {e.version}" if e.version else ""
    return (
        f'{authors}, "{e.title}"{version_part}, {e.container_title or "GitHub"}. '
        f"[Online]. Available: {e.url}. [Accessed: {e.accessed_date}]."
    )


_BUILDERS = {
    SourceType.JOURNAL_ARTICLE: _build_journal_article,
    SourceType.CONFERENCE_PAPER: _build_conference_paper,
    SourceType.BOOK: _build_book,
    SourceType.WEBSITE: _build_website,
    SourceType.DATASET: _build_dataset,
    SourceType.SOFTWARE: _build_software,
}


def format_ieee_reference(entry: CitationEntry, number: int) -> str:
    """Format a single entry into a full IEEE reference-list line."""
    body = _BUILDERS[entry.type](entry)
    return f"[{number}] {body}"


class CitationTracker:
    """Assigns and reuses [n] citation numbers in order-of-first-citation."""

    def __init__(self) -> None:
        self._order: list[str] = []
        self._entries: dict[str, CitationEntry] = {}

    def cite(self, entry: CitationEntry) -> int:
        if entry.key in self._order:
            return self._order.index(entry.key) + 1
        self._order.append(entry.key)
        self._entries[entry.key] = entry
        return len(self._order)

    def marker_for(self, keys: list[str]) -> str:
        numbers = sorted(
            self._order.index(k) + 1 for k in keys if k in self._order
        )
        return self._collapse_runs(numbers)

    @staticmethod
    def _collapse_runs(numbers: list[int]) -> str:
        parts, i = [], 0
        while i < len(numbers):
            j = i
            while j + 1 < len(numbers) and numbers[j + 1] == numbers[j] + 1:
                j += 1
            parts.append(f"[{numbers[i]}]-[{numbers[j]}]" if j > i else f"[{numbers[i]}]")
            i = j + 1
        return ", ".join(parts)

    def build_reference_list(self) -> list[str]:
        return [
            format_ieee_reference(self._entries[key], idx + 1)
            for idx, key in enumerate(self._order)
        ]
```

---

## Phase 3: Automated Verification

Never trust a formatter change (or a first implementation) without asserting
its output character-for-character against known-correct IEEE examples drawn
directly from the IEEE Editorial Style Manual. Test each source type
independently, then test the tracker's numbering/reuse/collapsing behavior.

### 3.1 TypeScript / Jest

```typescript
// ieee-citation.test.ts
import { formatIEEEReference, CitationTracker, formatAuthors, CitationEntry } from "./ieee-citation";

describe("formatIEEEReference — field-by-field golden examples", () => {
  it("formats a journal article per IEEE style", () => {
    const entry: CitationEntry = {
      key: "doi:10.1109/EXAMPLE.2024.1234567",
      type: "journal-article",
      authors: ["John K. Smith", "Alice B. Lee"],
      title: "Deep learning for intrusion detection",
      containerTitle: "IEEE Trans. Netw. Secur.",
      volume: "12",
      issue: "3",
      pages: "45-52",
      month: "Mar.",
      year: 2024,
      doi: "10.1109/EXAMPLE.2024.1234567",
    };
    const out = formatIEEEReference(entry, 1);
    expect(out).toBe(
      '[1] J. K. Smith and A. B. Lee, "Deep learning for intrusion detection," ' +
      'IEEE Trans. Netw. Secur., vol. 12, no. 3, pp. 45-52, Mar. 2024, ' +
      'doi: 10.1109/EXAMPLE.2024.1234567.'
    );
  });

  it("formats a conference paper with location", () => {
    const entry: CitationEntry = {
      key: "conf-1",
      type: "conference-paper",
      authors: ["Priya Nair"],
      title: "A lightweight CTF scoring engine",
      containerTitle: "Proc. IEEE Int. Conf. Cybersecurity",
      city: "Colombo",
      country: "Sri Lanka",
      year: 2025,
      pages: "112-118",
    };
    expect(formatIEEEReference(entry, 2)).toBe(
      '[2] P. Nair, "A lightweight CTF scoring engine," in Proc. IEEE Int. Conf. ' +
      'Cybersecurity, Colombo, Sri Lanka, 2025, pp. 112-118.'
    );
  });

  it("formats a book with edition and page range", () => {
    const entry: CitationEntry = {
      key: "book-1",
      type: "book",
      authors: ["Behrouz A. Forouzan"],
      title: "Cryptography and Network Security",
      edition: "5th",
      city: "New York",
      state: "NY",
      country: "USA",
      publisher: "McGraw-Hill",
      year: 2022,
      pages: "220-245",
    };
    expect(formatIEEEReference(entry, 3)).toBe(
      "[3] B. A. Forouzan, Cryptography and Network Security, 5th ed. New York, " +
      "NY, USA: McGraw-Hill, 2022, pp. 220-245."
    );
  });

  it("formats a website with accessed date", () => {
    const entry: CitationEntry = {
      key: "web-1",
      type: "website",
      authors: [],
      organization: "OWASP Foundation",
      title: "OWASP Top Ten",
      containerTitle: "OWASP",
      url: "https://owasp.org/www-project-top-ten/",
      accessedDate: "Aug. 26, 2026",
    };
    expect(formatIEEEReference(entry, 4)).toBe(
      '[4] OWASP Foundation, "OWASP Top Ten," OWASP. Accessed: Aug. 26, 2026. ' +
      "[Online]. Available: https://owasp.org/www-project-top-ten/"
    );
  });

  it("formats a dataset with DOI and accessed date", () => {
    const entry: CitationEntry = {
      key: "ds-1",
      type: "dataset",
      authors: ["M. Perera"],
      title: "SLIIT CTF Network Traffic Corpus",
      containerTitle: "Zenodo",
      year: 2025,
      doi: "10.5281/zenodo.1234567",
      accessedDate: "Aug. 20, 2026",
    };
    expect(formatIEEEReference(entry, 5)).toBe(
      '[5] M. Perera, "SLIIT CTF Network Traffic Corpus," Zenodo, 2025. ' +
      "[Online]. Available: 10.5281/zenodo.1234567. [Accessed: Aug. 20, 2026]."
    );
  });

  it("formats a GitHub software repository with version", () => {
    const entry: CitationEntry = {
      key: "sw-1",
      type: "software",
      authors: [],
      organization: "IEEE CS SLIIT",
      title: "campus-endgame-portal",
      version: "2.1.0",
      containerTitle: "GitHub",
      url: "https://github.com/ieeecs-sliit/campus-endgame-portal",
      accessedDate: "Aug. 26, 2026",
    };
    expect(formatIEEEReference(entry, 6)).toBe(
      '[6] IEEE CS SLIIT, "campus-endgame-portal", version 2.1.0, GitHub. ' +
      "[Online]. Available: https://github.com/ieeecs-sliit/campus-endgame-portal. " +
      "[Accessed: Aug. 26, 2026]."
    );
  });
});

describe("formatAuthors — name-list edge cases", () => {
  it("uses 'et al.' beyond six authors", () => {
    const entry = {
      authors: ["A One", "B Two", "C Three", "D Four", "E Five", "F Six", "G Seven"],
    } as CitationEntry;
    expect(formatAuthors(entry)).toBe("A. One et al.");
  });

  it("joins exactly two authors with 'and', no comma", () => {
    const entry = { authors: ["Jane Doe", "John Roe"] } as CitationEntry;
    expect(formatAuthors(entry)).toBe("J. Doe and J. Roe");
  });
});

describe("CitationTracker — numbering, reuse, and range collapsing", () => {
  it("assigns sequential numbers on first citation and reuses them on repeat", () => {
    const tracker = new CitationTracker();
    const a = { key: "a", type: "website" } as CitationEntry;
    const b = { key: "b", type: "website" } as CitationEntry;
    expect(tracker.cite(a)).toBe(1);
    expect(tracker.cite(b)).toBe(2);
    expect(tracker.cite(a)).toBe(1); // reused, not re-assigned
  });

  it("collapses consecutive numbers into a range marker", () => {
    const tracker = new CitationTracker();
    ["a", "b", "c", "d"].forEach((k) => tracker.cite({ key: k, type: "website" } as CitationEntry));
    expect(tracker.markerFor(["a", "b", "c"])).toBe("[1]-[3]");
    expect(tracker.markerFor(["a", "c"])).toBe("[1], [3]");
  });

  it("builds the reference list in citation order, not alphabetical order", () => {
    const tracker = new CitationTracker();
    tracker.cite({ key: "zebra", type: "website", title: "Z source" } as CitationEntry);
    tracker.cite({ key: "apple", type: "website", title: "A source" } as CitationEntry);
    const list = tracker.buildReferenceList();
    expect(list[0]).toContain("[1]");
    expect(list[1]).toContain("[2]"); // "apple" is [2] despite alphabetically first
  });
});
```

Run with:

```bash
npx jest ieee-citation.test.ts --verbose
```

### 3.2 Python / pytest

```python
# test_ieee_citation.py
from ieee_citation import (
    CitationEntry, SourceType, format_ieee_reference,
    format_authors, CitationTracker,
)


def test_journal_article_golden_example():
    entry = CitationEntry(
        key="doi:10.1109/EXAMPLE.2024.1234567",
        type=SourceType.JOURNAL_ARTICLE,
        authors=["John K. Smith", "Alice B. Lee"],
        title="Deep learning for intrusion detection",
        container_title="IEEE Trans. Netw. Secur.",
        volume="12", issue="3", pages="45-52",
        month="Mar.", year="2024",
        doi="10.1109/EXAMPLE.2024.1234567",
    )
    assert format_ieee_reference(entry, 1) == (
        '[1] J. K. Smith and A. B. Lee, "Deep learning for intrusion detection," '
        "IEEE Trans. Netw. Secur., vol. 12, no. 3, pp. 45-52, Mar. 2024, "
        "doi: 10.1109/EXAMPLE.2024.1234567."
    )


def test_book_golden_example():
    entry = CitationEntry(
        key="book-1", type=SourceType.BOOK,
        authors=["Behrouz A. Forouzan"],
        title="Cryptography and Network Security",
        edition="5th", city="New York", state="NY", country="USA",
        publisher="McGraw-Hill", year="2022", pages="220-245",
    )
    assert format_ieee_reference(entry, 3) == (
        "[3] B. A. Forouzan, Cryptography and Network Security, 5th ed. "
        "New York, NY, USA: McGraw-Hill, 2022, pp. 220-245."
    )


def test_website_requires_accessed_date_in_output():
    entry = CitationEntry(
        key="web-1", type=SourceType.WEBSITE,
        organization="OWASP Foundation", title="OWASP Top Ten",
        container_title="OWASP", url="https://owasp.org/www-project-top-ten/",
        accessed_date="Aug. 26, 2026",
    )
    out = format_ieee_reference(entry, 4)
    assert "Accessed: Aug. 26, 2026" in out
    assert out.endswith("https://owasp.org/www-project-top-ten/")


def test_author_formatting_et_al_beyond_six():
    entry = CitationEntry(
        key="x", type=SourceType.JOURNAL_ARTICLE,
        authors=["A One", "B Two", "C Three", "D Four", "E Five", "F Six", "G Seven"],
    )
    assert format_authors(entry) == "A. One et al."


def test_tracker_reuses_numbers_and_preserves_citation_order():
    tracker = CitationTracker()
    a = CitationEntry(key="zebra", type=SourceType.WEBSITE, title="Z source")
    b = CitationEntry(key="apple", type=SourceType.WEBSITE, title="A source")
    assert tracker.cite(a) == 1
    assert tracker.cite(b) == 2
    assert tracker.cite(a) == 1  # re-citation reuses [1]
    refs = tracker.build_reference_list()
    assert refs[0].startswith("[1]")   # zebra, cited first, stays [1]
    assert refs[1].startswith("[2]")   # apple stays [2] despite alphabetical order


def test_tracker_collapses_consecutive_ranges():
    tracker = CitationTracker()
    for k in ["a", "b", "c", "d"]:
        tracker.cite(CitationEntry(key=k, type=SourceType.WEBSITE))
    assert tracker.marker_for(["a", "b", "c"]) == "[1]-[3]"
    assert tracker.marker_for(["a", "c"]) == "[1], [3]"
```

Run with:

```bash
pytest test_ieee_citation.py -v
```

Both suites should pass with **zero** diffs against the golden strings above
before the formatter is considered trustworthy for a real document. Any
future change to punctuation, spacing, or field order must update these
golden examples deliberately — a silent diff in expected output is itself a
signal that the change needs review against the IEEE Editorial Style Manual.

---

## Phase 4: Rollback & Self-Healing

Real source metadata is frequently incomplete — a student pastes a URL with
no author, a dataset has no explicit access date, a preprint has no page
numbers. The formatter must never (a) crash, (b) silently drop a required
field without a trace, or (c) fabricate data. Instead, apply documented
fallback rules and **flag** the entry for human review.

### 4.1 Validation pass

```typescript
export function validateEntry(entry: CitationEntry): string[] {
  const required = REQUIRED_FIELDS[entry.type];
  const missing: string[] = [];
  for (const field of required) {
    const value = (entry as any)[field];
    const isEmpty =
      value === undefined ||
      value === null ||
      value === "" ||
      (Array.isArray(value) && value.length === 0);
    if (isEmpty && !(field === "authors" && entry.organization)) {
      missing.push(field);
    }
  }
  return missing;
}
```

### 4.2 Fallback rules (apply, then flag — never omit silently)

| Missing field | Fallback applied | Flag emitted |
|---|---|---|
| `year` | Substitute `"n.d."` (no date) per common IEEE practice for undated web sources | `"WARNING: no publication year found for '<title>' — using 'n.d.'"` |
| `authors` (and no `organization`) | Substitute `"[Author unknown]"` — never drop the author slot entirely | `"WARNING: no author/organization for '<title>' — verify before submission"` |
| `pages` on an online-first/early-access journal article | Omit the `pp.` segment; insert `"Early Access"` in its place per IEEE early-access convention | `"NOTE: '<title>' formatted as Early Access — confirm final page numbers once assigned"` |
| `doi` on a journal/conference/dataset entry | Fall back to `url` + `accessedDate`; if `url` is also missing, flag as blocking | `"WARNING: no DOI for '<title>' — used URL fallback"` / `"ERROR: no DOI or URL — cannot complete entry"` |
| `accessedDate` on a Website/Dataset/Software entry | Do **not** fabricate a date. Emit a blocking error; formatting proceeds with `[Accessed: DATE NEEDED]` as a visible placeholder | `"ERROR: '<title>' is missing an accessed date — required for undated online sources"` |
| `volume`/`issue` on a journal article | Omit both fields cleanly rather than printing `vol. undefined` | `"NOTE: '<title>' has no volume/issue — check if this is an early-access or online-only article"` |
| `city`/`country` on a book/conference | Omit the location segment; do not print an empty `", :"` | `"NOTE: no location for '<title>' — location is commonly omitted for well-known publishers, verify if required by your instructor"` |

### 4.3 Repair-and-report function

```typescript
export function validateAndRepair(entry: CitationEntry, number: number): FormatResult {
  const warnings: string[] = [];
  const repaired: CitationEntry = { ...entry };

  if (!repaired.year) {
    repaired.year = "n.d.";
    warnings.push(`WARNING: no publication year for "${entry.title}" — using "n.d."`);
  }
  if (repaired.authors.length === 0 && !repaired.organization) {
    repaired.organization = "[Author unknown]";
    warnings.push(`WARNING: no author/organization for "${entry.title}" — verify before submission`);
  }
  const needsAccessDate = ["website", "dataset", "software"].includes(repaired.type);
  if (needsAccessDate && !repaired.doi && !repaired.accessedDate) {
    repaired.accessedDate = "DATE NEEDED";
    warnings.push(`ERROR: "${entry.title}" is missing an accessed date — required for undated online sources`);
  }
  if (["journal-article", "conference-paper", "dataset"].includes(repaired.type) &&
      !repaired.doi && !repaired.url) {
    warnings.push(`ERROR: "${entry.title}" has no DOI or URL — cannot complete this entry`);
  }

  const reference = formatIEEEReference(repaired, number);
  const isComplete = !warnings.some((w) => w.startsWith("ERROR"));
  return { reference, warnings, isComplete };
}
```

### 4.4 Self-healing principles

1. **Never fabricate content** — placeholders like `"n.d."`, `"[Author
   unknown]"`, and `"DATE NEEDED"` are visible, greppable markers, not
   invented facts.
2. **Never silently drop a required field** — an omitted field must be a
   deliberate, documented case (e.g., "no volume for an early-access
   article"), not a `undefined` leaking into the output string.
3. **Escalate blocking gaps** — missing DOI *and* URL on a journal/
   conference/dataset entry is unrecoverable; mark `isComplete: false` and
   surface it rather than emitting a broken reference.
4. **Always return warnings alongside a best-effort reference** — the
   student/author gets a usable draft immediately, plus an explicit punch
   list of what to fix before final submission.
5. **Re-run validation after every metadata edit** — a repaired entry is not
   considered clean until `validateEntry()` returns an empty array with the
   corrected data actually in place (not just the placeholder).

---

## Common Anti-Patterns vs Gold Standard

| # | Anti-Pattern | Why it's wrong | Gold Standard |
|---|---|---|---|
| 1 | Reference list sorted alphabetically by author surname | IEEE lists in **citation order**, not alphabetically — this is the single most common IEEE error inherited from APA/MLA habits | Number sources by order of first appearance in the text; `[1]` in text = first entry in the list, period |
| 2 | Web source cited with no "Accessed" date | URLs are mutable; without an access date, the reader can't know what version of the page the author actually saw | `Accessed: Month DD, YYYY. [Online]. Available: <url>` on every URL-only source |
| 3 | Author names written as "Surname, Firstname" (APA style) | IEEE uses initials-first: `F. M. Surname`, not `Surname, F. M.` | Convert every author to `J. K. Author` format before formatting |
| 4 | In-text citation written as `(Smith, 2024)` | That is APA's author-date style, not IEEE's bracketed-number style | Use `[n]` exclusively in-text; never a parenthetical author-year |
| 5 | Re-citing a source later in the paper with a new number, e.g. citing source A as `[1]` then again later as `[9]` | Each source gets exactly one number for its entire life in the document | Track citations with an order-preserving map (see `CitationTracker`); re-use the original number on every repeat |
| 6 | Missing DOI silently replaced with nothing — reference ends abruptly after the year | Drops a verifiable, stable locator without telling anyone | Fall back to URL + accessed date, or explicitly flag `ERROR: no DOI or URL` per Phase 4 |
| 7 | Journal/conference name spelled out in full when IEEE convention abbreviates it (e.g., "Proceedings of the IEEE International Conference on..." instead of "Proc. IEEE Int. Conf. on...") | Bloats the reference and diverges from IEEE Xplore's own abbreviation conventions, breaking automated matching | Use standard IEEE abbreviations (`Proc.`, `Int.`, `Conf.`, `J.`, `Trans.`) consistently |
| 8 | Book title and journal title both italicized/quoted the same way | IEEE distinguishes: journal/conference **names** are italicized (unquoted); article/paper **titles** are quoted (not italicized); book titles are italicized like journal names | Quote article/paper titles; italicize book titles and journal/conference names |
| 9 | GitHub repository cited with no version/commit reference and no accessed date | Code changes over time — an undated, unversioned software citation is unverifiable | Include a version tag or commit hash where available, plus `[Accessed: ...]` |

---

## Pre-Flight Checklist

Before formatting a reference list or answering an IEEE-citation request, confirm:

- [ ] Every source has been classified into one of the six supported types (journal, conference, book, website, dataset, software) — not left as "unknown"
- [ ] For each source with a DOI, the DOI has been validated against the `10.\d{4,9}/...` pattern and, where possible, resolved against CrossRef for authoritative metadata
- [ ] For each URL-only source, it has been confirmed whether an "Accessed" date is required (yes, unless a DOI/ISBN exists)
- [ ] The required-field checklist (Phase 1.5) has been run against every entry, with gaps noted before formatting begins
- [ ] Author names have been normalized to `F. M. Surname` initials-first form for every entry
- [ ] The intended citation order (order of first appearance in the body text) has been established — not alphabetical, not by source type
- [ ] Any pre-existing reference list has been checked for the "alphabetized instead of citation-ordered" anti-pattern before being trusted as a base
- [ ] Ambiguous source types (e.g., a preprint that was later published in a journal, a GitHub repo that is also archived with a DOI on Zenodo) have been resolved to a single canonical entry, not duplicated

## Post-Flight Checklist

After generating or updating the reference list, confirm:

- [ ] Every in-text `[n]` marker has a corresponding entry in the References section, and vice versa — no orphaned citations, no unused references
- [ ] The reference list order matches citation order exactly, verified by re-reading the body text top-to-bottom against the list numbering
- [ ] Every entry passed `validateEntry()` / `validate_entry()` with zero missing required fields, or carries an explicit warning/flag if it did not
- [ ] No entry contains a literal `undefined`, `None`, `null`, or empty field artifact (e.g., `vol. , no. ,`) in the rendered string
- [ ] All quoted titles use straight double quotes consistently (not smart quotes mixed with straight quotes) and end with the terminal comma inside the closing quote
- [ ] Journal/conference names use consistent IEEE abbreviation style throughout the whole document, not mixed full-name/abbreviated forms
- [ ] Automated tests (Section 3) have been run and pass against the golden examples before the reference list is treated as final
- [ ] Any entry flagged `isComplete: false` or carrying an `ERROR:` warning has been surfaced to the user explicitly, with a concrete ask for the missing field, rather than being submitted silently
- [ ] Re-citations of the same source later in the document reuse the original bracket number, confirmed by spot-checking at least one repeated citation
- [ ] The final rendered list has been diffed against the previous version (if updating an existing bibliography) to confirm no entry silently changed number due to a reordering bug
