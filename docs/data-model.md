# Relational Data Model

This document outlines the relational database schema, integrity constraints, and snapshot architecture implemented with PostgreSQL and Prisma ORM, matching Section 11 of `Revised_LeaderBoardManagement(CodeClash).docx` (Version 2.0).

---

## Entity Relationship Overview

The database is organized around **competitions** and **contest sets** rather than physical laboratories:

```mermaid
erDiagram
    USERS ||--o{ COMPETITIONS : "creates"
    USERS ||--o{ UPLOADS : "uploads / approves"
    USERS ||--o{ AUDIT_LOGS : "triggers"
    USERS ||--o{ LEADERBOARD_SNAPSHOTS : "publishes"
    COMPETITIONS ||--|{ CONTEST_SETS : "contains"
    COMPETITIONS ||--o{ TIEBREAKER_RULES : "governs"
    COMPETITIONS ||--o{ LEADERBOARD_SNAPSHOTS : "publishes"
    CONTEST_SETS ||--o{ UPLOADS : "receives"
    CONTEST_SETS ||--o{ RESULTS : "originates"
    CONTEST_SETS ||--o{ LEADERBOARD_ENTRIES : "contains"
    UPLOADS ||--o{ RESULTS : "contains"
    PARTICIPANTS ||--o{ RESULTS : "achieves"
    PARTICIPANTS ||--o{ LEADERBOARD_ENTRIES : "ranks as"
    LEADERBOARD_SNAPSHOTS ||--|{ LEADERBOARD_ENTRIES : "records"
```

---

## Detailed Table Schemas

### 1. `users`
Stores all administrative and institutional monitoring accounts with role-based segregation.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY`, default `gen_random_uuid()` | Unique user identifier |
| `name` | `VARCHAR(100)` | `NOT NULL` | Full name of the user |
| `email` | `VARCHAR(255)` | `NOT NULL`, `UNIQUE` | Unique login email address |
| `password_hash` | `VARCHAR(255)` | `NOT NULL` | Secure salted password hash (bcrypt/argon2) |
| `role` | `ENUM` | `NOT NULL` (`SUPER_ADMIN`, `MASTER_LAB_ADMIN`, `HOD`, `PRINCIPAL`) | Authorization tier |
| `is_active` | `BOOLEAN` | `DEFAULT TRUE` | Account active toggle |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | Account creation timestamp |

---

### 2. `competitions`
Represents an independent coding competition lifecycle.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY`, default `gen_random_uuid()` | Unique competition identifier |
| `slug` | `VARCHAR(100)` | `NOT NULL`, `UNIQUE` | URL slug (e.g. `code-clash-2026`) |
| `name` | `VARCHAR(255)` | `NOT NULL` | Official event title |
| `description` | `TEXT` | `NULLABLE` | Contest description, rules, and notes |
| `event_date` | `DATE` | `NOT NULL` | Date of competition |
| `top_k` | `INTEGER` | `NOT NULL`, `DEFAULT 10` | Qualification limit for top performers |
| `status` | `ENUM` | `DEFAULT 'NOT_STARTED'` (`NOT_STARTED`, `IN_PROGRESS`, `CONSOLIDATING`, `READY_FOR_REVIEW`, `PUBLISHED`) | Lifecycle state |
| `visibility` | `ENUM` | `DEFAULT 'PUBLIC'` (`PUBLIC`, `RESTRICTED`) | Access control for public display |
| `created_by` | `UUID` | `FOREIGN KEY (users.id)` | Admin who created event |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | Timestamp of creation |

---

