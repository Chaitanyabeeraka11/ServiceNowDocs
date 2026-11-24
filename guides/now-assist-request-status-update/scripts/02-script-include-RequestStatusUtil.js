/*
 * 02 - Script Include: RequestStatusUtil
 * ---------------------------------------
 * Where       : System Definition > Script Includes > New
 * Name        : RequestStatusUtil
 * Application : Global
 * Accessible from : All application scopes   <-- important
 * Client callable : unchecked
 *
 * What it does:
 *   Collects everything that explains WHERE a requested item (RITM) is:
 *   the item, its stage, approvals, catalog tasks and their latest work
 *   notes, plus the requester's own latest comment. Returns compact JSON
 *   for the LLM. It does the fact-finding; the LLM only does the wording.
 *
 * Tables read:
 *   sc_req_item          the requested item
 *   sysapproval_approver approvals (sysapproval = RITM sys_id)
 *   sc_task              fulfilment tasks (request_item = RITM sys_id)
 *   journal fields       latest work note per task, latest RITM comment
 *
 * Quick test in Scripts - Background:
 *   var r = new GlideRecord('sc_req_item');
 *   r.get('number', 'RITM0010001');          // one of your demo numbers
 *   gs.info(new global.RequestStatusUtil().getStatusJSON(r.getUniqueValue()));
 */
var RequestStatusUtil = Class.create();
RequestStatusUtil.prototype = {

    NOTE_MAX_CHARS: 400,
    MAX_TASKS: 10,

    initialize: function () {},

    getStatus: function (ritmSysId) {
        var ritm = new GlideRecord('sc_req_item');
        if (!ritmSysId || !ritm.get(ritmSysId)) {
            return { error: 'Requested item not found' };
        }

        var now = new GlideDateTime();
        var approvals = this._getApprovals(ritmSysId);
        var tasks = this._getTasks(ritmSysId);

        return {
            request_number: ritm.getValue('number'),
            item: ritm.getDisplayValue('cat_item') || ritm.getValue('short_description'),
            short_description: ritm.getValue('short_description'),
            requested_for: ritm.getDisplayValue('requested_for'),
            opened_on: ritm.getDisplayValue('opened_at'),
            days_open: this._daysBetween(ritm.getValue('opened_at'), now),
            is_active: ritm.getValue('active') === '1' || ritm.getValue('active') === 'true',
            state: ritm.getDisplayValue('state'),
            stage: ritm.getDisplayValue('stage'),
            approval: ritm.getDisplayValue('approval'),
            estimated_delivery: ritm.getDisplayValue('estimated_delivery') || '',
            due_date: ritm.getDisplayValue('due_date') || '',
            approvals: approvals,
            tasks: tasks,
            tasks_done: tasks.filter(function (t) { return t.is_closed; }).length,
            tasks_total: tasks.length,
            requester_latest_comment: this._latestJournal(ritm, 'comments')
        };
    },

    getStatusJSON: function (ritmSysId) {
        return JSON.stringify(this.getStatus(ritmSysId), null, 2);
    },

    // ---------------------------------------------------------------- private

    _getApprovals: function (ritmSysId) {
        var list = [];
        var a = new GlideRecord('sysapproval_approver');
        a.addQuery('sysapproval', ritmSysId);
        a.orderBy('sys_created_on');
        a.setLimit(20);
        a.query();
        while (a.next()) {
            list.push({
                approver: a.getDisplayValue('approver'), // approvers may be named to the requester
                state: a.getDisplayValue('state'),
                waiting_since: a.getValue('state') === 'requested' ? a.getDisplayValue('sys_created_on') : '',
                comment: this._latestJournal(a, 'comments')
            });
        }
        return list;
    },

    _getTasks: function (ritmSysId) {
        var list = [];
        var t = new GlideRecord('sc_task');
        t.addQuery('request_item', ritmSysId);
        t.orderBy('sys_created_on');
        t.setLimit(this.MAX_TASKS);
        t.query();
        while (t.next()) {
            list.push({
                task: t.getValue('short_description'),
                team: t.getDisplayValue('assignment_group') || 'Unassigned',
                state: t.getDisplayValue('state'),
                is_closed: t.getValue('active') !== '1' && t.getValue('active') !== 'true',
                last_updated: t.getDisplayValue('sys_updated_on'),
                // INTERNAL note: may contain staff names or blunt language.
                // The prompt tells the model to use only the facts, never quote it.
                latest_internal_note: this._latestJournal(t, 'work_notes')
            });
        }
        return list;
    },

    _latestJournal: function (gr, field) {
        // getJournalEntry(1) returns the newest entry with a header line
        // ("2026-11-24 10:00:00 - Name (Work notes)"). Drop the header.
        var entry = gr[field] ? gr[field].getJournalEntry(1) : '';
        if (!entry) return '';
        var lines = entry.split('\n');
        if (lines.length > 1 && /\(.*\)\s*$/.test(lines[0])) {
            lines.shift();
        }
        return lines.join(' ').replace(/\s+/g, ' ').trim().substring(0, this.NOTE_MAX_CHARS);
    },

    _daysBetween: function (start, endGdt) {
        if (!start) return 0;
        var ms = endGdt.getNumericValue() - new GlideDateTime(start).getNumericValue();
        return Math.floor(ms / 86400000);
    },

    type: 'RequestStatusUtil'
};
