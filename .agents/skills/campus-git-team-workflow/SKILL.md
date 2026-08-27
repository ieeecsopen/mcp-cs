---
name: campus-git-team-workflow
description: >
  Activate when a student or team needs to set up, repair, or reason about a
  Git collaboration workflow for a university group project (semester
  project, hackathon team, final year project, capstone). Trigger phrasings
  include "set up a git workflow for my group project", "how should our team
  branch our repo", "help me resolve this merge conflict", "our repo is a
  mess after everyone pushed", "how do I do a pull request properly", "I
  force-pushed and lost commits", "how do I recover a deleted branch", and
  exact error signatures such as "CONFLICT (content): Merge conflict in",
  "Automatic merge failed; fix conflicts and then commit the result",
  "Your branch and 'origin/main' have diverged", "error: failed to push some
  refs", "fatal: refusing to merge unrelated histories", and
  "Already up to date" confusion. Also activate for PR template requests,
  .gitignore/.gitattributes setup for student projects, and branch
  protection rule questions.
version: 1.0.0
author: IEEE Computer Society of SLIIT
tags:
  - git
  - version-control
  - team-workflow
  - merge-conflicts
  - pull-requests
  - student-projects
  - branching-strategy
  - ci-cd
---

# Campus Git Team Workflow

## Mission

Give student teams (typically 3-6 members, one semester timeline, mixed Git
experience levels) a Git workflow that is **lightweight enough that nobody
abandons it under deadline pressure**, but **disciplined enough that the repo
never enters an unrecoverable state**. This skill is both a setup guide for a
fresh group project and an emergency runbook for a repo that is already on
fire (conflicts, diverged branches, accidental force-pushes, deleted
branches). When invoked, diagnose which mode the user is in — "we are
starting a new project" vs "something already went wrong" — and jump to the
matching phase below. Never guess at destructive recovery; always inspect
state first (Phase 1) before touching history.

---

## Mental Model & Theoretical Foundations

### Why branching strategy choice matters more for the *social* system than the *technical* one

A branching strategy is a coordination protocol for humans who are bad at
communicating, not a technical requirement of Git itself. The right choice
for a 4-person student team optimizes for **low ceremony** and **fast
recovery from mistakes**, because the team's real constraints are: nobody has
done a formal code review before, everyone has other courses, and the
"release cadence" is "whenever the demo is."

#### Git Flow vs GitHub Flow vs Trunk-Based Development

| Model | Branches involved | Ceremony | Fit for student teams |
|---|---|---|---|
| **Git Flow** (Vincent Driessen, 2010) | `main`, `develop`, `feature/*`, `release/*`, `hotfix/*` | High — 5 branch types, strict merge order, release branches | **Usually overkill.** Designed for versioned software with scheduled releases and long-lived support branches (e.g. shipping v1.2 while building v2.0). A student project has one "release": the demo/submission. The `release/*` and `hotfix/*` branch types solve a problem (maintaining multiple production versions simultaneously) that a semester project does not have. Teams that adopt full Git Flow anyway typically end up with `develop` and `main` permanently in sync (defeating the purpose) or permanently diverged (a bug factory). |
| **GitHub Flow** | `main` + short-lived `feature/*` branches merged via PR | Low — one long-lived branch, everything else is disposable | **Good fit.** One rule: `main` is always deployable/demoable. Everything else branches from `main` and merges back via PR. This is the default recommendation below. |
| **Trunk-Based Development** | `main` only, tiny commits, feature flags for incomplete work | Very low, but requires discipline and CI | Good for advanced teams comfortable committing small increments directly behind flags. Riskier for beginners because there is no PR checkpoint before code lands on `main`; recommend only if the team already has working CI and is comfortable with feature flags. |

**Recommendation for this skill: a lightweight GitHub-Flow variant** — `main`
as the single long-lived branch, one short-lived feature branch per task,
merged via pull request. This is detailed as the reference topology below.

#### The three-way merge, conceptually

Git does not diff two versions of a file to merge them — it uses **three**
inputs:

