---
name: api-mock-generator
description: >-
  Activate when the user asks to generate synthetic, fake, or mock data for
  testing or prototyping — phrasings such as "generate 50 fake users for
  testing", "mock this API response shape", "create realistic test fixtures
  for orders", "give me sample transactions that look real", or "seed the
  database with test data". Also activate when the active file context is a
  seed script (`seed.ts`, `seed.js`), a fixtures directory (`__mocks__/`,
  `fixtures/`, `*.fixture.ts`), or a schema/type definition (Zod schema,
  Prisma model, OpenAPI spec, DB migration) that needs populated sample
  records with correct field types, satisfied constraints, unique keys, and
  valid foreign-key references across related entities (e.g. mock orders
  that reference real mock user IDs, not orphaned random UUIDs).
version: 1.0.0
author: IEEE Computer Society of SLIIT
tags: [mock-data, synthetic-data, testing, fixtures, seed-scripts, typescript, zod, prng]
---

# Synthetic API Mock Data Generator

## Mission

Generate mock datasets that are **statistically indistinguishable from
production data in shape and distribution**, **internally consistent**
(foreign keys resolve, aggregates match their line items), and
**reproducible** (the same seed always produces the same dataset). Mock data
that is uniform-random, orphaned, or non-reproducible is worse than no mock
data — it hides bugs that only manifest against realistic distributions, and
it makes flaky test failures impossible to reproduce. This skill treats mock
generation as an engineering discipline with its own discovery, execution,
verification, and self-healing phases — not a one-off call to `Math.random()`.

---

## Mental Model & Theoretical Foundations

### Why uniform randomness is the wrong default

A naive mock generator samples every field uniformly at random. Real-world
data almost never looks like this, and the gap matters:

