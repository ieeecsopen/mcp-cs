---
name: campus-hackathon-fast-scaffold
description: Activate when a team needs to scaffold a hackathon project fast, set up a full-stack app in under an hour, spin up a demo-ready MVP under a hard 12/24/36-hour deadline, choose a "fast stack" for a campus hackathon (SLIITXtreme, IEEEXtreme, HackElite), or recover a broken build with hours left before judging. Covers stack selection, copy-paste scaffold commands, time-boxed scope planning, pre-demo smoke testing, and last-minute rollback triage.
version: 1.0.0
author: IEEE Computer Society of SLIIT
tags: [hackathon, rapid-prototyping, scaffolding, mvp, nextjs, supabase, time-boxing, demo-readiness]
---

# Campus Hackathon Fast Scaffold

## Mission

Take a team from an empty repository to a **judgeable, demoable, deployed** product inside a hard time box (12h / 24h / 36h), without the two failure modes that kill most campus hackathon teams: (1) burning the first 6 hours on architecture debates and boilerplate, and (2) arriving at demo time with a half-built system that only works on the developer's laptop. This skill is a runbook, not a tutorial — it assumes the operator already knows how to code and needs a decision framework plus copy-paste scaffolding to move fast without accumulating fatal risk.

The operating principle throughout: **a working demo of a narrow slice beats a broken demo of a broad vision, every single time.**

---

## Mental Model & Theoretical Foundations

### The Hackathon Tradeoff Curve

Every engineering decision in a hackathon sits on a curve between **velocity** and **correctness**. In production software, that curve is tuned toward correctness because the cost of a bug compounds over the life of the system. In a hackathon, the system has a life of about 36 hours and an audience of judges who will interact with it for 2-5 minutes. This inverts the optimal point on the curve almost completely:

- **Production default**: write tests, handle edge cases, design for scale, review PRs, plan data models for future features.
- **Hackathon default**: hardcode what can be hardcoded, handle only the inputs the demo will actually produce, design a data model for the one query the demo needs, skip review, skip migrations-as-a-discipline (one seed script is fine).

This is not laziness — it is **correct resource allocation under a deadline constraint**. Every hour spent on correctness that the judges will never observe is an hour not spent on the one thing that is graded: a live, working, demoable flow. Judges reward what they can see working in front of them. They cannot see your test coverage, your normalized schema, or your clean git history. They can see: does the app do the thing you pitched, right now, on this wifi, without crashing.

### The Vertical Slice Principle

The single most important architectural decision in a time-boxed build is sequencing: **build one full user flow end-to-end (UI → API → DB → back to UI) before building breadth across multiple features.**

A horizontal build (all UI screens first, then all API routes, then the DB layer) feels productive because visible progress accumulates fast, but it hides integration risk until the very end — the point at which you have the least slack to absorb a surprise. A vertical slice surfaces integration failures (auth misconfig, CORS, env vars, deploy pipeline breakage) in hour 2, when there are 20+ hours left to fix them, instead of hour 20, when there are none.

```
HORIZONTAL BUILD (fragile — avoid)          VERTICAL SLICE (resilient — use)
┌─────────────────────────────┐             ┌───────┬───────┬───────┐
│ All screens (UI)            │             │ Screen│  API  │  DB   │  <- Slice 1: login -> dashboard -> save
├─────────────────────────────┤             │  1    │  1    │  1    │     (fully working, deployed, demoed)
│ All API routes              │             ├───────┼───────┼───────┤
├─────────────────────────────┤             │ Screen│  API  │  DB   │  <- Slice 2: core feature
│ All DB models                │             │  2    │  2    │  2    │
├─────────────────────────────┤             ├───────┼───────┼───────┤
│ Wire it all together (hour 20)│            │ Screen│  API  │  DB   │  <- Slice 3: stretch feature (optional)
│  <- integration bugs found   │             │  3    │  3    │  3    │     (cut first if time runs out)
│     here, too late           │             └───────┴───────┴───────┘
└─────────────────────────────┘             Each slice is independently demoable the moment it's done.
```

Every slice must, on completion, be independently demoable. If time runs out after slice 2, the team still has a coherent story. If time runs out mid-slice-3, cutting slice 3 entirely and demoing slices 1-2 is always the right call (see Phase 4).

### Time-Boxing Theory: Parkinson's Law Under a Hard Constraint