1. **Base (common ancestor)** — the last commit both branches shared before
   they diverged.
2. **Ours** — the tip of the branch you are merging *into* (commonly your
   local `main` or the target branch of the PR).
3. **Theirs** — the tip of the branch being merged *in* (the feature
   branch/PR source).

For every line (technically every chunk identified by Git's diff algorithm),
Git compares each side against the base:

- If only **ours** changed a chunk relative to base → take ours.
- If only **theirs** changed a chunk relative to base → take theirs.
- If **both** changed the *same* chunk (to the same or different content) →
  **conflict**, and Git leaves conflict markers for a human to resolve.
- If both changed it identically → no conflict, take that content.

```
        base (common ancestor)
       /                        \
  ours (main, or PR target)   theirs (feature branch, or PR source)
       \                        /
        three-way merge algorithm
                 |
      clean merge  OR  CONFLICT markers
```

This is why `git log --graph` and identifying the merge-base
(`git merge-base <branch-a> <branch-b>`) are the starting point for
understanding *any* conflict — you cannot reason about "who changed what"
without first knowing the common ancestor.

#### Why conflicts happen: textual vs semantic

- **Textual (line-overlap) conflicts** — two branches edited the *same
  lines* of the *same file*. Git detects these automatically and refuses to
  auto-merge; this is the `CONFLICT (content): Merge conflict in <file>`
  case. Mechanical, and usually the easy case to resolve.
- **Semantic conflicts** — two branches edited *different, non-overlapping*
  lines (or even different files), and Git merges them cleanly with **no
  warning**, but the resulting combined code is logically broken. Example:
  Student A renames a function `calculateTotal()` to `computeTotal()`
  everywhere they touched; Student B, on a different branch, adds a new
  call to `calculateTotal()` in a file Student A never touched. Git merges
  both changes without complaint — and the build breaks. **This is why
  Phase 3 (automated verification) matters even for "clean" merges** —
  a merge with zero conflict markers is not proof the merge is correct.

### Recommended branch topology (ASCII)

```
main   o───o───o───────o───────────o───────o──►  (always demoable/deployable)
        \           \             /       /
         \           \           /       /
feat/A    o───o───o    \        /       /         short-lived, 1 person or pair,
                     \   \      /       /          deleted after merge
feat/B                \   o───o───o    /
                        \             /
feat/C                   o───o───o───o

Legend:
  o        = commit
  main     = single long-lived integration branch; protected, PR-only
  feat/*   = feature/task branch, branches FROM main, merges back INTO main via PR
  merges   = always via Pull Request, never direct push to main
```

Key properties of this topology for a student team:

1. **`main` is the only long-lived branch.** No `dev`/`develop` layer unless
   the team specifically needs a staging environment distinct from
   production — for most course projects this is unnecessary indirection.
2. **Feature branches are short-lived** (ideally < 3-5 days). The longer a
   branch lives without merging, the more it diverges from `main`, and the
   more likely a conflict becomes. "Merge or rebase from `main` often" beats
   "avoid conflicts by never syncing."
3. **Branch naming convention**: `feat/<name-or-initials>-<short-slug>`,
   `fix/<short-slug>`, `docs/<short-slug>`, `chore/<short-slug>`. Example:
   `feat/hesara-auth-login`, `fix/nadeesha-null-pointer-cart`.
4. **One branch per task, not one branch per person.** A branch that lives
   for the whole semester under someone's name becomes an unmergeable
   monster. Branches should map to units of work, not team members.

---

## Phase 1: Discovery & Static Analysis

**Never resolve a conflict or attempt recovery before you understand current
state.** Run these in order and read the output before acting.

### 1.1 — Overall working tree and staging state

```bash
git status
```

Tells you: which branch you're on, whether you're mid-merge/mid-rebase,
which files are staged/unstaged/untracked, and — critically — during a
conflict, lists files under "Unmerged paths".

### 1.2 — Visualize branch topology and divergence

```bash
git log --graph --oneline --all --decorate
```

This single command answers "how did we get into this state?" — it shows
every branch, every merge point, and where histories diverged. Add
`-20` (or any number) to limit output on a long-lived repo:

```bash
git log --graph --oneline --all --decorate -30
```

### 1.3 — Find the exact common ancestor of two branches

```bash
git merge-base main feat/hesara-auth-login
```

Pipe the result into a diff to see exactly what each side changed relative
to that ancestor:

```bash
git diff $(git merge-base main feat/hesara-auth-login) main
git diff $(git merge-base main feat/hesara-auth-login) feat/hesara-auth-login
```

### 1.4 — List only the files currently in conflict

During an active merge/rebase, don't scroll through full `git status` output
— filter directly to unmerged files:

```bash
git diff --name-only --diff-filter=U
```

`U` = unmerged. This is the authoritative list of files that need manual
attention; everything else already merged cleanly.

### 1.5 — See how far local and remote have diverged

```bash
git fetch origin
git status -sb
git log --left-right --graph --oneline main...origin/main
```

The `...` (triple-dot) range shows commits reachable from either branch but
not both — exactly the commits responsible for "Your branch and
'origin/main' have diverged" messages.

### 1.6 — Inspect a specific conflicted file's conflict regions before editing

```bash
grep -n "^<<<<<<<\|^=======\|^>>>>>>>" path/to/file
```

Gives line numbers of every conflict block in the file so you know how many
distinct conflicts you're dealing with before opening an editor.

### 1.7 — Check whether a branch was already merged (before deleting it)

```bash
git branch --merged main
git branch --no-merged main
```

`--merged` lists branches whose work is already fully in `main` — safe to
delete. `--no-merged` lists branches with unmerged work — deleting these
loses commits (recoverable via reflog for a while, see Phase 4, but don't
rely on that).

---

## Phase 2: Execution & Implementation

### 2.1 — The standard feature-branch lifecycle (no conflicts yet)

```bash
# 1. Always branch from an up-to-date main
git checkout main
git pull origin main
git checkout -b feat/hesara-auth-login

# 2. Work, committing in small logical chunks
git add src/auth/login.js
git commit -m "feat: add login form validation"

# 3. Before opening a PR, sync with main to surface conflicts EARLY,
#    on your own branch, where only you have to resolve them —
#    not later in a shared PR where it blocks the team.
git fetch origin
git merge origin/main
#   (or, if the team has agreed to a rebase workflow — see 2.4 — use:
#    git rebase origin/main)

# 4. Push and open a PR
git push -u origin feat/hesara-auth-login
```

### 2.2 — Decision procedure when a conflict actually occurs

When `git merge origin/main` (or a PR merge) reports:

```
Auto-merging src/auth/login.js
CONFLICT (content): Merge conflict in src/auth/login.js
Automatic merge failed; fix conflicts and then commit the result.
```

Follow this procedure — do not skip steps:

**Step 1 — Identify scope.** Run `git diff --name-only --diff-filter=U` (see
Phase 1.4). Know exactly how many files are involved before touching any of
them.

**Step 2 — Open the file and read the conflict markers.**

```
<<<<<<< HEAD
  const MAX_RETRIES = 3;
=======
  const MAX_RETRIES = 5;
>>>>>>> feat/increase-retry-limit
```

- Content between `<<<<<<< HEAD` and `=======` is **ours** (the branch you
  are currently on / merging into).
- Content between `=======` and `>>>>>>> <branch>` is **theirs** (the
  incoming branch).

**Step 3 — Decide the resolution strategy per file, not globally.** Three
options, in order of how much judgment they require:

- **Whole-file "take ours" or "take theirs"** — appropriate ONLY when one
  side's entire version of the file is known to be correct and the other
  side's changes to that file are already obsolete/superseded (e.g. a
  generated lockfile, or a file one teammate was told to stop editing).
  ```bash
  git checkout --ours  path/to/file    # keep current branch's version entirely
  git checkout --theirs path/to/file   # keep incoming branch's version entirely
  git add path/to/file
  ```
  **Warning**: this discards the *other* side's changes to that file
  completely, silently. Never use this as a default "make the error go
  away" move — confirm with the teammate whose work you're discarding, or
  confirm via `git diff` that their side truly has nothing worth keeping.

