---
name: campus-fyp-architecture
description: Activate when a student asks for help architecting, scoping, or documenting a university Final Year Project (FYP), software capstone, or research-linked undergraduate thesis project — trigger phrasings include "help me design the architecture for my final year project", "what tech stack should I use for my FYP", "how do I structure my capstone repo", "review my FYP proposal's system design", "my supervisor wants an SRS/architecture diagram", "I need to cut scope on my final year project", or "is my FYP evaluation methodology sound". Produces layered system architecture, ADRs, tech-stack decision matrices, repo structure, and a falsifiability-gated review process for CS/SE/DS undergraduate capstones.
version: 1.0.0
author: IEEE Computer Society of SLIIT
tags: [fyp, capstone, software-architecture, research-methodology, tech-stack, adr, undergraduate-thesis, scope-management]
---

# Campus FYP Architecture Runbook

## Mission

Turn a vague, ambitious Final Year Project idea into a system architecture that a
supervisor will approve, a panel will pass, and a team of 1-4 undergraduates can
actually finish in 20-30 weeks. This skill is not a diagram generator — it is a
gate. Its job is to force scoping decisions *before* code is written, catch
architecture that does not serve the research question, and give the team a
documented, falsifiable way to prove the project worked. Every output below
exists to prevent the single most common FYP failure mode: a demo that looks
impressive in week 28 but cannot answer the one question the evaluation panel
will actually ask — *"what did you prove, and how do you know?"*

---

## Mental Model & Theoretical Foundations

### Why FYPs fail: the two failure cones

FYPs fail in two symmetric ways, and almost never in the middle:

1. **Scope creep (the ambition trap).** The team keeps adding features —
   a mobile app "for completeness," a recommendation engine "since we have the
   data anyway," a blockchain layer "for tamper-proofing" — none of which are
   load-bearing for the research question. By week 20 the team is integrating
   subsystems instead of generating results. The architecture grew faster than
   the evidence.
2. **Under-scoping (the toy-project trap).** The team picks something so small
   and so well-trodden (a CRUD to-do app with a login page) that there is no
   research question left to answer. The panel's first question — "what is
   novel here?" — has no defensible answer, regardless of how clean the code is.

Both failure modes are scope-management failures, not technical-skill failures.
The fix is the same in both directions: **anchor every architectural decision to
one falsifiable research question, and cut anything that does not serve it.**
This is why Phase 1 (Discovery) exists *before* Phase 2 (Architecture) — you
cannot scope a system whose research question has not been written down and
interrogated first.

### The core tradeoff: novelty vs. completeness

Every FYP evaluation panel implicitly weighs two axes that pull in opposite
directions:

| Axis | What it rewards | What it punishes |
|---|---|---|
| **Novel-research-value** | A new method, a new dataset application, a non-obvious comparison, a gap in prior work | A system that is "just an app" with no contribution beyond integration |
| **Engineering-completeness** | A working, deployed, tested, documented system that runs end-to-end on demo day | A Jupyter notebook with 94% accuracy and no interface, no error handling, no reproducibility |

A project strong on novelty but weak on completeness reads as *unfinished
research* — the panel cannot verify the claim because nothing runs. A project
strong on completeness but weak on novelty reads as *a tutorial project* — the
panel cannot find a contribution to grade. **The architecture's job is to
spend the team's limited weeks on the intersection**: the smallest complete
system that still makes the novelty claim checkable end-to-end. This is why
Phase 2 below insists on a working baseline before any "stretch" component,
and why Phase 4 protects the novelty claim first when scope must be cut — the
completeness axis is negotiable in surface area (fewer features, simpler UI),
but the novelty claim is not negotiable at all, because without it there is
nothing left to evaluate.

### Standard FYP architecture layers

Almost every CS/SE/DS FYP — whether it is an ML system, a distributed system,
a security tool, or a data pipeline — decomposes into the same four layers.
Naming the layers explicitly during Discovery prevents the most common
structural mistake: conflating the "evaluation" layer with the "product" layer,
which causes teams to optimize demo aesthetics instead of generating the
evidence the thesis defense actually needs.