Parkinson's Law ("work expands to fill the time available") is usually cited as a warning, but in a hackathon it is a *tool*: an unbounded task ("build a matching algorithm") will consume unlimited hours if you let it, but the same task bounded to a hard 90-minute box forces a simpler, shippable version to emerge. The mechanism:

1. **Every feature gets an explicit time box before work starts**, not after ("this gets 90 minutes, then we ship whatever exists").
2. **Boxes are enforced by a visible timer, not vibes.** When the box expires, the feature is either done, degraded to a simpler version, or cut — never silently extended.
3. **The schedule is built backward from demo time**, not forward from hour 0. Decide the exact clock time the demo must be rehearsed and working, then allocate everything before that point.
4. **Buffer is a first-class allocation, not leftover time.** A 24-hour hackathon plan that allocates all 24 hours to building has a 0% chance of arriving at demo time in a good state — something always overruns. Reserve 10-15% of total time as unallocated buffer near the end.

### 24-Hour Reference Timeline

```
Hour:   0    2    4    6    8    10   12   14   16   18   20   22   24
        +----+----+----+----+----+----+----+----+----+----+----+----+
SETUP   |####|    |    |    |    |    |    |    |    |    |    |    |
        | scaffold, auth skeleton, deploy pipeline live (hour 0-2)   |
        +----+----+----+----+----+----+----+----+----+----+----+----+
CORE    |    |####|####|####|####|####|####|####|    |    |    |    |
        |    | vertical slice 1 -> slice 2 -> (slice 3 if ahead)     |
        +----+----+----+----+----+----+----+----+----+----+----+----+
SLEEP*  |    |    |####|####|    |    |    |    |    |    |    |    |
        | *optional rotating sleep block, team-dependent, hr 4-8     |
        +----+----+----+----+----+----+----+----+----+----+----+----+
POLISH  |    |    |    |    |    |    |    |    |####|####|    |    |
        | error states, empty states, loading states, styling pass  |
        +----+----+----+----+----+----+----+----+----+----+----+----+
DEMO    |    |    |    |    |    |    |    |    |    |    |####|####|
PREP    |    |    |    |    |    |    |    |    |    |    | smoke   |
        |    |    |    |    |    |    |    |    |    |    | test +  |
        |    |    |    |    |    |    |    |    |    |    | script +|
        |    |    |    |    |    |    |    |    |    |    | backup  |
        |    |    |    |    |    |    |    |    |    |    | video   |
        +----+----+----+----+----+----+----+----+----+----+----+----+
BUFFER  |                                                       [##]|
        | hour 23-24: unallocated slack for whatever overran        |
        +------------------------------------------------------------+
```

For a 12-hour sprint, compress proportionally: Setup = 0:45, Core = 6h, Polish = 2h, Demo Prep = 1.5h, Buffer = 45min. For 36 hours, do **not** linearly scale Core upward — add a second vertical slice and a real sleep rotation instead; unbounded core-build time just relocates the same deadline crunch to hour 34.

---

## Phase 1: Discovery & Static Analysis — Rapid Stack Selection

