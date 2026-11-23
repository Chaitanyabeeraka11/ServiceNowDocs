# Presenting the use case: demo script, talk track, likely questions

Companion to the [build guide](README.md). Use this in the next training
session.

---

## 1. The use case in one sentence

> "When an incident has bounced between teams, an agent clicks one button
> and a custom Now Assist skill explains the path it took, who moved it, why,
> and whether it is ping-ponging, using the audit trail and work notes that
> the out-of-box summary doesn't read."

---

## 2. Two-minute explanation (say this aloud)

About 330 words, roughly 2 minutes at a brisk pace. Drop the "Dataset" paragraph if you need to be shorter.

> In the first session we asked whether Incident Summarization could include
> the reassignment history. Out of the box, it summarises fields like the
> description and work notes, but the actual trail of "Service Desk to
> Network to Hardware, who moved it and when" lives in the audit table, and
> the standard skill doesn't read that. So I built a small custom skill for
> it with Skill Kit.
>
> I followed the five phases we covered last time.
>
> **Scope:** the user is an agent who has just picked up a ticket. The input
> is one incident. The output is a short, fixed-format summary: how many
> reassignments, the path, each hand-off with its reason, and any pattern,
> like the same group getting it twice. Just as important, I wrote down what
> it must *not* do: invent reasons or blame people.
>
> **Dataset:** I created six test incidents, each testing one behaviour: a
> normal chain, a ping-pong, one never reassigned, one with no reason
> recorded, one that started unassigned, and one with a long history. For
> each I wrote the expected answer, my ground truth.
>
> **Prompt:** the skill has one input, the incident, and one script tool that
> reads sys_audit and the work notes and hands the model clean JSON. The prompt
> tells the model how to read that data, gives a fixed format, and says
> "never guess; if there's no note, say reason not recorded." Temperature is
> low, because we want facts, not creativity.
>
> **Evaluate:** I tuned on three cases and kept three aside, then ran those
> once and scored them on count, path, and faithfulness.
>
> **Publish and invoke:** I published it, an admin activated it, and it shows
> up as a UI Action on the incident form, which is what I'll show you now. The
> same skill could also be called from a Flow, for example when an incident
> has been reassigned three times.

---

## 3. Live demo script (5 to 7 minutes)

**Before the session (15 minutes earlier):**

* [ ] Log in to the instance. Open these tabs:
  1. Incident list filtered *Short description starts with [AI Demo]*.
  2. TC2 (ping-pong) incident form.
  3. Skill Kit → your skill (Prompt editor).
  4. The test scorecard / ground truth table (Section 4.3 of the guide).
* [ ] Click the button once on TC2 to warm up (the first call can be slower).
* [ ] Have a backup: screenshots or a 60-second screen recording of the
      button working, in case the LLM service is slow or the network fails.
* [ ] Impersonate **Demo Agent** in a second browser profile if you want to
      show it running as a normal agent.

**The demo:**

| # | Show | Say |
|---|---|---|
| 1 | TC2 incident form, scroll to the activity stream | "Here's a real problem. This payroll incident has moved between four teams. To understand why, an agent would read the whole activity stream." |
| 2 | Click **Explain assignment history** | "One click." |
| 3 | The info message | "Reassigned four times, now with Database. Here's the path, here's each hand-off with the reason taken from the agent's own work note, and it flags that Database has had this twice. That's the ping-pong a team lead wants to catch." |
| 4 | Open TC3 and click | "And when there's nothing to say, it doesn't make anything up: it says it was never reassigned." |
| 5 | Open TC4 and click | "Here nobody wrote a reason, so it says 'reason not recorded' instead of guessing. That was a specific test case." |
| 6 | Switch to the Skill Kit tab: inputs, Tool editor, prompt | "Behind it: one input, the incident; one script tool reading sys_audit and the work notes; and this prompt. The pills fill in the data." |
| 7 | **Run test** → **Grounded prompt** tab | "This is exactly what the model saw. If the answer is wrong, I check this first: is it the data or the model?" |
| 8 | Show the ground truth table / evaluation results | "Six test cases with expected answers. Three for tuning, three held out." |
| 9 | Close | "Same skill could run from a Flow, the Now Assist panel, or a workspace button. Questions?" |

**If something fails live:** say "LLM calls are network calls, so I always
keep a backup," and show the recording. Then show the Grounded prompt in
Skill Kit, which proves the data part works even without the response.

---

## 4. Likely questions and answers

### About the use case