| Layer | Responsibility | Typical FYP mistake |
|---|---|---|
| **Data / ML layer** | Data acquisition, cleaning, feature engineering, model training, versioned artifacts | Treating data cleaning as a one-off script instead of a reproducible pipeline; no train/val/test discipline |
| **Backend / API layer** | Business logic, model-serving endpoints, persistence, auth | Putting model inference logic directly in a Flask route with no separation from the trained artifact |
| **Frontend / UI layer** | Demo-ability, user interaction, visualization of results | Over-investing here because it's visible on demo day, at the expense of evaluation rigor |
| **Evaluation / metrics harness** | The falsifiable proof of the novelty claim: baselines, metrics, statistical comparison, ablations | Treating this as an afterthought notebook instead of a first-class, versioned, re-runnable component |

### Layered architecture diagram (ML-integrated FYP)

```
┌──────────────────────────────────────────────────────────────────────┐
│                         PRESENTATION LAYER                           │
│   Web / Mobile UI  ·  Demo Dashboard  ·  API Docs (Swagger/OpenAPI)  │
└───────────────────────────────┬────────────────────────────────────-┘
                                 │ REST / GraphQL / WebSocket
┌───────────────────────────────▼────────────────────────────────────-┐
│                         BACKEND API LAYER                            │
│  ┌─────────────┐   ┌──────────────────┐   ┌────────────────────┐    │
│  │ Auth /       │   │ Business Logic /  │   │ Inference Service  │    │
│  │ User Mgmt    │   │ Orchestration      │   │ (model wrapper)    │   │
│  └─────────────┘   └──────────────────┘   └──────────┬─────────┘    │
└──────────────────────────────────────────────────────┼──────────────┘
                                                         │ loads versioned
                                                         │ model artifact
┌────────────────────────────────────────────────────────▼────────────┐
│                       DATA / ML LAYER                                │
│  ┌──────────────┐   ┌───────────────┐   ┌───────────────────────┐   │
│  │ Ingestion /   │──▶│ Preprocessing  │──▶│ Training Pipeline     │   │
│  │ Raw Data      │   │ / Feature Eng. │   │ (versioned, scripted) │   │
│  └──────────────┘   └───────────────┘   └──────────┬────────────┘   │
│                                                      │ artifact       │
│                                              ┌───────▼──────────┐    │
│                                              │ Model Registry     │   │
│                                              │ (versioned .pkl/  │   │
│                                              │  ONNX / checkpoint)│   │
│                                              └───────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
                                 │ same artifact fed to
┌───────────────────────────────▼──────────────────────────────────────┐
│                    EVALUATION / METRICS HARNESS                      │
│  ┌────────────┐   ┌───────────────┐   ┌─────────────────────────┐   │
│  │ Baseline(s) │   │ Novel Method   │   │ Statistical Comparison  │   │
│  │ (must exist │◀─▶│ (your claim)  │◀─▶│ (metric + significance) │   │
│  │  and run)   │   │                │   │                         │   │
│  └────────────┘   └───────────────┘   └─────────────────────────┘   │
│           Output: thesis Chapter 5 tables/figures, reproducible      │
└────────────────────────────────────────────────────────────────────-┘
```

Notice the evaluation harness sits **beside** the product, consuming the same
versioned model artifact the API layer serves — it is not a notebook that
lives outside the system and gets abandoned after the mid-viva. If the
evaluation harness cannot be re-run on demand by a panel member, it does not
count as evidence.

---

## Phase 1: Discovery & Static Analysis

Run this checklist *before* proposing any architecture. An architecture
proposed before these questions are answered is a guess, not a design — and
guesses are what produce both failure cones described above.

### Requirements-elicitation checklist