Before any code is written, resolve the stack in under 15 minutes using a decision tree gated on two inputs: **team skill overlap** (what does everyone already know, not what's trendy) and **demo requirements** (what does the pitch actually need to visibly do). Optimizing for "the right tool" over "the tool three of us already know" is the single most common velocity killer in the first 4 hours.

```
START: What does the demo need to PROVE, live, in front of judges?
│
├─ Does the core pitch require AUTHENTICATED, PER-USER state?
│  ├─ YES ─────────────────────────────────────────────────────┐
│  │                                                             │
│  └─ NO → skip auth entirely. Use a single shared "demo         │
│          workspace" row in the DB. Do not build login for      │
│          a feature no judge will be asked to log into.         │
│                                                                 │
├─ Does the core pitch require REAL-TIME updates                 │
│  (live dashboard, multiplayer, chat, presence)?                │
│  ├─ YES → use a backend with built-in realtime                 │
│  │        (Supabase Realtime / Firebase RTDB / Ably).          │
│  │        Do NOT hand-roll WebSocket infra in a hackathon.     │
│  └─ NO  → plain request/response. Do not add sockets           │
│           "in case it's impressive" — it isn't, it's risk.     │
│                                                                 │
├─ Does the core pitch require ML/AI inference                   │
│  (classification, generation, recommendation)?                 │
│  ├─ YES → call a hosted inference API (OpenAI/Anthropic/       │
│  │        HF Inference/Replicate). Never train a model         │
│  │        from scratch inside the time box.                    │
│  └─ NO  → do not add an LLM call "for buzzword value" —        │
│           it adds a network dependency and a new failure        │
│           mode with zero demo payoff.                          │
│                                                                 │
└─ Does the team have 2+ people fluent in the SAME               │
   frontend framework already?                                  │
   ├─ YES → use that framework regardless of what's trendy.       │
   │        Familiarity beats "best tool" under time pressure.    │
   └─ NO  → default to Next.js (React) — largest tutorial/        │
            Stack Overflow surface area, fastest to unblock       │
            a stuck teammate at 2am.
│
AUTH BRANCH (from above):
├─ Team knows Supabase/Firebase already? → use it. Managed auth
│   (magic link or OAuth) ships in under 20 minutes.
├─ Team has zero managed-auth experience? → still use Supabase
│   Auth (below) over rolling your own — the setup cost is lower
│   than the cost of a hand-rolled JWT/bcrypt bug at hour 30.
└─ Absolute last resort only: a single shared password/PIN gate
    for the whole demo workspace, with a giant TODO comment.
    Acceptable ONLY if the pitch does not depend on per-user
    identity being visibly correct.
```

### Recommended Default Stack (when skill overlap doesn't dictate otherwise)

| Layer | Choice | Why this and not the alternative |
|---|---|---|
| Frontend | Next.js (App Router) + TypeScript + Tailwind CSS | SSR/CSR flexibility in one framework, file-based routing removes a whole category of setup decisions, Tailwind removes CSS bikeshedding |
| Backend | Next.js Route Handlers (`app/api/**/route.ts`) | Zero extra server to deploy/manage; same repo, same deploy, same env vars as the frontend |
| Auth | Supabase Auth (magic link or GitHub/Google OAuth) | Managed, no password-hashing code to write, has a generous free tier, SDK is one `npm install` |
| Database | Supabase Postgres | Free hosted Postgres + auto-generated REST/RPC + Realtime channel, avoids running a local DB server during a hackathon |
| Validation | Zod | One schema definition shared between form validation and API input validation |
| Deployment | Vercel (frontend+API) — deploy at hour 0-2, not hour 22 | Free, git-push-to-deploy, catches env/build config problems while there's time to fix them |

This is a *default*, not a mandate — the decision tree above overrides it whenever team skill overlap says otherwise. A team that already knows Django + React should use Django + React; the framework matters far less than shipping the vertical slice.

---

## Phase 2: Execution & Implementation

### 2.1 — Scaffold Command (copy-paste, Next.js + Supabase fast stack)

```bash
# 1. Scaffold the app with every flag decided up front (no interactive prompts to block on)
npx create-next-app@latest hackathon-app \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --use-npm

cd hackathon-app

# 2. Install the fast-stack dependencies in one shot
npm install @supabase/supabase-js @supabase/ssr zod

# 3. Initialize env file immediately — never let a teammate block on "what's the URL again"
cat > .env.local <<'EOF'
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
EOF
echo ".env.local" >> .gitignore

# 4. Commit the empty skeleton immediately, then deploy it — before writing a single feature
git init && git add -A && git commit -m "chore: scaffold skeleton"
git branch -M main
# push to GitHub, then:
npx vercel --yes           # first deploy, links project, gets env vars synced
npx vercel env pull .env.local   # keep local env in sync with the deployed project
```

Why deploy an empty app at hour 0-2: the deploy pipeline (build config, env var wiring, framework auto-detection) is exactly the kind of thing that silently breaks and eats an hour when discovered at hour 22. Discover it now, while it's cheap to fix.

### 2.2 — Minimal Auth Setup (Supabase magic-link, ~20 minutes)

```ts
// src/lib/supabase/client.ts — browser client
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

```ts
// src/lib/supabase/server.ts — server component / route handler client
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => list.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options)),
      },
    }
  )
}
```

```tsx
// src/app/login/page.tsx — the entire login screen
'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const supabase = createClient()

  async function sendMagicLink() {
    await supabase.auth.signInWithOtp({ email })
    setSent(true) // don't bother with error UI yet — happy path first
  }

  if (sent) return <p>Check your email for the login link.</p>
  return (
    <div className="flex flex-col gap-3 p-8 max-w-sm mx-auto">
      <input
        className="border rounded p-2"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <button className="bg-black text-white rounded p-2" onClick={sendMagicLink}>
        Send magic link
      </button>
    </div>
  )
}
```

```ts
// src/middleware.ts — gate protected routes without writing auth logic per-page
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => list.forEach(({ name, value }) => response.cookies.set(name, value)),
    }}
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  return response
}