- **Manual line-by-line merge (the default, correct choice for real logic
  conflicts)** — open the file, read both sides, understand *why* each
  side made their change (not just *what* changed), and hand-edit to a
  version that preserves both intents. Remove all three marker lines
  (`<<<<<<<`, `=======`, `>>>>>>>`) — leaving one in is a silent bug that
  still compiles in many languages (e.g. JS: `=======` alone is a
  no-op-ish token soup, but `<<<<<<< HEAD` is a syntax error in most
  languages, so at least it'll fail loudly there — do not count on that in
  languages/config formats where it might not, e.g. YAML/JSON/Markdown).
  ```bash
  # after hand-editing the file to the correct resolved content:
  git add path/to/file
  ```

- **Use a merge tool for a visual 3-way view** (recommended once conflicts
  get non-trivial):
  ```bash
  git mergetool
  ```
  Configure one first if the team hasn't:
  ```bash
  git config --global merge.tool vscode
  git config --global mergetool.vscode.cmd 'code --wait $MERGED'
  ```

**Step 4 — Verify before committing.** Do NOT commit a conflict resolution
blind. At minimum, open every file listed in Phase 1.4 and confirm no
marker lines remain:
```bash
grep -rn "^<<<<<<<\|^=======\|^>>>>>>>" $(git diff --name-only --diff-filter=U)
```
If this outputs nothing, all markers are gone. Run the project's build/tests
locally (see Phase 3) before finalizing.