```markdown
## FYP Discovery Checklist — complete before architecture proposal

### 1. Research Question
- [ ] Written as a single sentence, not a feature list.
      BAD:  "Build a system that detects phishing using ML and shows it in a dashboard."
      GOOD: "Does combining URL lexical features with sender-behavior graph
             features improve phishing-detection F1 over lexical-only baselines
             on the CIC-Phish-2024 dataset?"
- [ ] Question names an independent variable (what you change) and a
      dependent variable (what you measure).
- [ ] Question is answerable within the timeline (see #4) — if not, narrow it now.

### 2. Novelty Claim
- [ ] State it as: "No prior work has [X] in the context of [Y]," with at
      least 2 cited prior works that come close but don't do X.
- [ ] Classify the novelty type: (a) new method, (b) existing method + new
      domain/dataset, (c) new comparative study, (d) new system/tool for an
      underserved workflow. Panels grade (a)-(d) differently — know which
      one you're claiming.
- [ ] Novelty claim is falsifiable: there exists a result that would make
      the claim false (e.g., "if F1 does not improve over baseline, the
      claim is not supported"). If no such result exists, it is not a claim.

### 3. Evaluation Metric
- [ ] Primary metric named explicitly (F1, BLEU, latency-p99, throughput,
      SUS score, etc.) — "the system works well" is not a metric.
- [ ] Baseline(s) identified by name (a specific prior paper, a specific
      off-the-shelf tool, or a naive heuristic) — "better than nothing" is
      not a baseline.
- [ ] Statistical comparison method decided (paired t-test, bootstrap CI,
      McNemar's test) if the metric involves any randomness.
- [ ] Sample size / test-set size sufficient for the comparison method chosen.

### 4. Timeline (in weeks)
- [ ] Total weeks available: ______ (typically 20-30 for a two-semester FYP)
- [ ] Weeks already elapsed before this architecture review: ______
- [ ] Milestone dates fixed by the department (proposal defense, mid-viva,
      final viva, thesis submission) mapped onto remaining weeks.
- [ ] Buffer of at least 15% of remaining weeks reserved for writing the
      thesis and rehearsing the defense — not coding.

### 5. Supervisor & Panel Constraints
- [ ] Supervisor's stated area of expertise / preference (some supervisors
      mandate a specific method family, dataset, or publication target).
- [ ] Any mandated deliverables beyond code: SRS document, IEEE-format
      paper draft, poster, specific diagram standard (UML/C4/DFD).
- [ ] Ethics/IRB clearance required? (human subjects, PII, medical data,
      scraped personal data all typically require this — check early,
      approval can take 2-4 weeks and blocks data collection.)
- [ ] Team size and each member's role — architecture must map cleanly to
      independently-assignable components if team size > 1, so evaluators
      can grade individual contribution.

### 6. Resource Constraints
- [ ] Compute available for training/inference (personal laptop / campus
      GPU cluster / free-tier cloud credits) — this alone eliminates many
      "SOTA" architecture choices before they're seriously considered.
- [ ] Budget for paid APIs, hosting, or datasets (usually $0 — confirm).
- [ ] Data availability confirmed *in hand*, not "we will scrape it" —
      unavailable data is the single most common reason FYP scope collapses
      in week 8.
```

**Static-analysis rule of thumb:** if the team cannot answer Q1-Q3 without
using the word "and" more than twice, the research question is still a
feature list in disguise. Send it back before touching architecture.

---

## Phase 2: Execution & Implementation

Only start here once Phase 1 is signed off (research question, novelty claim,
metric, timeline, constraints all written down and reviewed by the supervisor
if possible). Architecture decisions are recorded, not just discussed — a
verbal decision that isn't written down gets silently reversed under deadline
pressure, which is exactly how scope creep re-enters a project that already
did its Phase 1 discipline.

### Architecture Decision Record (ADR) template

Use one ADR per non-trivial decision (framework choice, database choice,
deployment target, model architecture family). Store as
`docs/adr/NNNN-title.md`, numbered sequentially, never edited after
acceptance — superseded by a new ADR instead, so the decision history stays
intact for the thesis's design-rationale chapter.

