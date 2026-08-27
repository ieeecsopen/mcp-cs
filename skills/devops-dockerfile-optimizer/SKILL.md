---
name: devops-dockerfile-optimizer
description: >
  Activate when the user asks to "optimize this Dockerfile," "make my docker
  image smaller," "reduce docker image size," "speed up docker build," "fix
  slow docker rebuilds," "my Docker builds are slow / cache always misses,"
  "convert to multi-stage build," "harden my container / run as non-root,"
  or pastes a `Dockerfile` / `Containerfile` / `docker-compose.yml` for
  review. Also trigger on symptom signatures without an explicit ask: builds
  that re-run `npm install` / `pip install` / `go mod download` on every
  source change (cache invalidated on unrelated edits), `docker images`
  showing multi-GB final images for a simple app, `docker history` showing a
  single-digit number of layers each hundreds of MB, CI logs showing rebuild
  times minutes long with no dependency changes, `dive` CI gate failures on
  wasted-bytes efficiency score, or containers running as `USER root` /
  UID 0. File types in scope: `Dockerfile`, `Dockerfile.*`, `*.dockerfile`,
  `Containerfile`, `.dockerignore`. Do NOT trigger for orchestration-only
  questions (Kubernetes manifests, Helm charts, docker-compose networking)
  that don't involve the image build itself.
version: 1.0.0
author: IEEE Computer Society of SLIIT
tags:
  - docker
  - devops
  - dockerfile
  - multi-stage-build
  - layer-caching
  - image-size-optimization
  - container-security
  - ci-cd
---

# Secure Multi-Stage Dockerfile Optimizer

## Mission

Turn slow, bloated, insecure `Dockerfile`s into fast-to-build, small,
cache-friendly, non-root production images — without changing what the
application does. Every recommendation in this skill must be justified by
one of three measurable outcomes: **(1) faster builds** (higher cache-hit
rate), **(2) smaller final images** (fewer MB shipped and pulled), or
**(3) a reduced attack surface** (fewer packages, no root, no build
toolchain in the runtime image). If a change does not move one of those
three needles, it does not belong in the diff.

---

## Mental Model & Theoretical Foundations

### 1. Docker layer caching mechanics

Every instruction in a `Dockerfile` (`FROM`, `RUN`, `COPY`, `ADD`, `ENV`,
etc.) produces one immutable, content-addressed **layer**. When you rebuild
an image, the builder walks the instruction list top to bottom and, for
each instruction, checks whether it can reuse a cached layer:

- `FROM` — cache key is the base image digest.
- `RUN` — cache key is the *exact command string* plus the parent layer's
  cache key. Change one character in the `RUN` line, or invalidate the
  parent, and the cache misses.
- `COPY` / `ADD` — cache key is a checksum of the *file contents and
  metadata being copied* plus the parent layer's cache key. If any byte in
  the copied file set changes, this layer and every layer after it misses.

**The critical rule: cache invalidation is a one-way cascade.** The instant
one layer misses, Docker recompiles that layer *and every layer that comes
after it* — even if those later layers' own inputs did not change. This is
why instruction *order* is the single highest-leverage lever you have:

> Put what changes **least often** at the top, and what changes **most
> often** at the bottom.

For a typical app, source code changes on every commit; the dependency
manifest (`package.json`, `requirements.txt`, `go.mod`, `pom.xml`) changes
rarely. So dependency installation must be its own layer, built from
*only* the manifest files, positioned before the source code is copied in.
Get this ordering wrong (e.g. `COPY . .` before `RUN npm install`) and
every single source edit forces a full dependency reinstall — the single
most common cause of "why does my Docker build take 4 minutes for a
one-line change."

### 2. Multi-stage build theory

A multi-stage build declares **more than one `FROM`** in the same
`Dockerfile`. Each `FROM` starts a fresh, independent build stage with its
own filesystem. Stages can be named (`FROM node:20 AS builder`) and later
stages can selectively pull *specific files* out of earlier stages with
`COPY --from=<stage>`, discarding everything else.

This decouples two things that a naive single-stage build conflates:

