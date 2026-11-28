# Operational Workflows

This document specifies the end-to-end operational lifecycle of the Centralized Leaderboard Management System — from initial competition setup through contest-set ingestion, validation, consolidation, ranking, publication, and institutional monitoring.

> [!NOTE]
> Each competition consists of **independent rounds**. Scores are **not** cumulated across rounds. Each round produces its own leaderboard snapshot. The public leaderboard displays clickable round tabs; the active round shows a live pulse indicator.

---

## Complete End-to-End Workflow

```mermaid
sequenceDiagram
    autonumber
    actor SA as Super Admin
    actor MLA as Master Lab Admin
    participant APP as System Ingestion Engine
    participant DB as Supabase (PostgreSQL + RLS)
    actor MON as Principal / HOD (Monitoring)
    actor PUB as Public / Contestants

    SA->>APP: Create Competition & Configure Contest Sets with Rounds
    SA->>APP: Define Top-K Limit, Deadline, & Scoring/Tie-Breaking Rules
    SA->>APP: Provision Master Lab Admin, HOD, & Principal Accounts

    rect rgb(240, 248, 255)
        Note over MLA,APP: Live Auto-Sync or File Upload (per Round)
        MLA->>APP: Access Centralized Upload Console (/upload)
        MLA->>APP: Enable Auto-Sync for Set A, B, C, D (5 s HackerRank polling)
        APP->>APP: Fetch HackerRank API, Validate Scores, Deduplicate within Round
        APP->>MLA: Display Sync Count, Last Sync Time, Participant Count
    end

    rect rgb(255, 250, 240)
        Note over SA,APP: Administrative Review & Approval Gate
        SA->>APP: Inspect Upload Status Matrix (Upload, Validation, Approval Statuses)
        alt Has Corrupt Records or Format Violations
            SA->>APP: Reject Upload with Corrective Comments
            APP->>MLA: Display Rejection Feedback; Request Re-upload
        else Clean & Valid Dataset
            SA->>APP: Approve Upload Slot
        end
        Note over SA,APP: Repeat until ALL configured contest sets for the round are Approved
    end

    rect rgb(240, 255, 240)
        Note over MLA,SA,APP: Consolidation & Lexicographical Ranking
        APP->>APP: Verify All Sets Approved for Target Round (Completion Check)
        MLA->>APP: Trigger Consolidation & Ranking Calculation
        APP->>APP: Merge Set Records, Apply Lexicographical Tie-Breakers, Assign Shared Ranks
        APP->>SA: Present Draft Consolidated Standings (Status: Ready for Review)
        SA->>APP: Approve Final Leaderboard & Click "Publish"
        APP->>DB: Store Immutable Snapshot (v1.0, Round N)
    end

    par Real-Time Dissemination
        APP->>PUB: Expose Official Leaderboard on `/leaderboard` & Projectors (5 s auto-refresh)
    and Institutional Monitoring
        APP->>MON: Display Read-Only Monitoring Dashboard (Progress, Set-Wise & Unified Standings)
    end
```

---

## Detailed Step-by-Step Procedure

### 1. Competition Creation & Contest Set Configuration
* The Super Admin navigates to `/admin/competitions` and configures:
  * Event title (e.g., `Code Clash 2026`), scheduled date, and description.
  * Number of contest sets (dynamic, e.g., 4 sets).
  * Contest-set identifiers: `Set A` (`setA`), `Set B` (`setB`), `Set C` (`setC`), `Set D` (`setD`).
  * **Number of rounds** per set (1–4), selected via pill buttons. A distinct HackerRank slug is required for each round.
  * Qualification limit for top performers (e.g., $K = 10$).
  * Upload deadline and file format requirements (`.csv`, `.xlsx`).
  * Lexicographical ranking and tie-breaking criteria.
* The application instantiates independent upload slots for each `(set, round)` combination.

### 2. User Account Provisioning & Role Assignment
* The Super Admin creates credentials for:
  * **Master Lab Admin:** Assigned to handle centralized file uploads and consolidation.
  * **HOD:** Assigned read-only monitoring dashboard access.
  * **Principal:** Assigned read-only monitoring dashboard access.
* Public self-registration is disabled; credentials are distributed securely to designated authorities.

### 3. Live HackerRank Auto-Sync (Primary Ingestion Method)
* The Master Lab Admin signs in and accesses `/upload`.
* The dashboard displays dedicated upload slots for every configured `(set, round)` combination.
* For each slot, the lab admin requests Super Admin approval to enable auto-sync.
* Once approved (`auto_sync_status = 'APPROVED'`), the client polls the HackerRank REST API every **5 seconds**:
  * Fetches leaderboard pages from `https://www.hackerrank.com/rest/contests/{slug}/leaderboard`.
  * Validates scores and participant handles.
  * Deduplicates within-round entries: keeps the entry with the smallest penalty if the same participant appears twice.
  * Writes normalized results to Supabase and invalidates the leaderboard cache.
* Sync count and last sync timestamp are displayed live on the lab page.