export const config = { matcher: ['/dashboard/:path*'] }
```

### 2.3 — Seed Script (deterministic demo data, run before every demo rehearsal)

```ts
// scripts/seed.ts — run with: npx tsx scripts/seed.ts
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // service role bypasses RLS for seeding
)

async function seed() {
  // Wipe demo data first so the seed is idempotent — re-runnable at 2am without side effects
  await supabase.from('items').delete().neq('id', 0)

  const { error } = await supabase.from('items').insert([
    { title: 'Demo Item One', status: 'active', owner_email: 'demo@judge.local' },
    { title: 'Demo Item Two', status: 'active', owner_email: 'demo@judge.local' },
    { title: 'Demo Item Three', status: 'pending', owner_email: 'demo@judge.local' },
  ])

  if (error) throw error
  console.log('Seed complete — 3 demo rows inserted.')
}

seed().catch((e) => { console.error(e); process.exit(1) })
```

Run this exact script immediately before demo prep rehearsals so the demo state is always predictable — never demo on organically-accumulated test data full of typos and half-finished flows from 3am debugging.

### 2.4 — One-Page MVP Scope Template (fill this in during Phase 1, before writing code)

```markdown
# MVP Scope — [Project Name]

## One-Sentence Pitch
[What does this do, for whom, in one sentence — this IS the demo narrative]

## Must-Have (the vertical slice — demo is not a demo without these)
- [ ] Feature A: [user can do X end-to-end]
- [ ] Feature B: [user can do Y end-to-end]
- [ ] Auth: [only if the pitch depends on per-user identity being visible]
- [ ] Deployed + reachable on the venue wifi