- **The build environment**: compilers, SDKs, dev headers, `node_modules`
  with devDependencies, build caches — everything needed to *produce* the
  artifact, but never needed to *run* it.
- **The runtime environment**: the compiled binary, the transpiled `dist/`
  folder, the production-only dependencies — the minimum needed to
  *execute* the artifact.

Only the runtime environment ships. The builder stage's multi-hundred-MB
toolchain (gcc, python-dev, the full `node_modules` tree, `.git`, test
fixtures) is discarded entirely once the final image is assembled, because
Docker only materializes the layers reachable from the final stage.

### 3. Why Alpine isn't always smaller in practice

Alpine Linux's small footprint comes from swapping `glibc` for `musl
libc` and BusyBox for GNU coreutils. This is a real trade-off, not a free
lunch:

- **musl vs glibc ABI differences**: prebuilt native binaries and Node.js
  native addons (`node-gyp` modules), Python C-extension wheels, and Go
  binaries built with `CGO_ENABLED=1` against glibc will not run on musl
  without a rebuild from source — which then requires pulling in the full
  `build-base` toolchain into the Alpine image anyway, sometimes making the
  *effective* build environment larger and slower than starting from a
  glibc-based slim image.
- **DNS resolution quirks**: musl's resolver historically diverges from
  glibc's on `/etc/resolv.conf` edge cases (multiple search domains, some
  `ndots` behavior), which has caused intermittent DNS failures for
  services under Kubernetes.
- **Missing packages**: many vendor-distributed `.deb`/`.rpm`-only tools,
  and some monitoring/APM agents, ship no musl-compatible build at all.
- **The practical guidance**: prefer `-slim` (Debian-based, glibc, stripped
  of docs/man-pages) variants for languages with heavy native dependency
  ecosystems (Python data/ML stacks, Node with native addons). Reach for
  `alpine` when the toolchain is pure-Go, pure-static, or you have already
  verified every dependency has musl wheels/binaries. Always measure the
  *actual* final image size — don't assume "alpine" in the tag name means
  "smaller than everything else."

### 4. The security angle of minimal base images

Every package in a base image is attack surface: a CVE in a shared library
you never call is still a CVE in your image, still shows up in
`docker scan` / `trivy` / `grype` output, still has to be patched, and
still is a real exploitation path if an attacker gets code execution inside
the container (privilege escalation via a setuid binary, a shell for
pivoting, a package manager for pulling in more tooling). Multi-stage
builds and minimal bases (`distroless`, `alpine`, `-slim`, or `scratch`
for static binaries) reduce this surface directly:

- No shell (`distroless`, `scratch`) means a remote-code-execution bug
  cannot trivially `sh -c` its way to a reverse shell or package install.
- No package manager means an attacker who gets a foothold cannot
  `apt install` reconnaissance or exfiltration tools.
- Fewer packages means fewer CVEs to track and patch, and a smaller
  `SBOM`.
- Running as a non-root `USER` means a container-escape or
  write-primitive bug does not hand the attacker root inside the
  container (and, depending on runtime config, potentially on the host).

Minimal base images are therefore not merely a size optimization — they
are a defense-in-depth control that reduces both the *likelihood* and the
*blast radius* of a successful exploit.

### Two-stage build flow (ASCII diagram)

```
┌───────────────────────────────────────────┐        ┌──────────────────────────────────────┐
│  STAGE 1 — "builder"                       │        │  STAGE 2 — "runner" (final image)     │
│  FROM node:20-bookworm AS builder          │        │  FROM node:20-bookworm-slim AS runner │
│                                             │        │                                        │
│  ┌───────────────────────────────────┐     │        │  ┌──────────────────────────────┐      │
│  │ Full toolchain                     │     │        │  │ Minimal runtime only          │      │
│  │  - gcc / make / python3 (native    │     │        │  │  - node runtime               │      │
│  │    addon build deps)               │     │        │  │  - production node_modules    │      │
│  │  - devDependencies                 │     │        │  │  - compiled dist/ output       │      │
│  │  - TypeScript compiler             │     │        │  │  - non-root USER              │      │
│  │  - test runner, linters            │     │        │  │  - HEALTHCHECK                │      │
│  │  - source .ts files                │     │        │  └──────────────────────────────┘      │
│  └───────────────────────────────────┘     │        │             ▲                            │
│                 │ compile/build              │        │             │  COPY --from=builder      │
│                 ▼                            │        │             │  /app/dist ./dist         │
│  ┌───────────────────────────────────┐     │        │             │  COPY --from=builder      │
│  │ /app/dist/  (compiled JS output)   │─────┼────────┼─────────────┘  /app/node_modules ...    │
│  └───────────────────────────────────┘     │        │                                        │
│                                             │        │  Everything above the COPY --from      │
│  DISCARDED — never shipped:                │        │  lines is UNREACHABLE from this stage  │
│   gcc, make, devDependencies, .ts source,  │        │  and is never materialized in the      │
│   test fixtures, build caches, .git        │        │  final image or its layers.            │
└───────────────────────────────────────────┘        └──────────────────────────────────────┘
        ~1.2 GB intermediate stage                            ~180 MB final image
        (never pushed to a registry)                          (this is what ships)