```markdown
# ADR-0003: Use PostgreSQL over MongoDB for the core data store

## Status
Accepted (2026-08-27)

## Context
The system must persist (a) structured user/session records with relational
integrity requirements (foreign keys between users, sessions, and detection
logs), and (b) semi-structured model-output metadata that varies by model
version. Team has 3 weeks of buffer before the mid-viva demo and no prior
production database experience beyond a DBMS coursework module.

## Decision
Use PostgreSQL with a JSONB column for the variable model-output metadata,
rather than MongoDB for everything or a dual-database setup.

## Alternatives Considered
1. **MongoDB only** — flexible schema fits the variable metadata well, but
   the relational integrity needs (foreign keys, cascading deletes across
   users/sessions/logs) would have to be hand-rolled in application code,
   which is a correctness risk given the timeline.
2. **PostgreSQL + MongoDB (polyglot persistence)** — technically ideal
   separation of concerns, but doubles operational complexity (two backup
   strategies, two connection pools, two things that can go down during the
   live demo) for a team that has never operated either in production.
3. **PostgreSQL + JSONB (chosen)** — gets relational integrity where it
   matters and schema flexibility where it's needed, in one engine the team
   already partially knows from coursework.

## Consequences
- Positive: single database to operate, back up, and demo; team's existing
  SQL knowledge transfers; JSONB queries cover the metadata flexibility need.
- Negative: JSONB fields lose some type-safety and indexing ergonomics
  compared to a native document store; acceptable because that data is
  read-mostly and low-volume in this system.
- Follow-up: if metadata queries become a measured bottleneck (unlikely at
  FYP data scale), revisit with a new ADR — do not silently patch around it.

## Novelty-claim impact
None — this is infrastructure, not the research contribution. Time spent
here is capped at 2 days; anything beyond that is scope creep on a decision
that does not move the evaluation metric.
```

### Tech-stack decision matrix (worked example)

Score every realistic option against criteria weighted by *this team's*
constraints from Phase 1 — not by what is trendy. Scale: 1 (poor fit) to 5
(excellent fit). Weight reflects what actually threatens a 24-week solo/2-person
FYP: running out of time and not knowing the tools beat theoretical elegance
every time.

**Decision: Backend framework for an ML-serving API, team of 2, 22 weeks
remaining, one member knows Python well, neither has production Node.js
experience.**

| Criterion (weight) | FastAPI | Django REST | Express.js | Spring Boot |
|---|---|---|---|---|
| Team familiarity (×3) | 5 | 3 | 2 | 1 |
| Deployment cost / simplicity (×2) | 5 | 4 | 4 | 2 |
| Timeline fit (×3) | 5 | 3 | 3 | 1 |
| Native ML-library interop (Python model artifacts) (×3) | 5 | 5 | 1 | 1 |
| Async I/O for concurrent inference requests (×1) | 5 | 2 | 5 | 4 |
| **Weighted total** | **60** | **41** | **28** | **17** |

*Weighted total = Σ(score × weight); max possible = 60.*

**Decision: FastAPI.** It wins on every criterion that matters to this team's
actual constraint (Python-native ML interop plus a 22-week clock), not because
it is the "best" framework in the abstract. Re-run this matrix with your own
team's weights — the template is the deliverable here, not the answer.

### Documented folder structure template

```
fyp-project-root/
├── docs/
│   ├── adr/                        # one file per Architecture Decision Record
│   │   ├── 0001-choice-of-database.md
│   │   └── 0002-model-architecture-family.md
│   ├── srs.md                      # IEEE 830-style Software Requirements Spec
│   ├── architecture-diagram.png    # exported C4 / layered diagram (source in /docs/diagrams)
│   └── meeting-log.md              # dated supervisor-meeting notes and action items
│
├── src/
│   ├── data/                       # ingestion, cleaning, feature engineering scripts
│   ├── model/                      # training code, model definitions (not trained weights)
│   ├── api/                        # backend service: routes, auth, inference wrapper
│   ├── frontend/                   # UI application
│   └── common/                     # shared config, logging, constants
│
├── evaluation/
│   ├── baselines/                  # runnable baseline implementations, not just citations
│   ├── metrics.py                  # single source of truth for how every metric is computed
│   ├── run_evaluation.py           # one command reproduces every thesis Ch.5 number/table
│   └── results/                    # versioned output — CSV/JSON, not just screenshots
│
├── thesis/
│   ├── chapters/                   # one .tex or .md per chapter
│   ├── figures/                    # generated, not hand-drawn — regenerate from evaluation/
│   └── references.bib
│
├── models/                         # versioned trained artifacts (or DVC/Git-LFS pointers)
├── tests/                          # unit + integration tests, mirrors src/ structure
├── .env.example                    # documented required environment variables
├── requirements.txt / package.json
└── README.md                       # setup steps a panel member can follow cold
```