## Nice-to-Have (cut without hesitation if behind schedule)
- [ ] Feature C: [polish / secondary flow]
- [ ] Feature D: [stretch feature that impresses but isn't the core pitch]
- [ ] Animations / transitions
- [ ] Dark mode

## Explicit Non-Goals (say no now, out loud, so nobody quietly builds these at 3am)
- Multi-tenant support beyond the demo workspace
- Admin panel
- Email notifications
- Anything requiring a second external API beyond [the one core dependency]

## Judging Criteria Mapping (map each rubric line to a Must-Have)
| Rubric criterion | Which Must-Have proves it |
|---|---|
| Technical execution | Feature A + B working live |
| Innovation | [specific mechanism in Feature A] |
| Impact / usefulness | [specific user outcome demoed] |
| Presentation | Demo script (see Phase 3) |

## Hard Deadlines
- Feature-complete (Must-Have only): Hour ___
- Deploy freeze (no risky changes after this): Hour ___
- Demo script rehearsed: Hour ___
- Backup video recorded: Hour ___
```

---

## Phase 3: Automated Verification — Pre-Demo Smoke Test

Run this checklist top-to-bottom starting at the "Deploy freeze" hour from the scope template, on the **deployed URL**, not `localhost`. `localhost` working proves nothing about what judges will see.

1. **Happy path, start to finish, on the deployed URL.** Open a fresh incognito window (no cached session, no dev-tools state) and walk the exact sequence of clicks the demo script will use, from landing page to the final "wow" moment, without touching devtools to fix anything mid-run.
2. **Cold refresh mid-flow.** After reaching a logged-in / stateful screen, hit refresh (F5). Confirm session and data survive — a demo that breaks on an accidental refresh in front of judges is a common, entirely preventable failure.
3. **Re-run from a second, unauthenticated browser/profile.** Confirms the app doesn't secretly depend on cached auth tokens, seeded localStorage, or a cookie that only exists on the dev machine.
4. **Airplane-mode / venue-wifi simulation.** Throttle to "Slow 3G" in devtools network tab, or physically test on a phone hotspot with poor signal. Hackathon venue wifi is notoriously congested — confirm the app has *some* degraded behavior (a loading spinner, a retry, a cached fallback) rather than an infinite hang or a blank white screen.
5. **Offline fallback plan exists.** If the core demo depends on a live network call (LLM API, external data API), have a pre-recorded response or a local mock ready to swap in via one env var / feature flag, in case venue wifi fails entirely during the live demo slot.
6. **Seed script re-run confirms idempotency.** Run the seed script twice in a row; the second run should not error or duplicate rows. Judges have watched teams demo a crashed seed script by accident — don't be that team.
7. **Mobile viewport check.** Resize to a phone width (375px) at minimum — many demo setups end up screen-mirrored from a phone, or a judge asks to try it on their own device.
8. **Console is clean of red errors** on every screen the demo script visits (open devtools, walk the flow, watch the console — a wall of red errors visible on a projector undermines confidence even if the feature technically works).
9. **Environment variables verified on the deployed platform**, not just locally — a `.env.local` value that was never added to the Vercel/Render dashboard is the single most common "works on my machine" hackathon failure.
10. **Time the happy path.** If it takes longer than the judging slot allows (commonly 3-5 minutes total including Q&A), cut a step from the demo script, not from the checklist.

A build that fails any of items 1-3 is **not demo-ready regardless of feature count** — fix these before adding anything else, even Must-Have features still on the board.

---

## Phase 4: Rollback & Self-Healing

Time pressure creates a specific, predictable failure mode: a team discovers close to the deadline that a chosen library, API, or approach is broken or misbehaving, and burns the remaining hours trying to debug it instead of routing around it. Treat this as an operational trigger, not a coding problem.

### Decision Rule

**If a blocking bug has not yielded to a fix attempt within 30 minutes (or 15 minutes inside the last 4 hours of the clock), stop debugging and downgrade the feature instead.** This is a hard rule enforced by the clock, not by how close the fix "feels."

### Rollback Ladder (attempt in order, do not skip to "cut the feature" prematurely, but do not linger on step 1 past its time box)

1. **Swap the library for a simpler / more battle-tested one.** e.g., a fancy state-management library causing sync bugs → drop to plain `useState`/`useContext`. A charting library with a broken build → drop to a static image or a plain HTML `<table>`.
2. **Mock the broken dependency instead of fixing it.** If a third-party API is flaky or rate-limited near demo time, hardcode a realistic mocked response behind the same function signature, gated by an env flag (`USE_MOCK_API=true`), so the rest of the app is unaffected and the mock can be flipped back if the real thing recovers before judging.
3. **Feature-flag the broken feature out of the demo path entirely.** Wrap it in a boolean check (env var, or even a hardcoded `const SHOW_BROKEN_FEATURE = false`) so it's hidden from the UI the demo walks through, rather than left visibly half-working where a judge might click into it.
4. **Revert to the last known-good deployed commit.** If a change introduced regressions across multiple screens close to the deadline, `git revert` (or redeploy the last known-good Vercel deployment via its dashboard) is faster and safer than chasing the regression live.
5. **Cut the feature from the demo script and the pitch, out loud, as a team decision.** Update the MVP scope template's Must-Have list to reflect reality. A confidently demoed smaller product beats a nervously demoed broken bigger one.

```ts
// Feature-flag pattern — wrap any at-risk feature so it can be pulled from the
// demo path in seconds without touching the underlying (possibly broken) code.
const FEATURE_FLAGS = {
  liveCollaboration: process.env.NEXT_PUBLIC_FF_LIVE_COLLAB === 'true',
  aiSummary: process.env.NEXT_PUBLIC_FF_AI_SUMMARY === 'true',
} as const

// In the component:
{FEATURE_FLAGS.aiSummary && <AiSummaryPanel />}
// Flip NEXT_PUBLIC_FF_AI_SUMMARY=false in the deployed env and redeploy —
// or keep a pre-built "safe" deployment pinned and swap the demo URL if
// something breaks in the last hour.
```

```bash
# Fast rollback to last known-good deployment (Vercel)
npx vercel ls                          # list recent deployments
npx vercel rollback <deployment-url>   # promote a previous good deployment instantly
```

### Self-Healing Habits That Prevent the Crisis in the First Place

- Tag a known-good commit right after every successful smoke test (`git tag demo-safe-hour-18`) so "revert to last known good" is a one-command operation, not an archaeology exercise.
- Never merge an at-risk experimental change directly onto the branch the demo will run from in the final 3 hours — branch it, prove it works, then merge.
- Keep the mock-data path (`USE_MOCK_API`) wired from the start (Phase 2), not bolted on in a panic — a fallback built calmly at hour 3 is reliable; one built in a panic at hour 23 is itself a new source of bugs.

---

## Common Anti-Patterns vs Gold Standard

| # | Anti-Pattern | Why It Kills Hackathon Velocity | Gold Standard |
|---|---|---|---|
| 1 | Building auth (password hashing, session tokens, reset flows) from scratch | Hours spent on a solved problem invisible to judges; high bug surface (security bugs, session bugs) right before demo | Use a managed auth provider (Supabase Auth / Firebase Auth / Clerk) — magic link or OAuth in under 20 minutes |
| 2 | Perfecting styling/animations before the core flow works end-to-end | Polish on a broken flow is wasted the moment the flow breaks; judges reward function over form first | Functional-first: get the ugly-but-working vertical slice done, then spend the Polish phase (see timeline) on styling |
| 3 | Choosing the "best" or trendiest stack the team has never used | Every unfamiliar API becomes a Stack-Overflow-at-2am risk with no teammate who can unblock it | Choose the stack with the highest team skill overlap, per the Phase 1 decision tree, even if it's "boring" |
| 4 | Designing a fully normalized, future-proof database schema | Time spent modeling hypothetical future features that will never be built in this event | Design the schema for exactly the queries the demo needs today; add a column later if a slice needs it |
| 5 | Deploying for the first time in the last 2 hours | Deploy/build/env-var issues are common and eat exactly the buffer time that no longer exists | Deploy an empty skeleton at hour 0-2 (Phase 2.1); redeploy continuously after that so it's never a novel step |
| 6 | Debugging a broken third-party library for hours right before the deadline | Sunk-cost spiral; the clock does not care how close the fix feels | Apply the Rollback Ladder (Phase 4): mock it, flag it off, or cut it within the 30-minute box |
| 7 | Writing the demo script and rehearsing it once, right before going on stage | Under adrenaline, an unrehearsed script reveals gaps (dead clicks, forgotten steps, silence while something loads) live | Rehearse the demo script 3+ times against the actual deployed build, timed, before the demo prep hour ends |
| 8 | Treating "nice-to-have" features as equal priority to "must-have" ones in daily standup/tracking | No clear cut list when time runs short, leading to a scramble that touches everything and finishes nothing | Keep the Must-Have/Nice-to-Have split visible (Phase 2.4 template) and re-confirm it every few hours as the source of truth for what to cut |

---

## Pre-Flight Checklist

Complete before writing the first feature line of code (target: within the Setup block of the timeline).

- [ ] One-sentence pitch is written down and every teammate can say it identically.
- [ ] MVP scope template (Phase 2.4) is filled in with Must-Have / Nice-to-Have / Non-Goals, agreed by the whole team.
- [ ] Stack chosen via the Phase 1 decision tree, with an explicit answer for auth / real-time / ML — not "we'll figure it out."
- [ ] Repository created, skeleton scaffolded, and pushed to a shared remote (GitHub) within the first 30 minutes.
- [ ] Empty/skeleton app deployed to the hosting platform (Vercel/Render/etc.) and reachable via a public URL before any feature work starts.
- [ ] Environment variables set in both `.env.local` and the deployed platform's dashboard, and confirmed to match.
- [ ] Roles/ownership assigned per vertical slice (who owns Feature A end-to-end, who owns Feature B) to avoid two people blocking on the same file.
- [ ] Hard deadlines from the scope template (feature-complete hour, deploy freeze hour, demo-rehearsed hour, backup-video hour) are written on a visible shared timer/doc, not just "in someone's head."

## Post-Flight Checklist

Complete during the Demo Prep block, before the judging slot.

- [ ] Full Phase 3 smoke test executed on the deployed URL (not localhost) with all 10 items passing.
- [ ] Seed script re-run immediately before final rehearsal so demo data is clean and predictable.
- [ ] Demo script written as an explicit numbered sequence of clicks/screens, mapped to the judging-criteria table in the scope template.
- [ ] Demo script rehearsed at least 3 times end-to-end against the real deployed build, timed to fit the judging slot.
- [ ] Backup screen-recording video of a fully successful run captured and saved locally (and off-device, e.g. uploaded to Drive/USB) in case live wifi or the live app fails during judging.
- [ ] Feature flags for any at-risk/rollback-ladder features (Phase 4) are set to their safe/demo-ready values in the deployed environment.
- [ ] A known-good commit/deployment is tagged and its rollback command (`vercel rollback ...`) is known by at least two teammates, not just whoever wrote it.
- [ ] Non-Goals list reviewed once more so nobody improvises an unrehearsed feature live in front of judges.
- [ ] Charging cables, laptop battery, and a mobile hotspot backup are ready in case venue wifi or power is unreliable during the actual judging walk.
- [ ] Whoever is presenting has practiced the one-sentence pitch and the Q&A answers for "how does X work" and "what would you build next," out loud, at least once.
