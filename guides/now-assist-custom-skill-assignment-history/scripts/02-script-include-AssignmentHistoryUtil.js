/*
 * 02 - Script Include: AssignmentHistoryUtil
 * -------------------------------------------
 * Where       : System Definition > Script Includes > New
 * Name        : AssignmentHistoryUtil
 * API name    : global.AssignmentHistoryUtil
 * Application : Global
 * Accessible from : All application scopes   <-- important, the skill tool may run in another scope
 * Client callable : unchecked
 *
 * What it does:
 *   Reads the assignment group changes of ONE incident from sys_audit,
 *   attaches the work notes written at (or close to) each hand-off, and
 *   returns a small, clean JSON object the LLM can read.
 *
 * Why a Script Include (and not all the code inside the skill tool)?
 *   - You can test it on its own in Scripts - Background before touching AI.
 *   - The skill tool stays 3 lines long and easy to explain in the demo.
 *   - Other things (a report, a flow, a REST API) can reuse it.
 *
 * Why sys_audit and not metric_instance?
 *   sys_audit records old value, new value, who made the change and when,
 *   for every audited field, and the incident table is audited by default.
 *   metric_instance (the "Assignment Group" metric) gives durations but not
 *   "who" and only exists if that metric definition is active. See the
 *   guide, section "Where does the history come from?".
 */
