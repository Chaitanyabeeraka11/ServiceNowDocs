/*
 * 03 - Skill Kit Script tool: GetRequestStatus
 * ---------------------------------------------
 * Where : AI Skill Kit (Now Assist Skill Kit) > your skill > Tool editor
 *         > + > Tool node > Script > "Write my own script"
 * Tool name   : GetRequestStatus        (the prompt uses {{GetRequestStatus.output}})
 * Tool input  : ritm_sys_id  =  {{requested_item.sys_id}}
 * Tool output : keep the standard "output" variable
 *
 * Keep the wrapper the editor gives you and put the two lines inside it.
 */
(function runScript(context) {
    var ritmSysId = context.getValue('ritm_sys_id');
    return new global.RequestStatusUtil().getStatusJSON(ritmSysId);
})(context);
