UIC(null, function (global, ns) {

    var platforms = global.platforms,
        cookies = platforms.cookies.getInstance(),
        events = platforms.events.getInstance(),

        models = global.models,
        userModel = models.user.getInstance(),
        rulesModel = models.rules.getInstance(),
        reauthModel = models.reauths.getInstance(),

        constants = global.constants,
        util = global.utils,
        p = util.p,
        // Keep track of the previous url loaded for each tab.
        tab_state = {};

    // "Content Scripts" (Chrome's term for scripts that run from user facing)
    // pages can interact with the background script in. We respond the
    // following messages:
    //  - "password"     : User just entered a password on a page, and we should
    //                     record / make note of it
    //  - "get-config"   : Page wants to know the current configuration
    //                     options for the extension. These include
    //                     "install_id", "start_date", "email" and
    //                     "check_in_date"
    //  - "set-email"    : Page is setting the email address associated with
    //                     this install of the extension
    //  - "reset-config" : Delete all configuration settings
    events.onClientEvent("password", function (msg, clientCallback) {
        p("Recording entering password");
        userModel.recordPasswordEntry(clientCallback);
    });

    events.onClientEvent("get-config", function (msg, clientCallback) {
        userModel.getConfig(clientCallback);
    });

    events.onClientEvent("set-email", function (msg, clientCallback) {
        userModel.setEmail(msg.email, function (new_config) {
            rulesModel.updateRules(function (new_rules) {
                p("Registration complete");
                p(new_config);

                p("Retrivied new cookie rules");
                p(new_rules);
                clientCallback(new_rules);
            });
        });
    });

    events.onClientEvent("reset-config", function (msg, clientCallback) {
        userModel.resetConfig(clientCallback);
    });

    // Register function so that everytime the user successfully loads a new
    // page, we can keep track of its domain, so that we can see if a user
    // is going to a site they've been to before
    events.onTabLoadComplete(function (tabId, url) {

        tab_state[tabId] = util.extractDomain(url);
        p("Recorded landing on domain: " + tab_state[tabId]);
    });

    // Also register a listener that will give us a chance to respond whenever
    // a user is requesting a new page.  Here we do the following checks:
    //  0) Note that we only require users in control group to reauth
    //  1) Find the domain the user is attempting to navigate to
    //  2) Check and see if the user is requesting a page in the same domain in
    //     in the same tab (if so, never force the user to reauth, to prevent
    //     them from loosing state)
    //  3) If they're moving to a new domain, look to see if domain they're
    //     moving to is one of the domains we want to force users to reauth
    //     on.  If its not, do nothing
    //  4) If it is one of the domains we want to force users to reauth on,
    //     check to see how long its been since we've forced them to reauth
    //     If its been more than a threshold, remove all their session cookies.
    events.onTabLoadStart(function (tabId, url) {

        // Step 0
        userModel.getConfig(function (config) {

            // For testing, assume all users are in experiment group
            if (false && (!config || config.group !== "experiment")) {
                p("Not altering browser session because user is not in experiment group.");
                return;
            }

            // Step 1 from above
            var dest_domain = util.extractDomain(url),
                previous_domain_in_tab = tab_state[tabId];

            // Step 2 from above
            if (previous_domain_in_tab === dest_domain) {
                p("not logging user out: same domain");
                return;
            }

            rulesModel.getRules(function (auth_rules) {

                // Step 3 from above
                if (!auth_rules[dest_domain]) {
                    p("not logging user out: not a domain we touch");
                    return;
                }

                reauthModel.getDateForReauthForDomain(dest_domain, function (date) {

                    // Step 4 from above
                    if (date !== -1 && (date + (constants.reauthThreshold * 1000)) >= Date.now()) {
                        p("not logging user out: hasn't been long enough");
                        return;
                    }

                    p("Logging user out of " + dest_domain);

                    // Otherwise, we should remove all cookies for the domain and
                    // require the user to reauth on the domain.
                    //
                    // Note that this is not guaranteed to have run or completed by the
                    // time the user successfully browses to the desired page.
                    cookies.deleteCookiesForDomain(dest_domain);

                    // Last, record that we're logging the user out
                    reauthModel.setDateForReauthForDomain(dest_domain);
                });
            });
        });
    });

    events.onBrowserReady(function (details) {
        userModel.updateRules(function (new_rules) {});
    });
});