- **Zipfian name/value frequency.** In any real population, a small number
  of given names, email domains, and product SKUs account for a
  disproportionate share of occurrences (Zipf's law: frequency ∝ 1/rank^s).
  A flat uniform pick over 20 equally-likely names produces a dataset that
  *looks* random in a way real data never is — autocomplete rankers, fraud
  heuristics, and even human reviewers can tell the difference. Weighting
  the sampling corpus by rank closes this gap cheaply.
- **Realistic date ranges.** `createdAt` timestamps on a growing platform
  cluster toward the recent past, not uniformly across all time. A mock
  generator that spreads timestamps evenly across five years will break any
  UI or query that assumes a growth curve (e.g. "active in the last 30
  days" dashboards look empty against uniform mock data).
- **Referential integrity between mocked entities.** An `orders` table
  whose `userId` is an independently-generated random UUID is *guaranteed*
  to reference a user that doesn't exist. Every FK field in a mocked child
  entity must be assigned **after** its parent entity has been generated,
  by sampling from the parent's actual generated ID set — never regenerated
  independently.
- **Seeded PRNG for reproducibility.** `Math.random()` cannot be seeded in
  JavaScript, so two runs of the same generator produce different data —
  which makes snapshot tests flaky and bug reports impossible to reproduce
  ("works on my machine" for test data). A seeded PRNG (e.g. `mulberry32`)
  makes generation a pure function of `(seed, params) -> dataset`.
- **Schema-driven generation vs. hardcoded fixtures.** Hand-written fixture
  arrays copy-pasted across test files silently drift from the real schema
  the moment a field is renamed or a constraint tightens. A generator that
  *reads the schema itself* (Zod schema, Prisma model, OpenAPI spec) and
  derives field generators from its types and constraints cannot drift —
  when the schema changes, the generator either adapts automatically or
  fails loudly (see Phase 4, schema drift).

### Entity-relationship flow: FK dependency order is not optional

Mock generation of related entities must follow the same dependency order a
database's foreign-key constraints would enforce on real inserts. Generating
in the wrong order produces either orphaned references or a generator that
has no real parent ID to point to yet.

```text
┌──────────────────────────────────────────────────────────────────────┐
│                    MOCK GENERATION DEPENDENCY GRAPH                  │
│                                                                        │
│   STEP 1 — no dependencies         STEP 2 — depends on users/products │
│   ┌─────────────────┐              ┌─────────────────────────────┐   │
│   │     users        │             │           orders             │   │
│   │ ─────────────────│             │ ──────────────────────────── │   │
│   │ id        (uuid) │────────────▶│ userId    (FK -> users.id)   │   │
│   │ name              │  generated  │ id        (uuid)             │   │
│   │ email             │  first,     │ createdAt                    │   │
│   │ createdAt         │  then       │ totalCents (derived, Step 3) │   │
│   └─────────────────┘  referenced  └───────────────┬───────────────┘   │
│                                                       │                │
│   ┌─────────────────┐                                │ id             │
│   │    products       │                                ▼                │
│   │ ─────────────────│             ┌─────────────────────────────┐   │
│   │ id        (uuid) │────────────▶│         order_items          │   │
│   │ sku               │  generated  │ ──────────────────────────── │   │
│   │ priceCents        │  first,     │ orderId   (FK -> orders.id)  │   │
│   └─────────────────┘  referenced  │ productId (FK -> products.id)│   │
│                                     │ quantity                     │   │
│                                     └─────────────────────────────┘   │
│                                                                        │
│   Topological order: users, products  ──▶  orders  ──▶  order_items  │
│   (STEP 3: order.totalCents is re-derived AFTER order_items exist,   │
│    so the aggregate is guaranteed consistent with its line items.)   │
└──────────────────────────────────────────────────────────────────────┘
```

The rule generalizes: build a dependency graph where an edge `A -> B` means
"B has a field that must reference an already-generated A", topologically
sort it, and generate strictly in that order. Never generate a child's FK
field independently of its parent's actual generated ID set.

---

## Phase 1: Discovery & Static Analysis

**Never hand-guess field names, types, or constraints.** Before writing a
single generator, locate and read the entity's canonical schema in full.

1. **Locate the schema of record.** In priority order, look for:
   - A Zod / Yup / io-ts schema (`z.object({...})`) — the most direct
     source, since it already encodes types *and* runtime constraints.
   - An ORM model (Prisma `schema.prisma`, TypeORM entity, Drizzle table
     definition) — types plus `@unique`, `@default`, nullability.
   - A DB migration (`CREATE TABLE ...`) — column types, `NOT NULL`,
     `UNIQUE`, `REFERENCES` (this is the ground truth for FK direction).
   - An OpenAPI/Swagger spec or hand-written TypeScript `interface` — last
     resort, since these often lack runtime constraints (min/max, format).

   ```bash
   # Discovery greps — run from repo root before generating anything
   grep -rn "z\.object(" src/ --include="*.ts"
   grep -rln "model .* {" prisma/schema.prisma
   grep -rn "CREATE TABLE" supabase/migrations/ database/migrations/
   grep -rn "REFERENCES" supabase/migrations/           # FK direction
   grep -rln "interface .*Schema\|type .* = {" src/types/
   ```

2. **Infer field intent from name + type + constraints**, not from type
   alone. A `z.string()` called `email` needs an email generator; a
   `z.string()` called `sku` needs a SKU generator; a bare `z.string()`
   with no semantic hint falls back to generic word-salad text. Build this
   inference as an explicit table before writing code:

   | Field | Zod type | Constraints found | Inferred generator |
   |---|---|---|---|
   | `id` | `z.string().uuid()` | primary key | `generateUuidV4` |
   | `email` | `z.string().email()` | unique index | `genEmail` (collision-safe) |
   | `name` | `z.string().min(3).max(40)` | — | `genFullName` (Zipfian) |
   | `createdAt` | `z.date()` | — | `genRecentDate` (growth-curve skew) |
   | `priceCents` | `z.number().min(500).max(500000)` | — | `genCurrencyCents` |
   | `userId` | `z.string().uuid()` | FK -> `users.id` | resolved post-hoc from registry |

3. **Extract the FK graph explicitly.** For every field whose name ends in
   `Id` (or that a migration marks `REFERENCES other_table(id)`), record
   `{ field, parentEntity }`. This list is the input to the topological
   sort in Phase 2 — do not skip it even for "obvious" relationships.

4. **Confirm uniqueness constraints** (`UNIQUE` columns, `.email()` fields
   commonly paired with a unique index, primary keys) — these need a
   collision-avoidance strategy at generation time, not just a "hope for
   the best" random string.

5. **Confirm the intended volume and destination** — a fixture file
   consumed by unit tests behaves differently from a seed script that
   inserts into a live dev database (the latter needs batching/transaction
   awareness that is out of scope for the generator itself, but changes
   how its output should be shaped: array of objects vs. SQL statements).

---

## Phase 2: Execution & Implementation

Complete, typed TypeScript implementation. It has four parts: a seeded PRNG,
realistic field generators, a Zod-schema-driven walker that turns any Zod
object into a populated instance, and a dependency-ordered cross-entity
orchestrator that resolves FK fields against real generated parent rows.

```typescript
// mock-generator.ts
import { z, type ZodTypeAny } from "zod";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

// ===========================================================================
// 1. Seeded PRNG — mulberry32. Deterministic, fast, zero dependencies.
//    Same seed => same byte-for-byte output on every machine and every run.
// ===========================================================================
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Rng {
  next(): number; // uniform [0, 1)
  int(min: number, max: number): number; // uniform inclusive integer
  pick<T>(arr: readonly T[]): T;
  weightedPick<T>(items: readonly { value: T; weight: number }[]): T;
  bool(pTrue?: number): boolean;
}

export function createRng(seed: number): Rng {
  const rand = mulberry32(seed);
  return {
    next: rand,
    int(min, max) {
      return Math.floor(rand() * (max - min + 1)) + min;
    },
    pick(arr) {
      return arr[Math.floor(rand() * arr.length)];
    },
    weightedPick(items) {
      const total = items.reduce((s, i) => s + i.weight, 0);
      let r = rand() * total;
      for (const item of items) {
        r -= item.weight;
        if (r <= 0) return item.value;
      }
      return items[items.length - 1].value;
    },
    bool(pTrue = 0.5) {
      return rand() < pTrue;
    },
  };
}

// ===========================================================================
// 2. Realistic field generators
// ===========================================================================

// --- Zipfian-weighted name corpus -----------------------------------------
// Real given-name frequency follows Zipf's law (s ~ 1). Sampling uniformly
// from a flat list produces a distribution real data never has.
const FIRST_NAMES = [
  "James", "Mary", "Robert", "Patricia", "John", "Jennifer", "Michael", "Linda",
  "David", "Elizabeth", "William", "Barbara", "Nimal", "Kasun", "Dilani",
  "Sanduni", "Chathura", "Ishara", "Tharindu", "Amaya",
] as const;

const LAST_NAMES = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller",
  "Perera", "Fernando", "Silva", "Jayawardena", "Rathnayake", "Bandara",
  "Wickramasinghe", "Gunasekara",
] as const;

function zipfWeights(n: number, s: number): number[] {
  let norm = 0;
  for (let k = 1; k <= n; k++) norm += 1 / k ** s;
  return Array.from({ length: n }, (_, i) => 1 / (i + 1) ** s / norm);
}

function zipfCorpus<T>(items: readonly T[], s: number) {
  const weights = zipfWeights(items.length, s);
  return items.map((value, i) => ({ value, weight: weights[i] }));
}

const FIRST_NAME_CORPUS = zipfCorpus(FIRST_NAMES, 1.07);
const LAST_NAME_CORPUS = zipfCorpus(LAST_NAMES, 0.8);

export function genFullName(rng: Rng): string {
  return `${rng.weightedPick(FIRST_NAME_CORPUS)} ${rng.weightedPick(LAST_NAME_CORPUS)}`;
}

// --- Collision-safe email ---------------------------------------------------
const usedEmails = new Set<string>();

export function resetEmailLedger(): void {
  usedEmails.clear();
}

export function genEmail(rng: Rng, fullName: string): string {
  const domains = [
    { value: "gmail.com", weight: 55 },
    { value: "yahoo.com", weight: 15 },
    { value: "outlook.com", weight: 12 },
    { value: "sliit.lk", weight: 10 },
    { value: "icloud.com", weight: 8 },
  ];
  const [first, last] = fullName.toLowerCase().split(" ");
  const domain = rng.weightedPick(domains);
  let candidate = `${first}.${last}@${domain}`;
  let suffix = 1;
  while (usedEmails.has(candidate)) {
    candidate = `${first}.${last}${suffix}@${domain}`;
    suffix += 1;
  }
  usedEmails.add(candidate);
  return candidate;
}

// --- Realistic date range: recent-skewed, not uniform across all time -----
export function genRecentDate(rng: Rng, daysBack = 365, skew = 2.5): Date {
  const now = Date.now();
  const r = rng.next() ** skew; // skew toward 0 => weighted toward "now"
  return new Date(now - r * daysBack * 24 * 60 * 60 * 1000);
}

// --- Currency: real prices cluster at psychological endings ---------------
export function genCurrencyCents(rng: Rng, minDollars: number, maxDollars: number): number {
  const dollars = rng.int(minDollars, Math.max(minDollars, maxDollars));
  const endings = [99, 95, 50, 0, 0, 0]; // 0 repeated => round totals are common
  return dollars * 100 + rng.pick(endings);
}

export function generateUuidV4(rng: Rng): string {
  const template = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx";
  return template.replace(/[xy]/g, (c) => {
    const v = c === "y" ? rng.int(8, 11) : rng.int(0, 15);
    return v.toString(16);
  });
}

function genSku(rng: Rng): string {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I/O — matches real SKU alphabets
  const prefix = Array.from({ length: 3 }, () => letters[rng.int(0, letters.length - 1)]).join("");
  return `${prefix}-${rng.int(1000, 9999)}`;
}

function genPhone(rng: Rng): string {
  return `+94 7${rng.int(0, 9)} ${rng.int(100, 999)} ${rng.int(1000, 9999)}`;
}

function genAddress(rng: Rng): string {
  const streets = ["Galle Road", "Kandy Road", "Baseline Road", "Duplication Road", "Havelock Road"];
  return `${rng.int(1, 400)} ${rng.pick(streets)}, Colombo ${rng.int(1, 15)}`;
}

function genWords(rng: Rng, minLen: number, maxLen: number): string {
  const bank = ["cyber", "security", "endgame", "capture", "flag", "network", "exploit", "patch", "token", "session"];
  let out = rng.pick(bank);
  while (out.length < minLen) out += ` ${rng.pick(bank)}`;
  return out.slice(0, Math.max(minLen, Math.min(out.length, maxLen)));
}

// ===========================================================================
// 3. Schema-driven walker — turns ANY Zod schema into a populated instance.
//    Field intent is inferred from the field NAME plus the zod TYPE/checks,
//    per the Phase 1 discovery table. This is what makes the generator
//    schema-driven rather than a hardcoded fixture.
// ===========================================================================
export interface GenContext {
  rng: Rng;
  path: string[];
  registry: Map<string, unknown[]>;
}

export function generateFromZod<T extends ZodTypeAny>(schema: T, ctx: GenContext): z.infer<T> {
  const def = (schema as unknown as { _def: any })._def;

  if (schema instanceof z.ZodOptional || schema instanceof z.ZodNullable) {
    if (ctx.rng.bool(0.1)) return undefined as z.infer<T>; // ~10% absent, matches real sparsity
    return generateFromZod(def.innerType, ctx);
  }
  if (schema instanceof z.ZodDefault) {
    return generateFromZod(def.innerType, ctx);
  }
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape as Record<string, ZodTypeAny>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(shape)) {
      out[key] = generateFromZod(shape[key], { ...ctx, path: [...ctx.path, key] });
    }
    return out as z.infer<T>;
  }
  if (schema instanceof z.ZodArray) {
    const len = ctx.rng.int(def.minLength?.value ?? 1, def.maxLength?.value ?? 3);
    return Array.from({ length: len }, () => generateFromZod(def.type, ctx)) as z.infer<T>;
  }
  if (schema instanceof z.ZodEnum) {
    return ctx.rng.pick(def.values) as z.infer<T>;
  }
  if (schema instanceof z.ZodString) {
    return generateStringField(schema, ctx) as z.infer<T>;
  }
  if (schema instanceof z.ZodNumber) {
    return generateNumberField(schema, ctx) as z.infer<T>;
  }
  if (schema instanceof z.ZodDate) {
    return genRecentDate(ctx.rng) as z.infer<T>;
  }
  if (schema instanceof z.ZodBoolean) {
    return ctx.rng.bool() as z.infer<T>;
  }
  throw new Error(`generateFromZod: unsupported schema type at "${ctx.path.join(".")}"`);
}

function generateStringField(schema: z.ZodString, ctx: GenContext): string {
  const checks = (schema._def as any).checks ?? [];
  const fieldName = ctx.path[ctx.path.length - 1]?.toLowerCase() ?? "";

  if (checks.some((c: any) => c.kind === "email") || fieldName.includes("email")) {
    return genEmail(ctx.rng, genFullName(ctx.rng));
  }
  if (checks.some((c: any) => c.kind === "uuid") || fieldName === "id") {
    return generateUuidV4(ctx.rng);
  }
  if (fieldName.includes("name")) return genFullName(ctx.rng);
  if (fieldName.includes("sku")) return genSku(ctx.rng);
  if (fieldName.includes("phone")) return genPhone(ctx.rng);
  if (fieldName.includes("address")) return genAddress(ctx.rng);

  const min = checks.find((c: any) => c.kind === "min")?.value ?? 5;
  const max = checks.find((c: any) => c.kind === "max")?.value ?? Math.max(min + 10, 20);
  return genWords(ctx.rng, min, max);
}

function generateNumberField(schema: z.ZodNumber, ctx: GenContext): number {
  const checks = (schema._def as any).checks ?? [];
  const fieldName = ctx.path[ctx.path.length - 1]?.toLowerCase() ?? "";
  const min = checks.find((c: any) => c.kind === "min")?.value ?? 0;
  const max = checks.find((c: any) => c.kind === "max")?.value ?? 1000;

  if (fieldName.includes("cents") || fieldName.includes("price") || fieldName.includes("amount")) {
    return genCurrencyCents(ctx.rng, Math.max(1, Math.floor(min / 100)), Math.floor(max / 100) || 500);
  }
  return ctx.rng.int(Math.floor(min), Math.floor(max));
}

// ===========================================================================
// 4. Entity schemas (Phase 1 output, encoded as the schema of record)
// ===========================================================================
export const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(3).max(40),
  email: z.string().email(),
  createdAt: z.date(),
});

export const ProductSchema = z.object({
  id: z.string().uuid(),
  sku: z.string(),
  name: z.string().min(3).max(40),
  priceCents: z.number().min(500).max(500000),
});

export const OrderSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(), // FK -> users.id
  createdAt: z.date(),
  totalCents: z.number().min(100).max(1000000),
});

export const OrderItemSchema = z.object({
  id: z.string().uuid(),
  orderId: z.string().uuid(), // FK -> orders.id
  productId: z.string().uuid(), // FK -> products.id
  quantity: z.number().min(1).max(5),
});

export type User = z.infer<typeof UserSchema>;
export type Product = z.infer<typeof ProductSchema>;
export type Order = z.infer<typeof OrderSchema>;
export type OrderItem = z.infer<typeof OrderItemSchema>;

// ===========================================================================
// 5. FK-respecting cross-entity orchestration (the topological sort from
//    the Mental Model diagram, executed literally): users, products first
//    (no dependencies) -> orders (needs users) -> order_items (needs orders
//    AND products) -> order.totalCents re-derived last from real line items.
// ===========================================================================
export interface DatasetOptions {
  users: number;
  products: number;
  ordersPerUser: [min: number, max: number];
  itemsPerOrder: [min: number, max: number];
}

export interface MockDataset {
  users: User[];
  products: Product[];
  orders: Order[];
  orderItems: OrderItem[];
}

export function generateMockDataset(seed: number, opts: DatasetOptions): MockDataset {
  resetEmailLedger();
  const registry = new Map<string, unknown[]>();
  const rng = createRng(seed);

  // Step 1 — independent entities, no FK inputs required.
  const users: User[] = Array.from({ length: opts.users }, () =>
    generateFromZod(UserSchema, { rng, path: ["users"], registry })
  );
  registry.set("users", users);

  const products: Product[] = Array.from({ length: opts.products }, () =>
    generateFromZod(ProductSchema, { rng, path: ["products"], registry })
  );
  registry.set("products", products);

  // Step 2 — orders depend on users; FK is overwritten with a REAL parent id.
  const orders: Order[] = [];
  const orderItems: OrderItem[] = [];

  for (const user of users) {
    const orderCount = rng.int(...opts.ordersPerUser);
    for (let i = 0; i < orderCount; i++) {
      const order = generateFromZod(OrderSchema, { rng, path: ["orders"], registry });
      order.userId = user.id; // <- FK overwrite, never a fresh random uuid

      // Step 3 — order_items depend on BOTH orders and products.
      const itemCount = rng.int(...opts.itemsPerOrder);
      let totalCents = 0;
      for (let j = 0; j < itemCount; j++) {
        const item = generateFromZod(OrderItemSchema, { rng, path: ["order_items"], registry });
        const product = rng.pick(products);
        item.orderId = order.id;
        item.productId = product.id;
        totalCents += product.priceCents * item.quantity;
        orderItems.push(item);
      }
      order.totalCents = totalCents; // derived AFTER line items exist -> always consistent
      orders.push(order);
    }
  }

  registry.set("orders", orders);
  registry.set("order_items", orderItems);
  return { users, products, orders, orderItems };
}
```

---

## Phase 3: Automated Verification

Generated mock data is only trustworthy after it passes an automated gate.
Verification has three independent checks: **schema validity** (100% of
records parse), **uniqueness** (every unique-constrained field has no
duplicates), and **referential integrity** (every FK resolves to a real
parent row in the same dataset).

```typescript
// tests/mock-dataset.test.ts
import { describe, it, expect } from "vitest";
import {
  UserSchema, ProductSchema, OrderSchema, OrderItemSchema,
  generateMockDataset,
} from "../mock-generator";

const DATASET_OPTS = { users: 50, products: 20, ordersPerUser: [0, 3] as [number, number], itemsPerOrder: [1, 4] as [number, number] };

describe("mock dataset: schema validity (must be 100%)", () => {
  const { users, products, orders, orderItems } = generateMockDataset(42, DATASET_OPTS);

  it("every user passes UserSchema", () => {
    const failures = users.filter((u) => !UserSchema.safeParse(u).success);
    expect(failures).toEqual([]);
  });

  it("every product passes ProductSchema", () => {
    const failures = products.filter((p) => !ProductSchema.safeParse(p).success);
    expect(failures).toEqual([]);
  });

  it("every order passes OrderSchema", () => {
    const failures = orders.filter((o) => !OrderSchema.safeParse(o).success);
    expect(failures).toEqual([]);
  });

  it("every order_item passes OrderItemSchema", () => {
    const failures = orderItems.filter((i) => !OrderItemSchema.safeParse(i).success);
    expect(failures).toEqual([]);
  });
});

describe("mock dataset: uniqueness constraints", () => {
  const { users, products, orders, orderItems } = generateMockDataset(42, DATASET_OPTS);

  it("user ids and emails are unique", () => {
    expect(new Set(users.map((u) => u.id)).size).toBe(users.length);
    expect(new Set(users.map((u) => u.email)).size).toBe(users.length);
  });

  it("product ids and skus are unique", () => {
    expect(new Set(products.map((p) => p.id)).size).toBe(products.length);
    expect(new Set(products.map((p) => p.sku)).size).toBe(products.length);
  });

  it("order and order_item ids are unique", () => {
    expect(new Set(orders.map((o) => o.id)).size).toBe(orders.length);
    expect(new Set(orderItems.map((i) => i.id)).size).toBe(orderItems.length);
  });
});

describe("mock dataset: referential integrity", () => {
  const { users, products, orders, orderItems } = generateMockDataset(42, DATASET_OPTS);
  const userIds = new Set(users.map((u) => u.id));
  const orderIds = new Set(orders.map((o) => o.id));
  const productIds = new Set(products.map((p) => p.id));

  it("every order.userId references an existing user", () => {
    for (const order of orders) expect(userIds.has(order.userId)).toBe(true);
  });

  it("every order_item.orderId and productId resolve", () => {
    for (const item of orderItems) {
      expect(orderIds.has(item.orderId)).toBe(true);
      expect(productIds.has(item.productId)).toBe(true);
    }
  });

  it("order.totalCents matches the sum of its own line items", () => {
    const totalByOrder = new Map<string, number>();
    for (const item of orderItems) {
      const product = products.find((p) => p.id === item.productId)!;
      totalByOrder.set(item.orderId, (totalByOrder.get(item.orderId) ?? 0) + product.priceCents * item.quantity);
    }
    for (const order of orders) {
      expect(order.totalCents).toBe(totalByOrder.get(order.id) ?? 0);
    }
  });
});

describe("mock dataset: reproducibility", () => {
  it("the same seed produces byte-identical output", () => {
    const a = generateMockDataset(42, DATASET_OPTS);
    const b = generateMockDataset(42, DATASET_OPTS);
    expect(a).toEqual(b);
  });

  it("a different seed produces a different dataset", () => {
    const a = generateMockDataset(42, DATASET_OPTS);
    const c = generateMockDataset(43, DATASET_OPTS);
    expect(a.users[0].email).not.toBe(c.users[0].email);
  });
});
```

Run the gate and require a clean, 100%-passing exit code before the dataset
is trusted anywhere downstream (fixture file, seed script, PR):

```bash
npx vitest run tests/mock-dataset.test.ts --reporter=verbose
```

A single failing assertion in the schema-validity or referential-integrity
blocks means the generator itself is wrong — treat it as a blocking defect,
not a flaky test to retry.

---

## Phase 4: Rollback & Self-Healing

Two failure modes are specific to schema-driven mock generation: the
**source schema changes underneath the generator** (schema drift), and a
**generated value repeatedly fails a constraint** (constraint violation,
usually from a collision or a narrow numeric range).

### Schema drift: detect it, don't silently generate garbage

```typescript
// schema-drift.ts
import { z, type ZodTypeAny } from "zod";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

export class SchemaDriftError extends Error {}

function walkShape(s: any): string {
  if (s instanceof z.ZodObject) {
    const entries = Object.entries(s.shape as Record<string, ZodTypeAny>)
      .map(([k, v]) => `${k}:${walkShape(v)}`)
      .sort();
    return `{${entries.join(",")}}`;
  }
  if (s instanceof z.ZodOptional || s instanceof z.ZodNullable || s instanceof z.ZodDefault) {
    return `${walkShape(s._def.innerType)}?`;
  }
  if (s instanceof z.ZodArray) return `[${walkShape(s._def.type)}]`;
  return s._def?.typeName ?? "unknown";
}

function hashSchemaShape(schema: ZodTypeAny): string {
  return createHash("sha256").update(walkShape(schema)).digest("hex").slice(0, 16);
}

/**
 * Fails loudly the moment a tracked entity's schema shape changes since the
 * last verified run, instead of silently generating mocks against a stale
 * mental model of the schema. On first run for an entity it just records
 * the baseline hash.
 */
export function assertNoSchemaDrift(
  schema: ZodTypeAny,
  entityName: string,
  hashFile = ".mock-schema-hashes.json"
): void {
  const current = hashSchemaShape(schema);
  const stored: Record<string, string> = existsSync(hashFile)
    ? JSON.parse(readFileSync(hashFile, "utf8"))
    : {};

  if (stored[entityName] && stored[entityName] !== current) {
    throw new SchemaDriftError(
      `Schema for "${entityName}" changed since the generator config was last ` +
        `verified (${stored[entityName]} -> ${current}). Re-run Phase 1 discovery, ` +
        `update the field-generator inference table, and regenerate before trusting ` +
        `new mock output for this entity.`
    );
  }
  stored[entityName] = current;
  writeFileSync(hashFile, JSON.stringify(stored, null, 2));
}
```

**Recovery procedure on drift:** do not patch around the error. Re-run
Phase 1 (re-read the schema, rebuild the field-generator inference table),
update `generateStringField` / `generateNumberField` mappings for any new or
renamed fields, re-run the Phase 3 verification suite, and only then update
the stored hash (the function above does this automatically once the new
shape is accepted as the baseline).

### Constraint violations: bounded retry, never an infinite loop

```typescript
// retry.ts
export class ConstraintViolationError extends Error {
  constructor(message: string, public readonly attempts: number) {
    super(message);
    this.name = "ConstraintViolationError";
  }
}

/**
 * Retries a generator+validator pair with exponential backoff, capped at
 * maxRetries. Use this around any generation step that can collide (e.g.
 * unique email/SKU generation under a small corpus) or that depends on an
 * external, rate-limited resource. A hard cap prevents an unsatisfiable
 * constraint (e.g. asking for 10,000 unique values from a 50-value corpus)
 * from hanging the generator forever.
 */
export function generateWithRetry<T>(
  factory: () => T,
  validate: (value: T) => boolean,
  opts: { maxRetries?: number; baseDelayMs?: number } = {}
): T {
  const maxRetries = opts.maxRetries ?? 5;
  const baseDelayMs = opts.baseDelayMs ?? 10;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const value = factory();
      if (validate(value)) return value;
      lastError = new Error("generated value failed validate()");
    } catch (err) {
      lastError = err;
    }
    // Exponential backoff — only meaningful when factory() touches a
    // rate-limited external resource; for pure in-memory generation the
    // delay is a no-op spacer that still bounds total retry attempts.
    const _delayMs = baseDelayMs * 2 ** attempt;
    void _delayMs;
  }

  throw new ConstraintViolationError(
    `Failed to generate a value satisfying constraints after ${maxRetries + 1} ` +
      `attempts. Last error: ${String(lastError)}. Consider widening the source ` +
      `corpus (names/domains/SKUs) or lowering the requested unique-record count.`,
    maxRetries + 1
  );
}
```

**Usage pattern:** wrap any collision-prone generation step, e.g. unique SKU
assignment for a large product catalog:

```typescript
const sku = generateWithRetry(
  () => genSkuCandidate(rng),
  (candidate) => !usedSkus.has(candidate),
  { maxRetries: 8 }
);
usedSkus.add(sku);
```

If `generateWithRetry` throws `ConstraintViolationError` after the cap, that
is a signal to fix the *generator design* (widen the corpus, shrink the
requested count) — not to raise `maxRetries` indefinitely.

---

## Common Anti-Patterns vs. Gold Standard

| # | Anti-Pattern | Gold Standard |
|---|---|---|
| 1 | Hardcoded fixture arrays copy-pasted across test files, drifting from the real schema silently | Single schema-driven generator (`generateFromZod`) reused everywhere, so fixtures can never diverge from the schema of record |
| 2 | `Math.random()` with no seed — every run produces different data, causing flaky snapshot tests and unreproducible bug reports | Seeded PRNG (`mulberry32(seed)`) — the same seed always reproduces byte-identical output |
| 3 | Child FK fields generated independently (`userId: uuidv4()`), guaranteeing orphaned references | FK fields are overwritten post-generation with an id sampled from the already-generated parent registry |
| 4 | Uniform-random names/emails drawn from a tiny flat list, producing obvious duplicate collisions and an unrealistic distribution | Zipfian-weighted name corpus plus collision-safe email suffixing |
| 5 | Generating child entities before their parents exist (e.g. `orders` before `users`) | Explicit dependency-ordered generation plan / topological sort — parents always generated first |
| 6 | Swallowing a validation failure and shipping the bad record anyway | `generateWithRetry` with a capped exponential backoff, escalating to a loud `ConstraintViolationError` |
| 7 | Upstream schema changes (new required field, tightened constraint) go unnoticed until consumers break in CI or prod | `assertNoSchemaDrift` schema-hash check run at generation time, failing loudly before bad mocks ship |
| 8 | Currency modeled as floats (`19.989999999999998`) with uniform random cents | Integer cents (`priceCents: number`) with a realistic price-ending distribution (`.99`, `.95`, round) |

---

## Pre-Flight Checklist

- [ ] Located and read the entity's canonical schema in full (Zod schema, ORM model, or migration SQL) — no field names or types guessed.
- [ ] Built the Phase 1 field-generator inference table (field, type, constraints, inferred generator) for every entity involved.
- [ ] Identified every foreign-key relationship and derived the correct topological generation order.
- [ ] Chosen and logged a PRNG seed for this run so the dataset is reproducible on request.
- [ ] Identified every uniqueness constraint (primary keys, unique indexes: email, sku, slug) the generator must respect.
- [ ] Identified nullable/optional fields and set a realistic sparsity rate (not always-present, not always-absent).
- [ ] Checked `.mock-schema-hashes.json` (or equivalent) for drift before trusting any cached generator-config assumptions.
- [ ] Confirmed the requested record count is within sane bounds for the target sink (e.g. `api_generate_mock_data`'s 1–50 range) and won't overload downstream consumers.
- [ ] Confirmed the output destination and format (in-memory fixture, JSON file, seed-script insert, SQL statements).
- [ ] Confirmed no real production data, PII, or user-identifying patterns are used as generation templates.

## Post-Flight Checklist

- [ ] Ran full schema validation (`safeParse`) over 100% of generated records for every entity — zero failures tolerated.
- [ ] Verified uniqueness constraints hold across the entire generated set (`Set` size equals array length for every unique field).
- [ ] Verified referential integrity — every FK value resolves to an existing parent id within the same generated dataset.
- [ ] Verified derived/aggregate fields (totals, counts, sums) are consistent with their underlying line-level records.
- [ ] Re-ran generation with the same seed and confirmed identical output (reproducibility check).
- [ ] Spot-checked realism — name, date, and currency distributions are visibly non-uniform and plausible, not robotic.
- [ ] Persisted/updated the schema-hash file so future runs can detect drift against this verified baseline.
- [ ] Confirmed mock data is clearly isolated from production data paths (distinct schema, `.mock.json` suffix, seed-only database) to prevent accidental production writes.
- [ ] Logged the seed, entity counts, and generation timestamp used, for traceability of this specific dataset.
