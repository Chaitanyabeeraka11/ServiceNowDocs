/*
 * 99 - Delete the demo incidents
 * ------------------------------
 * Where : System Definition > Scripts - Background (admin)
 * Deletes ONLY incidents whose short description starts with "[AI Demo]".
 * Run the count first (DRY_RUN = true), then set DRY_RUN = false.
 * Groups created by script 01 are left in place.
 */
(function () {
    var DRY_RUN = true;
    var gr = new GlideRecord('incident');
    gr.addQuery('short_description', 'STARTSWITH', '[AI Demo]');
    gr.query();
    gs.info('Demo incidents found: ' + gr.getRowCount());
    if (!DRY_RUN) {
        gr.deleteMultiple();
        gs.info('Deleted.');
    }
})();
