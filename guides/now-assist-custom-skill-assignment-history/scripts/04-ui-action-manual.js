/*
 * 04 - OPTIONAL manual UI Action (only if you want more than the auto-generated one)
 * ----------------------------------------------------------------------------------
 * When you activate a skill that has "UI Action" selected as a deployment
 * option, the platform generates a UI Action for you. Look at it first:
 *   System UI > UI Actions, filter Name contains your skill name.
 * Copy the two IDs from that generated script into the constants below.
 *
 * UI Action settings:
 *   Name            : Explain assignment history
 *   Table           : Incident [incident]
 *   Action name     : explain_assignment_history
 *   Form button     : checked
 *   Show insert     : unchecked      Show update : checked
 *   Client          : unchecked (server-side)
 *   Condition       : !current.isNewRecord()
 *   Requires role   : itil
 *
 * Pattern from the official doc "Call a custom skill from a script".
 */
(function () {
    var CAPABILITY_ID = 'PASTE_CAPABILITY_SYS_ID_HERE';
    var SKILL_CONFIG_ID = 'PASTE_SKILL_CONFIG_SYS_ID_HERE';
    var ALSO_WRITE_WORK_NOTE = false; // set true to keep the summary in the activity stream

    // The key must match the NAME of the skill input ("incident")
    var inputsPayload = {};
    inputsPayload['incident'] = {
        tableName: 'incident',
        sysId: current.getUniqueValue(),
        queryString: ''
    };

    var request = {
        executionRequests: [{
            payload: inputsPayload,
            capabilityId: CAPABILITY_ID,
            meta: { skillConfigId: SKILL_CONFIG_ID }
        }],
        mode: 'sync'
    };

    try {
        var response = sn_one_extend.OneExtendUtil.execute(request)['capabilities'][CAPABILITY_ID]['response'];
        var summary = JSON.parse(response).model_output;

        // Escape the LLM text, then keep its line breaks. If your instance shows a
        // literal "<br/>", remove the .replace(...) part.
        gs.addInfoMessage(GlideStringUtil.escapeHTML(summary).replace(/\n/g, '<br/>'));

        if (ALSO_WRITE_WORK_NOTE) {
            current.work_notes = '[AI] Assignment history summary\n\n' + summary;
            current.update();
        }
    } catch (e) {
        gs.error('Assignment history skill failed: ' + e);
        gs.addErrorMessage('Could not generate the assignment history summary. Check the system log.');
    }
    action.setRedirectURL(current);
})();