**Step 5 — Complete the merge.**
```bash
git commit          # for a merge in progress, no -m needed; Git pre-fills a merge message
# or, if mid-rebase:
git rebase --continue
```

### 2.3 — Conflicts in a Pull Request (GitHub UI) vs local

GitHub's web editor can resolve *simple* single-file, non-overlapping
conflicts inline. For anything beyond a one-liner, prefer resolving locally
with the full procedure above — the web editor gives no build/test
feedback loop and is easy to get wrong under time pressure:

```bash
git fetch origin
git checkout feat/hesara-auth-login
git merge origin/main
# resolve locally per 2.2, then:
git push origin feat/hesara-auth-login
```

### 2.4 — Merge vs rebase for syncing a feature branch (team must pick one)

- **`git merge origin/main`** into your feature branch — preserves true
  history, creates a merge commit, never rewrites commits. **Always safe**,
  including on branches others have already pulled. Recommended default for
  student teams because it never requires force-pushing.
- **`git rebase origin/main`** — replays your commits on top of latest
  `main`, producing linear history, but **rewrites your branch's commit
  hashes**, which requires `git push --force-with-lease` afterward. Only
  safe on a branch **you alone** are working on, that **nobody else has
  pulled a copy of**. Never rebase a branch other teammates have checked
  out — see the anti-pattern table.

### 2.5 — `.gitignore` template for a typical student full-stack project

```gitignore
# ---- Dependencies ----
node_modules/
vendor/
venv/
__pycache__/
*.pyc

# ---- Build output ----
dist/
build/
out/
*.class
target/

# ---- Environment & secrets ----
.env
.env.local
.env.*.local
*.pem
*.key
secrets.json

# ---- IDE / editor ----
.vscode/
.idea/
*.swp
.DS_Store

# ---- Logs & debug ----
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# ---- Test & coverage ----
coverage/
.nyc_output/

# ---- OS files ----
Thumbs.db
```

### 2.6 — `.gitattributes` template (prevents whole classes of "fake conflicts")

```gitattributes
# Normalize line endings across Windows/Mac/Linux teammates —
# the single biggest cause of noise-conflicts (every line shows as changed)
* text=auto eol=lf

# Never diff/merge generated or binary-ish files line-by-line
package-lock.json -diff -merge
yarn.lock -diff -merge
*.png binary
*.jpg binary
*.pdf binary

# Mark generated files so PR diffs collapse them by default on GitHub
dist/** linguist-generated=true
*.min.js linguist-generated=true
```