The non-negotiable rule this structure encodes: **`evaluation/` is a sibling
of `src/`, never a subfolder buried inside it, and never a personal notebook
outside version control.** If the panel cannot clone the repo and run
`evaluation/run_evaluation.py` to reproduce the thesis's headline number, the
evaluation does not count as reproducible — and an evaluator who cannot
reproduce a number is entitled to disregard it.

---

## Phase 3: Automated Verification

Before implementation proceeds past the first working slice, run this gate.
Treat a "no" on any item as a blocking finding, not a suggestion — each one
maps directly to a question the panel will ask at the viva.

### Architecture review gate

```markdown
## Architecture Review Gate — run before Phase 2 implementation continues

### Traceability to the research question
- [ ] Every major component in the architecture diagram can be traced to a
      line in the research question or novelty claim. If a component exists
      only because "it would be cool" or "it looks complete," flag it —
      it's scope creep, not architecture.
- [ ] The independent variable named in the research question maps to a
      concrete, swappable point in the architecture (e.g., a feature-flag or
      config switch between "baseline model" and "novel model"), not
      something buried in a hardcoded script.
- [ ] The dependent variable (the metric) is computed in exactly one place
      (evaluation/metrics.py) and both baseline and novel method are scored
      through that same code path — different code paths per method is a
      classic source of "my method is better" artifacts that don't survive
      panel scrutiny.

### Falsifiability of the evaluation methodology
- [ ] There is a specific, named baseline that actually runs, end-to-end,
      today — not "we will implement the baseline once the novel method
      works." A baseline built last is a baseline that never gets built.
- [ ] The comparison includes a statistical test or confidence interval, not
      just "our number is higher." A single-run point estimate is not
      evidence at undergraduate-thesis rigor, let alone publication rigor.
- [ ] There exists a plausible experimental outcome that would falsify the
      novelty claim (e.g., novel method loses to baseline on the primary
      metric). If every conceivable outcome would be spun as a success in
      the thesis, the methodology is not falsifiable — fix it now.
- [ ] Test/train/validation splits are fixed, versioned, and identical
      across every method compared (no accidental data leakage from
      re-splitting per experiment run).

### Completeness sanity check
- [ ] The system runs end-to-end (data in → result out) on a clean checkout,
      today, even if the "novel" component is currently a stub. An
      end-to-end skeleton with one weak link beats a fully-built skeleton
      that has never been connected.
- [ ] Every layer in the architecture diagram (Section: Mental Model) has at
      least a placeholder implementation — no layer exists only on paper.
- [ ] Deployment target is decided and matches Phase 1's resource
      constraints (a GPU-hungry model architecture is not "verified" if the
      team's only compute is a laptop CPU).

### Sign-off
- [ ] Supervisor (or peer-review proxy) has seen the architecture diagram
      and the ADRs, not just heard a verbal summary.
- [ ] Findings from this gate are logged in `docs/meeting-log.md` with
      owners and dates, not left as an unresolved Slack thread.
```

A project that passes this gate may still be ambitious — that's fine. What it
may not be is *unfalsifiable* or *untraceable to the research question*. Those
two properties are what a panel actually tests for, whether or not they use
this vocabulary.

---

## Phase 4: Rollback & Self-Healing

Scope must be cut on the majority of FYPs at some point — usually around
week 14-18, when the gap between remaining weeks and remaining work becomes
undeniable. This is not a failure of the original plan; it is a predictable
event that a good architecture anticipates. The failure mode to avoid is
cutting the *wrong* thing under panic — usually the novelty claim itself,
because it's the hardest part, while peripheral polish survives because it's
easiest to keep working on.

### MoSCoW re-prioritization heuristic, applied under deadline pressure

When a scope cut is needed, re-sort every remaining work item into MoSCoW —
but apply it with one FYP-specific rule layered on top of the standard
technique: **the novelty claim's minimum viable evidence is always "Must
Have," even if that means everything else drops to "Won't Have."**

