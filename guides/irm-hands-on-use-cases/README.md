# ServiceNow IRM: Two Hands-On Use Cases (Medium and Advanced)

**Author:** Chaitanya Beeraka
**Platform:** ServiceNow Personal Developer Instance (PDI), Australia release
**Modules:** Policy and Compliance Management, Risk Management with Advanced Risk, GRC Indicators, Issue Management, Compliance and Risk Workspaces, Integration Hub / REST, Flow Designer, ATF
**Certification behind this work:** ServiceNow Certified Implementation Specialist – Risk and Compliance (CIS-RC)

---

## How to use this document

This document describes two IRM implementations that I scoped the way a technical architect scopes a client engagement, and then built myself, end to end, on my own ServiceNow PDI.

- **Use case 1 (Medium):** Access Control Policy compliance program with control attestation, automated indicators, issues and exceptions.
- **Use case 2 (Advanced):** Third-party risk with continuous control monitoring, an external security-rating integration, composite risk scoring, event-driven reassessment and a GRC workspace view.

Each use case has the same structure:

1. Business problem (the "client" voice)
2. Lab scenario and scope
3. Solution design and architecture
4. Data model (tables and relationships)
5. Step-by-step implementation on a PDI
6. Testing and demo script
7. What I would do differently on a real engagement

At the end you will find interview talking points, likely interview questions with answers, and resume bullets.

> **Honesty rule for interviews.** Everything below is something you build and can demo on your own PDI. Describe it as *"an IRM implementation I designed and built on a ServiceNow instance"* or *"my hands-on IRM project"*. Do not attach a client name or production go-live to it. Interviewers at Cognizant will drill into details (table names, why a control is generated per entity, how indicator results flow to issues). If you have actually built it, that drill-down becomes your strongest moment. A self-built project that you can screen-share beats a vague "client project" every time.

---

## Before you start: PDI preparation (do this once)

### 1. Request and wake the PDI

1. Sign in at developer.servicenow.com and request an instance on the latest release offered.
2. Note the instance URL and admin password.

### 2. Activate the GRC plugins

On the Developer Portal, open your instance menu and use **Activate Plugin**, or inside the instance go to **All > System Definition > Plugins** (some GRC apps install from **System Applications > All Available Applications**). Search for and activate, in this order:

| Order | Plugin / application | Why you need it |
|---|---|---|
| 1 | GRC: Policy and Compliance Management (`com.sn_compliance`) | Policies, policy statements, controls, attestations, indicators |
| 2 | GRC: Risk Management (`com.sn_risk`) | Risk framework, risk statements, risks |
| 3 | GRC: Advanced Risk (`sn_risk_advanced`), if listed | Risk assessment methodologies (inherent, control, residual) |
| 4 | GRC: Compliance Workspace / Risk Workspace, if listed separately | Configurable workspaces |
| 5 | Performance Analytics (usually already active) | Dashboards |

> **Do not install Third-party Risk Management (TPRM) on the PDI.** It currently fails to install on PDIs because a dependency (`sn_reco_template`) is missing, and there is no workaround. Use case 2 is therefore built on Risk Management + Policy and Compliance, with suppliers modelled as entities. That is a legitimate design that many clients without a TPRM licence use, and it is good to say so in interviews.
>
> **Installs can take a long time** (sometimes hours). Start the activations first and do the user/group setup while they run.
>
> **GRC apps not listed?** Install them from **All > System Applications > All Available Applications > All** and search "GRC". On a brand-new PDI the GRC apps can take up to about a day to appear. If they are missing, wait, select **Sync** in the application manager, then log out and back in. Install order: Policy and Compliance, then Risk Management, then Advanced Risk, then the two workspaces.

> **If a plugin is not available on your PDI:** where a step depends on Advanced Risk, it also shows a *Fallback* path that uses only core Risk Management. Plugin availability on PDIs changes by release, so check the list on your instance and write down exactly what you activated. That list is itself a good interview detail.

### 3. Give yourself the roles

**All > User Administration > Users > System Administrator (admin)** and add:

- `sn_compliance.admin`, `sn_compliance.manager`
- `sn_risk.admin`, `sn_risk.manager`
- `sn_grc.admin` (if present)
- The workspace roles, otherwise the workspaces will not open: search **Roles** for `compliance_workspace` and `risk_workspace` (exact names vary by release, for example `sn_compliance_ws.compliance_workspace_user` / `sn_risk_workspace...`) and add them to yourself and the demo users.

Log out and back in so the roles apply.

### 4. Create demo users and groups

Create these users (password set, active) and groups. They make the demo realistic and let you show role-based behaviour by impersonating.

| User | Role in the story | Roles |
|---|---|---|
| Priya Compliance | Compliance manager | `sn_compliance.manager` |
| Ravi Owner | Control owner (IT Ops) | `sn_compliance.user` |
| Meera Risk | Risk manager | `sn_risk.manager` |
| Arjun Vendor | Third-party manager | `sn_risk.user` |
| Kiran Auditor | Internal auditor / reviewer | `sn_compliance.reader`, `sn_risk.reader` |

Groups: **GRC Compliance Team**, **IT Operations**, **Vendor Management Office**, **Information Security**.

### 5. Create a scoped application for your custom work

**All > System Applications > Studio > Create Application** (or App Engine Studio):

- Name: `IRM Lab Extensions`
- Scope: `x_irm_lab` (your PDI will add a vendor prefix such as `x_12345_irm_lab`; use whatever it generates)

All custom tables, script includes, REST APIs and flows go into this scope. Interviewers like hearing that you kept customisation out of the GRC scopes so upgrades stay clean.

> **Verify table names on your release.** Table names below come from the GRC data model. Before you build, confirm each one at **All > System Definition > Tables** (search by label). If a name differs on your release, use the one your instance shows and note the difference.

---

# USE CASE 1 (Medium): Access Control Policy Compliance with Attestation and Indicators

## 1.1 Business problem (client voice)

> "We are a mid-size financial services firm preparing for an ISO/IEC 27001 surveillance audit and an internal SOX ITGC review. Our Access Control Policy lives in a Word document on SharePoint. Every quarter the compliance team emails spreadsheets to application owners asking 'are your access controls working?' and chases replies for weeks. We cannot show the auditor which controls apply to which applications, who confirmed them, what evidence they gave, or what happened when something failed. Dormant accounts and orphaned privileged access keep turning up as audit findings. We want one system of record for the policy, the controls on every in-scope application, quarterly owner attestation with evidence, automated checks where data already exists in ServiceNow, and a clean path for issues and exceptions."

### Pain points translated into requirements

| # | Pain point | Requirement | IRM capability |
|---|---|---|---|
| R1 | Policy only exists as a document | Policy and its statements are records with owners, review dates and approval | Policy, Policy Statement (control objective), policy lifecycle |
| R2 | No traceability to the standard | Map each statement to ISO 27001 Annex A citations | Authority document, Citations, citation-to-control-objective mapping |
| R3 | Unclear which apps are in scope | Controls generated automatically per in-scope application | Entity types, entities, scoping, control generation |
| R4 | Spreadsheet attestations | Quarterly attestation to control owners with evidence | Attestation (assessment) on controls, scheduled |
| R5 | Dormant/privileged account findings | Automatic checks on user data already in the platform | Basic and Script indicators, indicator results |
| R6 | Failures are lost in email | Failed attestation or indicator creates a tracked issue | Issue management, remediation tasks |
| R7 | Legitimate deviations handled informally | Time-bound policy exceptions with approval | Policy exceptions |
| R8 | No management view | Compliance % by policy, entity and authority document | Compliance Workspace, Compliance Overview, reports |

## 1.2 Lab scenario and scope

- **Fictional company for the lab:** "Northwind Financial" (fictional, used only for realistic data).
- **Authority document:** ISO/IEC 27001:2022, Annex A, subset of access control clauses. Create these manually as a small library (UCF import needs a licence key, so manual creation is the PDI path).
- **Policy:** Access Control Policy with 5 policy statements.
- **In-scope entities:** 5 business applications (Core Banking, Payments Gateway, HR Portal, CRM, Data Warehouse).
- **Out of scope for this build:** policy authoring/redlining with SharePoint, UCF content import, mobile app.

## 1.3 Solution design

