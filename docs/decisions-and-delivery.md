# Decisions and Delivery Plan

This document formalizes the phased implementation roadmap, architectural decisions register, and verification test matrix matching Sections 14, 17, and 18 of `Revised_LeaderBoardManagement(CodeClash).docx` (Version 2.0).

---

## Phased Implementation Roadmap

```mermaid
flowchart LR
    P1["Phase 1: Core Infrastructure, Contest Sets & RBAC"] --> P2["Phase 2: Centralized Upload & Validation Engine"]
    P2 --> P3["Phase 3: Consolidation & Lexicographical Ranking"]
    P3 --> P4["Phase 4: Publication, Public Leaderboard & Exports"]
    P4 --> P5["Phase 5: Principal & HOD Monitoring Dashboards"]
```

### Phase 1: Core Infrastructure, Contest Sets & Role-Based Access Control
* **Scope:**
  * Initialize Supabase PostgreSQL database with SQL migrations and Row-Level Security (RLS) policies for: `profiles`, `competitions`, `contest_sets`, `uploads`, `participants`, `results`, `tiebreaker_rules`, `leaderboard_snapshots`, `leaderboard_entries`, and `audit_logs`.
  * Implement Supabase Auth session-based authentication with role-based guards: `SUPER_ADMIN`, `MASTER_LAB_ADMIN`, `HOD`, and `PRINCIPAL`.
  * Build Super Admin competition management: competition setup, dynamic multi-round contest set configuration (e.g., Set A, Set B, Set C, Set D across Rounds 1–4 via `round_number`), and user account provisioning.
  * Build base Master Lab Admin console and dedicated monitoring shells for HOD and Principal.
* **Exit Condition:** Super Admin can configure a competition with 4 contest sets (and optional multi-round slugs) and assign Master Lab Admin, HOD, and Principal accounts; each user can sign in and land on their respective dashboard.

---

### Phase 2: Centralized Contest Set Upload & Validation Engine
* **Scope:**
  * Multipart file upload service supporting `.csv` and `.xlsx` files with MIME-type and magic-byte verification.
  * Centralized upload dashboard for the Master Lab Admin with independent slots for each contest set, allowing uploads in **any order**.
  * Dynamic column mapping interface (mapping raw headers to `participant_code`, `name`, `score`, `problems_solved`, `penalty`).
  * Automated file parser (`xlsx` / `papaparse`) and validation service:
    * Rejection of missing participant IDs/names, non-numeric or negative scores.
    * Detection of internal duplicate participant IDs within the uploaded file.
    * Cross-set duplicate participant detection flagging candidate collisions across contest sets.
  * Itemized validation issue report (total records, valid, invalid, duplicates, row-level errors) and 10-row preview.
  * 3-tier status tracking (`upload_status`, `validation_status`, `approval_status`) and Super Admin review/approval actions.
* **Exit Condition:** Master Lab Admin can upload sample files for Sets A, B, C, D in arbitrary order, map columns, preview parsed records, inspect validation flags, and receive Super Admin approvals.

---

### Phase 3: Centralized Consolidation & Lexicographical Ranking Engine
* **Scope:**
  * Completion gate: Round-scoped consolidation remains locked until all configured contest sets for the target round are uploaded/synced, valid, and approved.
  * Consolidation engine merging all approved set records within a given `round_number` into a unified dataset while preserving source upload references.
  * Configurable lexicographical ranking engine supporting dynamic criteria reordering and direction:
    * Primary: Descending `Total Score`.
    * Secondary: Descending `Problems Solved`.
    * Tertiary: Ascending `Penalty` (contest time).
    * Quaternary: Earlier `Final Accepted Time`.
    * Quinary: Ascending `Incorrect Submissions`.
  * Shared rank assignment logic (e.g., tied at 1st place gives 1, 1, 3).
  * Purely merit-based cross-set ranking without artificial per-set quotas.
  * Automated Top-K boundary selector and tie-resolution review workflow.
* **Exit Condition:** Given approved uploads/syncs across Sets A, B, C, D for a round totaling 180 participants, the system consolidates them into a single round-scoped ranked list, resolves ties lexicographically, handles shared ranks, and identifies the Top-K.

---

### Phase 4: Leaderboard Publication, Public View & Exports
* **Scope:**
  * Publication approval gate: Consolidated results held in `Ready for Review` draft status until Super Admin approval.
  * One-click **Publish Leaderboard** generating an immutable round-scoped snapshot (`v1.0`).
  * Simplified public and contestant leaderboard route (`/leaderboard` and `/competitions/[slug]/leaderboard`):
    * High-contrast, responsive layout optimized for auditoriums, lab projectors, and mobile screens.
    * Round tab switcher and 5-second auto-refresh polling (`Auto Sync: On (5s)`).
    * Search by participant name/code, filter by contest set, and toggle Top-K view.
    * Visual podium cards and qualification badges for Top-K contestants.
  * Export service: One-click export to CSV, Excel (`.xlsx`), and print-friendly PDF.
  * Versioned republication workflow (`v2.0`) in case of post-publication adjustments.
* **Exit Condition:** The unified leaderboard is live on `/leaderboard`, refreshes every 5 seconds, displays identical rankings to all lab monitors simultaneously, and exports clean CSV/Excel files.

---