```markdown
## Scope-cut decision log — [date]

Remaining weeks: ____   Remaining work items (unsorted): ____

### Must Have (cannot submit/defend without this)
- [ ] The single experiment that directly tests the novelty claim
      (novel method vs. named baseline, on the fixed test set, with the
      primary metric computed).
- [ ] A minimal interface to demonstrate the system runs end-to-end
      (does NOT need to be polished — a CLI or a bare form is sufficient).
- [ ] The thesis chapters that report the above (Methodology, Results).

### Should Have (cut only if Must Have is at risk)
- [ ] A second baseline or ablation study strengthening the comparison.
- [ ] Basic error handling / input validation on the demo interface.
- [ ] A second dataset or domain to test generalization.

### Could Have (cut first, no defense-day risk)
- [ ] Polished UI styling, animations, dashboards beyond what's needed
      to show a result.
- [ ] Additional features not measured by the evaluation harness
      (user accounts, admin panels, notifications, "nice to have" screens).
- [ ] Support for input formats / edge cases beyond the test set's scope.

### Won't Have (this cycle)
- [ ] Anything requiring infrastructure the team does not already have
      running (a new cloud service, a new database, a new deployment
      target) with fewer than 4 weeks remaining.
- [ ] Any feature whose primary justification is "the panel might like it"
      rather than "the research question needs it."

## Decision
Cut items above the line: ____________________
Protected (never cut regardless of remaining time): the single Must-Have
experiment above — if this is genuinely at risk, escalate to supervisor
immediately rather than silently dropping it; a narrowed but *answered*
research question is always recoverable, an abandoned one is not.
```

### Self-healing triggers — when to re-run this process

- **Trigger 1: data unavailability discovered late.** If the planned dataset
  turns out incomplete, gated, or smaller than expected, don't silently
  substitute a different dataset without re-running Phase 1 Q1-Q3 — the
  research question and novelty claim may no longer hold on the new data.
