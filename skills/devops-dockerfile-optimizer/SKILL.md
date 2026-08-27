---
name: devops-dockerfile-optimizer
description: Write secure, multi-stage Dockerfiles with layer caching, minimal Alpine base images, and non-root execution users.
---

# Secure Multi-Stage Dockerfile Optimizer

Use this skill when containerizing Node.js, Python, Next.js, or Go applications.

## Best Practices
1. **Multi-Stage Builds**: Separate build-time dependencies (compilers) from runtime images.
2. **Layer Caching**: Copy `package.json` / `requirements.txt` first before source files.
3. **Non-Root User**: Never run containers as `root` (use `USER node` or `USER appuser`).
4. **Healthchecks**: Include `HEALTHCHECK --interval=30s CMD curl -f http://localhost:PORT/health || exit 1`.
