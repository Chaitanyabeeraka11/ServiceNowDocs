/*
 * 03 - Skill Kit Script tool: GetAssignmentHistory
 * -------------------------------------------------
 * Where : AI Skill Kit (Now Assist Skill Kit) > your skill > Tool editor
 *         > + > Tool node > Script > "Write my own script"
 * Tool name   : GetAssignmentHistory      (the prompt uses {{GetAssignmentHistory.output}})
 * Tool input  : incident_sys_id  =  {{incident.sys_id}}   (picked from the "incident" skill input)
 * Tool output : keep the standard "output" variable
 *
 * The editor may pre-fill a template. Keep its wrapper and put the two
 * lines below inside it. On recent releases the wrapper looks like this:
 */
(function runScript(context) {
    var incidentSysId = context.getValue('incident_sys_id');
    return new global.AssignmentHistoryUtil().getHistoryJSON(incidentSysId);
})(context);