```
 ISO 27001 (Authority Document)
        │ has
        ▼
 Citations (A.5.15, A.5.18, A.8.2, A.8.5, A.5.16)
        │ mapped to (many-to-many)
        ▼
 Access Control Policy ──contains──► Policy Statements (Control Objectives) x5
                                          │ scoped by Entity Type "Business Application"
                                          ▼
   Entities (5 apps) ───────────► Controls (5 statements × 5 apps = 25 controls)
                                          │
                ┌─────────────────────────┼──────────────────────────┐
                ▼                         ▼                          ▼
        Attestations (quarterly)    Indicators (Basic/Script/    Policy Exceptions
        owner + evidence            Manual) → Indicator Results  (time-bound, approved)
                │                         │
                └──── fail / non-compliant ────► Issues ──► Remediation tasks
                                          │
                                          ▼
                        Compliance status rolls up: Control → Statement → Policy → Entity
                                          │
                                          ▼
                     Compliance Workspace / Compliance Overview / reports
```

### Key design decisions (be ready to explain each)

1. **Entity type based on a filter on `cmdb_ci_business_app`**, not hand-made entities. New applications that meet the filter become entities automatically, and controls are generated for them. This is the main scaling argument for IRM over spreadsheets.
2. **One control per policy statement per entity.** The statement is the "what", the control is the "what, for this specific app, owned by this specific person". That is why control owners and attestations sit on the control, not the statement.
3. **Indicators where data exists, attestation where it does not.** Dormant accounts can be measured from `sys_user`, so that is a Basic indicator. "A quarterly user access review was performed" needs human evidence, so that is an attestation plus a Manual indicator.
4. **Issues are the single remediation channel.** Failed indicators and "Not implemented" attestations both create issues, so management has one queue and one ageing report.
5. **Exceptions are time-bound.** An exception expires, which forces a re-decision instead of a permanent hidden gap.

## 1.4 Data model

| Object | Table | Key fields used | Notes |
|---|---|---|---|
| Authority document | `sn_compliance_authority_document` | name, source, version | ISO 27001:2022 |
| Citation | `sn_compliance_citation` | name, reference, authority document, type | A.5.15 etc. |
| Policy | `sn_compliance_policy` | name, type, owner, state, valid to, approvers | Access Control Policy |
| Policy statement (control objective) | `sn_compliance_policy_statement` | name, policy, category, entity types, attestation | 5 statements |
| Entity type | `sn_grc_profile_type` | name, table, condition, owned by | "Business Application" |
| Entity | `sn_grc_profile` | name, table, applies to, owned by, entity class | One per app |
| Control | `sn_compliance_control` | policy statement, profile (entity), owner, status, state | Generated |
| Indicator template | `sn_grc_indicator_template` | type, table/condition or script, target, frequency | Reusable definition |
| Indicator | `sn_grc_indicator` | template, item (control), type, last result passed | One per control |
| Indicator result | `sn_grc_indicator_result` | indicator, value, passed, supporting data | History of runs |
| Issue | `sn_grc_issue` | item, profile, source, state, priority, assigned to | Remediation |
| Policy exception | `sn_compliance_policy_exception` | policy, statement, controls, valid to, justification | Approved deviation |
| Attestation (assessment) | `asmt_metric_type`, `asmt_assessment_instance` | questions, assigned to, due date, result | Attestation designer |
| Source data (indicators) | `sys_user`, `sys_user_has_role` | last_login_time, active, roles | Platform data |

Relationships to remember:

- Citation ↔ Policy statement: many-to-many (`sn_compliance_m2m_statement_citation` or similar relationship table, check on your release).
- Policy statement → Controls: one-to-many (one per entity in scope).
- Entity → Controls, Risks, Issues: one-to-many.
- Control → Indicators → Indicator results: one-to-many-to-many.
- Control → Issues: one-to-many.

## 1.5 Step-by-step implementation on the PDI

### Step 1. Prepare source data (CMDB applications and users)

1. **All > CMDB > Business Applications** (`cmdb_ci_business_app`). Create 5 records: Core Banking, Payments Gateway, HR Portal, CRM, Data Warehouse.
   - Set **Owned by** (use Ravi Owner for two of them, other demo users for the rest).
   - Add a custom choice or use an existing field to mark scope, for example set **Business criticality** = `1 - most critical` or `2 - somewhat critical` for in-scope apps. Leave the Data Warehouse at `3 - less critical` first, so you can later demo "scope change creates controls automatically".
2. **Seed users for the indicators.** Create 8 test users in `sys_user`:
   - 5 with **Last login time** within the last 30 days.
   - 3 with **Last login time** more than 90 days ago and **Active** = true (these are the "dormant" accounts the indicator must catch).
   - Give 2 of them the `admin` or `itil` role to simulate privileged dormant users.
   - Tip: set `last_login_time` with a fix script, since the form field is read-only:

```javascript
// Background script (global scope): seed dormant test users
var names = ['dormant.user1', 'dormant.user2', 'dormant.user3'];
names.forEach(function (n) {
  var u = new GlideRecord('sys_user');
  if (!u.get('user_name', n)) {
    u.initialize();
    u.user_name = n;
    u.first_name = 'Dormant';
    u.last_name = n.split('.')[1];
  }
  u.active = true;
  var d = new GlideDateTime();
  d.addDaysUTC(-120);
  u.last_login_time = d;
  u.setWorkflow(false); // avoid side effects for seed data only
  u.update();
});
gs.info('Seeded dormant users');
```

### Step 2. Create the authority document and citations

1. Navigate to **Policy and Compliance > Authority Documents** (Compliance Workspace: **Libraries > Authority documents**). Select **New**.
   - Name: `ISO/IEC 27001:2022`, Source: `ISO`, Version: `2022`, Type: Standard.
2. On the related list **Citations**, create:

| Reference | Name | Type |
|---|---|---|
| A.5.15 | Access control | Control |
| A.5.16 | Identity management | Control |
| A.5.18 | Access rights | Control |
| A.8.2 | Privileged access rights | Control |
| A.8.5 | Secure authentication | Control |

> Talking point: in a client project you would import authority documents from UCF (Unified Compliance Framework) using an API key, which also brings common controls across frameworks (ISO, NIST, SOX ITGC). On a PDI you build a small subset manually.

### Step 3. Create the entity type and generate entities

1. **Policy and Compliance > Administration > Entity Types** (Compliance Workspace: **Entity framework > Entity types**). **New**:
   - Name: `Business Application (In scope)`
   - Table: `Business Application [cmdb_ci_business_app]`
   - Condition: `Business criticality` is one of `1 - most critical`, `2 - somewhat critical`
   - Owned by field: `Owned by` (so entity owners come from the CMDB)
   - Select **Generate entities** / save; the platform creates one entity per matching application.
2. Optional: create an **Entity class** `IT Application` and assign it, to show you know classes are for grouping entities across types.
3. Verify at **Entities**: you should see 4 entities (Data Warehouse is excluded for now).

### Step 4. Create the policy and policy statements

1. **Policy and Compliance > Policies > New**:
   - Name: `Access Control Policy`, Type: `Policy`, Owner: Priya Compliance
   - Valid from / valid to: today / today + 1 year
   - Description: short purpose text.
   - Move the policy through **Draft > Review > Awaiting approval > Published**. Add yourself or Priya as an approver so you can demo the approval.
2. On the **Policy Statements** related list create:

| # | Policy statement (control objective) | Citations | Category | Measured by |
|---|---|---|---|---|
| PS-01 | User access is reviewed by the application owner every quarter | A.5.18, A.5.15 | Access management | Attestation + Manual indicator |
| PS-02 | Accounts with no login for 90 days are disabled | A.5.16, A.5.18 | Identity lifecycle | Basic indicator |
| PS-03 | Privileged access is restricted and approved | A.8.2 | Privileged access | Script indicator + attestation |
| PS-04 | Multi-factor authentication is enforced for remote and privileged access | A.8.5 | Authentication | Attestation |
| PS-05 | Leavers' access is removed within 1 business day | A.5.16 | Identity lifecycle | Attestation |

3. For each statement:
   - **Entity types**: add `Business Application (In scope)`.
   - **Citations** related list: link the citations from the table.
   - **Attestation**: set the default attestation (configured in Step 6).
4. Activate the statements. The platform generates **controls** for each statement × entity combination: 5 × 4 = **20 controls**.
5. Open **Controls** and check that each control has the correct entity and that **Owner** came from the entity owner. Fix owners where needed.

> Interview point: control generation is the reason the entity framework matters. Ask "what drives control generation?" and the answer is the entity types on the policy statement plus the entities that match those types.

### Step 5. Show scope change creating controls automatically

