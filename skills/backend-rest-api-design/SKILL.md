---
name: backend-rest-api-design
description: Design production-grade REST APIs with Zod schema validation, standard HTTP status codes, structured JSON error responses, and cursor pagination.
---

# Production REST API Design & Contracts

Use this skill when designing backend endpoints, route handlers, or API specifications.

## Standards
1. **Schema Validation**: Parse request body, params, and queries with Zod schemas.
2. **HTTP Verbs**: `GET` (read), `POST` (create), `PUT`/`PATCH` (update), `DELETE` (remove).
3. **Consistent Error Envelope**:
   ```json
   { "error": { "code": "VALIDATION_FAILED", "message": "Invalid email", "details": [] } }
   ```
4. **Pagination**: Implement cursor-based pagination (`limit`, `cursor`, `nextCursor`).
