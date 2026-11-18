# Code Clash Leaderboard documentation

Updated baseline aligning with `Leaderboard_Developer_Doc.docx` (November 2026).

This system is a **Multi-Lab Contest Leaderboard Management System**: a centralized result-collection, validation, consolidation, and ranking platform. It supports multi-lab coding competitions (including Code Clash 2026) where participants are distributed across multiple computer laboratories. Each lab independently uploads or syncs its contest results, and the application validates, consolidates, ranks, and publishes a single unified leaderboard (with configurable Top-K participants) for projectors, organizers, and public displays.

## Documents

| Document | Purpose |
| --- | --- |
| [Project scope](./project-scope.md) | System objectives, user roles, event parameters, and boundaries |
| [Functional requirements](./functional-requirements.md) | The 9 core functional modules, state lifecycle, security, and edge cases |
| [Tech stack](./tech-stack.md) | Architecture, Next.js implementation, routing, and REST API specification |
| [Workflows](./workflows.md) | End-to-end 11-step workflow, lab uploads, approval gates, and publication |
| [Data model](./data-model.md) | 7 relational database entities, column mapping, and data integrity rules |
| [Decisions and delivery plan](./decisions-and-delivery.md) | Phased delivery plan, decisions register, and verification test matrix |
| [Research references](./research-references.md) | Reference tools, scoring guidelines, and integration dependencies |

## Status terminology

- **Confirmed:** Established by the project requirements and developer documentation.
- **Configurable:** Parameterized in the system (e.g., Top-K value, number of labs, tie-breaking criteria).
- **Open:** Subject to organizer confirmation prior to contest start (e.g., specific tie-break order).

Always keep these documents synchronized when new specifications or decisions are recorded.
