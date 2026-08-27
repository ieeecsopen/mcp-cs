---
name: backend-rest-api-design
description: Activate this skill when designing a new REST endpoint or resource ("design a REST endpoint for X", "add a CRUD API for X", "how should I model this resource"), when reviewing existing HTTP APIs for REST compliance ("review this API for REST compliance", "audit our routes", "is this endpoint RESTful"), when implementing pagination, versioning, or error-handling conventions for an HTTP API, or when a diff/PR touches Express/Fastify/NestJS route handlers, controllers, or OpenAPI specs. Contexts: new endpoint design, API contract review, pagination/versioning strategy selection, error envelope standardization, pre-merge REST compliance audits.
version: 1.0.0
author: IEEE Computer Society of SLIIT
tags: [rest-api, backend, http, typescript, openapi, pagination, api-design, node]
---

# Production REST API Design & Contracts

## Mission

Design, implement, review, and harden HTTP APIs that are resource-oriented, predictable under failure, safe to paginate at scale, and mechanically verifiable. This skill is not a style guide — it is an operational runbook. It covers the full lifecycle: reading theory, auditing an existing codebase for violations, writing typed production code, proving correctness with automated tests, and defining rollback/self-healing behavior for the failure modes that REST APIs actually hit in production (breaking version bumps, malformed pagination tokens, partial rollouts).

Apply this skill whenever a task involves: designing a new resource endpoint, reviewing a PR that adds/changes routes, choosing a pagination or versioning strategy, standardizing error responses across a service, or writing OpenAPI documentation that must match implementation.

---

## Mental Model & Theoretical Foundations

### Resource-Oriented Design vs RPC-Style

REST models a system as a graph of **nouns (resources)** manipulated by a fixed, small verb set (the HTTP methods). RPC-style APIs model a system as a list of **verbs (procedures)** exposed over HTTP as a transport. The two are not cosmetically different — they have different failure semantics, cacheability, and tooling support.

| Property | Resource-Oriented (REST) | RPC-over-HTTP |
|---|---|---|
| URL shape | `/orders/{id}` | `/getOrder`, `/createOrderForUser` |
| Verb carries meaning | Yes — `DELETE /orders/1` is unambiguous | No — meaning lives in body/URL, not method |
| Cacheable by generic HTTP infra | Yes (GET is cacheable by default) | No (usually POST-only) |
| Client tooling | Generic (any HTTP client, generic pagination/retry libs) | Bespoke per endpoint |
| Idempotency | Falls out of the verb (PUT/DELETE) | Must be reinvented per procedure |

**Rule of thumb:** if you find yourself naming a route `/api/processPayment` or `/api/users/123/deactivate`, ask whether "payment" or "deactivation" is itself a resource (`POST /payments`, `PATCH /users/123 {"status":"inactive"}`, or `POST /users/123/deactivations` if deactivation has its own lifecycle/audit trail). RPC-style naming is acceptable **only** for genuine non-CRUD actions with no resource analogue (e.g., `POST /auth/token:refresh`) — and even then, prefix clearly and keep it rare.

### Idempotency: PUT/DELETE vs POST

Idempotency means: calling the operation N times has the same server-state effect as calling it once. This is not optional metadata — it determines what a client's retry logic, a load balancer's retry policy, and an at-least-once message queue are allowed to do safely.

- **GET, HEAD, OPTIONS** — safe (no side effects) and idempotent.
- **PUT** — idempotent by contract. `PUT /orders/5 {...}` replaces the full resource state; repeating it produces the same end state. If your "PUT" handler increments a counter or appends to a list, it is not actually a PUT — rename it.
- **DELETE** — idempotent. Deleting an already-deleted resource should return `204` or `404`, never `500`, and never partially apply.
- **PATCH** — *not guaranteed* idempotent (depends on the patch semantics — JSON Merge Patch is idempotent, JSON Patch with `"op":"add"` on an array is not). Document which one you implement.
- **POST** — **not** idempotent by default. `POST /orders` called twice creates two orders. This is why clients retrying a POST after a timeout can double-submit — the fix is an **idempotency key**: the client generates a UUID, sends it as `Idempotency-Key` header, and the server stores `(key -> response)` so a retried request with the same key returns the cached first response instead of re-executing.

```
Client                          Server
  |--- POST /orders ------------->|  Idempotency-Key: 9f2a...
  |     (network times out)       |  (server actually succeeded)
  |--- POST /orders (retry) ----->|  Idempotency-Key: 9f2a...  <- same key
  |<-- 201 Created (cached) ------|  no second order created
```

### Status Code Semantics (the ones people get wrong)