The `eol=lf` line alone eliminates the extremely common "every single line
of this file shows as conflicted" problem caused by one teammate on Windows
(CRLF) and others on macOS/Linux (LF) editing the same file.

### 2.7 — Branch protection settings (GitHub → Settings → Branches)

Apply to `main`:

- Require a pull request before merging (disable direct pushes to `main`).
- Require at least 1 approving review (even a teammate rubber-stamp review
  catches real bugs — it forces a second person to read the diff).
- Require status checks to pass before merging (wire up CI — see Phase 3).
- Do not allow force pushes to `main`.
- Do not allow branch deletion of `main`.

### 2.8 — Pull Request template

Create at `.github/pull_request_template.md`:

```markdown
## What does this PR do?
<!-- One or two sentences. Link the task/issue if you use a board. -->

## How was this tested?
<!-- Manual steps you ran, or automated tests you added/ran. -->

## Checklist
- [ ] Branch is up to date with `main` (merged or rebased recently)
- [ ] No `.env`, credentials, or `node_modules` accidentally included
- [ ] Code builds locally with no errors
- [ ] Existing tests pass locally
- [ ] I read my own diff before requesting review
- [ ] Screenshots/GIFs attached for any UI change

## Notes for reviewers
<!-- Anything tricky, any part you're unsure about, any file you want extra eyes on. -->
```

---

## Phase 3: Automated Verification

A merge with **zero conflict markers is not proof of correctness** — see the
semantic-conflict discussion above. Verify explicitly.

### 3.1 — Confirm a resolved merge didn't silently drop either side's work

After completing a merge commit, compare the merge result against **each**
parent individually. This surfaces exactly what was kept, dropped, or
changed relative to each side:

```bash
# find the merge commit's two parents
git log -1 --format="%P" <merge-commit-sha>
# → outputs two SHAs, e.g.: abc1234 def5678

# diff the merge result against each parent separately
git diff <merge-commit-sha> abc1234   # what changed relative to "ours" side
git diff <merge-commit-sha> def5678   # what changed relative to "theirs" side
```

Anything appearing in **both** of these diffs as a *removal* is content that
existed on both parents' history in some form but is gone from the final
merge — a strong signal of an accidental drop. If either diff shows large,
unexpected deletions of code neither side intended to remove, the conflict
resolution was wrong — reopen it (see Phase 4 rollback options) rather than
patching forward.

### 3.2 — Diff the merge commit against the merge-base to see the full combined delta

```bash
git diff $(git merge-base abc1234 def5678) <merge-commit-sha>
```

This is "everything that changed across both branches combined" — useful as
a final sanity read before pushing, especially to confirm nothing beyond the
intended scope moved.

### 3.3 — Search for leftover conflict markers anywhere in the tree

Run this as a hard gate before every push, not just after a conflict:

```bash
grep -rn "^<<<<<<<\|^=======\|^>>>>>>>" --exclude-dir=.git --exclude-dir=node_modules .
```

Any output here means an unresolved marker made it into a commit — stop and
fix before pushing. (This is a good candidate for a pre-commit hook or a CI
step; see 3.5.)

### 3.4 — Pre-merge / pre-push CI checklist

Before merging any PR into `main`, confirm all of the following pass —
ideally automated via CI (GitHub Actions), but at minimum run manually:

```bash
# 1. No leftover conflict markers
grep -rn "^<<<<<<<\|^=======\|^>>>>>>>" --exclude-dir=.git .

# 2. Project installs cleanly from a clean state
rm -rf node_modules && npm install     # (or pip install -r requirements.txt, etc.)

# 3. Project builds
npm run build                          # (or equivalent for the stack)

# 4. Linter passes
npm run lint

# 5. Test suite passes
npm test

# 6. No secrets accidentally staged
git diff --cached --name-only | grep -E "\.env$|\.pem$|secrets\."
```

### 3.5 — Minimal CI workflow example (GitHub Actions)

`.github/workflows/ci.yml`:

```yaml
name: CI
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - name: Check for leftover conflict markers
        run: |
          if grep -rn "^<<<<<<<\|^=======\|^>>>>>>>" --exclude-dir=.git --exclude-dir=node_modules .; then
            echo "Unresolved merge conflict markers found."
            exit 1
          fi
```

This single workflow, gated as a required status check (Phase 2.7), catches
the two most common student-team failures: an unresolved marker that
survived to `main`, and a merge that silently broke the build or tests.

---

## Phase 4: Rollback & Self-Healing

### 4.1 — Abort a merge that's going badly, before committing

If you're mid-conflict-resolution and realize you don't understand the
conflict well enough to resolve it safely, back out completely and start
over with a clearer head — this is always safe *before* you run `git
commit`:

```bash
git merge --abort
```

Returns the working tree exactly to its pre-merge state. Equivalent for a
rebase in progress:

```bash
git rebase --abort
```

### 4.2 — Undo a bad merge that was already committed (but not yet pushed/shared)

```bash
git reset --hard HEAD~1
```

Only safe if that merge commit has not been pushed or pulled by anyone
else. If it has already been pushed and others may have based work on it,
do not rewrite it — instead:

```bash
git revert -m 1 <merge-commit-sha>
```

`revert -m 1` creates a new commit that undoes the merge while keeping
history intact and safe for everyone who already pulled it.

### 4.3 — Recover from a bad `git reset --hard` using reflog

`git reflog` records every place `HEAD` has pointed, even commits no longer
reachable from any branch — this is the safety net for almost every "I
think I lost my work" panic:

```bash
git reflog
```

Example output:

```
a1b2c3d HEAD@{0}: reset: moving to HEAD~1
e4f5g6h HEAD@{1}: commit: feat: add password reset flow
```

The commit that existed *before* the destructive reset is right there
(`e4f5g6h` in this example). Recover it:

```bash
git reset --hard e4f5g6h
# or, less destructively, just create a branch pointing at it:
git branch recovered-work e4f5g6h
```

Reflog entries are local-only (never pushed) and expire after ~90 days by
default (30 for unreachable commits) — it is a safety net, not permanent
storage, but it comfortably covers "I made a mistake five minutes/days ago."

### 4.4 — Recover a deleted branch

If the branch was deleted locally and you know (or can find) its last
commit SHA:

```bash
git reflog | grep <branch-name>
# or scan broadly for a recent checkout/commit of it:
git reflog show --all | grep -i "<branch-name-fragment>"

git branch <branch-name> <sha-found-above>
```

If it was deleted on the **remote** (e.g. someone deleted it on GitHub after
merging), and someone still has it locally, they can simply push it back:

```bash
git push origin <branch-name>
```

If nobody has it locally but it was merged into `main` via PR, its commits
are already preserved inside `main`'s history — nothing is actually lost,
you likely don't need the branch pointer back at all. If it was deleted
**before** merging and nobody has a local copy, check the GitHub PR page
(if a PR was ever opened, GitHub keeps the branch's commits referenced by
the PR for a period) or `git fsck --lost-found` as a last resort.

### 4.5 — Recover from a bad force-push that overwrote a shared branch

```bash
# On any teammate's machine who still has the OLD state locally in their reflog:
git reflog                     # find the SHA of the branch tip before the bad force-push
git push origin <that-sha>:<branch-name> --force-with-lease
```

This is exactly why the team-wide rule is "never force-push a shared
branch" (see anti-pattern table) — recovery depends entirely on some
teammate still having the old tip in their local reflog or an un-pruned
local branch ref.

### 4.6 — General self-healing principle

Prefer **additive** fixes (`revert`, creating a new branch from a recovered
SHA) over **destructive** ones (`reset --hard`, force-push) whenever the
commit in question might already be visible to a teammate or to the remote.
Destructive history rewrites are only unconditionally safe on commits that
exist **only** in your own local, unpushed, un-shared work.

---

## Common Anti-Patterns vs Gold Standard

