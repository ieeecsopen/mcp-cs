---
name: frontend-clean-ui
description: Activate when designing, building, or refactoring modern, accessible, high-contrast web user interfaces, SaaS dashboards, and landing pages with Tailwind CSS, design tokens, dark mode, and responsive flex/grid layouts — trigger phrasings include "build a modern UI for my web app", "redesign this dashboard to look sleek", "apply Tailwind dark mode tokens", "create an accessible card component", "make this frontend responsive", or "improve the visual aesthetics of my interface". Enforces curated HSL/hex palettes, obsidian dark themes, glassmorphism, micro-interactions, and WCAG AA accessibility.
version: 1.0.0
author: IEEE Computer Society of SLIIT
tags: [frontend-ui, tailwind-css, design-system, dark-mode, responsive-design, saas-dashboard, accessibility-a11y]
---

# Modern Frontend & SaaS UI Design Runbook

## Mission

Transform amateur, generic web pages into sleek, high-converting, professional SaaS interfaces. Junior frontends suffer from generic primary colors (`#0000ff`, `#ff0000`), excessive gradient clutter, inconsistent padding, and illegible text contrast. This skill establishes a disciplined design token architecture: curated obsidian backgrounds, electric amber/yellow accents (`#ffd000`), subtle border luminescence, consistent 4px/8px spacing scales, and WCAG AA accessible typography.

---

## The Modern Dark-Mode Design Token System

```
┌────────────────────────────────────────────────────────────────────────────┐
│                       Core Design Token Palette                            │
├──────────────┬─────────────────────────────┬───────────────────────────────┤
│ Token Role   │ Hex Value                   │ Tailwind Utility Equivalent   │
├──────────────┼─────────────────────────────┼───────────────────────────────┤
│ Background   │ `#050505` (Obsidian Base)   │ `bg-[#050505]` / `bg-black`   │
│ Card Surface │ `rgba(18, 18, 18, 0.7)`     │ `bg-neutral-900/70 backdrop-blur`│
│ Border Glow  │ `rgba(255, 255, 255, 0.08)` │ `border-white/[0.08]`         │
│ Brand Accent │ `#ffd000` (Electric Yellow) │ `bg-[#ffd000] text-black`     │
│ Primary Text │ `#f9fafb` (Neutral 50)      │ `text-neutral-50`             │
│ Muted Text   │ `#9ca3af` (Neutral 400)     │ `text-neutral-400`            │
└──────────────┴─────────────────────────────┴───────────────────────────────┘
```

---

## Component Blueprint: The Modern Metric Card

```tsx
import React from "react";

interface MetricCardProps {
  label: string;
  value: string | number;
  change: string;
  trend: "up" | "down" | "neutral";
  icon: React.ReactNode;
}

export const MetricCard: React.FC<MetricCardProps> = ({ label, value, change, trend, icon }) => {
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-neutral-900/60 p-6 backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:border-white/[0.15] hover:shadow-xl hover:shadow-black/40">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-neutral-400">{label}</span>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-neutral-300">
          {icon}
        </div>
      </div>
      <div className="mt-4 flex items-baseline gap-3">
        <span className="text-2xl font-bold tracking-tight text-white">{value}</span>
        <span className={`inline-flex items-center text-xs font-semibold ${
          trend === "up" ? "text-emerald-400" : trend === "down" ? "text-rose-400" : "text-neutral-400"
        }`}>
          {change}
        </span>
      </div>
    </div>
  );
};
```

---

## Quality Gate Checklist

- [ ] **WCAG AA Contrast Compliant**: Text-to-background contrast ratio exceeds 4.5:1.
- [ ] **Fluid Responsive Breakpoints**: Layout adapts cleanly across `sm` (640px), `md` (768px), `lg` (1024px), and `xl` (1280px).
- [ ] **Zero Layout Shift (CLS)**: Images and skeleton loaders specify fixed aspect ratios and dimensions.
- [ ] **Keyboard Navigable**: Interactive elements include explicit `:focus-visible` outline rings.
