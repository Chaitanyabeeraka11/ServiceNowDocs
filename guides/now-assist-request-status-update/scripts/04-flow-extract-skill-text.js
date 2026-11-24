/*
 * 04 - Flow inline script: pull the plain text out of the skill's output
 * ----------------------------------------------------------------------
 * Where : Workflow Studio > your flow > "Set Flow Variables" step
 *         > value of the flow variable "update_text" > the script icon (f(x))
 *
 * The "Execute Skill" action returns its response as a JSON object. The
 * exact shape can differ slightly by release, so this script accepts the
 * common shapes and always returns plain text.
 *
 * Replace the pill path below by dragging YOUR Execute Skill "Output" pill
 * into the script editor (Flow Studio writes the fd_data path for you).
 */
var out = fd_data._2__for_each._3__execute_skill.output; // <-- replace with your pill

function pick(o) {
    if (o === null || o === undefined) return '';
    if (typeof o === 'string') {
        try { return pick(JSON.parse(o)); } catch (e) { return o; }
    }
    if (o.model_output) return pick(o.model_output);
    if (o.response) return pick(o.response);
    if (o.output) return pick(o.output);
    return JSON.stringify(o);
}

var text = pick(out).trim();
return text;
