# Custom Now Assist skill: Incident Assignment History Summary

A beginner-friendly, end-to-end build of one custom generative AI skill with
**Now Assist Skill Kit** (called **AI Skill Kit** in the Australia release),
from an empty instance to a button on the incident form.

| | |
|---|---|
| **Use case** | An agent picks up an incident that has bounced between teams. One click explains where it has been, who moved it, why, and whether it is ping-ponging. |
| **Why this one** | It answers the open question from Session 1 ("Can Incident Summarization include the assignment group reassignment history?") and it walks through all five Skill Kit phases. |
| **Invoked from** | A UI Action (form button) on the incident form. |
| **Time to build** | About 2 to 3 hours the first time, 30 minutes once you know the screens. |
| **Companion files** | [`PRESENTING.md`](PRESENTING.md) (demo script, 2-minute talk, likely questions) and [`scripts/`](scripts/) (copy-paste code). |

> **Release note.** This guide was written against the **Australia** docs in
> this repository (`markdown/intelligent-experiences/now-assist-skill-kit/`)
> and checked against older-release community material. Screen names moved
> between releases. Anything that differs is marked **[Varies by release]**
> and summarised in [Section 10](#10-what-varies-by-release).

---

## Contents

1. [The use case in one picture](#1-the-use-case-in-one-picture)
2. [Prerequisites: instance, plugins, roles](#2-prerequisites-instance-plugins-roles)
3. [Phase 1, Scope the skill](#3-phase-1--scope-the-skill)
4. [Phase 2, Create the sample data and the test dataset](#4-phase-2--create-the-sample-data-and-the-test-dataset)
5. [Build the data tool (Script Include)](#5-build-the-data-tool-script-include)
6. [Phase 3, Build the skill and the prompt in Skill Kit](#6-phase-3--build-the-skill-and-the-prompt-in-skill-kit)
7. [Phase 4, Test and evaluate](#7-phase-4--test-and-evaluate)
8. [Phase 5, Publish, activate, add the UI Action, monitor](#8-phase-5--publish-activate-add-the-ui-action-monitor)
9. [Troubleshooting](#9-troubleshooting)
10. [What varies by release](#10-what-varies-by-release)
11. [Sources](#11-sources)

---

## 1. The use case in one picture

```
 Agent clicks "Explain assignment history" on INC0010043
            │
            ▼
 ┌───────────────────────────── Custom skill ─────────────────────────────┐
 │ Input:  incident record                                                │
 │ Tool:   GetAssignmentHistory (script)                                  │
 │         reads sys_audit  (assignment_group old → new, who, when)       │
 │         reads work notes (why it moved)                                │
 │ Prompt: "Explain this history to the agent who just picked it up…"     │
 │ LLM:    Now LLM Service                                                │
 └────────────────────────────────────────────────────────────────────────┘
            │
            ▼
 REASSIGNMENT SUMMARY: Reassigned 4 times, now with Database.
 PATH: Service Desk → Software → Database → Application Development → Database
 HAND-OFFS: …one line each, with the reason from the work note…
 PATTERN TO WATCH: Database has had this incident twice (ping-pong).
```

**Why not just use the out-of-box Incident Summarization skill?**
The OOTB skill can be customised (AI Admin Hub → make a copy → choose input
fields), but its inputs are **fields on the incident table** such as
description, work notes and comments. The ordered "old group → new group,
by whom, when" trail lives in the **sys_audit** table, which the OOTB skill
does not read. So you either add a tool to a cloned summarization skill, or
build a small dedicated skill. This guide builds the dedicated skill because
it is easier to explain and it touches every phase. **[Likely, confirm on your
release by opening the OOTB skill's inputs.]**

---

## 2. Prerequisites: instance, plugins, roles

### 2.1 Instance

You need an instance that is **entitled for Now Assist** (for example, a
company sandbox with Now Assist for ITSM Pro Plus or Enterprise Plus, or a
training instance). A standard Personal Developer Instance (PDI) usually does
**not** have Now Assist licensing, so check with your training team before
you plan the demo around a PDI. **[Varies by entitlement]**

Do the whole build in a **non-production** instance. The official guidance is
to build and evaluate in non-production and only then move the skill on.

### 2.2 Plugins / applications

Open **All → System Applications → All Available Applications → All**
(Application Manager) and make sure these are installed **and updated to the
latest version**. The Skill Kit docs say explicitly that you must update your
Now Assist plugins (for example, Now Assist for ITSM) to use Skill Kit, and to
update Generative AI Controller whenever you update Skill Kit.

| Application | Usual ID (verify in Application Manager) | Why you need it |
|---|---|---|
| Incident Management (ITSM) | `com.snc.incident` (base) | The incident table and form. |
| Now Assist for IT Service Management (ITSM) / ServiceNow Otto for ITSM | `sn_itsm_gen_ai` | Entitlement and the ITSM skills. Skill Kit ships with these packages. |
| Now Assist Skill Kit / AI Skill Kit | `sn_skill_builder` | The skill builder itself. From Yokohama/Zurich onward it is delivered through the ServiceNow Store, so update it there. |
| Generative AI Controller | `sn_generative_ai` | Connects skills to the LLM providers. Installed as a dependency; keep it in step with Skill Kit. |
| Now Assist Admin console / AI Admin Hub | `sn_nowassist_admin` | Where an admin activates the published skill. |

> **[Varies by release]** Plugin display names changed in the Australia
> release ("Now Assist" became "ServiceNow Otto" in many product names,
> "Now Assist Skill Kit" became "AI Skill Kit", "Now Assist Admin console"
> became "AI Admin Hub"). The IDs above are the usual technical names; search
> by the display name if one does not match.

### 2.3 Roles

| Who | Role | What it allows | Source |
|---|---|---|---|
| You (builder) | `sn_skill_builder.admin` | Create, configure, test, evaluate and publish skills, call skills from scripts. Not assigned to anyone by default. | `na-skill-kit-roles.md` |
| You (admin) | `admin` | Install Skill Kit, **activate** the published skill, create the Script Include and UI Action. | `na-skill-kit-roles.md`, `activate-skill.md` |
| Demo agent | `itil` | Clicks the button. You will put `itil` in the skill's access control so only agents can run it. | Skill security controls |
| Not needed | `sn_skill_builder.model_admin` | Only for custom / BYO LLM connections. Not used here (we use Now LLM Service). | `na-skill-kit-roles.md` |

Steps:

1. **All → User Administration → Users**, open your own user.
2. In **Roles**, select **Edit**, add `sn_skill_builder.admin` (you already have `admin`). Save.
3. **Log out and log back in** so the new role takes effect.
4. Optional but good for the demo: create a user **Demo Agent** with only the
   `itil` role, so you can show that a normal agent (not admin) can use it.

**Check:** **All → Now Assist Skill Kit → Home** (or **All → AI Skill Kit →
Home**) opens without an access error.

---

## 3. Phase 1, Scope the skill

The docs' scoping guideline asks four questions before you build. Write the
answers down; they become your talk track.

| Question | Answer for this skill |
|---|---|
| What exactly should it do? | Explain an incident's assignment group history: path, hand-offs with reasons, and any pattern (ping-pong, long stay). |
| Inputs | One incident record. A tool adds the audit trail and work notes. |
| Output (content and format) | Plain text, four labelled parts, under 200 words. No Markdown, because it shows in a form info message. |
| Who uses it | Service desk and resolver-group agents (`itil`). |
| How do we measure success? | Path and count match sys_audit exactly; every reason is traceable to a work note; nothing invented. |
| What must it NOT do? | Invent reasons, names or times. Blame people. Treat the first assignment as a reassignment. |

**Before you build, check for an OOTB skill.** The scoping guide says to
review existing skills in the admin console first and use them where
possible. You did this in Section 1: the OOTB summary does not cover the audit
trail, so a custom skill is justified. Also note the field-of-use rule: custom
skills must not duplicate licensable ServiceNow skills. This skill adds a new
capability rather than copying one.

---

## 4. Phase 2, Create the sample data and the test dataset

### 4.1 Create demo incidents with real reassignments

1. **All → System Definition → Scripts - Background**.
2. Paste [`scripts/01-create-sample-incidents.js`](scripts/01-create-sample-incidents.js).
3. Scope **global**, select **Run script**. It takes about a minute because it
   pauses between updates so each audit entry has its own timestamp.
4. Copy the six incident numbers it prints. Example:

```
TC1 - normal chain        ->  INC0010042  (reassignment_count=2)
TC2 - ping-pong           ->  INC0010043  (reassignment_count=4)
TC3 - never reassigned    ->  INC0010044  (reassignment_count=0)
TC4 - no reason recorded  ->  INC0010045  (reassignment_count=1)
TC5 - starts unassigned   ->  INC0010046  (reassignment_count=1 or 2, see note)
TC6 - long history        ->  INC0010047  (reassignment_count=7)
```

The script updates incidents the same way an agent would (change the group,
add a work note, save), so the platform writes normal **sys_audit** and
**work notes** entries. Nothing is faked.

> **Note on TC5.** Whether the first assignment of an unassigned incident
> increments `reassignment_count` depends on the business rule on your
> instance. The skill treats "(unassigned) → group" as the first assignment,
> not a reassignment, either way.

**Check it worked:** open TC2, scroll to the activity stream; you should see
four group changes and their work notes. Or open
`sys_audit.list` with filter *Table name = incident*, *Field name =
assignment_group*, *Document key = (TC2 sys_id)*.

**Want a realistic demo?** Also reassign one incident by hand over a day or
two (Service Desk → Network, wait, → Hardware). Script-created history has
gaps of seconds; real history shows "sat with Network for 1 day 4 hours",
which lands better in the demo.

### 4.2 Where does the history come from?

| Source | What it has | Used here? |
|---|---|---|
| `sys_audit` | Every change to an audited field: `tablename`, `documentkey` (record sys_id), `fieldname`, `oldvalue`, `newvalue`, `user`, `sys_created_on`, `record_checkpoint`. Incident is audited by default. | **Yes**, the source of truth for the path and who moved it. |
| `sys_journal_field` | Work notes and comments (`element = work_notes`). | **Yes**, the reason for each move. |
| `metric_instance` | Durations per value if the **Assignment Group** metric definition is active on incident. No "who". | No, but a good extension for "time in each group" reporting. |
| `incident.reassignment_count` | A counter maintained by a business rule. | Used as a cross-check in testing. |

Performance tip: `sys_audit` is large. Always filter on `tablename` and
`documentkey` (as the script does); never query it without them.

### 4.3 The test dataset (ground truth)

This is the "dataset with ground truth" from Session 2. Six cases, each
chosen to test a different behaviour. Following the docs' dataset guideline
(keep development and test data separate to avoid prompt overfitting):

* **Development set:** TC1, TC2, TC3. Use these while you write the prompt.
* **Held-out test set:** TC4, TC5, TC6. Do not look at their outputs until
  the prompt is "final". Then run them once and score.

| ID | Scenario | Expected output (ground truth) | Must NOT happen |
|---|---|---|---|
| TC1 | Normal chain | 2 reassignments, now Hardware. Path: Service Desk → Network → Hardware. Reasons: VPN client reinstalled, gateway fine → Network; Wi-Fi adapter power-save → Hardware. Pattern: none. | Mentions groups not in history. |
| TC2 | Ping-pong | 4 reassignments, now Database. Path: Service Desk → Software → Database → Application Development → Database. Pattern: Database has had it twice (ping-pong). | Misses the ping-pong. Wrong order. |
| TC3 | Never reassigned | Exactly: "This incident has not been reassigned. It has stayed with Service Desk." | Invents a history. |
| TC4 | No reason recorded | 1 reassignment, Service Desk → Software, reason "reason not recorded". | Invents a reason (for example "access issue"). |
| TC5 | Starts unassigned | First assignment to Service Desk (not counted as a reassignment), then 1 reassignment to Hardware: remote reset failed, needs on-site engineer. | Counts the first assignment as a reassignment. |
| TC6 | Long history | 7 changes, now Application Development. Pattern: Network and Database bounced it back and forth 3 times. Under 200 words. | Exceeds length, drops the last hop, misses the pattern. |

Save this table; you will score against it in Phase 4 and show it in the
session ("this is my ground truth").

---

## 5. Build the data tool (Script Include)

The skill needs a tool that turns "incident sys_id" into "clean history
JSON". Put the logic in a Script Include so you can test it **without AI**
first, then call it from a 3-line Skill Kit Script tool.

1. **All → System Definition → Script Includes → New**.
2. Fill in:
   * **Name:** `AssignmentHistoryUtil`
   * **Application:** Global
   * **Accessible from:** **All application scopes** (important: the skill may run in another scope)
   * **Client callable:** unchecked
3. Paste [`scripts/02-script-include-AssignmentHistoryUtil.js`](scripts/02-script-include-AssignmentHistoryUtil.js). Submit.
4. **Test it without AI.** In Scripts - Background run (use your TC2 number):

```javascript
var inc = new GlideRecord('incident');
inc.get('number', 'INC0010043');
gs.info(new global.AssignmentHistoryUtil().getHistoryJSON(inc.getUniqueValue()));
```

You should see JSON with `total_group_changes: 4` and each change's
`from_group`, `to_group`, `changed_by`, `time_in_previous_group` and
`reason_from_work_notes`. If this is wrong, fix it here; the LLM can only be
as good as this data.

What the code does, in plain words:

1. Reads `sys_audit` rows for this incident where `fieldname =
   assignment_group`, oldest first (`record_checkpoint` order).
2. Skips the value set when the record was created (that is not a
   reassignment) but keeps "(unassigned) → group".
3. Turns group and user IDs into names.
4. Finds the work note written within 10 minutes of each change and uses it
   as the reason (deterministic, so the LLM does not have to guess).
5. Caps the list at 25 changes so a huge history cannot blow the prompt size.

---

## 6. Phase 3, Build the skill and the prompt in Skill Kit

### 6.1 Create the skill

1. **All → Now Assist Skill Kit → Home** (Australia: **All → AI Skill Kit → Home**).
2. Select **Create new skill** and fill in:

| Field | Value |
|---|---|
| Skill name | `Incident Assignment History Summary` |
| Description | `Explains where an incident has been assigned, who moved it, why, and whether it is bouncing between groups.` |
| Default provider | **Now LLM Service** |
| Provider API | **Now LLM Generic** (or the default shown) |
| User access | **Select roles** → `itil` |
| Role restrictions | `itil` (the skill runs with agent-level roles) |

3. Prompt creation: choose **Write from scratch**. (You can also try **Use an
   AI-generated prompt** and compare, which is a nice talking point.)
4. **Skill inputs:** add one input:

| Setting | Value |
|---|---|
| Datatype | Record |
| Name | `incident` |
| Description | `The incident to explain` |
| Mandatory | Yes |
| Table name | Incident [incident] |
| Test record | your TC1 incident |

5. **Outputs:** keep the default response output. Select **Go to summary →
   Finish**.

### 6.2 Configure the model settings

Open the skill → **Configurations** (prompt settings):

* **Model:** the Now LLM generic model offered.
* **Temperature:** `0.2`. We want the same facts every time, not creativity.
* **Max tokens:** leave default (the output is short).

### 6.3 Add the tool

1. Open the **Tool editor** tab. **[Varies by release]** In Xanadu the
   tools were on the **Prompt editor** tab; from Yokohama they moved to
   **Tool editor**.
2. Select **+** → **Tool node** → **Script** → **Configure tool**.
3. **Name:** `GetAssignmentHistory` (exactly; the prompt refers to it).
4. Choose **Write my own script** and paste
   [`scripts/03-skill-tool-GetAssignmentHistory.js`](scripts/03-skill-tool-GetAssignmentHistory.js):

```javascript
(function runScript(context) {
    var incidentSysId = context.getValue('incident_sys_id');
    return new global.AssignmentHistoryUtil().getHistoryJSON(incidentSysId);
})(context);
```

5. **Tool inputs:** add `incident_sys_id`, value **incident → Sys ID**
   (`{{incident.sys_id}}`).
6. **Tool outputs:** keep the standard `output`.
7. Select **Add**, then **Run tools**. You should see the same JSON you saw
   in Section 5.

> **[Varies by release]** If your release has no **Script** tool type, use a
> **Flow Action** tool instead: create a Flow Action in Workflow Studio with
> input `incident_sys_id`, a Script step that calls
> `new global.AssignmentHistoryUtil().getHistoryJSON(...)`, and an output
> named `output`. The official Skill Kit example ("child incident
> summarization") uses a Flow Action tool in exactly this way.

### 6.4 Write the prompt

In the **Prompt editor**, paste the prompt below. Then replace each
`{{...}}` by inserting the real pill with **Insert inputs** (search for
"short description", "number" and so on) and pick `GetAssignmentHistory →
output` for the history. Typing the braces by hand usually does not bind them.

```text
You are an assistant for IT service desk agents. Explain the assignment history of one incident to an agent who has just picked it up, so they understand where it has been and why.

Incident number: {{incident.number}}
Short description: {{incident.short_description}}
Current assignment group: {{incident.assignment_group}}

Assignment history (JSON, oldest change first):
{{GetAssignmentHistory.output}}

How to read the JSON:
- Each item in assignment_changes is one change of assignment group.
- A change whose from_group is "(unassigned)" is the first assignment, not a reassignment. Do not count it as a reassignment.
- reason_from_work_notes is the agent's own note for that change. If it is empty, the reason was not recorded.

Write plain text with no Markdown, using exactly these four labelled parts:

REASSIGNMENT SUMMARY: One sentence saying how many times the incident was reassigned and which group has it now.
PATH: The groups in order, joined with " -> ".
HAND-OFFS: One line per change, in the form "<from> -> <to> (by <changed_by>, after <time_in_previous_group>): <reason in 15 words or fewer>". If reason_from_work_notes is empty, write "reason not recorded".
PATTERN TO WATCH: One sentence. Mention it if the same group appears more than once in the path (ping-pong), or if the incident stayed in one group for more than 1 day. Otherwise write "No unusual pattern."

Rules:
- Use only the data above. Never guess a reason, a person, a group or a time.
- If assignment_changes is empty, reply with only: "This incident has not been reassigned. It has stayed with <current group>."
- If truncated is true, say that only the most recent changes are shown.
- Keep the whole answer under 200 words.
```

Why it is written this way (good to say in the session):

* **Role + audience** first, so tone fits an agent.
* **Explain the data** (what "(unassigned)" means), so the model does not
  have to guess. This fixes TC5.
* **Fixed output format**, so it is easy to read and easy to test.
* **Explicit refusal to invent** plus a fallback line, which fixes TC3 and TC4.
* **Plain text**, because the UI Action shows it in an info message.

Select **Save**.

---

## 7. Phase 4, Test and evaluate

### 7.1 Quick tests while you write the prompt (development set)

1. In the skill, under **Test prompt**, select **Run tests**.
2. Pick **TC1**, select **Run test**.
3. Read two tabs:
   * **Response:** what the LLM wrote.
   * **Grounded prompt:** the prompt with your data filled in. If the JSON
     is missing here, the problem is the tool or the pill, not the LLM.
4. Repeat for TC2 and TC3. Adjust the prompt and re-run until all three
   match the ground truth table.

> **Cost:** each test run consumes at least one Now Assist assist. LLM-judged
> metrics add more (one assist per 1,000 output tokens). Script-based metrics
> do not consume assists. (From `test-prompt-template.md`.)

### 7.2 Formal evaluation on the held-out set

Now run TC4, TC5 and TC6 once, without changing the prompt in between, and
score them against Section 4.3.

**Option A: built-in evaluation (recommended if your release has it).**
**[Varies by release]** These screens are in recent releases (Australia docs:
`evaluate-prompt.md`).

1. Open the skill → **Prompt performance** tab → **Evaluation runs**.
2. Create a dataset **from a table**: table `incident`, condition *Short
   description starts with [AI Demo]*, max records 6, **Generate preview**,
   map the record to the `incident` input, **Create**.
3. Name the run, select your prompt, select the dataset.
4. Under **Quality**, choose metrics:
   * **Faithfulness**: no hallucinated facts. The most important one here.
   * **Correctness**: accuracy and completeness against the instruction.
   * **Correctness with Golden Response**: if you add the expected outputs
     from Section 4.3 as golden responses.
   * **Human Feedback**: thumbs up or down with a comment.
5. **Save & Evaluate**, then do the **Human evaluation** for each record.

**Option B: simple scorecard (works on any release).** Copy this into a
spreadsheet and fill it in:

| Case | Count correct | Path correct | Reasons only from notes | Pattern correct | Format and length OK | Pass? |
|---|---|---|---|---|---|---|
| TC4 | | | | | | |
| TC5 | | | | | | |
| TC6 | | | | | | |

**Pass bar for the demo:** all six cases pass on "count", "path" and
"reasons only from notes". Wording can vary. If a held-out case fails, fix
the prompt, and be honest in the session that it was tuned after testing
(that is exactly the overfitting risk the docs warn about).

### 7.3 Finalize

When you are happy, select the **lock icon (Finalize prompt)** next to the
prompt name. If you edit a finalized prompt, you must finalize it again
before republishing.

---

## 8. Phase 5, Publish, activate, add the UI Action, monitor

### 8.1 Deployment settings (before publishing)

Skill → **Deployment and skill settings** tab (older releases: **Skill
settings → Deployment settings**):

| Field | Value |
|---|---|
| Workflow | Technology |
| Product | ITSM |
| Feature | Custom: `Assignment history` |
| Where the admin can activate the skill | **UI Action** (optionally also **Now Assist context menu**) |
| Security controls | Roles: `itil` (already set) |
| Evaluation metrics | Optional: add Faithfulness so every test run is scored |

**Save.**

### 8.2 Publish

1. Make sure at least one prompt is finalized.
2. Select **Publish skill**. Status changes from **Draft** to **Published**
   and the skill becomes visible to the admin.

### 8.3 Activate (admin role)

**[Varies by release]**

* Xanadu, Yokohama, Zurich: **All → Now Assist Admin → Features** (or
  *Now Assist Skills*), find the skill (it is under the workflow/product you
  chose, or **Other**), select **Activate skill**.
* Australia: **Admin → AI Admin Hub → AI Skills** tab → **Technology** →
  find the skill → **Activate skill**.

Follow the guided setup. When asked where to show it, choose **UI Action**.
Make sure you are in the right application scope when activating (the docs
call this out). Some instances need a data steward to approve the skill first.

### 8.4 The UI Action

When a skill with the UI Action deployment option is activated, the platform
**generates a UI Action** on the incident table. It calls the skill and shows
the response as an info message.

1. **All → System UI → UI Actions**, filter *Name contains Assignment
   History* (or your skill name). Open it.
2. Check: Table = Incident, **Form button** checked, Active = true.
3. Optional tidy-ups:
   * Rename it to **Explain assignment history**.
   * Condition: `!current.isNewRecord()`.
4. **Copy the capability ID and skill config ID** from its script into your
   notes. You need them if you ever call the skill from a Flow, a Business
   Rule or a REST API.

**Want more control?** [`scripts/04-ui-action-manual.js`](scripts/04-ui-action-manual.js)
is a hand-written version based on the official doc *Call a custom skill from
a script* (`sn_one_extend.OneExtendUtil.execute(request)`). It escapes the
output, keeps line breaks, and can optionally save the summary as a work note.
Paste your two IDs at the top.

> The generated UI Action was added in Skill Kit 1.0.3 (Xanadu Patch 1)
> according to the ServiceNow Community. On older versions, use the manual
> script. **[Varies by release]**

### 8.5 Try it end to end

1. Impersonate **Demo Agent** (`itil` only).
2. Open TC2. Select **Explain assignment history**.
3. The summary appears at the top of the form within a few seconds.
4. Open TC3 and click again: it should say it has not been reassigned.

### 8.6 Other ways to invoke the same skill (for questions)

| Invocation | How |
|---|---|
| Flow | Deployment option **Flow action**, then use the skill's action in Workflow Studio (for example, write the summary to work notes when `reassignment_count` reaches 3). |
| Now Assist panel / context menu | Deployment options **Now Assist panel** / **Now Assist context menu**. |
| Script / REST | `sn_one_extend.OneExtendUtil.execute(request)` with the capability and skill config IDs. |
| UI Builder / Workspace | Deployment option **UI Builder**, then add an "Execute" handler on a button. |

### 8.7 Monitor

* **Usage and execution data** in the admin console or AI Admin Hub (and the
  Skill Kit log tables listed in the Skill Kit reference): count of
  executions and assists consumed. Exact dashboards vary by release.
* **Feedback:** if you write the summary to work notes, agents can correct it,
  and you can review samples weekly.
* **Watch for:** reasons not found in notes (faithfulness), slow responses on
  very long histories, assist consumption.
* Optional: enable **AI Guardian** for the skill (mentioned in the activation
  doc) for content safety.

### 8.8 Clean up after the demo

Run [`scripts/99-cleanup-sample-incidents.js`](scripts/99-cleanup-sample-incidents.js)
once with `DRY_RUN = true` (counts), then with `false`. Deactivate the skill
in the admin console if you no longer need it.

---

## 9. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Skill Kit menu missing | Missing `sn_skill_builder.admin`, or not logged out after adding it. Plugin not installed or outdated. | Add role and log in again; update Skill Kit in Application Manager / Store. |
| **Run tools** returns an error or `{}` | Script Include not accessible from other scopes, or wrong input name. | Set **Accessible from = All application scopes**; call it as `global.AssignmentHistoryUtil`; input name must be `incident_sys_id`. |
| Grounded prompt shows `{{GetAssignmentHistory.output}}` literally | Pill typed by hand, or the tool name differs. | Delete it and insert the pill with **Insert inputs**. |
| History is empty for an incident you know was reassigned | Auditing turned off for incident, or the changes were made with `setWorkflow(false)` / imports that skip audit. | Check `sys_audit` directly. Check the `glide.sys.audit_*` properties and the dictionary **Audit** setting. |
| Order of changes looks wrong | Several updates in the same second. | The script orders by `record_checkpoint`, which avoids this. Make sure you used the latest script. |
| Response invents a reason | Prompt rules not strong enough, or temperature too high. | Keep temperature at 0.2; keep the "never guess" rule; add a Faithfulness metric. |
| Works in Skill Kit test but not from the button | User lacks the role in the skill's access control, or skill not activated, or UI Action inactive. | Give the user `itil`; activate the skill; check the UI Action is active. |
| Button not visible in Service Operations Workspace | Generated UI Action is a classic form button. | Also tick **Workspace Form Button** and configure it for workspace, or use the **Now Assist context menu** deployment. |
| "Something went wrong while executing the skill" | Wrong IDs in a manual UI Action, or the input key does not match the skill input name. | Copy IDs from the generated UI Action; the key must be `incident`. Check **System Logs**. |

---

## 10. What varies by release

| Topic | Xanadu / Yokohama / Zurich | Australia (this repo's docs) |
|---|---|---|
| Product name | Now Assist Skill Kit (NASK) | AI Skill Kit |
| Menu | All → Now Assist Skill Kit → Home | All → AI Skill Kit → Home |
| Activation console | Now Assist Admin console (Features / Now Assist Skills) | AI Admin Hub → AI Skills |
| Brand of skills | Now Assist | ServiceNow Otto (many product names) |
| Where tools are added | Xanadu: Prompt editor tab. Yokohama+: Tool editor tab. | Tool editor tab, with decision nodes |
| Tool types | Script Include / Flow Action / Subflow / Retriever (varies) | Script, Subflow, Flow Action, Retriever, Skill, Web search, Predictive Intelligence, Document Intelligence |
| Auto-generated UI Action | From Skill Kit 1.0.3 (Xanadu Patch 1) | Yes |
| Evaluation runs, datasets, metrics | Limited or absent in early versions | Prompt performance tab, Faithfulness / Correctness / Golden Response / Human feedback |
| Clone OOTB skills | From Yokohama | Yes |
| Delivery | Plugin, then Store app | Store app; update Generative AI Controller with it |
| LLM providers | Now LLM Service, Azure OpenAI, others via spokes | Now LLM Service, Azure OpenAI, Google Gemini, Anthropic Claude, spokes, custom LLM |

Always check the exact screen names on your instance's version: **All →
System Applications → All Available Applications → Installed**, search
"Skill Kit".

---

## 11. Sources

Official docs in this repository (Australia release, last updated 2026-09-10 unless noted):

* `markdown/intelligent-experiences/now-assist-skill-kit/na-skill-kit-guidelines.md` (five phases)
* `.../scoping-the-skill.md`, `.../creating-a-dataset.md`, `.../developing-the-prompt.md`, `.../evaluating-the-prompt.md`, `.../deploying-and-monitoring.md`
* `.../na-skill-kit-roles.md`, `.../exploring-now-assist-skill-kit.md`, `.../configuring-now-assist-skill-kit.md`, `.../nask-field-of-use.md`
* `.../create-new-skill.md`, `.../create-prompt-template.md`, `.../add-a-tool.md`, `.../configure-skill-settings.md`
* `.../test-prompt-template.md`, `.../evaluate-prompt.md`, `.../publish-skill.md`, `.../activate-skill.md`
* `.../call-custom-skill-from-script.md`, `.../example-na-skill-kit.md`
* `markdown/it-service-management/now-assist-for-it-service-management-itsm/cust-now-assist-itsm-record-summ-skill.md` (customising OOTB Incident Summarization)
* `markdown/delta-xanadu-australia/australia-xanadu-aiskillkit-release-notes.md` (tools moved to Tool editor tab)

ServiceNow Community (used for details the product docs leave out; verify on your instance):

* *AI Skill Kit / Now Assist Skill Kit (NASK) FAQ*: activation auto-generates a UI Action that returns the response in an info message.
* *Now Assist Skill Kit – Tool and Deployment Options*: UI Action deployment available from 1.0.3 / Xanadu Patch 1.
* *Creating a Custom Skill with Now Assist Skill Kit, Part 2* and *Multi-Method Assignment Group Prediction with Now Assist*: Script tool `runScript(context)` and `context.getValue()` syntax.
