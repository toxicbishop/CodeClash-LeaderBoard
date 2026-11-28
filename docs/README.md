# Code Clash Leaderboard Documentation

This system is a **Coding Competition – Centralized Leaderboard Management System**: a secure, transparent result-collection, validation, consolidation, and ranking platform built with Next.js, Supabase, and TypeScript.

The architecture uses a **centralized contest-set model** with **multi-round support**. A centralized **Master Lab Admin** ingests results for each contest set and round — either via live HackerRank API auto-sync (every **5 seconds**) or by uploading CSV/Excel files. The system validates incoming data, deduplicates within-round entries, consolidates approved results, applies configurable lexicographical tie-breaking rules, and publishes an authoritative unified leaderboard per round (highlighting Top-K qualified participants).

Dedicated, read-only monitoring dashboards for the **Principal** and **HOD** allow institutional observers to track live competition progress, inspect set-wise and round-wise rankings, and verify tie-breaking transparency without administrative edit permissions.

---

## Documentation Index

| Document | Purpose |
| :--- | :--- |
| [Project Scope](./project-scope.md) | System objectives, architectural evolution (v1.0 vs v2.0), user roles, multi-round contest structure, event parameters, and scope boundaries |
| [Functional Requirements](./functional-requirements.md) | The 10 core functional modules including multi-round sets, 5 s auto-sync, finite state lifecycle, security rules, and edge-case handling |
| [Data Model](./data-model.md) | Relational database schema including `round_number` on `contest_sets` and `leaderboard_snapshots`, column mappings, and integrity constraints |
| [Workflows](./workflows.md) | End-to-end operational workflow covering live API sync, per-round approval gates, consolidation, and publication |
| [Tech Stack and Architecture](./tech-stack.md) | Next.js App Router + React + TypeScript + Tailwind CSS + Supabase architecture, real-time sync design, and route tree |
| [Decisions and Delivery Plan](./decisions-and-delivery.md) | 5-phase delivery roadmap, architectural decisions register, and 18-point verification test matrix |
| [Production Deployment Guide](./production-deployment-guide.md) | End-to-end production deployment runbook, Supabase migration steps, Vercel configuration, and event-day schedule |
| [Research References](./research-references.md) | Source specifications, reference implementations, scoring guidelines, and integration dependencies |

---

## Key Facts

| Property | Value |
| :--- | :--- |
| **Auto-sync interval** | 5 seconds (lab page & leaderboard page) |
| **Rounds per set** | 1–4 (configured via pill selector; scores not cumulated) |
| **Uniqueness constraint** | `UNIQUE (competition_id, round_number, set_code)` |
| **Migration for rounds** | `20261128000000_multi_round_support.sql` |
| **Permission tests** | 68 Vitest cases (`pnpm test:permissions`) |

---

## Status Terminology

- **Confirmed:** Established by the architecture as implemented.
- **Configurable:** Parameterized in the system (e.g., Top-K threshold, number of contest sets, number of rounds, tie-breaking criteria priority and direction).
- **Open / Review:** Subject to organizer confirmation prior to contest start (e.g., contest-set equivalence confirmation, duplicate identity policy).