var AssignmentHistoryUtil = Class.create();
AssignmentHistoryUtil.prototype = {

    MAX_CHANGES: 25,          // keep the prompt small on very long histories
    NOTE_WINDOW_MINUTES: 10,  // a work note this close to a change is treated as its reason
    NOTE_MAX_CHARS: 400,

    initialize: function () {},

    /**
     * @param {string} incidentSysId sys_id of the incident
     * @returns {Object} history object (see bottom of file for an example)
     */
    getHistory: function (incidentSysId) {
        var inc = new GlideRecord('incident');
        if (!incidentSysId || !inc.get(incidentSysId)) {
            return { error: 'Incident not found' };
        }

        var changes = this._getGroupChanges(inc);
        var notes = this._getWorkNotes(incidentSysId);
        this._attachReasons(changes, notes);

        return {
            incident: inc.getValue('number'),
            opened_at: inc.getDisplayValue('opened_at'),
            current_group: inc.getDisplayValue('assignment_group') || '(none)',
            reassignment_count_field: parseInt(inc.getValue('reassignment_count') || '0', 10),
            total_group_changes: changes.length,
            assignment_changes: changes.slice(-this.MAX_CHANGES),
            truncated: changes.length > this.MAX_CHANGES
        };
    },

    /** Same as getHistory but as a string, which is what the skill tool returns. */
    getHistoryJSON: function (incidentSysId) {
        return JSON.stringify(this.getHistory(incidentSysId), null, 2);
    },

    // ---------------------------------------------------------------- private

    _getGroupChanges: function (inc) {
        var changes = [];
        var audit = new GlideRecord('sys_audit');
        audit.addQuery('tablename', 'incident');
        audit.addQuery('documentkey', inc.getUniqueValue());
        audit.addQuery('fieldname', 'assignment_group');
        audit.orderBy('record_checkpoint'); // update counter, reliable even if timestamps tie
        audit.orderBy('sys_created_on');
        audit.setLimit(200);
        audit.query();

        var previousTime = new GlideDateTime(inc.getValue('opened_at'));
        while (audit.next()) {
            var oldId = audit.getValue('oldvalue');
            var newId = audit.getValue('newvalue');
            if (!oldId) {
                // First value set on insert (or first assignment of an unassigned
                // incident). Not a re-assignment, but useful to know.
                if (changes.length === 0 && !this._isInsertEntry(audit)) {
                    // incident started unassigned and was assigned later
                    changes.push(this._buildChange(audit, '(unassigned)', newId, previousTime));
                    previousTime = new GlideDateTime(audit.getValue('sys_created_on'));
                }
                continue;
            }
            changes.push(this._buildChange(audit, this._groupName(oldId), newId, previousTime));
            previousTime = new GlideDateTime(audit.getValue('sys_created_on'));
        }
        return changes;
    },

    _isInsertEntry: function (audit) {
        // record_checkpoint 0 = written when the record was created
        return audit.getValue('record_checkpoint') === '0';
    },

    _buildChange: function (audit, fromName, newId, previousTime) {
        var changedOn = new GlideDateTime(audit.getValue('sys_created_on'));
        var timeInPrevious = GlideDateTime.subtract(previousTime, changedOn);
        return {
            step: 0, // set below
            from_group: fromName,
            to_group: this._groupName(newId),
            changed_by: this._userName(audit.getValue('user')),
            changed_on: changedOn.getDisplayValue(),
            time_in_previous_group: timeInPrevious.getDisplayValue() || 'less than a minute',
            _changed_on_ms: changedOn.getNumericValue(),
            reason_from_work_notes: ''
        };
    },

    _getWorkNotes: function (incidentSysId) {
        var notes = [];
        var j = new GlideRecord('sys_journal_field');
        j.addQuery('name', 'incident');
        j.addQuery('element_id', incidentSysId);
        j.addQuery('element', 'work_notes');
        j.orderBy('sys_created_on');
        j.setLimit(100);
        j.query();
        while (j.next()) {
            notes.push({
                ms: new GlideDateTime(j.getValue('sys_created_on')).getNumericValue(),
                text: (j.getValue('value') || '').substring(0, this.NOTE_MAX_CHARS)
            });
        }
        return notes;
    },

    _attachReasons: function (changes, notes) {
        var windowMs = this.NOTE_WINDOW_MINUTES * 60 * 1000;
        for (var i = 0; i < changes.length; i++) {
            var c = changes[i];
            c.step = i + 1;
            var best = null;
            var bestGap = windowMs + 1;
            for (var n = 0; n < notes.length; n++) {
                var gap = Math.abs(notes[n].ms - c._changed_on_ms);
                if (gap <= windowMs && gap < bestGap) {
                    best = notes[n];
                    bestGap = gap;
                }
            }
            c.reason_from_work_notes = best ? best.text : '';
            delete c._changed_on_ms;
        }
    },

    _groupName: function (groupSysId) {
        if (!groupSysId) {
            return '(unassigned)';
        }
        var g = new GlideRecord('sys_user_group');
        return g.get(groupSysId) ? g.getValue('name') : '(deleted group)';
    },

    _userName: function (userName) {
        // sys_audit.user stores the user_name (login), not the sys_id
        var u = new GlideRecord('sys_user');
        if (userName && u.get('user_name', userName)) {
            return u.getValue('name');
        }
        return userName || 'system';
    },

    type: 'AssignmentHistoryUtil'
};

/*
 * Example output (TC1 - normal chain):
 * {
 *   "incident": "INC0010042",
 *   "opened_at": "2026-11-24 10:02:11",
 *   "current_group": "Hardware",
 *   "reassignment_count_field": 2,
 *   "total_group_changes": 2,
 *   "assignment_changes": [
 *     { "step": 1, "from_group": "Service Desk", "to_group": "Network",
 *       "changed_by": "System Administrator", "changed_on": "2026-11-24 10:02:13",
 *       "time_in_previous_group": "2 Seconds",
 *       "reason_from_work_notes": "Basic troubleshooting done (reinstalled VPN client)..." },
 *     { "step": 2, "from_group": "Network", "to_group": "Hardware", ... }
 *   ],
 *   "truncated": false
 * }
 *
 * Quick test in Scripts - Background:
 *   var inc = new GlideRecord('incident');
 *   inc.get('number', 'INC0010042');   // use one of your demo numbers
 *   gs.info(new global.AssignmentHistoryUtil().getHistoryJSON(inc.getUniqueValue()));
 */