| # | Anti-Pattern | Why it hurts a student team | Gold Standard |
|---|---|---|---|
| 1 | Committing directly to `main` | No review checkpoint; one bad commit breaks the demo for everyone with no PR history to trace it | Branch-protect `main`; all changes land via PR (Phase 2.7) |
| 2 | Force-pushing a branch others have pulled | Silently discards teammates' local history; their next `pull` either errors or, worse, silently diverges | Never force-push shared branches; use `git revert` or `--force-with-lease` only on branches you alone own |
| 3 | One branch per person, alive the whole semester | Diverges further from `main` every day; becomes one giant unreviewable, unmergeable diff at the end | One branch per *task*, merged within days, then deleted |
| 4 | Resolving conflicts with `git checkout --theirs .` (whole repo, no thought) | Silently deletes the other side's changes across every conflicted file, not just the one that needed it | Resolve conflict-by-conflict, understanding intent; whole-file take only when confirmed obsolete (Phase 2.2) |
| 5 | Never pulling/syncing with `main` until the day of the demo | Guarantees a massive, high-stakes conflict resolved under maximum time pressure | Sync with `main` every session, or at minimum daily |
| 6 | Committing `node_modules/`, `.env`, build output | Bloats repo, leaks secrets, causes bogus conflicts in generated files | `.gitignore` from day one (Phase 2.5), secret scanning in CI |
| 7 | Vague commit messages ("fix stuff", "asdf", "final final v2") | Makes `git log`, `git blame`, and conflict-context reading useless when it matters most | Conventional commit prefixes (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`) with a real one-line summary |
| 8 | Merging a PR with failing CI / without running it locally first | Broken `main` blocks the entire team, not just the PR author | Required status checks on `main` (Phase 2.7/3.5); nobody merges red CI |
| 9 | Editing the same file/section as a teammate without communicating | Manufactures avoidable conflicts and duplicate work | Quick async message ("touching `auth.js` today") before starting overlapping work |
| 10 | Panicking and running random Git commands from Stack Overflow when something looks broken | Frequently turns a recoverable situation into a genuinely destructive one | Phase 1 discovery first, always — `git status`, `git log --graph`, `git reflog` before any corrective command |

---

## Pre-Flight Checklist

Before starting *any* work session, or before setting up a new project:

- [ ] `main` exists, is protected (no direct pushes, PR + 1 review + CI required)
- [ ] `.gitignore` is committed and covers dependencies, build output, env files, IDE cruft
- [ ] `.gitattributes` sets `* text=auto eol=lf` to prevent line-ending false-conflicts
- [ ] Every teammate has run `git config --global user.name` / `user.email` correctly (so commits attribute properly)
- [ ] CI workflow (lint + test + conflict-marker scan) is wired up and required on `main`
- [ ] PR template exists at `.github/pull_request_template.md`
- [ ] Branch naming convention is agreed and written down (`feat/`, `fix/`, `docs/`, `chore/`)
- [ ] Team has explicitly agreed: merge or rebase for syncing feature branches (Phase 2.4) — don't leave this ambiguous
- [ ] Local `main` is pulled and up to date (`git checkout main && git pull`) before branching off for new work

## Post-Flight Checklist

After resolving a conflict, merging a PR, or finishing a work session:

- [ ] `grep -rn "^<<<<<<<\|^=======\|^>>>>>>>"` returns nothing anywhere in the tree
- [ ] Project builds from a clean install (`rm -rf node_modules && npm install && npm run build`, or stack equivalent)
- [ ] Full test suite passes locally
- [ ] `git diff <merge-commit> <parent-1>` and `git diff <merge-commit> <parent-2>` reviewed for unexpected drops (Phase 3.1)
- [ ] CI is green on the PR/branch before merge, not just locally
- [ ] Merged feature branch is deleted (`git branch -d feat/x` locally, and via the GitHub "Delete branch" button remotely) to keep `git branch -a` readable
- [ ] Teammates notified that `main` moved, if the change affects shared files/setup (e.g. new env var, new dependency)
- [ ] No `.env`, credentials, or large binaries slipped into the commit (`git show --stat` on the final commit)
