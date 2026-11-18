# Research references

Reviewed during planning on 18 November 2026. Findings below come from repository documentation, including indexed README text where direct page retrieval failed. The repositories were not installed, executed or audited. Current live compatibility has not been verified.

## Existing projects

| Project | Documented capabilities | Application to Code Clash | Limitations |
| --- | --- | --- | --- |
| [HackerRank Leaderboard GUI](https://github.com/gabyah92/HackerRankLeaderboardGUI) | Python desktop tool accepts multiple contest IDs and produces per-contest Excel files and a combined total leaderboard. | Reference for collecting multiple contests and combining results. | Documented output is Excel; automatic collection and a shared public web display would need additional work. |
| [HackerRank Standings Tracker](https://github.com/AhmadShawkat/HackerRank_Standing_Traker) | Laravel application with a public standings page, organizer login, contest configuration and updates every minute. Uses internal submission data and an organizer session cookie. | Reference for organizer operations, background collection and persistent standings. | Ranks using ACM/ICPC solved-count and penalty rules. Multi-contest support is listed as future work. Session access can expire. |
| [HackerRank ACM Leaderboard Extension](https://github.com/lakshith-403/Hackerrank-ACM-Leaderboard-Extension) | Browser extension reads moderator submission data, refreshes every 30 seconds and offers CSV export, timing controls and an offline demo. | Reference for rehearsal, source pagination and collection diagnostics. | Designed around a selected contest and a custom time-weighted scoring formula. Uses undocumented endpoints. |

## Design conclusions

These are our conclusions from the documented features, not claims that the repositories already implement Code Clash's full requirements.

- Multi-contest collection and a shared live display are separate capabilities that must be combined.
- Assigned-set filtering is essential; summing every contest in which a username appears would allow unintended scores to count.
- Source collection should happen centrally, with lab screens reading our saved results.
- Keep the event's marks-based rules independent of the ACM/ICPC formulas in reference projects.
- Treat internal endpoints and session-based integration as a dependency to validate, with visible failure handling.
- Test complete-result collection before investing in a finished visual design.

No source code from these projects has been copied into this repository. Check the exact license and required attribution before any future reuse.

## HackerRank scoring reference

[HackerRank contest and challenge guidelines](https://www.hackerrank.com/problemsetter/p/) describe partial-credit and binary challenge scoring, default leaderboard tie-break options and ACM-style scoring. Event configuration and application ranking must agree. The platform's native tie-break options do not automatically define a fair cross-contest aggregate rule.

## Technology references

- [Next.js server and client components](https://nextjs.org/docs/app/getting-started/server-and-client-components)
- [Next.js backend capabilities](https://nextjs.org/docs/app/guides/backend-for-frontend)
- [Next.js authentication](https://nextjs.org/docs/app/guides/authentication)
- [Tailwind CSS](https://tailwindcss.com/docs/styling-with-utility-classes)
- [Prisma PostgreSQL connector](https://docs.prisma.io/docs/orm/core-concepts/supported-databases/postgresql)
- [Railway services](https://docs.railway.com/services)
- [Railway scheduled jobs](https://docs.railway.com/cron-jobs)

Hosting and package capabilities should be checked again when choosing versions and deployment settings. The proposed frequent score refresh uses a persistent worker; a hosting provider's cron schedule is not assumed to guarantee that cadence.