1. Change Data Warehouse **Business criticality** to `2 - somewhat critical`.
2. Re-run entity generation on the entity type (or wait for the scheduled job).
3. A new entity appears and 5 new controls are generated (total 25). Screenshot before and after. This is a strong demo moment.

### Step 6. Build the quarterly control attestation

1. **Policy and Compliance > Administration > Attestations** (or Compliance Workspace **Attestations**; in newer releases **Attestation designer**). **New** attestation `Quarterly Access Control Attestation` with questions:

| # | Question | Type | Logic |
|---|---|---|---|
| Q1 | Is this control designed and operating as described for your application? | Choice: Implemented / Partially implemented / Not implemented / Not applicable | Drives control status |
| Q2 | Describe how the control was performed this quarter | String (mandatory) | Evidence narrative |
| Q3 | Attach evidence (review sign-off, screenshot, ticket number) | Attachment | Mandatory if Q1 = Implemented |
| Q4 | If not fully implemented, what is the remediation plan and target date? | String + Date | Shown only when Q1 ≠ Implemented |

2. Link this attestation to PS-01, PS-03, PS-04, PS-05.
3. Schedule it: on the statement or via the attestation schedule set **Frequency = Quarterly**, assign to **control owner**.
4. Trigger it now for the demo (UI action **Attest** / "Create attestations now" on the control or statement, depending on release).
5. Impersonate **Ravi Owner**, open **Self-service > My Attestations** (or the Employee Center / workspace "My tasks"), and respond:
   - Core Banking PS-01: Implemented + evidence attachment.
   - Payments Gateway PS-04: **Not implemented** + remediation plan.
6. Impersonate back to admin. Observe:
   - Core Banking PS-01 control → **Compliant**.
   - Payments Gateway PS-04 control → **Non-compliant**, and an **issue** is created against that control.

### Step 7. Build indicators (continuous monitoring)

#### 7a. Basic indicator: dormant accounts (PS-02)

1. **Policy and Compliance > Indicators > Indicator Templates > New**:
   - Name: `Dormant active accounts (>90 days)`
   - Type: **Basic**
   - Category: Compliance Indicator
   - Table: `User [sys_user]`
   - Condition: `Active is true` AND `Last login time relative before 90 days ago`
   - Target type: **Count**, Target: `0`
   - Result if value meets or exceeds target: **Passed** must be set so that 0 passes; check the behaviour on your release and invert if needed (a count of 0 passes, anything above fails).
   - Collection frequency: Weekly
   - Sample size: 50 (supporting data stores only a sample of failing records)
   - Policy statement: PS-02
2. Generate indicators from the template, which creates one indicator per PS-02 control.
3. Open one indicator and select **Run indicator** / **Collect now**.
4. Check **Indicator results**: value = 3, passed = false, supporting data lists the 3 dormant users.
5. The control becomes **Non-compliant** and an **issue** is auto-created (source = Indicator).