**Q: Why not just customise the OOTB Incident Summarization skill?**
You can customise it (AI Admin Hub → make a copy → choose input fields), but
its inputs are fields on the incident record. The ordered old-group →
new-group trail is in `sys_audit`, which it does not read. Options are: clone
the OOTB skill and add a tool, or build a dedicated skill. I built a dedicated
one because it is easier to test and does one job well. *(Check the OOTB
skill's input screen on your release before stating this as fact.)*

**Q: Isn't this duplicating a licensed skill?**
No. The Skill Kit field-of-use rule says don't rebuild licensable ServiceNow
skills. This adds a capability the OOTB skill doesn't have.

**Q: Why use AI at all? A report could show the history.**
A report shows raw rows. The value here is (1) joining the history with the
*reasons* in free-text work notes, (2) spotting patterns like ping-pong, and
(3) putting it in plain language at the moment the agent needs it. The facts
come from a deterministic script; the LLM only does the explaining.

### About the build

**Q: Where does the history come from?**
`sys_audit` filtered by `tablename = incident`, `documentkey = sys_id`,
`fieldname = assignment_group`. Reasons come from `sys_journal_field`
work notes written within 10 minutes of each change.

**Q: Why sys_audit and not metric_instance?**
`sys_audit` has who and when for every change and is on by default for
incident. `metric_instance` gives durations but no "who", and only if the
Assignment Group metric definition is active. Good future extension.

**Q: Isn't querying sys_audit slow?**
It's a big table, so the script always filters by table and document key and
limits rows. Never query it unfiltered.

**Q: Why a Script Include instead of code inside the tool?**
Testable without AI (in Scripts - Background), reusable, and the tool stays
three lines.

**Q: Which LLM does it use? Can we change it?**
Now LLM Service by default. Skill Kit supports external providers (Azure
OpenAI, Gemini, Claude, others via spokes or a custom LLM connection) depending
on release and contract. The admin console controls the runtime provider.

**Q: Why temperature 0.2?**
We want the same facts in the same format every time. Higher temperature
adds variety we don't want here.

**Q: How did you stop hallucinations?**
Three layers: the script prepares exact data (the model doesn't search for
it); the prompt says "use only this data, never guess" with a fallback
sentence; and the test set includes cases designed to tempt it to invent
(TC3, TC4), scored with a Faithfulness metric.

### About testing

**Q: How did you test it?**
Six incidents with expected outputs (ground truth). Tuned on three, held out
three, scored on count, path, faithfulness, pattern, and format. Skill Kit's
evaluation runs can also score Faithfulness, Correctness, Correctness with a
golden response, and human thumbs up or down.

**Q: Why hold out test cases?**
The docs call it prompt overfitting: if you test on the same records you
tuned on, you over-report quality.

**Q: Does testing cost anything?**
Yes. Each test run consumes at least one assist; LLM-judged metrics add one
assist per 1,000 output tokens. Script-based metrics don't.

### About security and governance

**Q: Who can run it?**
Only users with `itil`, set in the skill's access control. Role restrictions
set the roles the skill runs with.

**Q: The script reads sys_audit. Can an agent see data they shouldn't?**
Fair point. Server-side `GlideRecord` doesn't apply ACLs, so the skill's
access control is the gate. It only returns group names, user names and
work notes for an incident the agent can already open, which is the same as
the activity stream shows them. For stricter cases, use `GlideRecordSecure`.

**Q: Where does the data go?**
To the LLM provider configured for the skill. The Skill Kit docs note data may
be processed in a central ServiceNow environment or a third-party cloud, and
that ServiceNow collects inputs/outputs to improve models unless you opt out.
Check your organisation's settings in the admin console.

**Q: Who builds vs who switches it on?**
Builder: `sn_skill_builder.admin`. Activation: `admin` in the Now Assist
Admin console / AI Admin Hub. Separation of duties is intentional.

### About deployment

**Q: Can it run automatically?**
Yes. Select **Flow action** in the deployment settings, then call it from a
flow, for example "when reassignment count reaches 3, add the summary as a
work note and notify the team lead".

**Q: Does it work in Service Operations Workspace?**
The generated UI Action is a classic form button. For workspace, tick
Workspace Form Button and configure it, or deploy through the Now Assist
context menu or UI Builder.

**Q: How would you move it to production?**
Build and evaluate in non-prod, do end-to-end user testing with different
users, then move it through your normal release process (update set or app
repository) and activate it in production. Then monitor usage, assists and
feedback.

**Q: How do you monitor it?**
Usage and assist consumption in the admin console; sample responses weekly
against the audit trail; watch for "reason not recorded" rates (that's a
process signal too: agents not writing work notes).

### Curveballs

**Q: What if the incident has 50 reassignments?**
The script caps it at the 25 most recent and tells the model it was
truncated, so the prompt stays small.

**Q: Would this be better as an AI Agent?**
Not for this. It's one fixed task with one input and one output, which is
exactly what a skill is for. An AI Agent makes sense when the AI has to decide
which steps to take, for example "find all ping-ponging incidents and
propose the right group". This skill could become one of that agent's tools.

**Q: Could it suggest the right group?**
That's a different skill (assignment prediction; Predictive Intelligence or
an LLM with group descriptions). Good next step, and Skill Kit can add a
Predictive Intelligence tool.
