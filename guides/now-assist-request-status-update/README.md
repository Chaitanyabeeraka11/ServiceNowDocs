# Custom Now Assist skill: "Where's my request?" status update

A beginner-friendly build of a custom generative AI skill for **Service
Request Management**. A scheduled **Flow** finds requested items (RITMs) that
have gone quiet, runs a Skill Kit skill that reads the approvals, tasks and
internal notes, and posts a plain-language update to the **requester**
before they have to chase it.

| | |
|---|---|
| **Problem** | A large share of service desk contacts are people chasing requests ("any update on my laptop?"). The information exists, but it's spread across approvals, catalog tasks and internal work notes the requester can't see or understand. |
| **Idea** | Most Now Assist examples summarise a record *for the agent*. This one writes *for the requester*, proactively, and turns internal jargon into an honest status update: what's happening, who has it, whether they need to do anything, and a date only if one exists. |
| **Invoked from** | A scheduled **Flow** using the **Execute Skill** action (the main path). The same skill is also deployed as a **UI Action** so an agent can preview the message, which is handy for a live demo. |
| **Time to build** | About 2 to 3 hours the first time. |
| **Companion files** | [`PRESENTING.md`](PRESENTING.md) (demo script, 2-minute talk, likely questions) and [`scripts/`](scripts/). |

> **Shared setup.** Instance, plugins, roles and the release-differences
> table are the same as in the first guide:
> [`../now-assist-custom-skill-assignment-history/README.md`](../now-assist-custom-skill-assignment-history/README.md)
> (Sections 2 and 10). This guide only repeats what's different.
> Anything that changes between releases is marked **[Varies by release]**.

---

## Contents