| Code | Meaning | Common misuse to avoid |
|---|---|---|
| `200 OK` | Success with body | Returning 200 for errors with `{"success": false}` in the body — clients that check status codes (not just bodies) will treat this as success. |
| `201 Created` | Resource created; **must** set `Location` header | Returning `200` from a `POST` that creates a resource. |
| `202 Accepted` | Async processing started, no final result yet | Using `200` for a queued/background job and making the client guess. |
| `204 No Content` | Success, intentionally empty body | Returning `200` with `null` body instead. |
| `400 Bad Request` | Malformed syntax/validation failure — **client must change the request** | Using `500` for validation errors (see Phase 4). |
| `401 Unauthorized` | Missing/invalid authentication | Confusing with 403. |
| `403 Forbidden` | Authenticated, but not permitted | Confusing with 401 — 401 means "who are you", 403 means "I know who you are and no". |
| `404 Not Found` | Resource doesn't exist | Using 404 to hide 403 (acceptable *only* as a deliberate security choice, document it). |
| `409 Conflict` | Request conflicts with current state (e.g. version mismatch, duplicate unique key) | Using 400 for optimistic-lock conflicts. |
| `410 Gone` | Resource existed, now permanently removed | Rare but correct for deprecated/deleted endpoints during migration windows. |
| `422 Unprocessable Entity` | Syntactically valid, semantically invalid (business rule failure) | Conflating with 400 — teams should pick one convention and be consistent (this skill uses 400 for schema validation, 422 for business-rule validation). |
| `429 Too Many Requests` | Rate limited — **must** set `Retry-After` | Silently dropping requests instead. |
| `500 Internal Server Error` | Unhandled server fault | Using for client-caused errors (validation, auth, not-found) — this is the single most common REST violation. |
| `503 Service Unavailable` | Temporary overload/maintenance | Returning 500 when the real cause is a dependency being down — 503 tells clients to back off and retry. |

### HATEOAS Tradeoffs

HATEOAS (Hypermedia as the Engine of Application State) means responses embed links describing valid next actions:

```json
{
  "id": "42",
  "status": "pending",
  "_links": {
    "self": { "href": "/orders/42" },
    "cancel": { "href": "/orders/42/cancel", "method": "POST" }
  }
}
```

**When it pays off:** long-lived public APIs with many independent client teams, workflow-driven resources where valid transitions change over time (e.g. order status machines), and APIs that want to evolve URLs without breaking clients.

**When it's overhead you shouldn't pay:** internal microservice-to-microservice APIs, mobile-app-only backends where client and server ship together, or any API with tight latency budgets and payload-size constraints. Most teams should default to **plain JSON + OpenAPI docs** and only adopt HATEOAS when a concrete versioning/discoverability problem justifies the extra payload and client complexity. Document the decision either way — "we deliberately do not do HATEOAS because X" is a valid and common architectural choice.

### Versioning Strategies: URI vs Header

