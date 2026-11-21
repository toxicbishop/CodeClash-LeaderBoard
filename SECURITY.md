# Security Policy

The **Code Clash Leaderboard** team takes the security, reliability, and integrity of our competition platform seriously. This document outlines our vulnerability reporting process, continuous security practices, maintainers, and disclosure guidelines.

---

## Scope & Coverage

This security policy applies to all active code in this repository, including the live competition ingestion engine, server actions, and leaderboard publication systems.

---

## Reporting a Vulnerability

If you discover a security vulnerability or security-sensitive defect in this project, **please do not report it in public GitHub issues, discussions, or pull requests.**

Instead, please use one of the following private reporting mechanisms:

1. **GitHub Private Vulnerability Reporting (Preferred):**
   * Navigate to the repository's **[Security](https://github.com/toxicbishop/CodeClash-LeaderBoard/security)** tab.
   * Click **Report a vulnerability** to open an advisory draft.
2. **Direct Contact:**
   * Reach out to any of the core maintainers listed in the [Security Team](#security-team--maintainers) section below.

### What to Include in Your Report

To help us review and triage your finding quickly, please include:
* **Description:** A detailed explanation of the vulnerability and its potential impact.
* **Reproduction Steps:** Step-by-step instructions or a minimal Proof of Concept (PoC).
* **Affected Components:** File paths, endpoints, or API functions involved (e.g., specific Server Actions, route handlers, or client libraries).
* **Suggested Fix / Remediation:** Any proposed patches or mitigations if available.

### Response Timelines

* **Initial Acknowledgement:** Within **24–48 hours** of report receipt.
* **Triage & Assessment:** Within **3–5 business days**, confirming severity and attack vectors.
* **Patch Release & Disclosure:** We coordinate a remediation patch and credit reporters before public disclosure.

---

## Security Architecture & Practices

The application enforces defense-in-depth across the full stack:

* **Automated Code Scanning:** Continuous static analysis using **GitHub CodeQL Advanced** on every push and pull request to identify vulnerabilities (e.g. CWE-918 SSRF, CWE-79 XSS, CWE-89 SQL injection).
* **Strict Server-Side Request Forgery (SSRF) Defenses:** Outbound requests (such as HackerRank leaderboard API fetching) strictly validate input slugs against an allowlist pattern (`^[a-zA-Z0-9_-]+$`) and restrict outbound connections exclusively to verified origin domains.
* **Row-Level Security (RLS) & RBAC:** Supabase PostgreSQL databases enforce row-level policies alongside server-side role validation (`SUPER_ADMIN`, `MASTER_LAB_ADMIN`, `HOD`, `PRINCIPAL`).
* **Session & Secret Protection:** Sensitive API keys (`SUPABASE_SERVICE_ROLE_KEY`, session cookies) remain strictly isolated server-side and are never exposed to browser bundles.

---

## Security Team & Maintainers

For security inquiries, vulnerability reporting, and oversight:

* **Pranav Arun** ([@toxicbishop](https://github.com/toxicbishop)) — Project Lead & Maintainer
* **Mohammed** ([@Mohammed0572](https://github.com/Mohammed0572)) — Security & Core Contributor
* **Rithika** ([@Rithika-git-netizen](https://github.com/Rithika-git-netizen)) — Core Contributor
* **Apeksh Shekar** ([@apekshshekar](https://github.com/apekshshekar)) — Core Contributor

---

## Safe Harbor

We consider security research conducted under this policy to be authorized. We commit not to pursue legal action against researchers who:
* Act in good faith to avoid privacy violations, destruction of data, and service interruption.
* Give us reasonable time to investigate and fix issues before disclosing them publicly.
* Do not access, modify, or retain sensitive user data during testing.
