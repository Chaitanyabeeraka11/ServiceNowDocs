/*
 * 99 - Delete the demo requests
 * -----------------------------
 * Where : System Definition > Scripts - Background (admin)
 * Deletes ONLY records whose short description starts with "[AI Demo]",
 * plus their catalog tasks and approvals. Run with DRY_RUN = true first.
 */
(function () {
    var DRY_RUN = true;
    var ritm = new GlideRecord('sc_req_item');
    ritm.addQuery('short_description', 'STARTSWITH', '[AI Demo]');
    ritm.query();
    gs.info('Demo RITMs found: ' + ritm.getRowCount());
    if (DRY_RUN) return;
    while (ritm.next()) {
        var t = new GlideRecord('sc_task');
        t.addQuery('request_item', ritm.getUniqueValue());
        t.deleteMultiple();
        var a = new GlideRecord('sysapproval_approver');
        a.addQuery('sysapproval', ritm.getUniqueValue());
        a.deleteMultiple();
        var reqId = ritm.getValue('request');
        ritm.deleteRecord();
        var req = new GlideRecord('sc_request');
        if (req.get(reqId)) req.deleteRecord();
    }
    gs.info('Deleted.');
})();