### 3. `contest_sets`
Defines independent contest sets (replacing physical lab entities) configured per competition.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY`, default `gen_random_uuid()` | Unique contest set identifier |
| `competition_id` | `UUID` | `FOREIGN KEY (competitions.id)`, `NOT NULL` | Parent competition reference |
| `set_name` | `VARCHAR(100)` | `NOT NULL` | Human-readable name (e.g., `Set A`) |
| `set_code` | `VARCHAR(50)` | `NOT NULL` | Unique machine code (e.g., `SET_A`) |
| `contest_url` | `VARCHAR(500)` | `NULLABLE` | Contest platform URL (e.g., `/setA`) |
| `is_active` | `BOOLEAN` | `DEFAULT TRUE` | Active operational status |

*Constraints:* `UNIQUE (competition_id, set_code)` and `UNIQUE (competition_id, set_name)`.

---

### 4. `uploads`
Tracks raw file uploads per contest set, versioning, and the 3-tier status lifecycle.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY`, default `gen_random_uuid()` | Unique upload identifier |
| `contest_set_id` | `UUID` | `FOREIGN KEY (contest_sets.id)`, `NOT NULL` | Associated contest set |
| `uploaded_by` | `UUID` | `FOREIGN KEY (users.id)`, `NOT NULL` | Master Lab Admin reference |
| `original_filename`| `VARCHAR(255)`| `NOT NULL` | Original client filename |
| `stored_filename` | `VARCHAR(500)` | `NOT NULL` | Secure private disk or cloud storage path |
| `version_number` | `INTEGER` | `NOT NULL`, `DEFAULT 1` | Incremental upload version |
| `upload_status` | `ENUM` | `NOT NULL` (`PENDING`, `UPLOADED`, `FAILED`) | File ingestion status |
| `validation_status`| `ENUM` | `NOT NULL` (`PENDING`, `VALID`, `INVALID`) | Schema and row integrity status |
| `approval_status` | `ENUM` | `NOT NULL` (`PENDING`, `APPROVED`, `REJECTED`) | Administrative review status |
| `uploaded_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | Upload timestamp |
| `approved_by` | `UUID` | `FOREIGN KEY (users.id)`, `NULLABLE` | Super Admin who approved |
| `approved_at` | `TIMESTAMPTZ` | `NULLABLE` | Approval timestamp |
| `rejection_reason` | `TEXT` | `NULLABLE` | Feedback if rejected |

---

### 5. `participants`
Maintains unique participant identities across the competition.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY`, default `gen_random_uuid()` | System participant identifier |
| `competition_id` | `UUID` | `FOREIGN KEY (competitions.id)`, `NOT NULL` | Parent competition reference |
| `participant_code` | `VARCHAR(100)`| `NOT NULL` | Unique participant ID / platform username |
| `name` | `VARCHAR(255)` | `NOT NULL` | Full participant name |
| `email` | `VARCHAR(255)` | `NULLABLE` | Optional email address |
| `registration_number`| `VARCHAR(100)`| `NULLABLE` | Optional institutional roll number |

*Constraint:* `UNIQUE (competition_id, participant_code)`.

---

### 6. `results`
Stores performance records parsed from approved contest set uploads.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY`, default `gen_random_uuid()` | Unique result identifier |
| `participant_id` | `UUID` | `FOREIGN KEY (participants.id)`, `NOT NULL` | Participant reference |
| `contest_set_id` | `UUID` | `FOREIGN KEY (contest_sets.id)`, `NOT NULL` | Contest set reference |
| `upload_id` | `UUID` | `FOREIGN KEY (uploads.id)`, `NOT NULL` | Source upload reference |
| `score` | `NUMERIC(8,2)` | `NOT NULL` | Total score (supports fractional marks) |
| `problems_solved` | `INTEGER` | `NOT NULL`, `DEFAULT 0` | Total accepted problems |
| `penalty` | `NUMERIC(10,2)`| `NULLABLE` | Penalty duration in seconds |
| `accepted_time` | `TIMESTAMPTZ` | `NULLABLE` | Timestamp of final accepted submission |
| `incorrect_submissions`| `INTEGER` | `NULLABLE`, `DEFAULT 0` | Count of rejected attempts |
| `raw_data` | `JSONB` | `NULLABLE` | Original parsed row payload |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | Record creation timestamp |

---

### 7. `tiebreaker_rules`
Stores the lexicographical tie-breaking criteria configured for a competition.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY`, default `gen_random_uuid()` | Unique rule identifier |
| `competition_id` | `UUID` | `FOREIGN KEY (competitions.id)`, `NOT NULL` | Competition reference |
| `criterion` | `VARCHAR(50)` | `NOT NULL` (`SCORE`, `PROBLEMS_SOLVED`, `PENALTY`, `ACCEPTED_TIME`, `INCORRECT_SUBMISSIONS`) | Ranking attribute |
| `priority` | `INTEGER` | `NOT NULL` | Comparison precedence (1 = highest) |
| `direction` | `ENUM` | `NOT NULL` (`ASCENDING`, `DESCENDING`) | Sorting direction |
| `enabled` | `BOOLEAN` | `DEFAULT TRUE` | Rule toggle |
| `approved_by` | `UUID` | `FOREIGN KEY (users.id)`, `NULLABLE` | Admin who approved configuration |

