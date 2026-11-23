/*
 * 01 - Create sample incidents with reassignment history
 * -------------------------------------------------------
 * Where to run : System Definition > Scripts - Background
 * Scope        : global
 * Run as       : a user with the admin role
 * Runtime      : about 1 minute (it pauses between updates so the
 *                history entries get distinct timestamps)
 *
 * What it does:
 *   - Finds (or creates) the assignment groups used in the story.
 *   - Creates 6 incidents whose short description starts with "[AI Demo]".
 *   - Moves each incident between groups, writing a work note at every
 *     hand-off, exactly like an agent would. Every update is recorded in
 *     sys_audit, which is where the skill reads the history from.
 *   - Prints the incident numbers at the end. Copy them into your notes.
 *
 * Clean up later with 99-cleanup-sample-incidents.js.
 */
(function () {
    var PAUSE_MS = 1500; // gap between updates so audit timestamps differ

    function getOrCreateGroup(name) {
        var g = new GlideRecord('sys_user_group');
        if (g.get('name', name)) {
            return g.getUniqueValue();
        }
        g.initialize();
        g.setValue('name', name);
        g.setValue('description', 'Created for the AI Skill Kit demo');
        return g.insert();
    }

    var GROUPS = {
        serviceDesk: getOrCreateGroup('Service Desk'),
        network: getOrCreateGroup('Network'),
        hardware: getOrCreateGroup('Hardware'),
        software: getOrCreateGroup('Software'),
        database: getOrCreateGroup('Database'),
        appDev: getOrCreateGroup('Application Development')
    };

    /*
     * Each scenario: short description, the first group (or null for
     * "unassigned"), then the list of hand-offs [group, work note].
     * A work note of '' means the agent did not explain the move
     * (that is one of our edge cases).
     */
    var SCENARIOS = [
        {
            key: 'TC1 - normal chain',
            short_description: 'VPN disconnects every 10 minutes when working from home',
            first: GROUPS.serviceDesk,
            hops: [
                [GROUPS.network, 'Basic troubleshooting done (reinstalled VPN client). Other users on same VPN gateway are fine. Sending to Network to check the gateway logs.'],
                [GROUPS.hardware, 'Gateway logs are clean for this user. Disconnects line up with the Wi-Fi adapter going into power-save. Sending to Hardware for the laptop NIC driver.']
            ],
            resolve: 'Updated Wi-Fi adapter driver and disabled power-save on the NIC. User confirmed stable for 2 hours.'
        },
        {
            key: 'TC2 - ping-pong',
            short_description: 'Monthly payroll report times out after 60 seconds',
            first: GROUPS.serviceDesk,
            hops: [
                [GROUPS.software, 'Report fails for all payroll users. Looks like an application issue, sending to Software.'],
                [GROUPS.database, 'Application server is healthy. Timeout happens inside the report query. Sending to Database.'],
                [GROUPS.appDev, 'Query plan changed after last weekend\'s statistics job. The query itself needs rewriting. Sending to Application Development.'],
                [GROUPS.database, 'Query rewritten but still slow in test. Needs a new index on the payroll_line table. Back to Database.']
            ],
            resolve: null // still open with Database
        },
        {
            key: 'TC3 - never reassigned',
            short_description: 'Outlook will not open after Windows update',
            first: GROUPS.serviceDesk,
            hops: [],
            resolve: 'Started Outlook in safe mode, disabled the faulty add-in. Outlook opens normally.'
        },
        {
            key: 'TC4 - no reason recorded',
            short_description: 'New starter cannot access the HR SharePoint site',
            first: GROUPS.serviceDesk,
            hops: [
                [GROUPS.software, '']
            ],
            resolve: null
        },
        {
            key: 'TC5 - starts unassigned',
            short_description: 'Third floor printer shows paper jam but tray is empty',
            first: null,
            hops: [
                [GROUPS.serviceDesk, 'Triage: picking this up at the Service Desk.'],
                [GROUPS.hardware, 'Remote reset did not clear the error. Needs an on-site engineer, sending to Hardware.']
            ],
            resolve: null
        },
        {
            key: 'TC6 - long history',
            short_description: 'Intermittent errors connecting to the inventory database',
            first: GROUPS.serviceDesk,
            hops: [
                [GROUPS.network, 'Connection resets seen from several app servers. Sending to Network.'],
                [GROUPS.database, 'No packet loss between app servers and DB host. Sending to Database.'],
                [GROUPS.network, 'DB listener logs show clients dropping, not the server. Back to Network.'],
                [GROUPS.database, 'Firewall idle timeout is 60 minutes, connections drop sooner. Back to Database.'],
                [GROUPS.network, 'Connection pool max lifetime is fine. Please check the load balancer. Back to Network.'],
                [GROUPS.database, 'Load balancer health checks pass. Returning to Database again.'],
                [GROUPS.appDev, 'Database and Network both clear. Suspect connection pool settings in the inventory app. Sending to Application Development.']
            ],
            resolve: null
        }
    ];

    var created = [];

    SCENARIOS.forEach(function (s) {
        var inc = new GlideRecord('incident');
        inc.initialize();
        inc.setValue('caller_id', gs.getUserID());
        inc.setValue('short_description', '[AI Demo] ' + s.short_description);
        inc.setValue('description', s.short_description + ' (sample record for the AI Skill Kit demo: ' + s.key + ')');
        inc.setValue('impact', 2);
        inc.setValue('urgency', 2);
        if (s.first) {
            inc.setValue('assignment_group', s.first);
        }
        var sysId = inc.insert();
        gs.sleep(PAUSE_MS);

        s.hops.forEach(function (hop) {
            var upd = new GlideRecord('incident');
            if (!upd.get(sysId)) {
                return;
            }
            upd.setValue('assignment_group', hop[0]);
            upd.setValue('assigned_to', ''); // a new group picks it up from the queue
            if (hop[1]) {
                upd.work_notes = hop[1];
            }
            upd.update();
            gs.sleep(PAUSE_MS);
        });

        if (s.resolve) {
            var res = new GlideRecord('incident');
            if (res.get(sysId)) {
                res.setValue('state', 6); // Resolved
                res.setValue('close_code', 'Solution provided'); // check the choice exists on your instance
                res.setValue('close_notes', s.resolve);
                res.update();
            }
        }

        var check = new GlideRecord('incident');
        check.get(sysId);
        created.push(s.key + '  ->  ' + check.getValue('number') +
            '  (reassignment_count=' + check.getValue('reassignment_count') + ')');
    });

    gs.info('AI Skill Kit demo incidents created:\n' + created.join('\n'));
})();
