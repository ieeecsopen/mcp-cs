---
name: react-state-architecture
description: Activate when structuring state management in React 18/19 and Next.js applications, selecting between Zustand, TanStack Query, and React Server Components, eliminating prop drilling, and handling cache invalidation — trigger phrasings include "how should I manage state in this React app", "setup Zustand store", "configure TanStack Query caching", "manage server vs client state in Next.js", "eliminate prop drilling", or "fix state race conditions". Enforces clear separation between Server State, Global Client State, and Local UI State.
version: 1.0.0
author: IEEE Computer Society of SLIIT
tags: [react-state, zustand, tanstack-query, nextjs-state, cache-invalidation, state-architecture, frontend-architecture]
---

# React & Next.js State Architecture Runbook

## Mission

Architect scalable, performant, and race-condition-free state in modern React applications. Anti-patterns like putting asynchronous server data into global Redux/Zustand stores cause stale cache bugs, duplicate network requests, and massive re-render cascades. This skill enforces the modern state taxonomy: delegating server data to TanStack Query/SWR, UI state to lightweight Zustand stores, and component state to local React hooks.

---

## The Three-Tier State Taxonomy

```
┌────────────────────────────────────────────────────────────────────────────┐
│                         State Taxonomy Breakdown                           │
├──────────────────────┬─────────────────────────────┬───────────────────────┤
│ Tier                 │ Technology Solution         │ Example Use Cases     │
├──────────────────────┼─────────────────────────────┼───────────────────────┤
│ 1. Server State      │ TanStack Query (v5) / SWR   │ User lists, API data, │
│                      │                             │ pagination, mutations │
├──────────────────────┼─────────────────────────────┼───────────────────────┤
│ 2. Global UI State   │ Zustand (Lightweight)       │ Sidebar open/closed,  │
│                      │                             │ active theme, modals  │
├──────────────────────┼─────────────────────────────┼───────────────────────┤
│ 3. Local UI State    │ `useState` / `useReducer`   │ Form inputs, accordions│
└──────────────────────┴─────────────────────────────┴───────────────────────┘
```

---

## Implementation Template: Zustand Global UI Store

```tsx
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UIState {
  isSidebarOpen: boolean;
  activeFilter: string;
  toggleSidebar: () => void;
  setFilter: (filter: string) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      isSidebarOpen: true,
      activeFilter: "all",
      toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
      setFilter: (activeFilter) => set({ activeFilter }),
    }),
    { name: "app-ui-settings" }
  )
);
```

---

## Quality Gate Checklist

- [ ] **No Server Data in Zustand**: All API endpoints managed via TanStack Query (`useQuery` / `useMutation`).
- [ ] **Atomic Selectors Used**: Zustand state accessed with specific selectors (`useUIStore(s => s.isSidebarOpen)`) to prevent unnecessary component re-renders.
- [ ] **Optimistic Updates Managed**: Mutations update cache optimistically with rollback handlers on error.