### Phase 5: Principal and HOD Monitoring Dashboards
* **Scope:**
  * Dedicated monitoring route (`/monitoring`) accessible to HOD and Principal accounts.
  * Metrics overview: Total participants, contest sets count, upload completion ($N/N$), approval status, Top-K threshold, and publication state.
  * Set-wise leaderboard tab switcher (inspect Set A, Set B, Set C, Set D standings).
  * Unified leaderboard view with real-time draft/provisional and published indicators.
  * Ranking transparency card detailing the exact tie-breaking criteria in priority order.
  * Strict read-only backend enforcement blocking all state mutations (upload, edit, delete, publish).
* **Exit Condition:** Principal and HOD log into independent monitoring dashboards, view real-time contest progress and set-wise leaderboards, but receive HTTP 403 Forbidden on any administrative write endpoint.

---

## Decisions Register

| Decision Area | Status | Agreed Policy (Version 2.0) |
| :--- | :--- | :--- |
| **Data Collection Model** | **Confirmed** | Single Master Lab Admin uploads all contest-set files through a centralized console. |
| **Data Organization** | **Confirmed** | Organized around contest sets (e.g., Sets A, B, C, D) rather than physical laboratories. |
| **Number of Contest Sets** | **Configurable** | Configured per competition by the Super Admin (baseline: 4 sets). |
| **Upload Timing & Order** | **Confirmed** | Independent upload slots; files can be submitted in any order prior to the deadline. |
| **Completion Gate** | **Confirmed** | All configured contest sets must be uploaded, valid, and approved before consolidation unlocks. |
| **Ranking Methodology** | **Confirmed** | Unified ranking across all contest sets using a configurable lexicographical tie-breaking engine. |
| **Set Quotas** | **Confirmed** | Strictly prohibited. Ranks are assigned purely on overall performance without per-set quotas. |
| **Shared Ranks** | **Confirmed** | Equal scores across all criteria share rank (e.g., 1, 1, 3) rather than arbitrary alphabetical ordering. |
| **Top-K Cutoff Ties** | **Configurable** | Super Admin reviews boundary ties and applies pre-approved institutional policy. |
| **Contest-Set Equivalence**| **Review** | Organizers must verify equivalence of questions, marks, and duration before comparing raw scores. |
| **Institutional Monitoring**| **Confirmed** | Dedicated read-only dashboards for Principal and HOD. |
| **Snapshot Immutability** | **Confirmed** | Published snapshots are immutable (`v1.0`); post-publication fixes yield version `v2.0`. |
| **Public Endpoint** | **Confirmed** | Clean `/leaderboard` route showing contestant-facing unified standings. |
| **Multi-Round Support** | **Confirmed** | Each contest set supports 1–4 independent rounds (`round_number` 1–4) with distinct HackerRank slugs; scores do not carry over between rounds. |
| **Live Auto-Sync Interval** | **Confirmed** | Both the Lab Auto-Sync page and Public Leaderboard poll at a 5-second interval. |

---

## Verification Test Matrix & Acceptance Criteria

Every milestone must pass this verification test plan:

| Test ID | Test Scenario | Expected Result |
| :--- | :--- | :--- |
| **TC-01** | Create competition with dynamic contest sets | Super Admin creates competition and sets up Sets A, B, C, D; slots initialized. |
| **TC-02** | Provision user accounts | Super Admin provisions Master Lab Admin, HOD, and Principal accounts successfully. |
| **TC-03** | Asynchronous upload order | Master Lab Admin uploads Set C first, then Set A; both ingest independently without errors. |
| **TC-04** | Invalid file upload (missing scores/IDs) | System identifies invalid rows with line numbers and marks validation as `INVALID`. |
| **TC-05** | Internal duplicate participant detection | Validation engine flags duplicate candidate IDs within the same set file. |
| **TC-06** | Cross-set duplicate participant detection | System detects identical candidate ID uploaded in both Set A and Set B, alerting admin. |
| **TC-07** | Super Admin approval gate | Super Admin reviews validation report and approves Set A; status changes to `APPROVED`. |
| **TC-08** | Super Admin rejection gate | Super Admin rejects flawed upload with comments; Master Lab Admin prompted to re-upload. |
| **TC-09** | Re-upload versioning | Re-uploading creates version `v2`, resets approval status, and retains previous version in history. |
| **TC-10** | Incomplete sets consolidation block | Consolidation trigger remains disabled when 3 of 4 sets are approved. |
| **TC-11** | Consolidation of all approved sets | Merges records from all sets into one dataset preserving set codes and source upload IDs. |
| **TC-12** | Lexicographical ranking engine | Ties broken in exact configured priority order (Score &rarr; Solved &rarr; Penalty &rarr; Time). |
| **TC-13** | Shared rank assignment | Two contestants tied on all criteria receive identical rank (e.g. Rank 1, 1, 3). |
| **TC-14** | Top-K qualification and boundary tie | Highlights Top-K contestants; alerts Super Admin if ties occur at the qualification threshold. |
| **TC-15** | Leaderboard publication | Super Admin clicks publish; generates immutable snapshot `v1.0` and activates `/leaderboard`. |
| **TC-16** | Export published leaderboard | Downloaded CSV/Excel matches onscreen rankings, scores, and qualification statuses. |
| **TC-17** | Principal and HOD monitoring view | Both log in, view live competition metrics, set-wise leaderboards, and unified standings. |
| **TC-18** | Institutional read-only enforcement | Principal or HOD attempting to POST to `/api/sets/:id/uploads` receives HTTP 403 Forbidden. |
| **TC-19** | Multi-round set creation | Admin creates Set A with 3 rounds, each with a distinct HackerRank slug; 3 `contest_sets` rows created with `round_number` 1, 2, 3. |
| **TC-20** | Round independence | Scores from Round 1 are not carried over to the Round 2 leaderboard or snapshot. |
