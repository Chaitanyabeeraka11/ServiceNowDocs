# Presenting "Where's my request?": demo script, talk track, likely questions

Companion to the [build guide](README.md).

---

## 1. The use case in one sentence

> "Instead of using AI to summarise tickets for agents, I pointed it at the
> person who's actually waiting: when a service request goes quiet for three
> days, a Flow runs a custom skill that reads the approvals, tasks and
> internal notes and tells the requester, in plain language, where it is and
> whether they need to do anything, before they have to chase it."

---

## 2. Two-minute explanation (say this aloud)

About 300 words.

> Most of the Gen AI examples we've seen summarise records for the agent. I
> wanted to look at who's actually waiting in Service Request Management,
> and that's the requester. A lot of service desk calls are just "any update
> on my request?" The answer usually exists: it's in an approval, a catalog
> task, or a work note like "vendor backordered, ETA 28 November". But the
> requester can't see it, and even if they could, it's full of jargon.
>
> So I built a skill called **Request Status Update** with Skill Kit, using
> the same five phases.
>
> **Scope:** the reader is the employee, not IT. Output is under 80 words:
> where it is, what's next, what *they* need to do, and a date only if one
> actually exists in the data. Just as important, it must never quote
> internal notes, name IT staff, or blame anyone.
>
> **Dataset:** six requests stuck in different ways: waiting on approval,
> backordered with an ETA, waiting on the requester for a cost centre, a
> messy internal note that names people, a new-joiner bundle that's
> two-thirds done, and one that's already closed, where the right answer is
> to say nothing.
>
> **Prompt:** a script tool gathers the facts (approvals, tasks, latest
> notes), and the prompt only does the wording. If there's nothing useful to
> say, it returns NO_UPDATE and the flow skips it.
>
> **Evaluate:** tuned on three, held out three, scored mainly on three safety
> checks: is the requester's action right, is any date real, and is there
> no leak of names or blame.
>
> **Deploy:** this is the part that's different. It's not a button. A
> scheduled Flow finds requests with no update in three days and calls the
> skill through the Execute Skill action. Posting the comment resets the
> clock, so nobody gets spammed. And I'd roll it out in stages, starting with
> work notes, before it ever writes to employees.

---

## 3. Live demo script (6 to 8 minutes)

**Before the session:**

* [ ] Tabs open: (1) RITM list filtered *[AI Demo]*; (2) TC4 RITM form;
      (3) the Flow in Workflow Studio; (4) Employee Center / Service Portal
      as the requester (you), on **My Requests**; (5) Skill Kit, the skill.
* [ ] Remove the comments the flow added in your rehearsal, or re-run the
      sample data script so you start clean.
* [ ] Warm up: click **Preview requester update** once on any RITM.
* [ ] Backup: a recording of the flow run and the portal view.

**The demo:**

| # | Show | Say |
|---|---|---|
| 1 | TC4 form → Catalog Tasks → the work note | "Here's what's really going on with this Visio request. The note says *Ravi forgot to raise the PO… again*. True, but you'd never send that to an employee. And the employee can't see it anyway, so they call the desk." |
| 2 | Click **Preview requester update** | "Here's what the skill would tell them: it's with the Software team, there's a short supplier delay, expect 2 to 3 working days, and nothing is needed from them. No names, no blame, no jargon. And the date is real, because it came from the note." |
| 3 | TC3 form → task note, then preview | "This one is stuck because the team is waiting on the *requester* for a cost centre. That's the most valuable message: it tells them exactly what to do." |
| 4 | TC6 (closed) → preview | "Closed request: it returns NO_UPDATE. Knowing when to stay quiet was one of my test cases." |
| 5 | Workflow Studio → the Flow | "In real life nobody clicks a button. A daily flow finds requests quiet for three days, calls the skill with the Execute Skill action, skips NO_UPDATE, and posts the comment." |
| 6 | **Test** the flow → execution details | "Running it now on the demo requests." |
| 7 | Portal → My Requests → TC2 | "And this is what the employee sees: approved, on backorder, expected around 28 November, shipping to Pune, nothing needed. They didn't have to ask." |
| 8 | Skill Kit → Grounded prompt | "Behind it, the script gathers the facts; the model only writes the sentence. If something's wrong, I check here first: data or model?" |
| 9 | Close | "Rollout would be preview, then work notes, then live. Questions?" |