> Design note: in a real client this would be filtered per application (for example, users who hold that application's role group). For the lab, explain that the indicator source can be narrowed with a condition or a script once access is modelled per app.

#### 7b. Script indicator: unapproved privileged access (PS-03)

Create an indicator template with **Type = Script** and this script. It counts active users holding the `admin` role who are not members of an approved "Privileged Access – Approved" group.

```javascript
// Script indicator: privileged users without approval
// Documented contract: set result.value and result.passed
(function () {
  var APPROVED_GROUP = 'Privileged Access - Approved';
  var approved = {};
  var gm = new GlideRecord('sys_user_grmember');
  gm.addQuery('group.name', APPROVED_GROUP);
  gm.query();
  while (gm.next()) {
    approved[gm.getValue('user')] = true;
  }

  var count = 0;
  var hr = new GlideRecord('sys_user_has_role');
  hr.addQuery('role.name', 'admin');
  hr.addQuery('user.active', true);
  hr.query();
  var seen = {};
  while (hr.next()) {
    var uid = hr.getValue('user');
    if (seen[uid]) continue;      // user may hold the role more than once
    seen[uid] = true;
    if (!approved[uid]) count++;
  }

  result.value = count;
  result.passed = (count === 0);
})();
```

- Create the group `Privileged Access - Approved` and add your admin account only, so the seeded dormant admin user makes it fail.
- Run it, see the failure, add the user to the group (or remove the role), run again, see it pass and the control return to compliant. This before/after is the core of "continuous monitoring".

#### 7c. Manual indicator: evidence of quarterly access review (PS-01)

- Template Type **Manual**, Target type **None**, assigned to control owner, frequency **Quarterly**, with instructions "Upload the signed user access review export".
- A manual **indicator task** is created for the owner. Complete it with an attachment. Explain that manual indicators cover data that lives outside ServiceNow.

### Step 8. Issue management and remediation

1. Open the issue created for Payments Gateway PS-04 (MFA not implemented).
2. Set **Assignment group** = Information Security, **Priority** = 2, **Due date** = +30 days.
3. Add a **remediation task**: "Enable MFA on Payments Gateway admin console".
4. Close the task, move the issue to **Respond > Remediate > Review > Closed**.
5. Re-attest the control (or re-run the indicator) and show the control back to **Compliant**.
6. Optional: configure an **Issue workflow / assignment rule** so issues from the "Business Application" entity type go to the entity owner's group automatically.

### Step 9. Policy exception

1. From the PS-04 control on CRM, raise a **Policy exception**: "CRM vendor-hosted admin console does not support MFA until v12 upgrade".
   - Valid to: +90 days
   - Compensating control: IP allow-listing and session recording
2. Approval goes to the policy owner (Priya). Impersonate and approve.
3. While the exception is active, the control is treated as exempt (status shown as exception on your release). When it expires, the control returns to evaluation.
4. Talking point: exceptions are time-bound and approved, which is exactly what auditors want to see.

### Step 10. Reporting and the Compliance Workspace

1. Open **Compliance Workspace** (`/now/compliance-workspace` or from the menu). Show:
   - Policies and their compliance %.
   - Controls by status, filtered by entity.
   - Open issues by priority and age.
   - Attestation completion.
2. Build two reports in **Reports > Create new** and add them to a dashboard `Access Control Compliance`:
   - Bar: Controls by Status grouped by Policy statement.
   - Pie: Non-compliant controls by Entity.
3. If Performance Analytics content for GRC is available, enable the **Compliance Overview** to show trends.

### Step 11. Automated tests (ATF)

Create an ATF suite `IRM Lab – Access Control` with tests:

1. Create a `cmdb_ci_business_app` with criticality 1 → run entity generation → assert an entity exists → assert 5 controls exist for it.
2. Create a dormant user → run the Basic indicator → assert latest result `passed = false` → assert an issue exists for that control.
3. Set the dormant user inactive → re-run → assert `passed = true`.

> ATF is a strong differentiator in interviews. Most candidates say "I tested it", few say "I wrote ATF tests for control generation and indicator failure".

## 1.6 Demo script (6 minutes)

1. (30s) The problem: policy in Word, spreadsheet attestations, repeat audit findings.
2. (60s) Authority document → citations → policy → statements, show the mapping.
3. (60s) Entity type on CMDB business apps → change one app's criticality → controls generated.
4. (60s) Impersonate the control owner, answer an attestation as Not implemented → issue appears.
5. (60s) Run the dormant-account indicator → fails with supporting data → issue → fix data → re-run → passes.
6. (45s) Raise and approve a time-bound policy exception.
7. (45s) Compliance Workspace and dashboard: compliance % by entity and policy.

## 1.7 What I would do differently on a real engagement

- Import ISO 27001 and SOX ITGC through UCF so common controls satisfy both frameworks once.
- Scope users per application through the CMDB or IGA data rather than all of `sys_user`.
- Use attestation groups so an owner of five apps answers once per statement, not five times.
- Agree the control status rules (what counts as Partially implemented) with internal audit before go-live.
- Use the issue workflow configuration and the GRC approval configurator rather than custom flows.

---

# USE CASE 2 (Advanced): Third-Party Risk with Continuous Control Monitoring, External Ratings Integration and Composite Risk Scoring

## 2.1 Business problem (client voice)

> "We have about 400 suppliers. Thirty of them host or process customer data. Our third-party risk process is an annual questionnaire in email. Last year a critical payments processor had a breach, and we only found out from the news, three weeks later. Our regulator (think RBI outsourcing guidelines, DORA for our EU branch) now expects us to tier suppliers by criticality, assess them proportionately, monitor them continuously, and show the board one risk view per supplier that combines questionnaire results, external security ratings, control test results and open issues. When a critical supplier's external rating drops sharply, we want an automatic reassessment and the risk owner to be told the same day, not at the next annual review."

### Requirements

| # | Requirement | IRM capability / design |
|---|---|---|
| T1 | Supplier inventory with criticality tiering | `core_company` as the third-party master; tiering questionnaire + custom tier field |
| T2 | Proportionate assessments by tier | Separate entity types per tier band, each with its own control set and attestation frequency |
| T3 | Standard third-party risks per supplier | Risk framework + risk statements scoped to a "Third Party" entity type → risks generated per supplier |
| T4 | Risk assessment with inherent, control and residual | Advanced Risk assessment methodology (fallback: classic risk scoring fields) |
| T5 | Continuous monitoring from external data | Integration with an external security-rating API → custom rating table → Script indicators on third-party controls |
| T6 | Automatic reaction to a rating drop | Event-driven flow: rating drop > threshold → issue + reassessment + notification |
| T7 | One composite risk score per supplier | Script include that combines tier, rating, indicator pass rate, open issue severity, residual risk |
| T8 | Board and risk owner view | Risk Workspace / custom workspace page + dashboard by tier and score |
| T9 | Auditability | Indicator results history, rating history table, flow execution logs, ATF tests |

## 2.2 Lab scenario and scope

- **Third parties (10):** e.g. "PayFast Processing" (critical), "CloudVault Hosting" (critical), "SecureMail SaaS" (high), "PrintPro Services" (low), and so on. All fictional.
- **External ratings provider:** simulated. Real clients use services like BitSight or SecurityScorecard. On the PDI you build a **mock rating API as a Scripted REST API** so the integration pattern (REST Message, auth, JSON parsing, error handling, scheduling) is real, and only the data source is simulated. Say this clearly in interviews. It is an honest and respected approach.
- **Frameworks:** a "Third-Party Security Standard" authority document with 6 citations (for example aligned to ISO 27001 A.5.19–A.5.23 supplier relationships).
- **In scope:** tiering, risk generation, risk assessment, integration, indicators, event-driven reassessment, composite score, workspace/dashboard, ATF.
- **Out of scope:** supplier portal for external users, contract management, DORA register of information exports.

## 2.3 Solution architecture

```
                      ┌──────────────────────────────────────────┐
                      │  External Security Ratings API (mock)    │
                      │  Scripted REST API: /api/x_irm_lab/      │
                      │  ratings/v1/company/{domain}             │
                      └───────────────────┬──────────────────────┘
                                          │ REST (Basic auth / OAuth profile)
                                          ▼
 Scheduled Flow (daily) ──► Script Include RatingsIntegration
                                          │ upsert
                                          ▼
                     x_irm_lab_security_rating  (rating history per company)
                                          │ business rule / flow trigger on insert
                     ┌────────────────────┴───────────────────────┐
                     ▼                                            ▼
      Script Indicators on third-party controls        Event-driven flow
      (TP-C01 rating ≥ 700, TP-C02 no critical         if drop ≥ 50 points or
       findings open > 30 days)                         grade falls below C
                     │                                            │
         Indicator results → control status         Issue + reassessment task
                     │                               + notification to risk owner
                     ▼                                            │
                Issues ◄──────────────────────────────────────────┘
                     │
                     ▼
 core_company ◄── entity (Third Party type) ──► Risks (generated from risk statements)
        │                                             │
        │                                  Risk assessment (inherent → control → residual)
        ▼                                             │
 Script Include CompositeThirdPartyScore ◄────────────┘
   (tier, latest rating, indicator pass rate, open issues, residual risk)
        │ writes u_composite_risk_score / u_risk_band on core_company
        ▼
 Risk Workspace view + dashboard "Third-Party Risk Posture"
```

### Key design decisions

1. **`core_company` stays the master record.** The third party is the company; IRM entities point at it. This keeps procurement, vendor management, contracts and IRM on one record.
2. **Ratings history lives in its own table.** Never overwrite the latest rating on the company only. Indicators, trend charts and the "drop" logic all need history.
3. **Integration logic sits in a Script Include, triggered by a Flow.** Flow gives schedule, logging and retry visibility to admins. The Script Include keeps parsing testable and reusable by both the flow and ATF.
4. **Indicators judge, flows react.** Script indicators decide pass/fail for controls (which is the IRM audit trail). The event-driven flow handles the "something just changed" reaction (reassessment, notification). Mixing the two makes both harder to audit.
5. **Composite score is explainable.** It is a weighted sum with stored components, so a risk manager can see why a supplier is "High". Black-box scores fail audit and board scrutiny.
6. **Configuration over customisation.** Thresholds and weights are system properties, not hard-coded constants.

## 2.4 Data model

### Out-of-box tables

| Object | Table | Use |
|---|---|---|
| Company | `core_company` | Third-party master (vendor = true) |
| Entity type / entity | `sn_grc_profile_type`, `sn_grc_profile` | "Third Party" entity type on `core_company` |
| Risk framework | `sn_risk_framework` | "Third-Party Risk Framework" |
| Risk statement | `sn_risk_definition` | 4 standard third-party risks |
| Risk | `sn_risk_risk` | Generated per third party |
| Risk assessment methodology / instance | `sn_risk_advanced_risk_assessment_methodology`, `sn_risk_advanced_risk_assessment_instance` | Inherent, control, residual (Advanced Risk) |
| Survey / assessment | `asmt_metric_type`, `asmt_assessment_instance` | Tiering questionnaire |
| Authority document / citation | `sn_compliance_authority_document`, `sn_compliance_citation` | Third-Party Security Standard |
| Policy / policy statement / control | `sn_compliance_policy`, `sn_compliance_policy_statement`, `sn_compliance_control` | Third-party controls per supplier |
| Indicator template / indicator / result | `sn_grc_indicator_template`, `sn_grc_indicator`, `sn_grc_indicator_result` | Continuous monitoring |
| Issue | `sn_grc_issue` | Remediation |

### Custom (scoped app `x_irm_lab`)

**Table `x_irm_lab_security_rating` (Security Rating)**

| Field | Type | Notes |
|---|---|---|
| company | Reference `core_company` | Mandatory |
| domain | String | Domain used for the lookup |
| rating | Integer | 250–900 scale (like commercial providers) |
| grade | Choice A/B/C/D/F | Derived from rating |
| critical_findings | Integer | Open critical findings |
| breach_reported | True/False | Breach signal from feed |
| rating_date | Date/Time | As-of time from provider |
| previous_rating | Integer | Filled by integration for drop logic |
| delta | Integer | rating − previous_rating |
| raw_payload | String (4000) | For troubleshooting / audit |

**Fields added to `core_company`** (in your scope, via dictionary)

| Field | Type | Notes |
|---|---|---|
| u_tp_tier | Choice: 1-Critical, 2-High, 3-Medium, 4-Low | From tiering |
| u_security_domain | String | e.g. payfast.example |
| u_latest_rating | Integer | Convenience copy for lists |
| u_composite_risk_score | Decimal | 0–100 (higher = riskier) |
| u_risk_band | Choice: Low/Medium/High/Critical | From score |
| u_score_breakdown | String (1000) | JSON of score components for explainability |
| u_risk_owner | Reference `sys_user` | Business owner |

**Table `x_irm_lab_mock_rating` (Mock provider data)** — only for the mock API: domain, rating, critical_findings, breach_reported. You edit this table during the demo to "simulate" the outside world.

**System properties**

| Property | Default | Meaning |
|---|---|---|
| `x_irm_lab.rating.min_pass` | 700 | Rating at or above passes TP-C01 |
| `x_irm_lab.rating.drop_threshold` | 50 | Drop that triggers reassessment |
| `x_irm_lab.score.weights` | `{"tier":0.20,"rating":0.30,"indicators":0.20,"issues":0.15,"residual":0.15}` | Composite weights |
| `x_irm_lab.ratings.endpoint` | `https://<instance>.service-now.com/api/<scope>/ratings/v1/company/` | Mock endpoint |

## 2.5 Step-by-step implementation on the PDI

### Phase A. Third-party master and tiering

**Step A1. Create the third parties.** In **Organization > Companies** create 10 companies with **Vendor = true**, a `u_security_domain` and a `u_risk_owner` (Meera Risk / Arjun Vendor). Example set:

| Company | Domain | Service | Expected tier |
|---|---|---|---|
| PayFast Processing | payfast.example | Card payment processing | 1-Critical |
| CloudVault Hosting | cloudvault.example | Core banking hosting | 1-Critical |
| SecureMail SaaS | securemail.example | Customer email | 2-High |
| DataLens Analytics | datalens.example | Analytics on customer data | 2-High |
| CallCentre One | callcentre1.example | Outsourced contact centre | 2-High |
| HRCloud Payroll | hrcloud.example | Payroll | 3-Medium |
| TravelDesk Corp | traveldesk.example | Business travel | 4-Low |
| PrintPro Services | printpro.example | Printing | 4-Low |
| OfficeSupplies Ltd | officesupplies.example | Stationery | 4-Low |
| LegalDocs LLP | legaldocs.example | Legal advisory | 3-Medium |

**Step A2. Tiering questionnaire.** Build a **Survey** (or Smart Assessment template, if available on your release) called "Third-Party Tiering" with 4 weighted questions:

| Question | Scoring |
|---|---|
| Does the supplier store or process our customer data? | Yes = 35, No = 0 |
| Does the service support a regulated or critical business function? | Yes = 30, No = 0 |
| Annual spend band | >₹5 Cr = 15, ₹1–5 Cr = 10, <₹1 Cr = 5 |
| How hard is it to replace the supplier? | Hard = 20, Medium = 10, Easy = 0 |

Add a flow "On tiering survey complete → read the score → set `core_company.u_tp_tier`". Logic: score ≥ 75 → Critical, 50–74 → High, 25–49 → Medium, else Low. Assign the survey to the company's risk owner and complete it (impersonating) for each supplier.

> Why not the TPRM app? It does not install on PDIs today. In an interview, say: "I modelled suppliers as IRM entities with a tiering questionnaire. On a client with a TPRM licence, I would use its tiering assessments, engagements and supplier portal, and the rest of the design (risks, controls, indicators, integration, scoring) stays the same."

> Talking point: tiering drives proportionality. Critical suppliers get full assessments, continuous monitoring and quarterly reviews; low-tier suppliers get a light self-attestation every two years. That is what regulators mean by a risk-based approach.

### Phase B. Entities, risk framework and risks

**Step B1. Entity type "Third Party (Tier 1–2)".** Table `core_company`, condition `Vendor = true AND u_tp_tier IN (1,2)`, owned-by field `u_risk_owner`. Generate entities. You get 5 entities.

**Step B2. Second entity type "Third Party (Tier 3–4)"** for low tiers, used only for lighter controls. This shows you understand that scoping drives proportionate control sets.

**Step B3. Risk framework and statements.** **Risk > Risk Framework > New** `Third-Party Risk Framework`. Add risk statements (scoped to the Tier 1–2 entity type):

| Risk statement | Category | Description |
|---|---|---|
| TPR-01 Third-party information security breach | Cyber | Breach at supplier exposes our customer data |
| TPR-02 Third-party service disruption | Operational resilience | Supplier outage disrupts a critical service |
| TPR-03 Third-party regulatory non-compliance | Compliance | Supplier breaches applicable regulation (outsourcing, privacy) |
| TPR-04 Concentration / fourth-party risk | Strategic | Over-reliance on one supplier or its sub-processors |

Activate them. Risks are generated per entity: 4 × 5 = **20 risks**.

**Step B4. Risk assessment methodology.**

- *With Advanced Risk:* **Advanced Risk > Assessment Methodologies > New** `Third-Party Risk Assessment`:
  - **Inherent assessment**: Impact (Financial, Regulatory, Reputational, Operational; 1–5) and Likelihood (1–5); inherent score = max impact × likelihood, mapped to ratings Low/Medium/High/Very High.
  - **Control assessment**: control effectiveness (Effective, Partially effective, Ineffective) with an option to derive from linked control compliance.
  - **Residual assessment**: inherent rating reduced by control effectiveness, using the residual matrix.
  - Scope the methodology to the Third-Party entity type and the TPR risk statements.
  - Run assessments for PayFast and CloudVault, impersonating Meera Risk as assessor and approver.
- *Fallback:* use classic risk fields (Inherent likelihood/impact, Residual likelihood/impact, or SLE/ARO/ALE depending on release) on `sn_risk_risk`, and set residual manually after reviewing controls. Explain the difference: Advanced Risk gives configurable, multi-factor, reusable methodologies with assessor/approver workflow.

### Phase C. Third-party controls

**Step C1. Authority document** `Third-Party Security Standard v1` with citations:

| Ref | Citation |
|---|---|
| TPS-1 | Suppliers maintain an acceptable external security posture |
| TPS-2 | Critical vulnerabilities at suppliers are remediated within 30 days |
| TPS-3 | Suppliers notify breaches within 24 hours |
| TPS-4 | Suppliers hold a current ISO 27001 or SOC 2 Type II report |
| TPS-5 | Supplier access to our systems is reviewed quarterly |
| TPS-6 | Exit and continuity plans exist for critical suppliers |

**Step C2. Policy** `Third-Party Security Policy` with statements TP-C01 … TP-C06 mapped to the citations, scoped to the Tier 1–2 entity type. Controls are generated: 6 × 5 = **30 controls**.

**Step C3. Link controls to risks.** On each TPR-01 risk, relate TP-C01, TP-C02, TP-C03 for the same entity (related list **Controls**). For TPR-02, relate TP-C06. This link is what lets control effectiveness feed the residual assessment.

**Step C4. Which controls are monitored how**

| Control | Method | Frequency |
|---|---|---|
| TP-C01 External rating ≥ 700 | Script indicator from rating table | Daily |
| TP-C02 No critical findings open | Script indicator from rating table | Daily |
| TP-C03 Breach notification | Event-driven (breach flag) + attestation | On event / annual |
| TP-C04 Current SOC 2 / ISO cert | Manual indicator with evidence upload, expiry date check | Annual |
| TP-C05 Supplier access review | Attestation by our relationship owner | Quarterly |
| TP-C06 Exit plan | Attestation | Annual |

### Phase D. Mock external ratings API (the "outside world")

**Step D1. Create table `x_irm_lab_mock_rating`** with fields domain (String, unique), rating (Integer), critical_findings (Integer), breach_reported (True/False). Load one row per company domain, e.g. PayFast 780, CloudVault 720, SecureMail 690, DataLens 810, CallCentre1 650.

**Step D2. Scripted REST API.** **System Web Services > Scripted REST APIs > New**:

- Name: `Ratings`, API ID: `ratings`, in scope `x_irm_lab`.
- Version v1, resource **GET** `/company/{domain}`.
- Requires authentication: yes. Create a dedicated integration user `ratings.integration` with role `x_irm_lab.ratings_reader` and an ACL on the resource for that role.

```javascript
(function process(/*RESTAPIRequest*/ request, /*RESTAPIResponse*/ response) {
  var domain = request.pathParams.domain;
  var gr = new GlideRecord('x_irm_lab_mock_rating');
  if (!gr.get('domain', domain)) {
    response.setStatus(404);
    response.setBody({ error: 'domain_not_found', domain: domain });
    return;
  }
  var rating = parseInt(gr.getValue('rating'), 10);
  response.setStatus(200);
  response.setBody({
    domain: domain,
    rating: rating,
    grade: rating >= 800 ? 'A' : rating >= 700 ? 'B' : rating >= 600 ? 'C' : rating >= 500 ? 'D' : 'F',
    critical_findings: parseInt(gr.getValue('critical_findings'), 10) || 0,
    breach_reported: gr.getValue('breach_reported') === '1',
    as_of: new GlideDateTime().getValue()
  });
})(request, response);
```

Test it with the **REST API Explorer** before moving on.

### Phase E. Integration: pull ratings into ServiceNow

**Step E1. REST Message.** **System Web Services > Outbound > REST Message > New** `Security Ratings Provider`:

- Endpoint: `${endpoint}` (we pass it at runtime).
- Authentication: Basic, with a **Basic Auth Profile** for `ratings.integration`. (On a real client: OAuth 2.0 or API key in a Connection & Credential alias via Integration Hub.)
- HTTP method `getCompanyRating`, GET, endpoint `${endpoint}${domain}`.

**Step E2. Script Include `RatingsIntegration`** (scoped, not client callable):

```javascript
var RatingsIntegration = Class.create();
RatingsIntegration.prototype = {
  initialize: function () {
    this.endpoint = gs.getProperty('x_irm_lab.ratings.endpoint');
  },

  /** Pull the latest rating for one company and store a history row. Returns the sys_id or null. */
  refreshCompany: function (companyGr) {
    var domain = companyGr.getValue('u_security_domain');
    if (!domain) return null;
    try {
      var rm = new sn_ws.RESTMessageV2('x_irm_lab.Security Ratings Provider', 'getCompanyRating');
      rm.setStringParameterNoEscape('endpoint', this.endpoint);
      rm.setStringParameterNoEscape('domain', encodeURIComponent(domain));
      rm.setHttpTimeout(15000);
      var resp = rm.execute();
      var status = resp.getStatusCode();
      var body = resp.getBody();
      if (status !== 200) {
        gs.warn('[RatingsIntegration] ' + domain + ' HTTP ' + status + ' ' + body);
        return null;
      }
      var data = JSON.parse(body);
      return this._store(companyGr, domain, data, body);
    } catch (e) {
      gs.error('[RatingsIntegration] ' + domain + ' failed: ' + e.message);
      return null;
    }
  },

  refreshAll: function () {
    var c = new GlideRecord('core_company');
    c.addQuery('vendor', true);
    c.addNotNullQuery('u_security_domain');
    c.query();
    var n = 0;
    while (c.next()) {
      if (this.refreshCompany(c)) n++;
    }
    return n;
  },

  _store: function (companyGr, domain, data, raw) {
    var prev = this._latestRating(companyGr.getUniqueValue());
    var r = new GlideRecord('x_irm_lab_security_rating');
    r.initialize();
    r.setValue('company', companyGr.getUniqueValue());
    r.setValue('domain', domain);
    r.setValue('rating', data.rating);
    r.setValue('grade', data.grade);
    r.setValue('critical_findings', data.critical_findings);
    r.setValue('breach_reported', !!data.breach_reported);
    r.setValue('rating_date', new GlideDateTime());
    if (prev !== null) {
      r.setValue('previous_rating', prev);
      r.setValue('delta', data.rating - prev);
    }
    r.setValue('raw_payload', raw.substring(0, 3990));
    var id = r.insert();

    companyGr.setValue('u_latest_rating', data.rating);
    companyGr.update();
    return id;
  },

  _latestRating: function (companyId) {
    var r = new GlideRecord('x_irm_lab_security_rating');
    r.addQuery('company', companyId);
    r.orderByDesc('rating_date');
    r.setLimit(1);
    r.query();
    return r.next() ? parseInt(r.getValue('rating'), 10) : null;
  },

  type: 'RatingsIntegration'
};
```

**Step E3. Scheduled flow** `Daily Third-Party Ratings Refresh` in Flow Designer:

- Trigger: Daily 02:00.
- Action: custom action **Refresh all ratings** (script step calling `new RatingsIntegration().refreshAll()`, output = count).
- Log the count; if count = 0, create an incident for the integration team (shows you think about integration failure monitoring).

Run it once manually. Check `x_irm_lab_security_rating` has 10 rows (or 5 if only tier 1–2 have domains).

### Phase F. Script indicators for continuous control monitoring

**Step F1. Indicator template `TP-C01 External rating at or above threshold`**, Type **Script**, linked to policy statement TP-C01, frequency Daily:

```javascript
// Script indicator for TP-C01. The indicator's item is the control; its entity points at core_company.
(function () {
  var minPass = parseInt(gs.getProperty('x_irm_lab.rating.min_pass', '700'), 10);
  var control = current.item.getRefRecord();          // sn_compliance_control
  var entity = control.profile.getRefRecord();         // sn_grc_profile
  var companyId = entity.getValue('applies_to');       // core_company sys_id

  var r = new GlideRecord('x_irm_lab_security_rating');
  r.addQuery('company', companyId);
  r.orderByDesc('rating_date');
  r.setLimit(1);
  r.query();

  if (!r.next()) {
    result.value = 0;
    result.passed = false;  // no data is a failure: we cannot evidence the control
    return;
  }
  var rating = parseInt(r.getValue('rating'), 10);
  result.value = rating;
  result.passed = rating >= minPass;
})();
```

> Check on your release which variable holds the indicator in the script context (commonly `current`), and the exact field names on the indicator (`item`) and control (`profile`). Open the default script template on a new Script indicator; it shows the variables provided. Adjust if needed and mention that you verified it.

**Step F2. Indicator template `TP-C02 No open critical findings`**: same pattern, `result.value = critical_findings`, `result.passed = critical_findings === 0`.

**Step F3.** Generate indicators from both templates (one per control), run them, and confirm:

- SecureMail (690) and CallCentre One (650) fail TP-C01 → controls non-compliant → issues created.
- Those control failures feed the **control assessment** in the risk methodology, raising residual risk for TPR-01 for those suppliers. Re-run the residual assessment and show the change.

### Phase G. Event-driven reassessment on rating drop or breach

**Step G1. Flow `Third-Party Rating Deterioration`**:

- Trigger: **Created** on `x_irm_lab_security_rating` where `delta <= -50` OR `breach_reported = true` OR `grade` is D or F. (Use the property for the threshold via a script condition or a flow variable.)
- Steps:
  1. Look up the company and its Tier 1–2 entity.
  2. **If** an open issue already exists for this company with source "Ratings deterioration" in the last 7 days → add a work note and stop (de-duplication).
  3. **Create** `sn_grc_issue`: short description `Security rating drop for {company}: {previous} → {rating}`, priority 1 if breach else 2, entity, assigned to company's `u_risk_owner`, link the latest rating record in the description.
  4. **Trigger reassessment**: create a new Advanced Risk assessment for the TPR-01 risk of that entity (in the Risk Workspace you can start an assessment for a risk; from a flow, use a script step or create a task for the risk owner to reassess if the assessment cannot be started from script on your release). Also create an attestation for TP-C03 (breach notification) if a breach was reported.
  5. **Run indicators** for this company's TP-C01/TP-C02 now (call the indicator execution from a script step, or simply note the daily run) so control status is current.
  6. **Notify** the risk owner and the Vendor Management Office group by email.
  7. **Recalculate** the composite score (Phase H).

**Step G2. Demo it:** edit `x_irm_lab_mock_rating` for PayFast from 780 to 610 and set breach_reported = true. Run the daily flow manually. Show: new rating row with delta −170 → deterioration flow → P1 issue, reassessment created, email in **System Logs > Emails**, TP-C01 failing, composite score jumps to Critical.

### Phase H. Composite third-party risk score

**Step H1. Script Include `CompositeThirdPartyScore`**:

```javascript
var CompositeThirdPartyScore = Class.create();
CompositeThirdPartyScore.prototype = {
  initialize: function () {
    this.w = JSON.parse(gs.getProperty('x_irm_lab.score.weights',
      '{"tier":0.20,"rating":0.30,"indicators":0.20,"issues":0.15,"residual":0.15}'));
  },

  /** Returns {score, band, parts} and writes them to the company. 0 = lowest risk, 100 = highest. */
  calculate: function (companyId) {
    var company = new GlideRecord('core_company');
    if (!company.get(companyId)) return null;
    var entityId = this._entityFor(companyId);

    var parts = {
      tier: this._tierRisk(company.getValue('u_tp_tier')),
      rating: this._ratingRisk(parseInt(company.getValue('u_latest_rating'), 10)),
      indicators: entityId ? this._indicatorFailRate(entityId) : 50,
      issues: entityId ? this._issueRisk(entityId) : 0,
      residual: entityId ? this._residualRisk(entityId) : 50
    };

    var score = 0;
    for (var k in this.w) score += (parts[k] || 0) * this.w[k];
    score = Math.round(score * 10) / 10;
    var band = score >= 75 ? 'critical' : score >= 50 ? 'high' : score >= 25 ? 'medium' : 'low';

    company.setValue('u_composite_risk_score', score);
    company.setValue('u_risk_band', band);
    company.setValue('u_score_breakdown', JSON.stringify(parts));
    company.update();
    return { score: score, band: band, parts: parts };
  },

  _entityFor: function (companyId) {
    var e = new GlideRecord('sn_grc_profile');
    e.addQuery('applies_to', companyId);
    e.addActiveQuery();
    e.setLimit(1);
    e.query();
    return e.next() ? e.getUniqueValue() : null;
  },

  _tierRisk: function (tier) {
    return { '1': 100, '2': 70, '3': 40, '4': 10 }[tier] || 50;
  },

  // Map a 250–900 rating to 0–100 risk (900 → 0, 250 → 100); unknown rating = 60.
  _ratingRisk: function (rating) {
    if (isNaN(rating)) return 60;
    var r = Math.max(250, Math.min(900, rating));
    return Math.round((900 - r) / 650 * 100);
  },

  // Share of this entity's indicators whose last result failed.
  _indicatorFailRate: function (entityId) {
    var total = 0, failed = 0;
    var ind = new GlideRecord('sn_grc_indicator');
    ind.addQuery('item.profile', entityId);
    ind.addActiveQuery();
    ind.query();
    while (ind.next()) {
      total++;
      if (ind.getValue('last_result_passed') === '0') failed++;
    }
    return total ? Math.round(failed / total * 100) : 50;
  },

  // Weighted open issues: P1 = 40, P2 = 20, P3 = 10, P4 = 5, capped at 100.
  _issueRisk: function (entityId) {
    var weights = { '1': 40, '2': 20, '3': 10, '4': 5 };
    var sum = 0;
    var ga = new GlideAggregate('sn_grc_issue');
    ga.addQuery('profile', entityId);
    ga.addQuery('active', true);
    ga.addAggregate('COUNT');
    ga.groupBy('priority');
    ga.query();
    while (ga.next()) {
      sum += (weights[ga.getValue('priority')] || 5) * parseInt(ga.getAggregate('COUNT'), 10);
    }
    return Math.min(100, sum);
  },

  // Worst residual rating among the entity's risks. Adjust the field to your release
  // (Advanced Risk stores residual ratings on the risk / assessment instance).
  _residualRisk: function (entityId) {
    var map = { 'very_high': 100, 'high': 75, 'medium': 50, 'low': 25, 'very_low': 10 };
    var worst = 0, found = false;
    var risk = new GlideRecord('sn_risk_risk');
    risk.addQuery('profile', entityId);
    risk.addActiveQuery();
    risk.query();
    while (risk.next()) {
      var val = (risk.getDisplayValue('residual_risk') || '').toLowerCase().replace(/\s+/g, '_');
      if (map[val] !== undefined) {
        found = true;
        worst = Math.max(worst, map[val]);
      }
    }
    return found ? worst : 50;
  },

  type: 'CompositeThirdPartyScore'
};
```

**Step H2. Triggers for recalculation:**

- End of the daily ratings flow (for all companies).
- End of the deterioration flow (for that company).
- Business rule (async) on `sn_grc_issue` after insert/update when priority or state changes.
- Business rule (async) on `sn_grc_indicator_result` after insert.

Always async, so users do not wait on scoring.

**Step H3. Explainability:** add `u_score_breakdown` to the company form in a "Third-Party Risk" section, and a UI macro or simple formatted field showing each component. In interviews, say: "every score can be decomposed, so a risk manager can challenge it."

### Phase I. Workspace and dashboard

1. **Risk Workspace**: show the 20 generated risks, filter by entity, show inherent vs residual for PayFast before and after the rating drop.
2. **Compliance Workspace**: third-party controls by status, failing indicators.
3. **Dashboard `Third-Party Risk Posture`** (Platform Analytics / Reports):
   - Single score: number of Critical-band suppliers.
   - Bar: suppliers by tier and risk band.
   - Line: rating trend for Tier 1 suppliers (from `x_irm_lab_security_rating`).
   - List: open third-party issues by age and priority.
   - Heat map: residual risk by supplier × risk statement.
4. Optional (stretch): with UI Builder, add a **"Third-Party 360"** page in a configurable workspace showing company details, score breakdown, rating trend, risks, controls and issues on one screen. Even a simple version is impressive in a demo.

### Phase J. Security, quality and operations

- **ACLs:** only `sn_risk.manager` and `x_irm_lab.admin` can write `u_composite_risk_score`; rating table is read-only except for the integration user.
- **Integration user:** web-service-access-only, least privilege.
- **Error handling:** non-200 responses logged; zero-refresh incident; payload stored for audit.
- **Performance:** `GlideAggregate` for counts; async business rules; indicators scheduled off-peak.
- **ATF suite `IRM Lab – Third Party`:**
  1. Insert a mock rating below 700 → run TP-C01 indicator → assert failed and issue created.
  2. Insert a rating row with delta −60 → assert deterioration flow created an issue (use the "Wait for flow" step or check after flow completion).
  3. Call `CompositeThirdPartyScore.calculate()` for a known setup → assert band = expected.
- **Update sets / app repo:** keep all work in the scoped app and commit it to a source-control repo through Studio, so you can show the app history.

## 2.6 Demo script (8 minutes)

1. (45s) The problem: annual questionnaires, a breach found from the news, regulator expects continuous monitoring.
2. (60s) Suppliers in `core_company`, tiering result, entity type picks only Tier 1–2.
3. (60s) Risk framework → 20 generated risks → one Advanced Risk assessment (inherent → control → residual).
4. (60s) Third-party controls, how each is monitored (table from C4).
5. (90s) Integration: Scripted REST mock, REST Message, Script Include, daily flow, history table.
6. (90s) Live: drop PayFast's rating and set breach → run flow → P1 issue, reassessment, email, failing indicator, residual risk up, composite score to Critical.
7. (45s) Dashboard and score breakdown.
8. (30s) ATF tests and what I would change in production.

## 2.7 What I would do differently on a real engagement

- Use the vendor's certified spoke or Integration Hub spoke (for example a security-ratings spoke) instead of a custom REST message, with OAuth credentials in a Connection & Credential alias.
- Use the TPRM application if the client is licensed: engagements per service, tier-specific assessment templates, external portal for suppliers, event-driven management rules, and issue generation rules.
- Agree the scoring model and weights with the CRO and validate it against last year's incidents before making it visible to the board.
- Add fourth-party mapping (sub-processors) and DORA register of information if the client has EU operations.
- Move score recalculation into a scheduled batch with a "dirty" flag if the supplier count is in the thousands.

---

# Interview preparation

## How to describe this work (opening pitch, 60 seconds)

> "I hold the CIS Risk and Compliance certification, and to turn that into hands-on skill I designed and built two IRM implementations on a ServiceNow instance, scoped the way a client would scope them. The first is an Access Control Policy compliance program: ISO 27001 citations mapped to policy statements, an entity type on CMDB business applications that generates controls automatically, quarterly control attestations, Basic, Script and Manual indicators, issues, and time-bound policy exceptions. The second is third-party risk with continuous control monitoring: suppliers tiered by criticality, risks generated per supplier and assessed with inherent, control and residual ratings, a security-ratings integration through REST that feeds Script indicators, an event-driven flow that opens a P1 issue and a reassessment when a supplier's rating drops, and an explainable composite risk score on a dashboard. I can walk you through either one live."

## Talking points that signal real experience

1. **Entity framework is the heart of IRM.** Entity types (a table plus a condition) generate entities; policy statements and risk statements scoped to entity types generate controls and risks. Scope changes then flow through automatically.
2. **Statement vs control.** Statement = the requirement, control = the requirement applied to one entity with an owner. Same for risk statement vs risk.
3. **Three indicator types.** Basic (table + condition, count/percentage target), Script (custom logic, sets `result.value` and `result.passed`), Manual (task for evidence from outside the platform). Indicator results drive control compliance and can auto-create issues.
4. **Attestation vs indicator.** Attestation is the owner's assertion with evidence; indicators are measurements. Mature programs combine both and move controls from attestation to indicators over time.
5. **Issues are the single remediation channel**, with remediation tasks and an issue workflow. Exceptions are a separate, time-bound, approved path.
6. **Inherent vs residual.** Inherent = before controls; control effectiveness reduces it to residual; failing controls should push residual up. That link is why controls are related to risks.
7. **Integration pattern.** External data lands in a history table, indicators judge it, flows react to changes. Never overwrite history.
8. **Explainable scoring** and configuration through properties rather than hard-coding.
9. **Upgrade safety.** Custom work in a scoped app; GRC scopes untouched; ATF for regressions.

## Likely interview questions and strong answers

**Q1. What is the difference between a policy, a policy statement and a control?**
A policy is the governing document (Access Control Policy). Policy statements are the individual requirements, also called control objectives (accounts dormant for 90 days are disabled). A control is a statement applied to one entity, with an owner and a compliance status (dormant accounts disabled for Core Banking, owned by Ravi). Controls are generated from statements for every entity whose entity type is on the statement.

**Q2. How are controls generated? What happens when a new application is added?**
The policy statement lists entity types. Each entity type is a table and a condition, and entities are generated for records matching it. For each active statement and each matching entity, a control is created. When a new business application meets the condition, entity generation creates an entity and the controls follow. I demoed this by changing an application's criticality and watching 5 controls appear.

**Q3. Entity type vs entity class?**
An entity type defines where entities come from (table + condition) and generates them. An entity class is a grouping/classification across types (for example "IT Application"), used for filtering, reporting and sometimes scoping. Types generate, classes categorise.

**Q4. Explain the indicator types and when you use each.**
Basic for data in a ServiceNow table with a condition and a target (dormant users count, target 0). Script for logic that needs joins or external data (privileged users not in the approved group, supplier rating ≥ 700). Manual when the data lives outside the platform and needs a person to supply a value or evidence (quarterly access review sign-off).

**Q5. What happens when an indicator fails?**
An indicator result is stored with the value and supporting data. The control linked to the indicator becomes non-compliant and, depending on configuration, an issue is created against the control and entity. When a later result passes and the issue is closed, the control returns to compliant.

**Q6. How did you design attestations?**
Four questions: implementation status, narrative, mandatory evidence when implemented, and a remediation plan with a date when not fully implemented. Scheduled quarterly, assigned to the control owner. A Not implemented answer makes the control non-compliant and opens an issue.

**Q7. How do you handle a control that cannot be met for a valid reason?**
A policy exception: linked to the statement and the affected controls, with justification, compensating controls, an approval by the policy owner, and an expiry date. When it expires the control is evaluated again.

**Q8. Inherent vs residual risk, and how do controls affect the risk score?**
Inherent risk is impact × likelihood before controls. The control assessment rates control effectiveness, which can be derived from the compliance of controls linked to the risk. Residual risk is inherent reduced by control effectiveness. In my third-party build, when the rating indicator failed, the control became non-compliant, control effectiveness dropped and the residual rating for the breach risk went up.

**Q8b. Why didn't you use the TPRM application?**
It does not install on a developer instance today, so I modelled suppliers as entities on `core_company` with a tiering questionnaire. That is also how clients without a TPRM licence run third-party risk. With TPRM I would use tiering assessments, engagements, the supplier portal and issue generation rules, and keep my risks, controls, indicators, integration and scoring design.

**Q9. Advanced Risk vs classic risk assessment?**
Advanced Risk gives configurable methodologies (inherent, control, residual and optional target assessments), multiple factors (qualitative and quantitative), scoring logic, assessor/approver workflow and reuse across entity types. Classic uses fixed fields on the risk. Advanced is what clients use now for anything beyond basic scoring.

**Q10. How did you integrate the external ratings?**
A REST Message with a Basic auth profile (in production, OAuth or an API key via Connection & Credential alias), called from a scoped Script Include, triggered by a daily scheduled flow. Responses are written to a rating history table with previous rating and delta. Non-200 responses are logged, and a zero-refresh run raises an incident. Because I had no commercial ratings licence, I built the provider as a Scripted REST API on the instance with its own integration user and ACL, so the integration pattern is real and only the data is simulated.

**Q11. Why a separate history table instead of a field on the company?**
Indicators need the latest value, the deterioration logic needs the previous value, and trend charts need the series. History also gives auditors the evidence of what the system knew and when.

**Q12. How do you avoid duplicate issues when ratings keep dropping?**
The deterioration flow checks for an open issue for the same company with the same source in the last 7 days and adds a work note instead of creating another issue.

**Q13. How is your composite score calculated and why should a CRO trust it?**
A weighted sum of five 0–100 components: tier, external rating, indicator failure rate, weighted open issues and worst residual risk. Weights live in a system property. The breakdown is stored on the company record, so anyone can see why a supplier is High. Before production I would back-test it against past incidents with the risk team.

**Q14. How would you scale this to 5,000 suppliers?**
Tiering first so only Tier 1–2 get continuous monitoring; batch API calls if the provider supports them; async and scheduled recalculation with a dirty flag; `GlideAggregate` for counts; indicator schedules spread across off-peak windows; and monitoring of flow execution time.

**Q15. Which roles did you use?**
`sn_compliance.admin/manager/user/reader` and `sn_risk.admin/manager/user/reader`, plus a custom read role for the integration user. I tested by impersonating the control owner, the risk manager and an auditor.

**Q16. How did you test?**
Manual demo scenarios plus ATF: control generation on scope change, indicator failure creating an issue, indicator pass after data fix, deterioration flow creating an issue, and score banding.

**Q17. What is UCF and would you use it?**
The Unified Compliance Framework provides authority documents, citations and common controls mapped across frameworks. With a licence key it can be imported into Policy and Compliance, so one control can satisfy ISO 27001, NIST and SOX ITGC. On my instance I created a small ISO subset manually.

**Q18. Where does SecOps connect to IRM?** (useful since the role also mentions SecOps)
Vulnerability Response results can feed risk and compliance indicators (for example "critical vulnerabilities older than 30 days on in-scope apps"), Security Incident Response can create or link GRC issues, and Configuration Compliance results can drive control status. Pattern-wise, it is exactly what I did with ratings: security data in a table, an indicator judges it, issues and risk follow.

**Q19. What went wrong while building, and how did you fix it?**
Prepare 2–3 true stories from your own build. Common real ones: indicator script used the wrong variable or field name (fixed by reading the default script template); controls not generating because the entity type condition did not match (fixed by checking the entities list first); flow not firing because the trigger condition referenced a field updated later (fixed by moving to an "on insert" trigger on the history table). Only use the ones that actually happened to you.

**Q20. What would you do first on a new IRM client engagement?**
Discovery: frameworks in scope, current control library, entity model (what are we assessing: apps, business units, suppliers), owners, issue and exception processes, reporting needs. Then design the entity framework and data model before touching content, and agree status/scoring rules with audit and risk.

## Resume bullets (true and defensible)

Put these under a heading such as **"Hands-on Project: ServiceNow IRM Implementation (self-built, ServiceNow PDI)"**, not under a client project.

- Designed and built a Policy and Compliance program on ServiceNow IRM: mapped ISO 27001 Annex A citations to an Access Control Policy with 5 control objectives, and used an entity type on CMDB business applications to auto-generate 25 controls across 5 in-scope applications.
- Implemented continuous control monitoring with Basic, Script and Manual GRC indicators (dormant accounts, unapproved privileged access, access-review evidence) that automatically set control compliance and raise issues on failure.
- Configured quarterly control attestations with conditional evidence and remediation questions, issue remediation workflow and time-bound policy exceptions with owner approval.
- Built a third-party risk solution: supplier tiering, a third-party risk framework generating 20 risks across Tier 1–2 suppliers, and inherent/control/residual risk assessment.
- Integrated an external security-ratings API (simulated as a Scripted REST service) using REST Message, a scoped Script Include and a scheduled Flow Designer flow, storing rating history for trend and deterioration analysis.
- Automated event-driven reassessment: a rating drop or breach signal creates a P1 GRC issue, triggers a reassessment, notifies the risk owner and recalculates an explainable composite third-party risk score.
- Delivered Risk and Compliance workspace views and a Third-Party Risk Posture dashboard; covered control generation, indicator failure and scoring with ATF test suites; kept all customisation in a scoped application.

**Skills line:** ServiceNow IRM (Policy and Compliance, Risk Management, Advanced Risk, third-party risk design), GRC Indicators, Entity Framework, Attestations, Issue Management, Flow Designer, Scripted REST APIs, REST Message V2, Script Includes, ATF, Performance Analytics/Reports, CIS-RC.

## Suggested build schedule (about 2 weeks of evenings)

| Day | Work |
|---|---|
| 1 | PDI, plugins, roles, users, scoped app |
| 2–3 | Use case 1 Steps 1–5 (library, entity type, policy, controls) |
| 4 | Use case 1 Steps 6–7 (attestation, indicators) |
| 5 | Use case 1 Steps 8–11 (issues, exception, reports, ATF); record a demo video |
| 6 | Use case 2 Phase A–B (suppliers, tiering, risks, methodology) |
| 7 | Phase C–D (controls, mock API) |
| 8 | Phase E–F (integration, indicators) |
| 9 | Phase G–H (deterioration flow, composite score) |
| 10 | Phase I–J (dashboard, ATF); record the demo video |

Keep screenshots of each step in a folder. Two short demo videos and a screenshot pack are excellent to share with the referrer along with your resume.