### 4. File Upload (Alternative Ingestion Method)
* **Asynchronous Uploads:** Files may be uploaded in **any order** (e.g., Set C and Set D first, followed by Set A and Set B).
* **Column Mapping:** If headers differ from the system standard (e.g., HackerRank export using `Username`, `Score`, `Time Taken`), the Lab Admin maps them to internal schema fields: `participant_code`, `name`, `score`, `problems_solved`, `penalty`.

### 5. Automated File Validation & Cross-Set Duplicate Detection
* Upon upload, the backend parsing service validates the file:
  * Ensures file matches accepted `.csv` or `.xlsx` MIME signatures.
  * Verifies required columns are present and non-empty.
  * Validates scores as numeric within allowable bounds.
  * Identifies internal duplicate participant IDs within the file.
  * Cross-references against already ingested sets within the same round to detect participant ID collisions.
* The system generates an itemized validation report detailing:
  * Total Records Ingested
  * Valid Records Count
  * Invalid Records Count
  * Duplicate Records Identified
  * Specific row-level errors and explanations
* If blocking errors exist, the upload is flagged as `INVALID`, requiring correction and re-upload.

### 6. Super Admin Review & Approval Gate
* The Super Admin monitors the competition upload matrix to track progress.
* The system maintains three distinct statuses per contest set:
  1. `upload_status` (`PENDING` | `UPLOADED` | `FAILED`)
  2. `validation_status` (`PENDING` | `VALID` | `INVALID`)
  3. `approval_status` (`PENDING` | `APPROVED` | `REJECTED`)
* The Super Admin inspects the validation summary and parsed preview rows:
  * **Approve:** Locks the upload version as the authoritative dataset for that contest set.
  * **Reject:** Enters mandatory corrective feedback. The Master Lab Admin is notified to fix the file and re-upload. Re-uploading creates version `v2` and resets approval status.

### 7. Upload Completion Check
* Before consolidation can occur, the system verifies that **every** configured contest set for the target round has:
  1. An uploaded file (via API sync or file upload).
  2. `VALID` validation status.
  3. `APPROVED` administrative status.
* If any set is missing, invalid, or pending review, consolidation remains locked to prevent incomplete rankings.

### 8. Data Consolidation
* Once all required sets for the round are approved, the backend initiates consolidation:
  * Gathers all participant records across all approved contest sets into a single unified dataset for that round.
  * Preserves participant ID, participant name, contest-set identifier, score, problems solved, and penalty.
  * Retains the source upload reference for complete audit traceability.

### 9. Lexicographical Ranking & Tie-Breaking
* The ranking engine processes the consolidated dataset against the approved ranking configuration:
  * Primary: Descending `Total Score`.
  * Secondary: Descending `Problems Solved`.
  * Tertiary: Ascending `Penalty` (contest time).
  * Quaternary: Earlier `Final Accepted Time`.
  * Quinary: Ascending `Incorrect Submissions`.
* **Shared Ranks:** Participants tied across all enabled criteria receive identical ranks (e.g., tied at Rank 1 gives both Rank 1; the next participant receives Rank 3).
* **No Artificial Set Quotas:** Contestants are ranked strictly on merit across all sets without forcing equal representation per set.
* **Top-K Selection & Boundary Ties:** Automatically tags contestants within the Top-K limit. If ties occur at rank $K$, the Super Admin applies the pre-approved institutional policy.

### 10. Review, Final Approval & Publication
* The consolidated leaderboard is generated in `Ready for Review` (draft) status.
* The Master Lab Admin and Super Admin review overall standings, set-wise distributions, and boundary cases.
* The Super Admin clicks **Publish Leaderboard**:
  * Freezes the results into an immutable snapshot (`v1.0` for Round N).
  * Switches competition state to `Published`.
* The live leaderboard becomes immediately accessible to contestants, spectators, and auditoriums via `/leaderboard` (or `/competitions/[slug]/leaderboard`). The page auto-refreshes every **5 seconds**.

### 11. Real-Time Institutional Monitoring
* The Principal and HOD log into their dedicated monitoring dashboards:
  * View overall competition metrics (total participants, upload progress, approved sets per round).
  * Switch between sets and rounds to inspect set-wise leaderboards.
  * Inspect the unified leaderboard and Top-K roster.
  * Inspect the active tie-breaking criteria in priority order.
  * Verify publication status.
  * Optionally export leaderboard summaries.
* Monitoring access is strictly read-only; attempts to modify data are blocked at the backend API layer.

### 12. Post-Publication Corrections & Versioning
* If a post-publication correction is mandated (e.g. retroactive disqualification of an illicit submission):
  * The Master Lab Admin uploads a revised set file or the auto-sync brings in updated data.
  * The file undergoes validation and Super Admin approval.
  * Re-running consolidation generates a new draft snapshot.
  * Upon Super Admin publication, snapshot `v2.0` for the round is released.
  * The previous snapshot (`v1.0`) remains permanently archived in the audit history for complete institutional transparency.
