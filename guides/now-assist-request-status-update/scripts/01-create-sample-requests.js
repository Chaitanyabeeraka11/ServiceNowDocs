/*
 * 01 - Create sample requested items (RITMs) in different "stuck" situations
 * --------------------------------------------------------------------------
 * Where to run : System Definition > Scripts - Background
 * Scope        : global
 * Run as       : admin
 *
 * Creates 6 requests whose short description starts with "[AI Demo]".
 * Each one is stuck (or not) in a different way, so you can test how the
 * skill explains it to the requester. Prints the RITM numbers at the end.
 *
 * Request and RITM are inserted with setWorkflow(false) so the catalog
 * item's own flow/workflow does NOT start and create extra tasks. Approvals
 * and catalog tasks are then added by hand, exactly as the story needs.
 *
 * Clean up later with 99-cleanup-sample-requests.js.
 */
(function () {
    var REQUESTER = gs.getUserID(); // you are the requester, so you see the comments

    function getOrCreateGroup(name) {
        var g = new GlideRecord('sys_user_group');
        if (g.get('name', name)) return g.getUniqueValue();
        g.initialize();
        g.setValue('name', name);
        g.setValue('description', 'Created for the AI Skill Kit demo');
        return g.insert();
    }

    function getOrCreateUser(userName, first, last) {
        var u = new GlideRecord('sys_user');
        if (u.get('user_name', userName)) return u.getUniqueValue();
        u.initialize();
        u.setValue('user_name', userName);
        u.setValue('first_name', first);
        u.setValue('last_name', last);
        return u.insert();
    }

    function findItem(names) {
        // use a real catalog item name if your instance has one, for a nicer demo
        for (var i = 0; i < names.length; i++) {
            var c = new GlideRecord('sc_cat_item');
            if (c.get('name', names[i])) return c.getUniqueValue();
        }
        return '';
    }

    var G = {
        procurement: getOrCreateGroup('Procurement'),
        hardware: getOrCreateGroup('Hardware'),
        iam: getOrCreateGroup('Identity and Access Management'),
        software: getOrCreateGroup('Software')
    };
    var MANAGER = getOrCreateUser('demo.manager', 'Priya', 'Sharma');

    function createRitm(shortDesc, itemNames, stage, state) {
        var req = new GlideRecord('sc_request');
        req.initialize();
        req.setValue('requested_for', REQUESTER);
        req.setValue('opened_by', REQUESTER);
        req.setValue('short_description', '[AI Demo] ' + shortDesc);
        req.setWorkflow(false);
        var reqId = req.insert();

        var ritm = new GlideRecord('sc_req_item');
        ritm.initialize();
        ritm.setValue('request', reqId);
        ritm.setValue('requested_for', REQUESTER);
        ritm.setValue('opened_by', REQUESTER);
        ritm.setValue('cat_item', findItem(itemNames));
        ritm.setValue('short_description', '[AI Demo] ' + shortDesc);
        ritm.setValue('stage', stage);   // e.g. waiting_for_approval, fulfillment, complete
        ritm.setValue('state', state);   // 1 Open, 2 Work in Progress, 3 Closed Complete
        ritm.setWorkflow(false);
        return ritm.insert();
    }

    function addApproval(ritmId, approver, state, comment) {
        var a = new GlideRecord('sysapproval_approver');
        a.initialize();
        a.setValue('sysapproval', ritmId);
        a.setValue('source_table', 'sc_req_item');
        a.setValue('document_id', ritmId);
        a.setValue('approver', approver);
        a.setValue('state', state); // requested | approved | rejected
        if (comment) a.comments = comment;
        a.setWorkflow(false); // no approval emails / engine side effects
        a.insert();
        var r = new GlideRecord('sc_req_item');
        if (r.get(ritmId)) {
            r.setValue('approval', state === 'approved' ? 'approved' : 'requested');
            r.setWorkflow(false);
            r.update();
        }
    }

    function addTask(ritmId, shortDesc, group, state, workNote) {
        var t = new GlideRecord('sc_task');
        t.initialize();
        t.setValue('request_item', ritmId);
        t.setValue('short_description', shortDesc);
        t.setValue('assignment_group', group);
        t.setValue('state', state); // 1 Open, 2 Work in Progress, 3 Closed Complete
        if (workNote) t.work_notes = workNote;
        t.insert();
    }

    function addRequesterComment(ritmId, text) {
        var r = new GlideRecord('sc_req_item');
        if (r.get(ritmId)) {
            r.comments = text;
            r.update();
        }
    }

    var out = [];
    var id;

    // TC1 - waiting on the manager's approval
    id = createRitm('Adobe Acrobat Pro licence', ['Adobe Acrobat Pro', 'Adobe Acrobat'], 'waiting_for_approval', 1);
    addApproval(id, MANAGER, 'requested', '');
    addRequesterComment(id, 'Hi, I need this for the client contracts due next week. Any update?');
    out.push(['TC1 - waiting on approval', id]);

    // TC2 - approved, backordered at vendor, ETA in the work note
    id = createRitm('Standard laptop replacement', ['Standard Laptop', 'Developer Laptop (Mac)'], 'fulfillment', 2);
    addApproval(id, MANAGER, 'approved', 'Approved, old laptop is 5 years old.');
    addTask(id, 'Order laptop from vendor', G.procurement, 2,
        'PO 4500123 raised. Vendor confirms model is backordered, new ETA 28 Nov. Will ship to Pune office.');
    out.push(['TC2 - backordered with ETA', id]);

    // TC3 - waiting on the REQUESTER (they must act)
    id = createRitm('Second monitor', ['Monitor', 'Standard Monitor'], 'fulfillment', 2);
    addApproval(id, MANAGER, 'approved', '');
    addTask(id, 'Order monitor', G.procurement, 2,
        'Cannot raise PO: cost centre missing on request. Emailed requester on Monday asking for cost centre, no reply yet. On hold until we hear back.');
    out.push(['TC3 - waiting on requester', id]);

    // TC4 - messy internal note with names and blame (must NOT leak)
    id = createRitm('Visio Professional licence', ['Microsoft Visio Professional', 'Visio'], 'fulfillment', 2);
    addApproval(id, MANAGER, 'approved', '');
    addTask(id, 'Assign Visio licence', G.software, 2,
        'Ravi forgot to raise the licence PO last week, again. Vendor portal also down today. Escalated to Meena. Should be sorted in 2-3 working days.');
    out.push(['TC4 - internal names and blame', id]);

    // TC5 - new joiner bundle, 2 of 3 tasks done
    id = createRitm('New joiner setup for Arjun Mehta', ['New Employee Hire', 'New Hire'], 'fulfillment', 2);
    addApproval(id, MANAGER, 'approved', '');
    addTask(id, 'Prepare laptop', G.hardware, 3, 'Laptop imaged and delivered to desk 4F-12.');
    addTask(id, 'Create email mailbox', G.iam, 3, 'Mailbox created.');
    addTask(id, 'Grant SAP access', G.iam, 2, 'Waiting for SAP role approval from Finance system owner. Normally 2 working days.');
    out.push(['TC5 - multi-task progress', id]);

    // TC6 - already completed (skill should answer NO_UPDATE)
    id = createRitm('Wireless mouse', ['Wireless Mouse', 'Mouse'], 'complete', 3);
    addApproval(id, MANAGER, 'approved', '');
    addTask(id, 'Deliver mouse', G.hardware, 3, 'Delivered to requester desk.');
    out.push(['TC6 - already complete', id]);

    var lines = out.map(function (o) {
        var r = new GlideRecord('sc_req_item');
        r.get(o[1]);
        return o[0] + '  ->  ' + r.getValue('number');
    });
    gs.info('AI Skill Kit demo requests created:\n' + lines.join('\n'));
})();