- **Trigger 2: baseline outperforms the novel method.** This is a valid
  result, not a crisis. Re-frame the research question honestly ("under what
  conditions does X fail to outperform the baseline") rather than hiding the
  result or picking a friendlier metric post hoc — panels notice metric
  shopping, and it damages credibility more than a negative result does.
- **Trigger 3: a team member drops out or a dependency becomes unmaintained.**
  Re-run the tech-stack decision matrix with updated familiarity/timeline
  weights rather than trying to force the original stack through with less
  capacity than it assumed.
- **Trigger 4: mid-viva feedback demands a pivot.** Treat panel feedback at
  the mid-viva as an authoritative new constraint on Phase 1 — re-derive the
  Must-Have list from it immediately, don't merely note it and continue the
  old plan.

---

## Common Anti-Patterns vs. Gold Standard

| # | Anti-Pattern | Why it fails | Gold Standard |
|---|---|---|---|
| 1 | Microservices architecture for a solo/duo FYP ("it's more scalable") | Multiplies operational surface area (service discovery, inter-service auth, distributed logging) that a 1-2 person team must build *and* demo live, for scale the project will never reach | A well-factored **monolith** with clean internal module boundaries (`src/data`, `src/model`, `src/api`) — split into services later only if a specific, measured bottleneck demands it |
| 2 | Chasing SOTA (state-of-the-art) model architecture from a paper published last month | SOTA papers assume compute, tuning time, and engineering support a 20-week undergrad project doesn't have; team burns 6 weeks failing to reproduce someone else's result before writing a line of their own contribution | Implement a **working baseline first** (even a simple one), get the evaluation harness running end-to-end against it, *then* layer in the more ambitious method — a working simple system beats a non-working ambitious one at every checkpoint |
| 3 | Evaluation as an afterthought notebook run once, screenshotted, and never re-run | Not reproducible; if the panel asks to see it re-run, or asks "what happens with a different seed," there's no answer; results can't be trusted at defense | Evaluation harness is a **first-class, versioned component** (`evaluation/run_evaluation.py`) that regenerates every thesis Chapter 5 number and figure from one command |
| 4 | Building the frontend/UI first because it's the most visible, demo-friendly part | Weeks go into styling before the research question has any evidence behind it; if data or model plans change, UI work is wasted; panel grades substance, not polish | **Data/ML and evaluation layers first**, UI last and deliberately minimal — a bare form that proves the pipeline works outranks a beautiful dashboard around an empty pipeline |
| 5 | Picking the tech stack based on what's trendy or what a tutorial used, without scoring it against the team's actual constraints | Team ends up debugging unfamiliar tooling instead of doing research; timeline evaporates into Stack Overflow searches for framework-specific errors unrelated to the research question | Run the **weighted decision matrix** (Phase 2) against this team's actual familiarity, timeline, and interop needs — boring-but-known beats exciting-but-unfamiliar under a hard deadline |
| 6 | No baseline, or a strawman baseline deliberately made weak to guarantee the "novel" method wins | Panel immediately recognizes a strawman comparison; destroys credibility of the entire results chapter, sometimes triggers a resit | Choose the **strongest reasonable baseline** available (a real prior method or well-tuned off-the-shelf tool) — beating a strong baseline by a small, statistically significant margin is more defensible than beating a weak one by a large margin |
| 7 | Treating the SRS/architecture document as a one-time deliverable written after the code, to satisfy a paperwork requirement | Documentation drifts from reality; ADRs don't exist so design rationale is lost by the time the thesis defense asks "why did you choose X over Y"; can't answer viva questions about tradeoffs | Documentation (**ADRs, SRS, meeting log**) is written *during* implementation, versioned alongside code, and updated the moment a decision changes |

---

## Pre-Flight Checklist

Run before starting Phase 2 (implementation). If any item is unchecked, return
to Phase 1.

- [ ] Research question is one sentence, names an independent and dependent
      variable, and has been read aloud to the supervisor.
- [ ] Novelty claim is written down and classified (new method / new domain /
      new comparison / new system), with at least 2 cited prior works.
- [ ] Novelty claim is falsifiable — a specific experimental outcome exists
      that would disprove it.
- [ ] Primary evaluation metric and at least one named, real baseline are
      identified (not "TBD").
- [ ] Remaining timeline is broken into weeks, with milestone dates from the
      department mapped on, and ≥15% buffer reserved for writing/defense prep.
- [ ] Data required for the project is confirmed *in hand* or has a concrete,
      time-bounded acquisition/scraping/licensing plan — not assumed available.
- [ ] Ethics/IRB clearance need has been checked, and applied for if required.
- [ ] Compute and budget constraints are documented and the planned
      architecture has been sanity-checked against them (no GPU-hungry
      design on laptop-CPU-only compute).
- [ ] Team roles and component ownership are mapped 1:1 onto architecture
      layers, if team size > 1.
- [ ] At least one ADR exists for the highest-risk technical decision made
      so far (framework, database, or model-family choice).

## Post-Flight Checklist

Run after architecture and initial implementation are in place, before the
next milestone (mid-viva, progress review, or final submission).

- [ ] The system runs end-to-end on a clean checkout by someone who is not
      the original author, using only the README.
- [ ] `evaluation/run_evaluation.py` (or equivalent) reproduces every number
      and figure currently cited in the thesis draft, from one command.
- [ ] The baseline is implemented and actually executed — not aspirational —
      and scored through the same metric code path as the novel method.
- [ ] Test/train/validation splits are fixed, versioned, and provably
      identical across every compared method.
- [ ] The Architecture Review Gate (Phase 3) has been run and its findings
      logged in `docs/meeting-log.md` with owners and resolution dates.
- [ ] Every ADR reflects the decisions actually implemented — no ADR
      describes a plan that was silently abandoned without a superseding ADR.
- [ ] A MoSCoW scope-cut log exists (even if empty/unused so far), so scope
      decisions under future deadline pressure are deliberate, not panicked.
- [ ] The novelty claim's Must-Have experiment (Phase 4) has a protected,
      explicit status: done / in progress / at risk — never "unknown."
- [ ] Folder structure matches the documented template, with `evaluation/`
      as a sibling of `src/`, not nested inside it.
- [ ] Supervisor has signed off on the current state against the original
      (or explicitly revised) research question — no silent scope drift
      since the last checkpoint.
