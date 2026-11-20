# Research References

Reviewed and updated in November 2026 to align with the revised specification: `Revised_LeaderBoardManagement(CodeClash).docx` (Version 2.0).

---

## 1. Specification Baseline

* **Authoritative Specification:** `Revised_LeaderBoardManagement(CodeClash).docx` (Version 2.0, November 2026).
* **Superseded Document:** `Leaderboard_Developer_Doc.docx` (Version 1.0, deprecated).
* **Primary Architectural Shift:** Replacement of the distributed multi-lab administrative model with a **centralized contest-set model** (Master Lab Admin, independent contest sets, unified lexicographical ranking, and institutional read-only monitoring for Principal and HOD).

---

## 2. Existing Projects & Reference Tools

Findings below come from repository documentation, including indexed README text. The repositories were not installed, executed or audited as production dependencies:

| Project | Documented Capabilities | Application to Code Clash 2026 | Limitations |
| :--- | :--- | :--- | :--- |
| [HackerRank Leaderboard GUI](https://github.com/gabyah92/HackerRankLeaderboardGUI) | Python desktop tool accepts multiple contest IDs and produces per-contest Excel files and a combined total leaderboard. | Reference for collecting multiple contests/sets and combining results into an aggregate ranking. | Documented output is desktop Excel; automatic web ingestion, server-side validation, and shared public web displays require a dedicated web platform. |
| [HackerRank Standings Tracker](https://github.com/AhmadShawkat/HackerRank_Standing_Traker) | Web application with a public standings page, organizer login, contest configuration, and periodic updates. | Reference for organizer operations, persistent standings, and role-based views. | Ranks using ACM/ICPC solved-count and penalty rules. Multi-contest support is listed as future work; uses session-based polling susceptible to token expiration. |
| [HackerRank ACM Leaderboard Extension](https://github.com/lakshith-403/Hackerrank-ACM-Leaderboard-Extension) | Browser extension reads moderator submission data, refreshes every 30 seconds, offers CSV export, timing controls, and offline demo. | Reference for contest export structures, pagination diagnostics, and timing tie-breakers. | Designed around a single selected contest and custom time-weighted scoring formulas. Uses undocumented endpoints. |

---

## 3. Design Conclusions for Version 2.0

These conclusions incorporate lessons learned from reference projects and the revised competition requirements:

1. **Centralized Ingestion over Distributed Proctor Logins:** Rather than provisioning dozens of physical lab accounts, a single Master Lab Admin uploads all contest-set files (Sets A, B, C, D) through an asynchronous upload console.
2. **Contest-Set Equivalence Verification:** Direct cross-set ranking is valid only when contest sets are verified by organizers to be equivalent in terms of total marks (100 marks), difficulty, question count, and duration.
3. **Cross-Set Duplicate Participant Detection:** Identifying participant IDs that appear across multiple contest sets is essential to prevent score inflation and contest rule violations.
4. **Lexicographical Tie-Breaking:** Application ranking must follow configured institutional criteria (Total Score &rarr; Problems Solved &rarr; Total Penalty &rarr; Accepted Time) rather than default platform tie-breakers or arbitrary alphabetical ordering.
5. **Shared Rankings:** Contestants tied across all enabled criteria receive identical ranks (e.g., 1, 1, 3) to ensure fairness.
6. **Institutional Monitoring Separation:** Principal and HOD require dedicated read-only dashboards with full competition visibility but zero data-modification permissions, enforced at the API layer.
7. **Immutable Snapshot Publication:** Leaderboard releases must be versioned (`v1.0`, `v2.0`) and immutable, providing complete auditability for institutional transparency.

---

## 4. Platform & Technology References

* [HackerRank Contest and Scoring Guidelines](https://www.hackerrank.com/problemsetter/p/): Describes partial-credit, binary scoring, and standard tie-break options.
* [Next.js App Router Documentation](https://nextjs.org/docs/app): Guide for Server Components, Route Handlers, and Server Actions.
* [React 19 Documentation](https://react.dev/): Reference for hooks, concurrent rendering, and accessible form handling.
* [Tailwind CSS v4](https://tailwindcss.com/docs): Utility-first CSS styling for high-contrast projector displays.
* [Prisma ORM with PostgreSQL](https://docs.prisma.io/docs/orm/overview/databases/postgresql): Relational data modeling, schema migrations, and transactional guarantees.