1. [How it works](#1-how-it-works)
2. [Before you start](#2-before-you-start)
3. [Phase 1, Scope the skill](#3-phase-1--scope-the-skill)
4. [Phase 2, Sample data and the test dataset](#4-phase-2--sample-data-and-the-test-dataset)
5. [Build the data tool (Script Include)](#5-build-the-data-tool-script-include)
6. [Phase 3, Build the skill and the prompt](#6-phase-3--build-the-skill-and-the-prompt)
7. [Phase 4, Test and evaluate](#7-phase-4--test-and-evaluate)
8. [Phase 5, Publish, activate and invoke from a Flow](#8-phase-5--publish-activate-and-invoke-from-a-flow)
9. [Rolling it out safely](#9-rolling-it-out-safely)
10. [Troubleshooting](#10-troubleshooting)
11. [Sources](#11-sources)

---

## 1. How it works

```
 Daily 9:00  Flow "AI request status update"
     │
     ├─ Look up RITMs: active, not updated for 3+ days
     │
     └─ For each RITM
          │
          ├─ Execute Skill: "Request Status Update"
          │     input : the RITM
          │     tool  : GetRequestStatus (script)
          │             approvals  (sysapproval_approver)
          │             tasks + latest internal note (sc_task)
          │             requester's last comment
          │     prompt: "Write to the requester, not IT…"
          │
          ├─ If the answer is NO_UPDATE → skip
          │
          └─ Update RITM: Additional comments =
               "[Automatic update] Your laptop is approved and on order.
                The supplier has it on backorder and expects to ship it
                around 28 Nov to the Pune office. Nothing is needed from
                you right now."
```

Posting a comment updates the RITM, so the 3-day clock restarts. That
gives you natural throttling: at most one automatic update every 3 quiet
days per request.

**Is this already out of the box?** Now Assist for ITSM has a *Request
summarization* skill, which is a summary for the **agent**. This skill writes
**to the requester**, runs **proactively** from a Flow, and deliberately
filters internal notes. Check **AI Admin Hub → AI Skills** (or the Now Assist
Admin console) on your release before you present, in case something similar
has been added. **[Varies by release]**

---

## 2. Before you start

Same as the first guide (Section 2): a Now Assist-entitled non-production
instance, Skill Kit and Generative AI Controller up to date, and the roles
`sn_skill_builder.admin` + `admin`.

Additionally:

* **Service Catalog / Request Management** is active (it is on any ITSM instance).
* You can build flows in **Workflow Studio** (Flow Designer): `admin` or `flow_designer` role.
* The **Execute Skill** action is available in Workflow Studio. The docs
  list it as a *Now Assist Skill Kit action*. If you can't find it, update
  Skill Kit. **[Varies by release]**

---

## 3. Phase 1, Scope the skill

| Question | Answer |
|---|---|
| What exactly should it do? | Write one short, honest status update to the person waiting on a requested item. |
| Input | One requested item (RITM). A tool adds approvals, tasks, internal notes and the requester's last comment. |
| Output | Plain text, at most 80 words: where it is, what's next and which team, what the requester must do (or "nothing"), a date only if the data has one. Or exactly `NO_UPDATE`. |
| Who reads it | The requester (an employee, not IT). |
| Success | No invented dates; no internal names or blame; requester actions are always clear; fewer "any update?" contacts. |
| Must NOT | Quote internal notes, name fulfillers, promise dates that aren't in the data, use jargon (RITM, PO, stage, assignment group), or message about closed requests. |

**Why Gen AI and not a notification template?** A template can say "Stage:
Fulfillment". It can't read "PO raised, vendor backordered, new ETA 28 Nov"
from a work note and turn it into a safe sentence for the requester, or
notice that the team is waiting on the requester for a cost centre.

---

## 4. Phase 2, Sample data and the test dataset

### 4.1 Create the demo requests

1. **All → System Definition → Scripts - Background**, scope **global**.
2. Paste [`scripts/01-create-sample-requests.js`](scripts/01-create-sample-requests.js) and run it.
3. Copy the six RITM numbers it prints.

The script makes you the requester (so you see the comments in the portal),
creates a "Priya Sharma" approver, and builds six requested items, each
stuck in a different way. The RITMs are inserted with `setWorkflow(false)` so
the catalog item's own flow doesn't add extra approvals or tasks. If an item
name it looks for (for example "Standard Laptop") exists on your instance, it
links to it. Otherwise the item is blank, and the short description carries
the name.

**Check:** open TC2 and look at the **Approvals** and **Catalog Tasks**
related lists, and the work note on the task.

### 4.2 The test dataset (ground truth)

* **Development set:** TC1, TC2, TC6. Tune the prompt on these.
* **Held-out test set:** TC3, TC4, TC5. Run them once, at the end.

| ID | Situation | Expected update (ground truth) | Must NOT happen |
|---|---|---|---|
| TC1 | Waiting on manager approval; requester asked "Any update?" | Waiting for approval from Priya Sharma; answers the requester's question; nothing needed from them (or "you may remind your manager"); no date. | Says it's approved or gives a date. |
| TC2 | Approved; laptop backordered; ETA 28 Nov; ships to Pune | Approved and on order; supplier backorder; expected around 28 Nov, shipping to the Pune office; nothing needed. | Mentions the PO number or "backordered" jargon unexplained; invents a different date. |
| TC3 | Team waiting on requester for cost centre | Clear action: the requester must send their cost centre (reply to the email or add a comment); order is on hold until then. | "Nothing is needed from you." |
| TC4 | Internal note names staff and blames ("Ravi forgot… again") | Licence is being arranged by the Software team; short delay with a supplier system; expected in 2 to 3 working days; nothing needed. | Names Ravi or Meena; says "forgot", "again", or blames anyone. |
| TC5 | New joiner: 2 of 3 tasks done; SAP access pending Finance approval | Laptop delivered to desk 4F-12 and mailbox ready; SAP access waiting on Finance approval, usually about 2 working days; nothing needed. | Says everything is done; drops the pending item. |
| TC6 | Already complete | Exactly `NO_UPDATE`. | Any message. |

---

## 5. Build the data tool (Script Include)

1. **All → System Definition → Script Includes → New**.
2. **Name:** `RequestStatusUtil`, **Application:** Global, **Accessible
   from:** All application scopes, **Client callable:** unchecked.
3. Paste [`scripts/02-script-include-RequestStatusUtil.js`](scripts/02-script-include-RequestStatusUtil.js). Submit.
4. Test it **without AI** in Scripts - Background:

```javascript
var r = new GlideRecord('sc_req_item');
r.get('number', 'RITM0010002');   // your TC2 number
gs.info(new global.RequestStatusUtil().getStatusJSON(r.getUniqueValue()));
```

You should get JSON like this (shortened):

```json
{
  "request_number": "RITM0010002",
  "item": "Standard Laptop",
  "is_active": true,
  "stage": "Fulfillment",
  "approvals": [{ "approver": "Priya Sharma", "state": "Approved", "comment": "Approved, old laptop is 5 years old." }],
  "tasks": [{ "task": "Order laptop from vendor", "team": "Procurement", "state": "Work in Progress",
              "is_closed": false,
              "latest_internal_note": "PO 4500123 raised. Vendor confirms model is backordered, new ETA 28 Nov. Will ship to Pune office." }],
  "tasks_done": 0, "tasks_total": 1,
  "requester_latest_comment": ""
}
```

Design notes worth saying in the session:

* **Facts by script, words by AI.** The script decides what's true; the LLM
  only rephrases. That's the main defence against hallucination.
* **Only the latest note per task** is sent. It's the most current, keeps
  the prompt small, and lowers the chance of old internal chatter leaking.
* **Internal notes are labelled as internal** (`latest_internal_note`) so
  the prompt can treat them differently.

---

## 6. Phase 3, Build the skill and the prompt

### 6.1 Create the skill

**All → Now Assist Skill Kit → Home** (Australia: **All → AI Skill Kit →
Home**) → **Create new skill**:

| Field | Value |
|---|---|
| Skill name | `Request Status Update` |
| Description | `Writes a plain-language status update for the requester of a stalled requested item.` |
| Default provider | Now LLM Service |
| User access | Select roles → `itil` |
| Role restrictions | `itil` |
| Prompt | Write from scratch |

**Skill input:** Datatype **Record**, Name `requested_item`, Table
**Requested Item [sc_req_item]**, Mandatory, Test record = your TC2.

**Configurations:** Temperature `0.2`.

### 6.2 Add the tool

**Tool editor** tab → **+** → **Tool node** → **Script** → **Configure tool**:

* **Name:** `GetRequestStatus`
* **Write my own script:** paste [`scripts/03-skill-tool-GetRequestStatus.js`](scripts/03-skill-tool-GetRequestStatus.js)
* **Tool input:** `ritm_sys_id` = **requested_item → Sys ID**
* **Tool output:** standard `output`
* **Add**, then **Run tools**. You should see the Section 5 JSON.

(If your release has no Script tool, use a Flow Action tool that calls the
Script Include. See the first guide, Section 6.3. **[Varies by release]**)

### 6.3 The prompt

Paste this, then bind `{{GetRequestStatus.output}}` with **Insert inputs**:

```text
You write short status updates for an employee who is waiting on an IT service request. The reader is the requester, not IT staff. They do not know internal terms such as RITM, stage, catalog task, assignment group or PO.

Request data (JSON):
{{GetRequestStatus.output}}

Write ONE message to the requester in plain text, at most 80 words, covering in this order:
1. Where the request is now, in one sentence (for example "approved and being ordered" or "waiting for approval from Priya Sharma").
2. What happens next and which team is handling it.
3. What the requester needs to do. If the data shows a team is waiting on the requester, say exactly what to provide and how. Otherwise write "Nothing is needed from you right now."
4. An expected date or timeframe ONLY if one appears in the data. Otherwise give no date.

Rules:
- Use only facts from the data. Never invent dates, reasons, steps or promises.
- Fields named latest_internal_note are internal. Use their facts, but never quote them, never name IT staff from them, and never blame anyone. Describe problems neutrally, for example "a short delay with the supplier".
- People listed under approvals may be named.
- If requester_latest_comment contains a question, answer it.
- Friendly and direct. No "Dear", no sign-off, at most one apology.
- If is_active is false, or there is nothing useful to tell the requester, reply with exactly: NO_UPDATE
```

Why each part is there:

| Prompt element | Fixes |
|---|---|
| "The reader is the requester… does not know RITM, PO…" | Jargon (TC2) |
| Fixed four-part order | Consistent, testable output |
| "Date ONLY if one appears in the data" | Invented ETAs (TC1) |
| Internal-note rule plus neutral wording example | Name and blame leaks (TC4) |
| "If a team is waiting on the requester, say exactly what" | Missed requester action (TC3) |
| `NO_UPDATE` sentinel | Messages about closed requests (TC6); the Flow can skip cleanly |

---

## 7. Phase 4, Test and evaluate

### 7.1 Tune on the development set

**Run tests** → pick TC1 → **Run test**. Check the **Response** tab, and the
**Grounded prompt** tab to see the exact JSON the model received. Repeat with
TC2 and TC6 until all three match Section 4.2. Each run uses at least one
assist.

### 7.2 Score the held-out set once

Run TC3, TC4 and TC5 without editing the prompt in between.

**Built-in evaluation** (recent releases: skill → **Prompt performance** →
**Evaluation runs**): create a dataset from table `sc_req_item` with condition
*Short description starts with [AI Demo]*, map the record to `requested_item`,
and choose **Faithfulness** (no invented facts), **Correctness with Golden
Response** (paste the Section 4.2 expectations as golden responses) and
**Human Feedback**. **[Varies by release]**

**Or a simple scorecard:**

| Case | Status correct | Requester action correct | Date only if in data | No names / blame / jargon | ≤ 80 words | Pass? |
|---|---|---|---|---|---|---|
| TC3 | | | | | | |
| TC4 | | | | | | |
| TC5 | | | | | | |

**Pass bar:** every case passes "requester action correct", "date only if in
data" and "no names / blame". These three columns are the real safety
requirements for anything sent to employees.

### 7.3 Finalize

Select the lock icon (**Finalize prompt**).

---

## 8. Phase 5, Publish, activate and invoke from a Flow

### 8.1 Deployment settings

Skill → **Deployment and skill settings**:

| Field | Value |
|---|---|
| Workflow | Technology |
| Product | ITSM |
| Feature | Custom: `Request status update` |
| Activation points | **Flow action** (main) and **UI Action** (agent preview for the demo) |

Save → **Publish skill**.

### 8.2 Activate

As `admin`: **Now Assist Admin → Features / Now Assist Skills** (Australia:
**AI Admin Hub → AI Skills**) → find *Request Status Update* → **Activate
skill**. Enable it for **Flow** and **UI Action**. **[Varies by release]**

The UI Action that activation generates appears on the RITM form. It shows the
draft update as an info message without posting anything. Rename it
**Preview requester update** (System UI → UI Actions).

### 8.3 Build the Flow

**All → Workflow Studio → New → Flow**. Name: `AI request status update`.
Run as: **System user**.

**Trigger:** **Scheduled → Daily**, 09:00.

**Flow variable:** `update_text` (String).

**Actions:**

1. **Look Up Records**
   * Table: Requested Item [sc_req_item]
   * Conditions: **Active is true** AND **Updated relative before 3 Days ago**
   * Demo only: also **Short description starts with [AI Demo]**, and remove
     the date condition so it runs on fresh demo data
   * Max results: 50 (keeps assist use predictable)
2. **For Each** item in step 1's records.
3. **Execute Skill** (under the Now Assist Skill Kit actions):
   * Workflow: Technology, Product: ITSM, Feature: Request status update
   * Skill Config: **Request Status Update**
   * Skill Inputs → `requested_item` = the **For Each** record pill
4. **Set Flow Variables** → `update_text` = script
   [`scripts/04-flow-extract-skill-text.js`](scripts/04-flow-extract-skill-text.js).
   Drag your Execute Skill **Output** pill into the script so the path is right.
5. **If** `update_text` *is not empty* AND `update_text` *does not contain* `NO_UPDATE`:
   * **Update Record** (the For Each record): **Additional comments** =
     `[Automatic update] ` + `update_text` pill.
   * **Pilot mode:** write to **Work notes** instead, so fulfillers see and
     check the drafts for a week before requesters do (see Section 9).

**Save → Test** (runs it now) → open the execution details. Then open TC2 in
the Employee Center / Service Portal as the requester and see the comment.

> **Testing flows that call skills.** The Skill Kit docs say: if the skill is
> deployed as a flow, turn off the `com.glide.oneapi.fdih.async.quick.mode`
> system property and turn on flow reporting to get execution details. Turn it
> back on afterwards.

**Activate** the flow when you're happy.

### 8.4 Monitor

* **Volume and cost:** executions and assists in the admin console / AI Admin
  Hub, and the flow's execution history. One assist per RITM per run.
* **Quality:** sample 10 automatic comments a week against the task notes.
  Track how often the answer is `NO_UPDATE`.
* **Business result:** fewer "status check" contacts. Compare the count of
  incidents or chats mentioning a RITM number, before and after.

### 8.5 Clean up

[`scripts/99-cleanup-sample-requests.js`](scripts/99-cleanup-sample-requests.js)
(dry run first). Deactivate the flow.

---

## 9. Rolling it out safely

Because this writes to employees, roll it out in stages, and say so in the
session. It's the governance answer people will ask about.

1. **Preview only:** agents use the *Preview requester update* button.
2. **Pilot (work notes):** the flow writes drafts to work notes for one
   catalog category. Fulfillers flag bad ones.
3. **Live (additional comments):** switch the field, keep the
   `[Automatic update]` prefix so people know it's automated, and keep the
   3-day throttle.
4. **Opt-outs:** add a condition to exclude sensitive catalog items (HR,
   legal, security) from the Look Up step.

---

## 10. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| **Execute Skill** action not in Workflow Studio | Skill Kit outdated, or skill not activated for Flow | Update Skill Kit; activate with the Flow option. |
| Skill Config dropdown is empty | Workflow / Product / Feature don't match the deployment settings | Pick exactly Technology / ITSM / Request status update. |
| Comment shows raw JSON | Output not unpacked | Use script 04 in the Set Flow Variables step. |
| Comment says "NO_UPDATE" | The If condition is missing or checks the wrong pill | Check `update_text` *does not contain* `NO_UPDATE`. |
| Tool returns `{"error":"Requested item not found"}` | Input mapped to the wrong field | Tool input must be **requested_item → Sys ID**. |
| Approvals empty for real (non-demo) items | Approvals are on the parent request (`sc_request`) rather than the RITM | Extend `_getApprovals` to also query `sysapproval = ritm.request`. |
| Model names a fulfiller | Internal-note rule too weak | Keep temperature 0.2; add a Faithfulness metric; add a sentence like "Refer to teams, never to individual IT staff". |
| No flow execution details | `com.glide.oneapi.fdih.async.quick.mode` is on | Turn it off while testing (see Section 8.3). |

---

## 11. Sources

Official docs in this repository (Australia release):

* `markdown/build-workflows/workflow-studio/execute-skill-action.md` (Execute Skill action inputs and outputs)
* `markdown/intelligent-experiences/now-assist-skill-kit/configure-skill-settings.md` (Flow action and UI Action activation points)
* `markdown/intelligent-experiences/now-assist-skill-kit/test-prompt-template.md` (flow testing property, assist consumption)
* `markdown/intelligent-experiences/now-assist-skill-kit/create-new-skill.md`, `create-prompt-template.md`, `add-a-tool.md`, `evaluate-prompt.md`, `publish-skill.md`, `activate-skill.md`
* `markdown/intelligent-experiences/now-assist-skill-kit/na-skill-kit-guidelines.md`, `scoping-the-skill.md`, `creating-a-dataset.md`, `deploying-and-monitoring.md`
* `markdown/it-service-management/now-assist-for-it-service-management-itsm/cust-now-assist-request-summarization-skill.md` (the OOTB agent-facing request summary, for contrast)

ServiceNow Community (verify on your instance): Script tool syntax
`runScript(context)` / `context.getValue()`, and the auto-generated UI Action.
These are the same references as in the first guide, Section 11.
