---
name: devops-vercel-render-deploy
description: Activate when deploying web applications, Next.js frontends, Node/Python backends, or PostgreSQL databases to cloud hosting platforms (Vercel, Render, Supabase, Railway) — trigger phrasings include "deploy my project to Vercel", "how do I host this Next.js app", "deploy backend to Render", "setup Supabase database", "configure production environment variables", or "fix failed Vercel build". Produces zero-downtime deployment configurations, build command settings, and production secret synchronization.
version: 1.0.0
author: IEEE Computer Society of SLIIT
tags: [cloud-deployment, vercel, render, supabase, railway, devops-hosting, production-deploy]
---

# Cloud Deployment & Hosting Setup Runbook

## Mission

Deploy full-stack web applications and backend services with zero deployment friction. Student and developer deployments frequently fail due to misconfigured build commands (`npm run build`), missing production environment variables, unrouted single-page app (SPA) fallback routes, or broken database connection pooling. This skill establishes standardized production configurations across Vercel (Frontends), Render/Railway (Backends & Workers), and Supabase (PostgreSQL & Auth).

---

## Platform Deployment Architecture Matrix

```
┌────────────────────────────────────────────────────────────────────────────┐
│                    Full-Stack Hosting Platform Mapping                     │
├──────────────────────┬─────────────────────────────┬───────────────────────┤
│ Application Layer    │ Recommended Platform        │ Build & Run Command   │
├──────────────────────┼─────────────────────────────┼───────────────────────┤
│ Frontend (Next.js)   │ Vercel / Cloudflare Pages   │ `npm run build`       │
│ Single Page App (SPA)│ Vercel / Netlify / Render   │ `npm run build` (dist)│
│ Backend API (Fastify)│ Render Web Service / Railway│ `npm start` (dist)    │
│ Background Workers   │ Render Background Worker    │ `node dist/worker.js` │
│ Relational Database  │ Supabase / Neon Serverless  │ Port 5432 / 6543 pool │
└──────────────────────┴─────────────────────────────┴───────────────────────┘
```

---

## Single Page App Routing Configuration (`vercel.json`)

```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

---

## Quality Gate Checklist

- [ ] **Build Command Validated**: Verified `npm run build` exits with code 0 locally before triggering deployment.
- [ ] **Connection Pooling Enabled**: Supabase / PostgreSQL configured with Transaction Pooler (`port 6543`) for serverless backends.
- [ ] **Production Secrets Bound**: All variables from `.env.example` populated in the hosting provider's dashboard.
- [ ] **Custom Domain & SSL Active**: DNS records configured with automatic Let's Encrypt SSL certificates.
