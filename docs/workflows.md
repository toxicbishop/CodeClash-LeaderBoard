# Operational Workflows

This document specifies the end-to-end operational lifecycle of the Centralized Leaderboard Management System, from initial competition setup to contest-set ingestion, validation, consolidation, ranking, publication, and institutional monitoring, matching Section 6 and Section 19 of `Revised_LeaderBoardManagement(CodeClash).docx` (Version 2.0).

---

## Complete End-to-End Workflow

```mermaid
sequenceDiagram
    autonumber
    actor SA as Super Admin
    actor MLA as Master Lab Admin
    participant APP as System Ingestion Engine
    participant DB as PostgreSQL
    actor MON as Principal / HOD (Monitoring)
    actor PUB as Public / Contestants

    SA->>APP: Create Competition & Configure Contest Sets (Sets A, B, C, D)
    SA->>APP: Define Top-K Limit, Deadline, & Scoring/Tie-Breaking Rules
    SA->>APP: Provision Master Lab Admin, HOD, & Principal Accounts
    
    rect rgb(240, 248, 255)
        Note over MLA,APP: Centralized Contest Set Uploads (Any Order)
        MLA->>APP: Access Centralized Upload Console
        MLA->>APP: Upload Set A, B, C, D Files (.csv / .xlsx)
        MLA->>APP: Map Source Columns (if needed)
        APP->>APP: Validate File Schema, Check Numeric Scores, Detect Cross-Set Duplicates
        APP->>MLA: Present Validation Reports (Total, Valid, Invalid, Duplicates)
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
        Note over SA,APP: Repeat until ALL configured contest sets are Approved
    end

    rect rgb(240, 255, 240)
        Note over MLA,SA,APP: Consolidation & Lexicographical Ranking
        APP->>APP: Verify All Sets Approved (Completion Check)
        MLA->>APP: Trigger Consolidation & Ranking Calculation
        APP->>APP: Merge Set Records, Apply Lexicographical Tie-Breakers, Assign Shared Ranks
        APP->>SA: Present Draft Consolidated Standings (Status: Ready for Review)
        SA->>APP: Approve Final Leaderboard & Click "Publish"
        APP->>DB: Store Immutable Snapshot (v1.0)
    end

    par Real-Time Dissemination
        APP->>PUB: Expose Official Leaderboard on `/leaderboard` & Projectors
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
  * Contest-set identifiers and names: `Set A` (`SET_A`), `Set B` (`SET_B`), `Set C` (`SET_C`), `Set D` (`SET_D`).
  * Qualification limit for top performers (e.g., $K = 10$).
  * Upload deadline and file format requirements (`.csv`, `.xlsx`).
  * Lexicographical ranking and tie-breaking criteria.
* The application automatically instantiates independent upload slots for each configured contest set.

### 2. User Account Provisioning & Role Assignment
* The Super Admin creates credentials for:
  * **Master Lab Admin:** Assigned to handle centralized file uploads and consolidation.
  * **HOD:** Assigned read-only monitoring dashboard access.
  * **Principal:** Assigned read-only monitoring dashboard access.
* Public self-registration is disabled; credentials are distributed securely to designated authorities.

### 3. Centralized Contest Set Uploads
* The Master Lab Admin signs in and accesses the centralized upload console.
* The dashboard displays dedicated upload slots for every configured contest set (Set A, B, C, D).
* **Asynchronous Uploads:** Files may be uploaded in **any order** (e.g., Set C and Set D first, followed by Set A and Set B).
* **Column Mapping:** If headers differ from the system standard (e.g., HackerRank export using `Username`, `Score`, `Time Taken`), the Master Lab Admin maps them to internal schema fields: `participant_code`, `name`, `score`, `problems_solved`, `penalty`.

### 4. Automated File Validation & Cross-Set Duplicate Detection
* Upon upload, the backend parsing service validates the file:
  * Ensures file matches accepted `.csv` or `.xlsx` MIME signatures.
  * Verifies required columns are present and non-empty.
  * Validates scores as numeric within allowable bounds (e.g., 0 to 100).
  * Identifies internal duplicate participant IDs within the file.
  * Cross-references against already ingested sets to detect cross-set participant ID collisions.
* The system generates an itemized validation report detailing:
  * Total Records Ingested
  * Valid Records Count
  * Invalid Records Count
  * Duplicate Records Identified
  * Specific row-level errors and explanations
* If blocking errors exist, the upload is flagged as `INVALID`, requiring correction and re-upload.

### 5. Super Admin Review & Approval Gate
* The Super Admin monitors the competition upload matrix to track progress.
* The system maintains three distinct statuses per contest set:
  1. `upload_status` (`PENDING` | `UPLOADED` | `FAILED`)
  2. `validation_status` (`PENDING` | `VALID` | `INVALID`)
  3. `approval_status` (`PENDING` | `APPROVED` | `REJECTED`)
* The Super Admin inspects the validation summary and parsed preview rows:
  * **Approve:** Locks the upload version as the authoritative dataset for that contest set.
  * **Reject:** Enters mandatory corrective feedback. The Master Lab Admin is notified to fix the file and re-upload. Re-uploading creates version `v2` and resets approval status.

### 6. Upload Completion Check
* Before consolidation can occur, the system verifies that **every** configured contest set has:
  1. An uploaded file.
  2. `VALID` validation status.
  3. `APPROVED` administrative status.
* If any set is missing, invalid, or pending review, consolidation remains locked to prevent incomplete rankings.

### 7. Data Consolidation
* Once all required sets are approved, the backend initiates consolidation:
  * Gathers all participant records across all approved contest sets into a single unified dataset.
  * Preserves participant ID, participant name, contest-set identifier, score, problems solved, and penalty.
  * Retains the source upload reference for complete audit traceability.

### 8. Lexicographical Ranking & Tie-Breaking
* The ranking engine processes the consolidated dataset against the approved ranking configuration:
  * Primary: Descending `Total Score`.
  * Secondary: Descending `Problems Solved`.
  * Tertiary: Ascending `Penalty` (contest time).
  * Quaternary: Earlier `Final Accepted Time`.
  * Quinary: Ascending `Incorrect Submissions`.
* **Shared Ranks:** Participants tied across all enabled criteria receive identical ranks (e.g., tied at Rank 1 gives both Rank 1; the next participant receives Rank 3).
* **No Artificial Set Quotas:** Contestants are ranked strictly on merit across all sets without forcing equal representation per set.
* **Top-K Selection & Boundary Ties:** Automatically tags contestants within the Top-K limit. If ties occur at rank $K$, the Super Admin applies the pre-approved institutional policy.

### 9. Review, Final Approval & Publication
* The consolidated leaderboard is generated in `Ready for Review` (draft) status.
* The Master Lab Admin and Super Admin review overall standings, set-wise distributions, and boundary cases.
* The Super Admin clicks **Publish Leaderboard**:
  * Freezes the results into an immutable snapshot (`v1.0`).
  * Switches competition state to `Published`.
* The live leaderboard becomes immediately accessible to contestants, spectators, and auditoriums via `/leaderboard` (or `/competitions/[slug]/leaderboard`).

### 10. Real-Time Institutional Monitoring
* The Principal and HOD log into their dedicated monitoring dashboards:
  * View overall competition metrics (total participants, upload progress, approved sets).
  * Switch between Set A, Set B, Set C, Set D to inspect set-wise leaderboards.
  * Inspect the unified leaderboard and Top-K roster.
  * Inspect the active tie-breaking criteria in priority order.
  * Verify publication status.
  * Optionally export leaderboard summaries.
* Monitoring access is strictly read-only; attempts to modify data are blocked at the backend API layer.

### 11. Post-Publication Corrections & Versioning
* If a post-publication correction is mandated (e.g. retroactive disqualification of an illicit submission):
  * The Master Lab Admin uploads a revised set file.
  * The file undergoes validation and Super Admin approval.
  * Re-running consolidation generates a new draft snapshot.
  * Upon Super Admin publication, snapshot `v2.0` is released.
  * The previous snapshot (`v1.0`) remains permanently archived in the audit history for complete institutional transparency.
