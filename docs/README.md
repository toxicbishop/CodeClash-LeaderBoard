# Code Clash Leaderboard Documentation

Updated baseline aligning with `Revised_LeaderBoardManagement(CodeClash).docx` (Version 2.0, November 2026).

This system is a **Coding Competition – Centralized Leaderboard Management System**: a secure, transparent result-collection, validation, consolidation, and ranking platform.

In Version 2.0, the architecture has transitioned from a distributed multi-lab administrative model to a **centralized contest-set model**. Rather than having individual lab administrators upload partial files for each physical lab, a centralized **Master Lab Admin** uploads independent leaderboard files for each contest set (e.g., Set A, Set B, Set C, Set D). The system validates incoming files, identifies duplicate participants across sets, consolidates approved results, applies configurable lexicographical tie-breaking rules, and publishes an authoritative unified leaderboard (highlighting Top-K qualified participants).

Additionally, Version 2.0 introduces dedicated, read-only monitoring dashboards for the **Principal** and **HOD** (Head of Department) to observe live competition progress, inspect set-wise rankings, verify tie-breaking transparency, and audit publication statuses without administrative edit permissions.

---

## Documentation Index

| Document | Purpose |
| :--- | :--- |
| [Project Scope](./project-scope.md) | System objectives, architectural evolution (v1.0 vs v2.0), user roles (Super Admin, Master Lab Admin, HOD, Principal, Public), event parameters, and scope boundaries |
| [Functional Requirements](./functional-requirements.md) | The 10 core functional modules, finite state lifecycle, security rules, Principal/HOD monitoring, and edge-case handling |
| [Data Model](./data-model.md) | Relational database schema (`contest_sets`, `uploads`, `results`, `tiebreaker_rules`, `leaderboard_snapshots`), column mappings, and integrity constraints |
| [Workflows](./workflows.md) | End-to-end 11-step operational workflow, contest-set uploads, validation reports, approval gates, consolidation, and publication |
| [Tech Stack and Architecture](./tech-stack.md) | Full-stack Next.js 16 + React 19 + TypeScript + Tailwind CSS + Prisma + PostgreSQL architecture, route tree, and REST API specification |
| [Decisions and Delivery Plan](./decisions-and-delivery.md) | 5-phase delivery roadmap, formal architectural decisions register, and 18-point verification test matrix |
| [Research References](./research-references.md) | Source specifications, reference implementations, scoring guidelines, and integration dependencies |

---

## Status Terminology

- **Confirmed:** Established by the revised specification (`Revised_LeaderBoardManagement(CodeClash).docx` v2.0).
- **Configurable:** Parameterized in the system (e.g., Top-K threshold, number of contest sets, tie-breaking criteria priority and direction).
- **Open / Review:** Subject to organizer confirmation prior to contest start (e.g., contest-set equivalence confirmation, duplicate identity policy).