**If the LLM is slow or fails:** switch to the recording. Then show the
**Grounded prompt**, which proves the data side works.

---

## 4. Likely questions and answers

### Is it really new?

**Q: Doesn't Now Assist already summarise requests?**
Now Assist for ITSM has *Request summarization*, which is a summary for the
**agent**. This writes **to the requester**, runs **proactively** from a Flow,
and deliberately filters internal notes. Different reader, different trigger,
different risk. *(Check your release's skill list before saying "no OOTB
equivalent".)*

**Q: Why not a normal notification with the stage?**
A template can say "Stage: Fulfillment". It can't read a free-text note like
"backordered, new ETA 28 Nov" or "waiting on requester for cost centre" and
turn it into the right, safe sentence. That's the language part only Gen AI
does well.

**Q: Why not Virtual Agent "check my request status"?**
That's pull: the user has to ask, and gets the stage. This is push, before
they ask, with the *reason* and *next step*.

### How it's built

**Q: Where does the data come from?**
`sc_req_item` for the item, `sysapproval_approver` for approvals,
`sc_task` for fulfilment tasks with the latest work note, and the
requester's latest comment on the RITM.

**Q: Why only the latest note per task?**
It's the most current, keeps the prompt small (cost and speed), and reduces
the chance of old internal chatter leaking.

**Q: How does the Flow call the skill?**
With the **Execute Skill** action (Now Assist Skill Kit action in Workflow
Studio): choose workflow, product, feature and the skill, map the RITM to the
skill input. The output is a JSON object. A small script pulls the text out.

**Q: Why temperature 0.2?**
Same facts, same shape every time. We want reliability, not creativity, in
messages to employees.

### Safety and governance

**Q: What stops it from leaking internal notes or names?**
Four layers: (1) only the latest note per task is sent; (2) notes are
labelled internal and the prompt says use facts, never quote, never name
staff; (3) a dedicated test case (TC4) with names and blame; (4) staged
rollout, with work notes first so humans review drafts.

**Q: What if it invents a delivery date?**
The prompt allows a date only if one is in the data, and two test cases
check it: TC1 has no date, TC2 has a real one. A Faithfulness metric scores it
during evaluation.

**Q: Won't requesters get spammed?**
The flow only picks requests with no update for 3 days. Posting the comment
updates the record, so the clock resets. At most one message per 3 quiet
days, and closed requests get NO_UPDATE.

**Q: Should a human approve every message?**
In the pilot, yes, by writing to work notes. Once quality is proven, it goes
to comments with an "[Automatic update]" prefix so people know it's
automated. Sensitive catalog categories (HR, legal, security) are excluded.

**Q: Who can run it?**
The skill's access control is `itil`; the flow runs as the system user.
Builders need `sn_skill_builder.admin`; activation needs `admin`.

**Q: Where does the data go?**
To the configured LLM provider (Now LLM Service by default). Per the Skill
Kit docs, data may be processed in a central ServiceNow environment, and
ServiceNow collects inputs and outputs to improve models unless you opt out.

### Cost and value

**Q: What does it cost?**
One skill call per stalled request per run, so roughly one assist each. The
Look Up step caps it (50 per day in the guide), so cost is predictable. Test
runs and LLM-judged metrics also consume assists.

**Q: How would you prove value?**
Before and after: the number of incidents or chats that mention a RITM number
or "status", time-to-first-requester-contact, and the share of requester
actions resolved within a day of the message (TC3-type cases).

### Curveballs

**Q: Could this be an AI Agent instead?**
For one fixed task with one input and one output, a skill is the right size.
An agent makes sense if it should *act*: for example, chase the approver,
check stock, or reopen the vendor order. This skill could be one of that
agent's tools.

**Q: What about requests in other languages?**
Add the requester's preferred language to the tool output and tell the
prompt to answer in it. LLM language support depends on the provider.

**Q: Approvals on the parent request instead of the RITM?**
Some catalogs approve at the REQ level. Extend the tool to also read
approvals where `sysapproval` is the parent request. That's one extra query.