```

---

## Phase 1: Discovery & Static Analysis

Before touching a single line, measure the current state so you have a
before/after to justify the change and a target to verify against.

```bash
# 1. Build the image as-is (baseline) and tag it for comparison.
docker build -t myapp:baseline .

# 2. Inspect per-layer size breakdown — find which instructions are the
#    heaviest contributors to total image size.
docker history myapp:baseline
docker history --no-trunc --format '{{.Size}}\t{{.CreatedBy}}' myapp:baseline

# 3. Deep layer analysis with dive — shows wasted space (files
#    duplicated/overwritten across layers) and an efficiency score.
#    https://github.com/wagoodman/dive
dive myapp:baseline
#   Look at:
#     - "Image efficiency score" (aim for >95%)
#     - "Wasted space" (files present in an earlier layer, then
#       modified/deleted in a later one — the earlier copy is dead weight
#       that still ships)
#   CI-friendly non-interactive mode with a hard budget gate:
CI=true dive myapp:baseline --highestUserWastedPercent 0.05

# 4. Lint the Dockerfile itself for anti-patterns before rebuilding.
#    https://github.com/hadolint/hadolint
hadolint Dockerfile

# 5. Check .dockerignore completeness — an incomplete .dockerignore is the
#    #1 silent cause of both cache misses and bloated build contexts.
cat .dockerignore 2>/dev/null || echo "MISSING .dockerignore — build context includes everything"

# 5a. Measure the actual build context size sent to the daemon — this
#     number should be KB/low-MB, not hundreds of MB. A huge context here
#     means .dockerignore is missing entries (node_modules, .git, dist,
#     coverage, *.log, .env are the usual leaks).
docker build --no-cache -t myapp:context-check . 2>&1 | grep -i "sending build context"