| Strategy | Example | Pros | Cons |
|---|---|---|---|
| URI path | `/v2/orders/42` | Visible, cacheable per-version, trivial to route/load-balance, easy to grep in logs | "Pollutes" the URL; implies the resource identity changes across versions (it doesn't) |
| Header (`Accept: application/vnd.acme.v2+json`) | same URL, different header | Keeps URL as pure resource identifier; cleaner REST purism | Invisible in browser/curl by default, harder to cache/debug, easy for clients to forget |
| Query param (`?version=2`) | `/orders/42?version=2` | Easy to add without routing changes | Easy to omit accidentally, mixes identity with negotiation, not cacheable by default (varies by query) |

**Recommendation for this skill:** default to **URI path versioning at the major-version granularity only** (`/v1/`, `/v2/`), reserving header-based content negotiation for fine-grained representation choices (e.g. `Accept: application/json` vs `text/csv`), not for breaking API versions. Never version per-field — version whole resource contracts.

### Pagination Models: Offset vs Cursor

**Offset pagination** (`?limit=20&offset=40`) is simple but has two production-breaking properties at scale:
1. **Performance degrades linearly with offset** — `OFFSET 100000` still requires the database to scan and discard 100,000 rows before returning the page. On a large table this turns a 5ms query into a multi-second one.
2. **Page drift under concurrent writes** — if a row is inserted/deleted between page 1 and page 2 requests, offset pagination will **skip or duplicate items**, because offset is a position in an ever-shifting ordered set, not a stable reference point.

**Cursor pagination** (`?limit=20&cursor=eyJpZCI6NDJ9`) encodes the *last seen item's sort key* (typically an opaque, base64-encoded, tamper-resistant token wrapping `{id, sortValue}`), and the query becomes `WHERE (created_at, id) < (cursor.created_at, cursor.id) ORDER BY created_at DESC, id DESC LIMIT 20`. This:
- Uses an index seek instead of a scan — **O(log n) + limit**, independent of how deep into the list you are.
- Is stable under concurrent inserts/deletes elsewhere in the set, because it's anchored to a specific row's sort key, not a numeric position.
- Requires a **tie-breaker column** (usually the primary key) alongside the natural sort column, because timestamps alone are not guaranteed unique.

Cursor pagination's tradeoff: no "jump to page 7" — it's forward/backward-only navigation. This is the correct tradeoff for infinite-scroll feeds, sync APIs, and any list backed by a large or high-write-throughput table. Offset pagination remains acceptable for small, rarely-mutated collections where "jump to page N" UX is required (e.g. an admin table with a page-number widget).

### Sequence Diagram: Cursor-Based Paginated List Request/Response Cycle

```
 CLIENT                          API SERVER                          DATABASE
   |                                  |                                  |
   |  GET /orders?limit=20            |                                  |
   |--------------------------------->|                                  |
   |                                  |  SELECT * FROM orders           |
   |                                  |  ORDER BY created_at DESC, id DESC
   |                                  |  LIMIT 21   -- fetch N+1         |
   |                                  |--------------------------------->|
   |                                  |<---------------------------------|
   |                                  |  21 rows returned                |
   |                                  |  (has_more = true; drop 21st)    |
   |                                  |  encode cursor from row #20      |
   |                                  |  cursor = base64({               |
   |                                  |    createdAt: row20.created_at,  |
   |                                  |    id: row20.id                  |
   |                                  |  })                              |
   |  200 OK                          |                                  |
   |  { data: [...20 items],          |                                  |
   |    pageInfo: {                   |                                  |
   |      nextCursor: "eyJ...",       |                                  |
   |      hasMore: true } }           |                                  |
   |<----------------------------------|                                  |
   |                                  |                                  |
   |  GET /orders?limit=20&cursor=eyJ...                                 |
   |--------------------------------->|                                  |
   |                                  |  decode + VALIDATE cursor        |
   |                                  |  (malformed? -> 400, see Phase 4)|
   |                                  |  SELECT * FROM orders           |
   |                                  |  WHERE (created_at, id) <        |
   |                                  |        (cursor.createdAt, cursor.id)
   |                                  |  ORDER BY created_at DESC, id DESC
   |                                  |  LIMIT 21                        |
   |                                  |--------------------------------->|
   |                                  |<---------------------------------|
   |  200 OK { data: [...next 20],    |                                  |
   |    pageInfo: { nextCursor,       |                                  |
   |      hasMore } }                 |                                  |
   |<----------------------------------|                                  |
```

Note the **N+1 fetch trick**: request `limit + 1` rows from the database. If you get back `limit + 1` rows, `hasMore = true` and you drop the extra row before returning; if you get back `<= limit` rows, `hasMore = false`. This avoids a separate `COUNT(*)` query to determine whether more pages exist.

---

## Phase 1: Discovery & Static Analysis

Before writing or reviewing any endpoint, audit what already exists. Most REST violations are systemic (copy-pasted across a codebase), so find the pattern, not just the instance.

### Checklist of violations to grep for

**1. Verbs in URLs (RPC leaking into route paths)**

```bash
# Find route definitions containing verb-like segments
grep -rEn "(app|router)\.(get|post|put|patch|delete)\(['\"](.*\/(get|create|update|delete|remove|fetch|process|list)[A-Z]?[a-zA-Z]*)" \
  --include="*.ts" --include="*.js" src/
```

**2. Inconsistent pluralization across resources**

```bash
# List every top-level route segment to spot singular/plural drift
grep -rEon "(app|router)\.(get|post|put|patch|delete)\(['\"]\/[a-zA-Z_-]+" \
  --include="*.ts" src/routes | sed -E "s/.*\('([^']+)'.*/\1/" | sort -u
# Manually scan output for e.g. "/order" next to "/users" next to "/product"
```

**3. Missing pagination on list endpoints**

```bash
# Find GET collection handlers that don't reference limit/cursor/offset/page anywhere in the function body
grep -rln "router\.get(['\"]\/[a-z-]\+['\"]" --include="*.ts" src/routes | \
  xargs grep -L -E "limit|cursor|offset|page"
```

**4. Endpoints returning raw arrays instead of an enveloped/paginated shape**

```bash
grep -rn "res\.json(\[" --include="*.ts" src/
grep -rn "res\.status(200)\.json(await .*\.findAll\(\))" --include="*.ts" src/
```

**5. Inconsistent or missing error envelopes**

```bash
# Surface every distinct error response shape in the codebase
grep -rn "res\.status(4[0-9][0-9]).json(" --include="*.ts" src/ | \
  sed -E 's/^[^:]+:[0-9]+://' | sort -u
# If this produces more than one JSON shape, error responses are inconsistent.
```

**6. Non-idempotent PUT/DELETE handlers**

```bash
# Flag PUT/DELETE handlers using increment/append/push-style mutations
grep -rn "router\.put(" -A 15 --include="*.ts" src/routes | grep -E "\+\+|\.push\(|increment"
```

**7. Hardcoded status codes that bypass a shared constants/enum file**

```bash
grep -rn "res\.status([0-9]\{3\})" --include="*.ts" src/ | wc -l
# Compare against usages of a shared HttpStatus enum, if one exists:
grep -rln "HttpStatus\." --include="*.ts" src/ | wc -l
```

**8. Version-less routes in a codebase that claims to be versioned**

```bash
grep -rEn "app\.use\(['\"]\/api['\"]" --include="*.ts" src/ | grep -v "/v[0-9]"
```

### Discovery output

Produce a short table before implementation begins:

| Route | Violation | Severity |
|---|---|---|
| `POST /getUserOrders` | verb-in-URL, wrong method | High |
| `GET /order/:id` | inconsistent singular vs `/users`, `/products` | Medium |
| `GET /users` | no pagination, will degrade at scale | High |
| `DELETE /sessions/:id` | returns `200 {}` instead of `204` | Low |

---

## Phase 2: Execution & Implementation

Below is a complete, typed reference implementation for an `Order` resource controller (Express + Zod), including the error envelope, cursor pagination, and matching OpenAPI documentation. Treat this as the gold-standard template to adapt per resource.

### 2.1 Error Envelope Schema

```typescript
// src/errors/api-error.ts
export type ApiErrorCode =
  | "VALIDATION_FAILED"
  | "INVALID_CURSOR"
  | "RESOURCE_NOT_FOUND"
  | "CONFLICT"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export interface ApiErrorDetail {
  field?: string;
  issue: string;
}

export interface ApiErrorEnvelope {
  error: {
    code: ApiErrorCode;
    message: string;
    details: ApiErrorDetail[];
    // Correlation id for support/log lookup — always present, never omitted.
    requestId: string;
  };
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ApiErrorCode,
    message: string,
    public readonly details: ApiErrorDetail[] = []
  ) {
    super(message);
    this.name = "ApiError";
  }

  toEnvelope(requestId: string): ApiErrorEnvelope {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
        requestId,
      },
    };
  }
}

// Central mapping — every route MUST throw ApiError, never res.status().json() ad hoc.
export const Errors = {
  validation: (details: ApiErrorDetail[]) =>
    new ApiError(400, "VALIDATION_FAILED", "Request failed validation.", details),
  invalidCursor: () =>
    new ApiError(400, "INVALID_CURSOR", "The provided pagination cursor is malformed or expired."),
  notFound: (resource: string, id: string) =>
    new ApiError(404, "RESOURCE_NOT_FOUND", `${resource} with id '${id}' was not found.`),
  conflict: (message: string) => new ApiError(409, "CONFLICT", message),
  unauthorized: () => new ApiError(401, "UNAUTHORIZED", "Authentication is required."),
  forbidden: () => new ApiError(403, "FORBIDDEN", "You do not have access to this resource."),
  rateLimited: (retryAfterSeconds: number) =>
    new ApiError(429, "RATE_LIMITED", `Too many requests. Retry after ${retryAfterSeconds}s.`),
  internal: () => new ApiError(500, "INTERNAL_ERROR", "An unexpected error occurred."),
};
```

### 2.2 Cursor Pagination Utility

```typescript
// src/pagination/cursor.ts
import { z } from "zod";
import { Errors } from "../errors/api-error";

const CursorPayloadSchema = z.object({
  createdAt: z.string().datetime(),
  id: z.string().uuid(),
});
type CursorPayload = z.infer<typeof CursorPayloadSchema>;

export function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeCursor(raw: string): CursorPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
  } catch {
    throw Errors.invalidCursor();
  }
  const result = CursorPayloadSchema.safeParse(parsed);
  if (!result.success) {
    throw Errors.invalidCursor();
  }
  return result.data;
}

export interface PageInfo {
  nextCursor: string | null;
  hasMore: boolean;
}

/**
 * Given limit+1 fetched rows, split into the page to return and the
 * pageInfo describing whether more data exists.
 */
export function buildPage<T extends { id: string; createdAt: string }>(
  fetchedRows: T[],
  limit: number
): { data: T[]; pageInfo: PageInfo } {
  const hasMore = fetchedRows.length > limit;
  const data = hasMore ? fetchedRows.slice(0, limit) : fetchedRows;
  const last = data[data.length - 1];
  return {
    data,
    pageInfo: {
      hasMore,
      nextCursor: hasMore && last ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null,
    },
  };
}
```

### 2.3 Request Schemas (Zod)

```typescript
// src/routes/orders/schemas.ts
import { z } from "zod";

export const ListOrdersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().min(1).optional(),
  status: z.enum(["pending", "paid", "shipped", "cancelled"]).optional(),
});

export const CreateOrderBodySchema = z.object({
  customerId: z.string().uuid(),
  items: z
    .array(
      z.object({
        sku: z.string().min(1),
        quantity: z.number().int().positive(),
      })
    )
    .min(1),
});

export const ReplaceOrderBodySchema = z.object({
  customerId: z.string().uuid(),
  status: z.enum(["pending", "paid", "shipped", "cancelled"]),
  items: z
    .array(
      z.object({
        sku: z.string().min(1),
        quantity: z.number().int().positive(),
      })
    )
    .min(1),
});

export const OrderIdParamSchema = z.object({
  id: z.string().uuid(),
});
```

### 2.4 Controller Implementation (Express)

```typescript
// src/routes/orders/orders.controller.ts
import { Router, Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import {
  ListOrdersQuerySchema,
  CreateOrderBodySchema,
  ReplaceOrderBodySchema,
  OrderIdParamSchema,
} from "./schemas";
import { Errors, ApiError } from "../../errors/api-error";
import { decodeCursor, buildPage } from "../../pagination/cursor";
import { OrderRepository } from "./orders.repository";

export function createOrdersRouter(repo: OrderRepository): Router {
  const router = Router();

  // GET /v1/orders  — list, cursor-paginated
  router.get("/v1/orders", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = ListOrdersQuerySchema.parse(req.query);
      const afterCursor = query.cursor ? decodeCursor(query.cursor) : null;

      // Fetch limit+1 to compute hasMore without a separate COUNT(*) query.
      const rows = await repo.findPage({
        limit: query.limit + 1,
        after: afterCursor,
        status: query.status,
      });

      const { data, pageInfo } = buildPage(rows, query.limit);

      res.status(200).json({ data, pageInfo });
    } catch (err) {
      next(err);
    }
  });

  // GET /v1/orders/:id
  router.get("/v1/orders/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = OrderIdParamSchema.parse(req.params);
      const order = await repo.findById(id);
      if (!order) throw Errors.notFound("Order", id);
      res.status(200).json({ data: order });
    } catch (err) {
      next(err);
    }
  });

  // POST /v1/orders — creation, not idempotent by default; supports Idempotency-Key
  router.post("/v1/orders", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = CreateOrderBodySchema.parse(req.body);
      const idempotencyKey = req.header("Idempotency-Key");

      if (idempotencyKey) {
        const cached = await repo.findByIdempotencyKey(idempotencyKey);
        if (cached) {
          res.status(201).location(`/v1/orders/${cached.id}`).json({ data: cached });
          return;
        }
      }

      const created = await repo.create(body, idempotencyKey);
      res.status(201).location(`/v1/orders/${created.id}`).json({ data: created });
    } catch (err) {
      next(err);
    }
  });

  // PUT /v1/orders/:id — full replacement, idempotent
  router.put("/v1/orders/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = OrderIdParamSchema.parse(req.params);
      const body = ReplaceOrderBodySchema.parse(req.body);

      const existing = await repo.findById(id);
      if (!existing) throw Errors.notFound("Order", id);

      const replaced = await repo.replace(id, body);
      res.status(200).json({ data: replaced });
    } catch (err) {
      next(err);
    }
  });

  // DELETE /v1/orders/:id — idempotent: deleting twice is not an error
  router.delete("/v1/orders/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = OrderIdParamSchema.parse(req.params);
      await repo.deleteById(id); // repository treats "already gone" as success
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  return router;
}

// Centralized error-handling middleware — the ONLY place that writes error JSON.
export function apiErrorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) {
  const requestId = (req.headers["x-request-id"] as string) ?? randomUUID();

  if (err instanceof ApiError) {
    res.status(err.status).json(err.toEnvelope(requestId));
    return;
  }

  // Zod validation errors surface here if not pre-caught.
  if (err && typeof err === "object" && "issues" in err) {
    const zodErr = err as { issues: Array<{ path: (string | number)[]; message: string }> };
    const mapped = Errors.validation(
      zodErr.issues.map((i) => ({ field: i.path.join("."), issue: i.message }))
    );
    res.status(mapped.status).json(mapped.toEnvelope(requestId));
    return;
  }

  // Anything else is an unhandled fault — never leak internals, always 500.
  console.error(`[${requestId}] Unhandled error:`, err);
  const fallback = Errors.internal();
  res.status(fallback.status).json(fallback.toEnvelope(requestId));
}
```

### 2.5 OpenAPI 3.0 Documentation

```yaml
openapi: 3.0.3
info:
  title: Orders API
  version: "1.0.0"
paths:
  /v1/orders:
    get:
      summary: List orders (cursor-paginated)
      parameters:
        - name: limit
          in: query
          schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
        - name: cursor
          in: query
          schema: { type: string }
          description: Opaque base64url token from a previous response's pageInfo.nextCursor
        - name: status
          in: query
          schema: { type: string, enum: [pending, paid, shipped, cancelled] }
      responses:
        "200":
          description: A page of orders
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items: { $ref: "#/components/schemas/Order" }
                  pageInfo:
                    $ref: "#/components/schemas/PageInfo"
        "400":
          description: Malformed cursor or query parameters
          content:
            application/json:
              schema: { $ref: "#/components/schemas/ErrorEnvelope" }
    post:
      summary: Create an order
      parameters:
        - name: Idempotency-Key
          in: header
          required: false
          schema: { type: string, format: uuid }
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: "#/components/schemas/CreateOrderRequest" }
      responses:
        "201":
          description: Order created
          headers:
            Location:
              schema: { type: string }
          content:
            application/json:
              schema:
                type: object
                properties:
                  data: { $ref: "#/components/schemas/Order" }
        "400":
          description: Validation failed
          content:
            application/json:
              schema: { $ref: "#/components/schemas/ErrorEnvelope" }
  /v1/orders/{id}:
    get:
      summary: Get a single order
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: string, format: uuid }
      responses:
        "200":
          description: The order
          content:
            application/json:
              schema:
                type: object
                properties:
                  data: { $ref: "#/components/schemas/Order" }
        "404":
          description: Order not found
          content:
            application/json:
              schema: { $ref: "#/components/schemas/ErrorEnvelope" }
    put:
      summary: Replace an order (idempotent)
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: string, format: uuid }
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: "#/components/schemas/ReplaceOrderRequest" }
      responses:
        "200":
          description: Order replaced
        "404":
          description: Order not found
    delete:
      summary: Delete an order (idempotent)
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: string, format: uuid }
      responses:
        "204":
          description: Deleted (or already absent)
components:
  schemas:
    PageInfo:
      type: object
      properties:
        nextCursor: { type: string, nullable: true }
        hasMore: { type: boolean }
    Order:
      type: object
      properties:
        id: { type: string, format: uuid }
        customerId: { type: string, format: uuid }
        status: { type: string, enum: [pending, paid, shipped, cancelled] }
        createdAt: { type: string, format: date-time }
    CreateOrderRequest:
      type: object
      required: [customerId, items]
      properties:
        customerId: { type: string, format: uuid }
        items:
          type: array
          items:
            type: object
            properties:
              sku: { type: string }
              quantity: { type: integer, minimum: 1 }
    ReplaceOrderRequest:
      allOf:
        - $ref: "#/components/schemas/CreateOrderRequest"
        - type: object
          required: [status]
          properties:
            status: { type: string, enum: [pending, paid, shipped, cancelled] }
    ErrorEnvelope:
      type: object
      properties:
        error:
          type: object
          properties:
            code: { type: string }
            message: { type: string }
            details:
              type: array
              items:
                type: object
                properties:
                  field: { type: string }
                  issue: { type: string }
            requestId: { type: string }
```

---

## Phase 3: Automated Verification

Every claim made above must be enforced by tests, not convention. Use `vitest` + `supertest` against the running Express app.

### 3.1 Test Setup

```typescript
// tests/orders.test.ts
import request from "supertest";
import { describe, it, expect, beforeAll } from "vitest";
import { buildApp } from "../src/app";
import type { Express } from "express";

let app: Express;

beforeAll(() => {
  app = buildApp(); // wires router + apiErrorHandler against an in-memory/test repo
});
```

### 3.2 Status Code Assertions

```typescript
describe("POST /v1/orders", () => {
  it("returns 201 with a Location header on success", async () => {
    const res = await request(app)
      .post("/v1/orders")
      .send({ customerId: crypto.randomUUID(), items: [{ sku: "SKU-1", quantity: 2 }] });

    expect(res.status).toBe(201);
    expect(res.headers.location).toMatch(/^\/v1\/orders\/[0-9a-f-]{36}$/);
    expect(res.body.data.id).toBeTruthy();
  });

  it("returns 400 (not 500) for a validation failure", async () => {
    const res = await request(app).post("/v1/orders").send({ items: [] }); // missing customerId, empty items

    expect(res.status).toBe(400);
  });
});

describe("DELETE /v1/orders/:id", () => {
  it("returns 204 on first delete and 204 again on repeat (idempotent)", async () => {
    const create = await request(app)
      .post("/v1/orders")
      .send({ customerId: crypto.randomUUID(), items: [{ sku: "SKU-1", quantity: 1 }] });
    const id = create.body.data.id;

    const first = await request(app).delete(`/v1/orders/${id}`);
    const second = await request(app).delete(`/v1/orders/${id}`);

    expect(first.status).toBe(204);
    expect(second.status).toBe(204); // NOT 404 — deleting twice must not error
  });
});
```

### 3.3 Error Envelope Shape Assertion

```typescript
describe("Error envelope contract", () => {
  it("every 4xx/5xx response matches the standard envelope shape", async () => {
    const res = await request(app).get("/v1/orders/not-a-uuid");

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      error: {
        code: expect.any(String),
        message: expect.any(String),
        details: expect.any(Array),
        requestId: expect.any(String),
      },
    });
    // Ensure no accidental leakage of stack traces or internal fields.
    expect(res.body.error).not.toHaveProperty("stack");
  });
});
```

### 3.4 Pagination Correctness — No Duplicate/Skipped Items Across Pages

This is the highest-value test in this file: it proves cursor pagination is stable under concurrent writes, which is the entire reason to prefer it over offset pagination.

```typescript
describe("GET /v1/orders pagination", () => {
  it("walks every page with no duplicate and no skipped items", async () => {
    // Seed 45 orders so we exercise 3 pages at limit=20 (20, 20, 5).
    const seededIds: string[] = [];
    for (let i = 0; i < 45; i++) {
      const res = await request(app)
        .post("/v1/orders")
        .send({ customerId: crypto.randomUUID(), items: [{ sku: `SKU-${i}`, quantity: 1 }] });
      seededIds.push(res.body.data.id);
    }

    const seenIds = new Set<string>();
    let cursor: string | undefined;
    let pages = 0;

    do {
      const res = await request(app)
        .get("/v1/orders")
        .query({ limit: 20, ...(cursor ? { cursor } : {}) });

      expect(res.status).toBe(200);
      for (const item of res.body.data) {
        // Fails the test if pagination produced a duplicate across pages.
        expect(seenIds.has(item.id)).toBe(false);
        seenIds.add(item.id);
      }

      cursor = res.body.pageInfo.nextCursor ?? undefined;
      pages += 1;
      expect(pages).toBeLessThan(10); // guard against infinite loop on a pagination bug
    } while (cursor);

    // Every seeded id must have been observed exactly once — no skips, no dupes.
    for (const id of seededIds) {
      expect(seenIds.has(id)).toBe(true);
    }
    expect(seenIds.size).toBe(seededIds.length);
  });

  it("remains stable when an item is inserted between page fetches", async () => {
    const page1 = await request(app).get("/v1/orders").query({ limit: 5 });
    const firstPageIds = new Set(page1.body.data.map((o: { id: string }) => o.id));

    // Simulate a concurrent write: insert a brand-new order after page 1 is fetched.
    await request(app)
      .post("/v1/orders")
      .send({ customerId: crypto.randomUUID(), items: [{ sku: "NEW", quantity: 1 }] });

    const page2 = await request(app)
      .get("/v1/orders")
      .query({ limit: 5, cursor: page1.body.pageInfo.nextCursor });

    for (const item of page2.body.data) {
      // The newly-inserted row must not reappear on page 2 nor duplicate page 1 content,
      // because the cursor is anchored to (createdAt, id), not a shifting offset.
      expect(firstPageIds.has(item.id)).toBe(false);
    }
  });
});
```

### 3.5 Exact Commands to Run

```bash
# Run the full REST contract suite
npx vitest run tests/orders.test.ts

# Run with coverage to confirm every status branch in the controller is exercised
npx vitest run --coverage tests/orders.test.ts

# Lint the OpenAPI spec against the actual implementation (drift check)
npx @redocly/cli lint openapi/orders.yaml
```

Verification is not complete until all three commands pass with zero skipped assertions. Any `500` observed for what should be a `400`/`404`/`409` case is a hard failure of this skill's contract, not a "flaky test."

---

## Phase 4: Rollback & Self-Healing

### 4.1 Handling Breaking API Changes (Versioning Fallback)

When a change to a resource's shape or behavior is breaking (field removed/renamed, semantics of a field changed, status code for an existing case changed), never mutate `v1` in place. Instead:

1. **Introduce `v2` alongside `v1`** — both routers mounted simultaneously (`app.use(ordersV1Router); app.use(ordersV2Router);`).
2. **`v1` becomes a compatibility shim over the `v2` implementation**, not a separately maintained code path, wherever the mapping is lossless:
   ```typescript
   // v1 shim: translate v2's richer shape back to v1's contract
   router.get("/v1/orders/:id", async (req, res, next) => {
     try {
       const v2Order = await ordersV2Service.findById(req.params.id);
       if (!v2Order) throw Errors.notFound("Order", req.params.id);
       res.status(200).json({ data: toV1Shape(v2Order) }); // drop/rename fields for old clients
     } catch (err) {
       next(err);
     }
   });
   ```
3. **Set a deprecation sunset header on every `v1` response** so clients get machine-readable warning ahead of removal:
   ```typescript
   res.set("Deprecation", "true");
   res.set("Sunset", "Wed, 01 Apr 2027 00:00:00 GMT");
   res.set("Link", '</docs/migrating-to-v2>; rel="deprecation"');
   ```
4. **Never remove `v1` on a hard deadline** — monitor actual traffic to `v1` (log `req.path` version segment to metrics) and only retire it once traffic drops to zero or the sunset date passes, whichever is governed by your API's support policy.
5. If a breaking change must ship to the *same* version due to a security fix, that is the one exception — document it loudly in a changelog and notify consumers directly; do not rely on versioning to protect against a change that must apply universally immediately.

### 4.2 Handling Malformed Cursor Tokens (400, Never 500)

A malformed, tampered, or expired cursor is **client input**, not a server fault — it must never surface as an unhandled exception that produces a `500`. The implementation in section 2.2 (`decodeCursor`) already guards both failure modes:

```typescript
export function decodeCursor(raw: string): CursorPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
  } catch {
    // Base64 decode failure OR invalid JSON -> throw ApiError, caught by
    // apiErrorHandler and converted to a clean 400 INVALID_CURSOR response.
    throw Errors.invalidCursor();
  }
  const result = CursorPayloadSchema.safeParse(parsed);
  if (!result.success) {
    // Well-formed JSON but wrong shape (e.g. tampered payload, old cursor
    // schema from a since-changed sort key) -> also 400, not 500.
    throw Errors.invalidCursor();
  }
  return result.data;
}
```

**Self-healing checklist for cursor failures:**
- If the sort key used to build cursors ever changes (e.g. switching sort from `createdAt` to `updatedAt`), old cursors become semantically invalid even though they parse successfully. Version the cursor payload itself (`{ v: 2, sortKey: "updatedAt", id, value }`) and reject/ignore cursors with an unrecognized `v`, falling back to `INVALID_CURSOR` (400) rather than silently returning wrong data.
- Never let a cursor-decode failure propagate to the database layer (e.g. passing `undefined` into a `WHERE` clause) — that is how a malformed cursor turns into a full unfiltered table scan or a `500` from a driver-level type error. Validate and fail fast, before any query executes.
- Log invalid-cursor events at `warn`, not `error` — they are expected client behavior (bookmarked URLs, stale mobile app caches), not system faults, and should not page anyone.
- If cursors are used for infinite-scroll UX, the client-side self-healing counterpart is: on `INVALID_CURSOR`, drop the stored cursor and refetch the first page rather than showing a dead-end error screen.

### 4.3 General Self-Healing Principles

- **Fail closed on ambiguity, fail loud on bugs.** A malformed request from a client should always resolve to a clear 4xx; an internal invariant violation should always resolve to a logged 500 with a `requestId` an operator can trace — never let the two categories blur.
- **Every error response is traceable.** The `requestId` in the envelope must appear in server logs at the point of failure, so a support ticket referencing a `requestId` can be grepped directly to the causing stack trace.
- **Circuit-break on dependency failure, don't 500 through it.** If an endpoint depends on a downstream service that is down, return `503` with `Retry-After`, not a `500` that implies the bug is local.

---

## Common Anti-Patterns vs Gold Standard

| # | Anti-Pattern | Gold Standard | Why it matters |
|---|---|---|---|
| 1 | `POST /getUserOrders`, `POST /createOrder` (verbs baked into URL) | `GET /users/:id/orders`, `POST /orders` (nouns + HTTP method carries the verb) | Verb-in-URL breaks cacheability, defeats generic REST tooling, and duplicates meaning already carried by the method. |
| 2 | Offset pagination (`?offset=100000&limit=20`) on a large/high-write table | Cursor pagination (`?cursor=...&limit=20`) anchored to a stable sort key + tiebreaker | Offset degrades to a full scan at depth and skips/duplicates rows under concurrent writes; cursor pagination is O(log n) and stable. |
| 3 | Every error returns `500` regardless of cause (validation, not-found, auth all collapse to one status) | Status code reflects the failure category precisely: `400` validation, `401`/`403` auth, `404` missing, `409` conflict, `500` only for true faults | Clients (and on-call engineers) cannot distinguish "you sent bad input" from "we broke" without correct status codes — this is the single most common REST violation. |
| 4 | Ad hoc error JSON shape per route (`{msg: "..."}` here, `{error: "..."}` there, `{ok: false}` elsewhere) | One `ApiErrorEnvelope` shape (`{error:{code,message,details,requestId}}`) enforced by a single central error-handling middleware | Inconsistent shapes force every client to write bespoke error parsing per endpoint and make cross-service error handling impossible to generalize. |
| 5 | `PUT` handler that appends to a list or increments a counter | `PUT` performs full-resource replacement (idempotent); use `POST` sub-resource or `PATCH` with documented semantics for partial/additive updates | Breaks the idempotency contract that clients, load balancers, and retry middleware rely on for PUT. |
| 6 | Breaking change shipped in place on `v1` (field renamed/removed with no new version) | New behavior ships as `v2`; `v1` kept as a compatibility shim with `Deprecation`/`Sunset` headers until traffic drops to zero | In-place breaking changes silently break every existing client with no warning or migration path. |
| 7 | Deleting an already-deleted resource returns `404`/`500` | `DELETE` is idempotent: repeat calls return `204` | Retried DELETE calls (common after network timeouts) should not be treated as errors — the end state the client wants is already achieved. |
| 8 | Malformed pagination cursor crashes the query layer and surfaces as `500` | Cursor is decoded and schema-validated before touching the database; malformed cursor returns `400 INVALID_CURSOR` | Client input errors must never present as server faults — this also prevents accidental unfiltered table scans from an `undefined` cursor value. |
| 9 | Inconsistent resource pluralization (`/user`, `/orders`, `/product-list`) across the same API | Every collection endpoint uses plural nouns consistently: `/users`, `/orders`, `/products` | Inconsistent naming forces every client integration to special-case route construction and signals an unreviewed API surface. |

---

## Pre-Flight Checklist

Before implementing or approving a new endpoint, confirm:

- [ ] The resource is named as a plural noun; no verbs appear in the URL path.
- [ ] The correct HTTP method is chosen based on idempotency requirements (GET/PUT/DELETE idempotent, POST is not — and a decision is made about whether an `Idempotency-Key` is needed for this POST).
- [ ] A versioning strategy (URI-path, per this skill's default) is applied consistently with the rest of the API — no unversioned routes introduced into a versioned API.
- [ ] List endpoints are designed with cursor-based pagination from the start, not retrofitted after the table grows large.
- [ ] The error envelope schema (`code`/`message`/`details`/`requestId`) is reused from the shared `ApiError` module, not reinvented per route.
- [ ] Every planned response status code is enumerated up front (2xx success cases, 4xx client-fault cases, and the single generic 5xx fallback) and matches the semantics table in this skill.
- [ ] Request body/query/param validation is defined with a schema library (Zod or equivalent) before any handler logic is written.
- [ ] An OpenAPI spec fragment is drafted alongside the code, not after — implementation and documentation should be reviewed together.
- [ ] HATEOAS is explicitly considered and consciously accepted or rejected for this API's audience, not defaulted into either direction.
- [ ] Breaking-change blast radius is assessed: does this change require a new major version, or is it additive/backward-compatible?

## Post-Flight Checklist

After implementation, before merge:

- [ ] `npx vitest run` passes for all new/updated route tests, including explicit status-code assertions for every documented response.
- [ ] The pagination round-trip test (walk every page, assert no duplicate/skipped ids) passes against a seeded dataset large enough to span at least 3 pages.
- [ ] A test exists proving a malformed/tampered cursor returns `400 INVALID_CURSOR`, not `500`.
- [ ] A test exists proving repeated `DELETE` calls on the same resource both return `204` (idempotency verified, not assumed).
- [ ] Every 4xx/5xx response body in tests is asserted to match the `ApiErrorEnvelope` shape exactly, including presence of `requestId`.
- [ ] The OpenAPI spec is linted (`npx @redocly/cli lint`) and matches the implemented routes, methods, and status codes with no drift.
- [ ] Grep audits from Phase 1 are re-run against the changed files to confirm no new verb-in-URL, missing-pagination, or ad hoc error shape violations were introduced.
- [ ] If this change is breaking, a new version segment exists (`/v2/...`), the prior version's routes still function, and `Deprecation`/`Sunset` headers are set on the outgoing version.
- [ ] Logs emitted on error paths include `requestId` and are at the correct level (`warn` for expected client errors like invalid cursors, `error` only for genuine internal faults).
- [ ] Response `Content-Type` and, for creation endpoints, the `Location` header are verified present and correctly formed in tests.