---

### 8. `leaderboard_snapshots`
Stores versioned, immutable publications of the consolidated rankings.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY`, default `gen_random_uuid()` | Unique snapshot identifier |
| `competition_id` | `UUID` | `FOREIGN KEY (competitions.id)`, `NOT NULL` | Competition reference |
| `version_number` | `INTEGER` | `NOT NULL`, `DEFAULT 1` | Incremental version number |
| `generated_by` | `UUID` | `FOREIGN KEY (users.id)`, `NOT NULL` | User who triggered consolidation |
| `approved_by` | `UUID` | `FOREIGN KEY (users.id)`, `NULLABLE` | Super Admin who approved |
| `published_by` | `UUID` | `FOREIGN KEY (users.id)`, `NULLABLE` | Super Admin who published |
| `status` | `ENUM` | `NOT NULL` (`DRAFT`, `APPROVED`, `PUBLISHED`, `SUPERSEDED`) | Snapshot state |
| `generated_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | Snapshot generation timestamp |
| `published_at` | `TIMESTAMPTZ` | `NULLABLE` | Official publication timestamp |

---

### 9. `leaderboard_entries`
Stores individual ranked contestant rows belonging to an immutable snapshot.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY`, default `gen_random_uuid()` | Unique entry identifier |
| `snapshot_id` | `UUID` | `FOREIGN KEY (leaderboard_snapshots.id)`, `NOT NULL` | Parent snapshot reference |
| `participant_id` | `UUID` | `FOREIGN KEY (participants.id)`, `NOT NULL` | Participant reference |
| `contest_set_id` | `UUID` | `FOREIGN KEY (contest_sets.id)`, `NOT NULL` | Participant's contest set |
| `rank` | `INTEGER` | `NOT NULL` | Calculated rank (with shared ranks) |
| `score` | `NUMERIC(8,2)` | `NOT NULL` | Recorded score at snapshot |
| `qualification_status`| `ENUM` | `NOT NULL` (`QUALIFIED`, `NOT_QUALIFIED`) | Qualification badge state (Top-K) |

---

### 10. `audit_logs`
Provides an immutable ledger of all administrative and lifecycle operations.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY`, default `gen_random_uuid()` | Unique log identifier |
| `user_id` | `UUID` | `FOREIGN KEY (users.id)`, `NULLABLE` | Actor reference |
| `action` | `VARCHAR(100)` | `NOT NULL` | Action performed (e.g. `UPLOAD_SET`, `APPROVE_SET`, `PUBLISH`) |
| `entity_type` | `VARCHAR(50)` | `NOT NULL` | Target entity (e.g. `Upload`, `Competition`) |
| `entity_id` | `UUID` | `NULLABLE` | Affected entity identifier |
| `details` | `JSONB` | `NULLABLE` | Metadata, differences, or rejection comments |
| `timestamp` | `TIMESTAMPTZ` | `DEFAULT NOW()` | Event timestamp |

---

## Column Mapping Schema

During ingestion, source headers from various platform exports are mapped to standardized internal fields via this JSON schema:

```json
{
  "participant_code": "Username",
  "name": "Full Name",
  "score": "Score",
  "problems_solved": "Problems Solved",
  "penalty": "Time Taken",
  "accepted_time": "Last Submission",
  "incorrect_submissions": "Attempts"
}
```

---

## Consistency Rules & Data Integrity

1. **Uniqueness:** A participant identifier can only exist once per competition. The validation engine flags cross-set collisions if the same `participant_code` appears in multiple set files.
2. **Snapshot Immutability:** Once `status = 'PUBLISHED'` on a `leaderboard_snapshot`, its related records in `leaderboard_entries` are read-only. Updates require generating an incremented version snapshot (`version_number = 2`).
3. **Decimals & Precision:** Scores use `NUMERIC(8,2)` to guarantee exact fractional mark representations without IEEE 754 floating-point inaccuracies.
4. **Completion Lock:** Database constraints and application logic prevent triggering consolidation unless every active contest set has an approved upload.
5. **Transactional Atomicity:** Consolidation, snapshot creation, and publication procedures execute within atomic SQL transactions.