# 6. Confirm final image size against expectations.
docker images myapp --format 'table {{.Repository}}\t{{.Tag}}\t{{.Size}}'
```

**What to look for while triaging `docker history` output:**
- A `COPY` or `RUN npm install` layer sized in the hundreds of MB sitting
  *above* a `COPY . .` line → dependency layer is being invalidated by
  source changes; reorder.
- Multiple `RUN apt-get install` layers each carrying their own `apt`
  cache → not chaining `apt-get update && apt-get install && rm -rf
  /var/lib/apt/lists/*` in a single `RUN`.
- A single final `RUN` layer that's unexpectedly huge → build artifacts
  or package manager caches not cleaned up in the same layer they were
  created in (cleanup in a *later* layer does not shrink earlier layers).

---

## Phase 2: Execution & Implementation

### Reference implementation: production Node.js multi-stage Dockerfile

```dockerfile
# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# STAGE 1: "deps" — install ALL dependencies (incl. devDependencies) in a
# layer keyed ONLY to the lockfile. This is the layer-cache-friendliness
# core trick: as long as package.json/package-lock.json don't change,
# Docker reuses this entire stage's cache regardless of how much source
# code churns.
# ---------------------------------------------------------------------------
FROM node:20-bookworm-slim AS deps
WORKDIR /app

# Copy ONLY the manifest + lockfile first — NOT the source tree.
# Rationale: COPY's cache key is a checksum of the copied files. If we
# copied source here too, any source edit would invalidate this layer and
# force a full `npm ci` on every rebuild. By copying just these two files,
# this layer's cache key changes ONLY when a dependency actually changes.
COPY package.json package-lock.json ./

# npm ci (not npm install) for reproducible, lockfile-exact installs in CI/
# production builds. This is the expensive step we are protecting with the
# cache-key isolation above.
RUN npm ci

# ---------------------------------------------------------------------------
# STAGE 2: "builder" — compile/transpile the application. Reuses the deps
# layer's node_modules, then layers the source copy + build ON TOP, so a
# source-only change invalidates only these last two layers, not the
# npm ci layer.
# ---------------------------------------------------------------------------
FROM node:20-bookworm-slim AS builder
WORKDIR /app

# Pull the already-installed node_modules from the deps stage instead of
# reinstalling. Cheap COPY between stages — no network, no npm resolution.
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./

# NOW copy source. This is intentionally the LAST thing before the build
# step, and deliberately AFTER every dependency-related instruction above,
# so that editing src/ never invalidates the npm ci work done in "deps".
COPY tsconfig.json ./
COPY src ./src
COPY public ./public

# Compile TypeScript -> dist/, bundle assets, etc. Only THIS layer and the
# final COPY re-run when only source changes — npm ci above stays cached.
RUN npm run build

# Prune devDependencies now, inside the builder stage, so what we copy out
# next is already production-only (belt-and-braces alongside stage 3's own
# minimal COPY list).
RUN npm prune --omit=dev

# ---------------------------------------------------------------------------
# STAGE 3: "runner" — the image that actually ships. Starts from a FRESH,
# minimal base — none of the builder stage's layers (TypeScript compiler,
# devDependencies, source .ts files, build caches) are reachable from here,
# so they are never materialized into this image or pushed to a registry.
# ---------------------------------------------------------------------------
FROM node:20-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
# Disable npm update checks / telemetry noise in production containers.
ENV NPM_CONFIG_UPDATE_NOTIFIER=false

# Copy ONLY the pruned production node_modules and the compiled output —
# never the source .ts, never devDependencies, never the compiler.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

# Create and switch to a dedicated, unprivileged, non-root user. Never ship
# a production container running as root: a container-escape or
# arbitrary-write vulnerability in the app becomes a root compromise
# instead of a contained, unprivileged one.
RUN groupadd --gid 1001 nodejs \
  && useradd --uid 1001 --gid nodejs --shell /bin/false --no-create-home appuser
USER appuser

EXPOSE 3000

# Container-level liveness signal so orchestrators (Docker Swarm, ECS,
# Kubernetes via a translated probe) can detect a hung/unresponsive
# process, not just a crashed one.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', r => process.exit(r.statusCode===200?0:1)).on('error', () => process.exit(1))"

CMD ["node", "dist/index.js"]
```

### Why this ordering, explicitly

| Instruction order | Reason |
|---|---|
| `package.json`/lockfile copied before `RUN npm ci` | Isolates the cache key of the expensive install step to dependency files only. |
| `npm ci`, not `npm install` | Deterministic install from the lockfile; fails loudly if lockfile and manifest disagree, instead of silently rewriting the lockfile inside CI. |
| Source (`COPY src ./src`) copied *after* `node_modules` restore | Guarantees the dependency-install layer survives every source-only commit. |
| `npm prune --omit=dev` in `builder`, not `runner` | Keeps the pruning logic (and its dependency on the full builder toolchain) out of the final stage entirely. |
| Fresh `FROM node:20-bookworm-slim AS runner` (not `FROM builder`) | Prevents anything from the builder stage — compiler, devDependencies, `.ts` sources — from being reachable in the final image. |
| `USER appuser` set *after* all `COPY`/`RUN` needing elevated file permissions | File ownership operations (`COPY`, package installs) generally need root; drop privileges only once no more privileged steps remain. |
| `HEALTHCHECK` near the end | Purely metadata; placement doesn't affect caching, but grouping it with `CMD` keeps runtime-behavior instructions together for readability. |

### Reference `.dockerignore`

```gitignore
# .dockerignore — keep the build context tiny AND prevent irrelevant
# files from ever contributing to a COPY's cache-key checksum.

# Dependency directories — reinstalled inside the image, never copied in.
node_modules
**/node_modules
venv
.venv
__pycache__
*.pyc

