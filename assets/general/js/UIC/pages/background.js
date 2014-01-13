__UIC(null, function (global, ns) {

    var platforms = global.platforms,
        cookies = platforms.cookies.getInstance(),
        events = platforms.events.getInstance(),

        models = global.models,
        userModel = models.user.getInstance(),
        rulesModel = models.rules.getInstance(),
        reauthModel = models.reauths.getInstance(),
        loggingModel = models.logging.getInstance(),
        tabHistoryManager,

        constants = global.constants,
        log = function (msg, type) {
            if (constants.debug) {
                loggingModel.log(msg, type);
            }
        };

    tabHistoryManager = new models.tabs.TabsCollection(constants.pageHistoryTime * 1000);

    events.onContentEvent("password", function (msg, clientCallback) {
        log("Recording entering password: " + global.utils.extractDomain(msg.url), "password");
        userModel.recordPasswordEntry(clientCallback);
    });

    events.onContentEvent("refresh-logs", function (msg, callback) {
        loggingModel.get(callback);
    });

    events.onContentEvent("empty-logs", function (msg, callback) {
        loggingModel.empty(callback);
    });

    events.onContentEvent("get-config", function (msg, clientCallback) {
        userModel.getConfig(clientCallback);
    });

    events.onContentEvent("set-email", function (msg, clientCallback) {

        var successCallback = function (new_config) {

                if (!new_config || new_config.error) {
                    log("Error registering email address with registration server", "error");
                    clientCallback(false);
                    return;
                }

                rulesModel.updateRules(function (update_rs) {
                    log("Registration complete", "config");
                    log(" - Email: " + update_rs.email, "config");
                    clientCallback(update_rs);
                });
            };

        userModel.setEmail(msg.email, successCallback);
    });

    events.onContentEvent("reset-config", function (msg, clientCallback) {
        log("Resetting configuration", "config");
        userModel.resetConfig(clientCallback);
    });

    events.onTabCreate(function (tabId, url) {
        tabHistoryManager.addTab(tabId);
    });

    events.onTabClose(function (tabId) {
        tabHistoryManager.removeTab(tabId);
    });

    // Register function so that everytime the user successfully loads a new
    // page, we can keep track of its domain, so that we can see if a user
    // is going to a site they've been to before
    events.onTabLoadComplete(function (tabId, url) {
        tabHistoryManager.addPageToTab(tabId, url);
        log("Recorded landing on page: " + url, "tab-" + tabId);
    });

    // Also register a listener that will give us a chance to respond whenever
    // a user is requesting a new page.  Here we do the following checks:
    //  0) Note that we only require users in control group to reauth
    //  1) Find the domain the user is attempting to navigate to
    //  2) Check and see if the user is requesting a page in the same domain
    //     that they were recently visiting. If so, don't force the user to
    //     reauth, to prevent them from loosing state)
    //  3) If they're moving to a new domain, look to see if domain they're
    //     moving to is one of the domains we want to force users to reauth
    //     on.  If its not, do nothing
    //  4) If it is one of the domains we want to force users to reauth on,
    //     check to see how long its been since we've forced them to reauth
    //     If its been more than a threshold, remove all their session cookies.
    events.onTabLoadStart(function (tabId, url) {

        // Step 0
        userModel.getConfig(function (config) {

            var matchingTabIds,
                dest_domain = global.utils.extractDomain(url);

            // For testing, assume all users are in experiment group
            if (!constants.debug && (!config || config.group !== "experiment")) {
                log("Not altering browser session because user is not in experiment group.", "tab-" + tabId);
                return;
            }

            // Step 2 from above
            matchingTabIds = tabHistoryManager.isDomainForUrlInHistory(url);

            if (matchingTabIds.length) {
                log("Not logging user out. User was recently visiting '" + dest_domain + "' domain in tab(s): " + matchingTabIds.join(","), "tab-" + tabId);
                return;
            }

            rulesModel.getRules(function (auth_rules) {

                // Step 3 from above
                if (!auth_rules[dest_domain]) {
                    log("Not logging user out: '" + dest_domain + "' is a domain we interact with.", "tab-" + tabId);
                    return;
                }

                reauthModel.getDateForReauthForDomain(dest_domain, function (date) {

                    // Step 4 from above
                    if (date !== -1 && (date + (constants.reauthThreshold * 1000)) >= Date.now()) {
                        log("Not logging user out: Its only been " + ((Date.now() - date) / 1000) + " seconds since we've seen this domain (threshold is " + constants.reauthThreshold + " seconds", "tab-" + tabId);
                        return;
                    }

                    log("Logging user out of " + dest_domain, "tab-" + tabId);

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

    events.onBrowserReady(function () {
        rulesModel.updateRules(function (new_rules) {});
    });
});
