---
name: react-state-architecture
description: Architect client and server state in React/Next.js using Zustand, TanStack Query, and Server Components to eliminate prop drilling and race conditions.
---

# React State Architecture & Data Fetching

Use this skill when designing state stores, managing cache invalidation, or handling async server state.

## State Taxonomy
- **Server State**: Use TanStack Query / SWR (`useQuery`, `useMutation`) for caching, pagination, and background refetching.
- **Global Client State**: Use lightweight Zustand stores for modals, sidebar toggles, and active filters.
- **Local Component State**: Use `useState` / `useReducer` for isolated form inputs and animations.