# Version control — large, irrelevant to the build, and changes on every
# commit (which would otherwise poison ADD/COPY cache keys if ever
# accidentally included by a broad COPY . .).
.git
.gitignore
.gitattributes

# Build output already produced locally — must be rebuilt inside the
# image, not copied stale from the host.
dist
build
out
coverage
*.tsbuildinfo

# Editor/OS cruft
.vscode
.idea
*.swp
.DS_Store

# Secrets and environment files — NEVER let these enter the build context;
# a leaked .env baked into a layer is a permanent, hard-to-purge secret
# exposure even if a later layer "deletes" it.
.env
.env.*
!.env.example
*.pem
*.key

# Docker/CI meta-files that don't belong inside their own build context.
Dockerfile*
.dockerignore
docker-compose*.yml
.github
.gitlab-ci.yml

# Logs, temp files, test artifacts
*.log
tmp
.cache
.next/cache
```

---

## Phase 3: Automated Verification

Run all of the following after every Dockerfile change. None of them are
optional — a Dockerfile that "looks right" and fails any of these checks
is not done.

### 3.1 Lint with hadolint

```bash
hadolint Dockerfile
```

Rules that matter most (do not suppress these without a documented reason
in a comment):
- **DL3006** — Always tag the version of an image explicitly (`FROM
  node:20-bookworm-slim`, never bare `FROM node`). An untagged/`:latest`
  base silently changes under you and breaks reproducibility.
- **DL3008 / DL3018 / DL3013** — Pin apt/apk/pip package versions
  (`apt-get install -y package=1.2.3-1`). Unpinned installs are a supply
  -chain and reproducibility risk.
- **DL3009** — Delete the apt-get lists after installing
  (`rm -rf /var/lib/apt/lists/*`) in the *same* `RUN` layer as the install.
- **DL3025** — Use JSON array (`exec`) form for `CMD`/`ENTRYPOINT`, not
  shell form — shell form runs your process as PID 1's child under `/bin/
  sh -c`, which swallows signals (SIGTERM never reaches the app,
  containers hang on `docker stop` until the kill timeout).
- **DL3042** — Avoid `--no-cache-dir`-less `pip install` bloating the
  layer with pip's download cache.
- **DL3059** — Multiple consecutive `RUN` instructions that could be
  consolidated — each avoidable `RUN` is an avoidable extra layer.
- **DL4006** — Set `SHELL` with `-o pipefail` if piping into `RUN` (e.g.
  `curl ... | sh`), so a failed `curl` doesn't silently succeed the layer.
- **SC2086** (ShellCheck passthrough) — unquoted variables in `RUN`
  instructions; can cause word-splitting bugs in install scripts.

Treat hadolint as a CI gate, not a suggestion:

```bash
hadolint --failure-threshold warning Dockerfile
```

### 3.2 Verify cache-hit behavior with a double build

The whole point of Phase 2's reordering is that a second build with only
source changes should be near-instant on the dependency-install step.
Prove it:

```bash
# First build — cold, populates the cache. Time it for the baseline.
time docker build -t myapp:verify .

# Touch ONLY a source file (simulate a typical commit) — do NOT touch
# package.json or the lockfile.
touch src/index.ts

# Second build — this MUST show "CACHED" for the deps/npm-ci layer.
docker build -t myapp:verify . 2>&1 | tee build2.log
grep -A1 "npm ci" build2.log | grep -q "CACHED" \
  && echo "PASS: dependency layer cache hit as expected" \
  || echo "FAIL: dependency layer was rebuilt on a source-only change — check COPY ordering"
```

With BuildKit's default output, look for `CACHED` next to the `RUN npm ci`
step specifically — not just "some layers were cached." If that exact step
recomputes on a source-only change, the ordering fix in Phase 2 was not
applied correctly (or a broader `COPY . .` earlier in the file is still
pulling source into the dependency stage's cache key).

### 3.3 Image size assertion

Set a real, project-specific byte budget and fail the build/CI step if the
final image exceeds it:

```bash
# Get final image size in bytes.
SIZE_BYTES=$(docker inspect myapp:verify --format='{{.Size}}')
SIZE_MB=$(( SIZE_BYTES / 1024 / 1024 ))
THRESHOLD_MB=250   # set per project: a slim Node API might budget 200-300MB;
                    # a Python+ML image might budget 1-2GB; a static Go
                    # binary on distroless/scratch should budget <50MB.

echo "Final image size: ${SIZE_MB}MB (threshold: ${THRESHOLD_MB}MB)"
if [ "$SIZE_MB" -gt "$THRESHOLD_MB" ]; then
  echo "FAIL: image exceeds size budget (${SIZE_MB}MB > ${THRESHOLD_MB}MB)"
  exit 1
fi
echo "PASS: image within size budget"
```

Also re-run `dive` non-interactively as a hard efficiency gate in CI:

```bash
CI=true dive myapp:verify --highestUserWastedPercent 0.05 --lowestEfficiency 0.95
```

### 3.4 Confirm non-root and no leaked build tooling

```bash
# Must NOT print "root" / "0".
docker run --rm myapp:verify id -u

# Must NOT find compilers, devDependencies, or source .ts files in the
# final image — if it does, the multi-stage boundary is leaking.
docker run --rm myapp:verify sh -c "which gcc tsc 2>/dev/null; ls node_modules | grep -i typescript" \
  && echo "FAIL: build-only tooling leaked into runtime image" \
  || echo "PASS: no build tooling found in final image"
```

---

## Phase 4: Rollback & Self-Healing

Diagnostic playbook for when the optimized Dockerfile misbehaves.

### 4.1 "Cache still invalidates on every build even after reordering"

1. Check for a `COPY . .` or `ADD . .` anywhere *before* the dependency
   install step — even one, anywhere earlier in the same stage, pulls
   every tracked file's checksum into that layer's cache key. Search for
   it explicitly:
   ```bash
   grep -n "^COPY \. \.\|^ADD \. \." Dockerfile
   ```
2. Check `.dockerignore` for missing entries — if `.git` isn't excluded,
   *any* commit (even to unrelated files, even just `git commit --amend`)
   changes `.git/index`/`HEAD`, and if any `COPY . .` reaches it, that's
   an invalidation on every single commit regardless of source changes.
3. Confirm the manifest `COPY` is copying the *exact* files needed and
   nothing more — `COPY package.json ./` without also copying
   `package-lock.json` (or vice versa) can force `npm install` to
   re-resolve non-deterministically, which also affects reproducibility.
4. Check whether `ARG`/`ENV` values that change per-build (build
   timestamps, git SHAs, cache-busting args) are declared *before* the
   dependency-install `RUN` — any `ARG`/`ENV` used inside a `RUN`
   command's resolved string becomes part of that layer's cache key. Move
   volatile build args below the dependency install, or pass them only to
   later stages.
5. Verify the base image tag isn't floating (`:latest`, or a
   frequently-republished tag) — a changed base image digest invalidates
   *everything* beneath the `FROM` line, even with perfect instruction
   ordering. Pin to a digest for maximum stability if this recurs:
   `FROM node:20-bookworm-slim@sha256:<digest>`.

### 4.2 "Final image is still bloated after moving to multi-stage"

1. Confirm the final stage's `FROM` starts a genuinely fresh base and is
   not accidentally `FROM builder` (which inherits the *entire* builder
   filesystem, defeating the multi-stage boundary entirely):
   ```bash
   grep -n "^FROM" Dockerfile
   ```
2. Audit every `COPY --from=` in the final stage — a copy like
   `COPY --from=builder /app ./` (copying the whole builder `/app`
   instead of just `/app/dist`) drags devDependencies, source, and build
   caches straight into the runtime image.
3. Check for dependency pruning that happened in the *wrong* stage or
   *wrong* layer — `npm prune --omit=dev` run in a `RUN` layer that comes
   *after* the `node_modules` were already `COPY`'d in a separate earlier
   layer does not shrink that earlier layer; Docker layers are
   append-only diffs, so deleting a file in a later layer keeps the
   original file's bytes in the image (visible as "wasted space" in
   `dive`). Prune *before* copying out, in the same stage that produced
   the files.
4. Run `dive` again and inspect the specific layer breakdown to attribute
   size precisely:
   ```bash
   dive myapp:latest
   ```
5. Check for package-manager caches not cleaned within the same `RUN`
   instruction that created them:
   ```dockerfile
   # BAD — cache directory persists in this layer even after later cleanup
   RUN apt-get update && apt-get install -y curl
   RUN rm -rf /var/lib/apt/lists/*   # too late — different layer

   # GOOD — clean up inside the SAME RUN/layer that created the cache
   RUN apt-get update \
     && apt-get install -y --no-install-recommends curl \
     && rm -rf /var/lib/apt/lists/*
   ```
6. For compiled languages, confirm static linking / stripped symbols
   where applicable (`go build -ldflags="-s -w"`) and consider `scratch`
   or `distroless/static` as the final base if there truly are zero
   runtime shared-library dependencies.

### 4.3 "Build works locally but fails or behaves differently in CI"

1. Confirm CI is using BuildKit (`DOCKER_BUILDKIT=1` or a builder that
   defaults to it) — legacy builder cache semantics differ and can mask
   or produce different cache-hit behavior than local Docker Desktop.
2. Confirm CI actually has a cache to hit — ephemeral CI runners with no
   persisted layer cache between runs will *always* show cold-build
   times; that's expected and not a Dockerfile bug. Wire up
   `--cache-from`/`--cache-to` (registry cache) or a CI-native layer
   cache before judging build speed in that environment.

---

## Common Anti-Patterns vs Gold Standard

| # | Anti-pattern | Gold standard | Why it matters |
|---|---|---|---|
| 1 | `COPY . .` then `RUN npm install` | `COPY package*.json ./` → `RUN npm ci` → `COPY . .` | Isolates the expensive install step's cache key to the lockfile only; any source edit no longer forces a reinstall. |
| 2 | Single-stage build: one `FROM`, compiler and app shipped together | Multi-stage: `builder` stage compiles, minimal `runner` stage ships only the artifact | Keeps compilers, devDependencies, and source out of the attack surface and out of the pushed image size. |
| 3 | Container runs as `USER root` (the default if unset) | Explicit `RUN useradd ...` + `USER appuser` before `CMD` | Limits blast radius of a code-execution or path-traversal bug inside the container. |
| 4 | `FROM node` / `FROM python` (no tag, defaults to `:latest`) | `FROM node:20-bookworm-slim` (explicit version + variant), pinned to a digest for max reproducibility | Untagged/`:latest` base images change silently over time, breaking reproducible builds and cache assumptions. |
| 5 | Separate `RUN apt-get update` and `RUN apt-get install` in different layers, no cleanup | Single chained `RUN apt-get update && apt-get install -y --no-install-recommends pkg && rm -rf /var/lib/apt/lists/*` | A stale `apt-get update` layer can be cached independently of the install list, silently installing outdated/wrong package versions; uncombined layers also leak apt cache bytes into the image permanently. |
| 6 | Missing or incomplete `.dockerignore` (whole repo incl. `.git`, `node_modules` sent as build context) | Explicit `.dockerignore` excluding VCS, dependency dirs, build output, secrets | Shrinks build-context transfer time and prevents irrelevant/volatile files from poisoning `COPY .` cache keys. |
| 7 | `CMD npm start` (shell form) | `CMD ["node", "dist/index.js"]` (exec/JSON array form) | Shell form runs the process as a child of `/bin/sh -c`, which does not forward `SIGTERM`; containers hang until the forced-kill timeout on every `docker stop`/rolling deploy. |
| 8 | Secrets passed via `ARG`/`ENV` baked into a layer (`ARG API_KEY`, `ENV API_KEY=$API_KEY`) | `RUN --mount=type=secret,id=api_key` (BuildKit secret mount) or inject at runtime via orchestrator secrets | Build-time `ARG`/`ENV` values are permanently readable in `docker history`/layer metadata even if a later layer "unsets" them. |
| 9 | No `HEALTHCHECK` — orchestrator only knows the process crashed, not that it's hung | `HEALTHCHECK --interval=30s --timeout=3s CMD curl -f http://localhost:PORT/health \|\| exit 1` | Lets the orchestrator detect and restart hung-but-alive containers, not just crashed ones. |

---

## Pre-Flight Checklist

Confirm every item before beginning the optimization pass:

- [ ] Captured baseline `docker images` size and `docker history` output
      for before/after comparison.
- [ ] Ran `dive` on the current image and noted the efficiency score and
      wasted-space figure.
- [ ] Ran `hadolint Dockerfile` on the current file and recorded existing
      warnings/errors.
- [ ] Confirmed a `.dockerignore` exists and diffed it against the
      reference template above for gaps (`.git`, `node_modules`, `.env`).
- [ ] Identified the language/framework's dependency manifest file(s)
      (`package.json`+lock, `requirements.txt`/`poetry.lock`, `go.mod`+sum,
      `pom.xml`/`build.gradle`) that must be isolated into their own
      cache-friendly layer.
- [ ] Confirmed whether any native/compiled dependencies exist that would
      make an Alpine/musl base risky (check for `node-gyp`, C-extension
      Python wheels, `CGO_ENABLED=1` Go builds).
- [ ] Identified all secrets currently referenced via `ARG`/`ENV` in the
      Dockerfile that need to move to BuildKit secret mounts or
      runtime injection instead.
- [ ] Confirmed the application exposes (or can expose) a lightweight
      health endpoint or process check suitable for `HEALTHCHECK`.
- [ ] Verified BuildKit is enabled locally and in CI
      (`DOCKER_BUILDKIT=1` or `docker buildx`), since `--mount=type=cache`
      and secret mounts require it.
- [ ] Confirmed with the team whether a specific image size budget or SLA
      already exists (registry storage limits, cold-start time targets)
      to set as the Phase 3 threshold.

## Post-Flight Checklist

Confirm every item after the optimization pass, before merging:

- [ ] `hadolint Dockerfile` passes with no un-annotated errors (any
      suppressed rule has an inline comment explaining why).
- [ ] Second consecutive `docker build` with only source changes shows a
      `CACHED` hit on the dependency-install layer specifically.
- [ ] Final image size measured with `docker inspect --format='{{.Size}}'`
      and confirmed under the agreed threshold from the pre-flight
      checklist.
- [ ] `dive` non-interactive gate passes (`--highestUserWastedPercent`,
      `--lowestEfficiency`) at whatever thresholds the team has agreed on.
- [ ] `docker run --rm <image> id -u` returns a non-zero UID (container
      does not run as root).
- [ ] Confirmed no compiler, devDependencies, `.git`, or source-only files
      are present in the final image (spot-checked with `docker run --rm
      <image> sh` or `dive`'s layer file browser).
- [ ] `CMD`/`ENTRYPOINT` use JSON array (exec) form, and `docker stop`
      against a running container exits promptly (not after the full
      kill-timeout), proving signals are forwarded correctly.
- [ ] `HEALTHCHECK` is present and `docker inspect --format='{{.State.
      Health.Status}}'` reports `healthy` after container startup.
- [ ] No secrets appear in `docker history <image> --no-trunc` output.
- [ ] `.dockerignore` reviewed and confirmed to exclude VCS metadata,
      dependency directories, build output, and all `.env*` files except
      `.env.example`.
- [ ] Documented the before/after size and build-time numbers in the PR
      description so the improvement is measurable and reviewable.
