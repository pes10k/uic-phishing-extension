__UIC(['pages', 'background'], function (global, ns) {

var constants = global.constants,
    models = global.models,
    currentUser = models.user.getInstance(),
    domainModel = models.domains.getInstance(),
    // Because of the order that Kango loads platform specific libraries,
    // we lazy load the cookie model when we need it, instead of right away,
    // since this file will always be loaded first (since its platform
    // agnostic)
    cookiesModel = null,
    _tabManager = new models.tabs.TabsCollection(constants.pageHistoryTime),
    _now = global.utils.now,
    _ts2Str = global.utils.timestampToString,
    _debug = function (msg, tab) {

        var tabDesc = tab ? " [" + tab.getId() + ":" + tab.getUrl() + "]" : "";

        if (constants.debug && console && console.log) {
            kango.console.log(msg + tabDesc);
        }
    };

/**
 * When ever a user opens a new tab, we need to add that tab to the tab
 * manager we use to track tab behavior
 */
kango.browser.addEventListener(kango.browser.event.TAB_CREATED, function (event) {
    _tabManager.addTab(event.tabId);
});

/**
 * Similarly, whenever a user closes a tab, we don't need to watch it anymore,
 * so remove it from the collection of watched / tracked tabs.
 */
kango.browser.addEventListener(kango.browser.event.TAB_REMOVED, function (event) {
    _tabManager.removeTab(event.tabId);
});

/**
 * On each page load the the content page will ask the extension if the user
 * has registred the extension.
 *
 * If so, heartbeat ping back to the recording server if needed. Reply to
 * the content page with "registered"
 *
 * If not, send a message back to the content page instructing it to display
 * the "you have not registered yet" message.  Reply to the content page
 * with "alert"
 */
kango.addMessageListener("check-for-registration", function (event) {

    var tab = event.target;

    if (!currentUser.installId()) {
        tab.dispatchMessage("response-for-registration", "alert");
    } else {
        currentUser.heartbeat(function () {});
        tab.dispatchMessage("response-for-registration", "registered");
    }
});

/**
 * Content pages will ask the background page on each page load whether they
 * should force the user to reauth for the current site.  The answer will be
 * true if all the below conditions have been met:
 *
 *  - The user has registered the extension (ie there is an installId)
 *  - The domain has not been recently visited in the current session
 *  - The user is in the expermient group OR we're in debug mode
 *  - It has been at least a given period of time since the user registered
 *    the extension
 *  - The current domain is one that we're watching and its been a while since
 *    we've forced the user to reauth
 */
kango.addMessageListener("check-for-reauth", function (event) {

    var tab = event.target,
        tabId = tab.getId(),
        url = tab.getUrl(),
        data = event.data;

    if (data && data.domReady) {
        _tabManager.addUrlToTab(url, tabId);
    }

    _debug("received reauth request", tab);

    if (!currentUser.installId()) {
        _debug("no reauth, extension is not installed", tab);
        tab.dispatchMessage("response-for-reauth", false);
        return;
    }

    if (_tabManager.tabHistoriesContainingDomainForUrl(url).length > 1) {
        _debug("no reauth, page was open in another tab", tab);
        tab.dispatchMessage("response-for-reauth", false);
        return;
    }

    if (!constants.debug && !currentUser.isExperimentGroup()) {
        _debug("no reauth, user is not in experiment group", tab);
        tab.dispatchMessage("response-for-reauth", false);
        return;
    }

    if ((currentUser.registrationTime() + constants.extensionSleepTime) > _now()) {
        _debug("no reauth, extension is still sleeping (wakes up at " + _ts2Str(currentUser.registrationTime() + constants.extensionSleepTime) + ")", tab);
        tab.dispatchMessage("response-for-reauth", false);
        return;
    }

    domainModel.shouldReauthForUrl(url, function (domainRule, reason) {

        if (!domainRule) {

            switch (reason) {

                case "inactive":
                    _debug("no reauth, study is not currently active", tab);
                    break;

                case "asleep":
                    _debug("no reauth, matching domain rule is asleep (wakes up at " + _ts2Str(arguments[2]) + ")", tab);
                    break;

                case "no-rules":
                    _debug("no reauth, could not find domain rules", tab);
                    break;

                case "no-match":
                    _debug("no reauth, the current url is not a watched domain", tab);
                    break;

                case "no-time":
                    _debug("no reauth, recently reauthed on this domain (next reauth at " + _ts2Str(arguments[2]) + ")", tab);
                    break;
            }

            tab.dispatchMessage("response-for-reauth", false);

        } else {

            _debug("forcing reauth", tab);
            domainRule.setLastReauthTime(_now());
            tab.dispatchMessage("response-for-reauth", domainRule.title);

        }
    });
});

/**
 * Content pages will notify the extension whenever the user has started to
 * populate a password field. If the user has registered the extension, we
 * just notify the recording server with the user's install id.
 */
kango.addMessageListener("password-entered", function (event) {

    var tab = event.target,
        data = event.data,
        url = data.url,
        domain = global.utils.extractDomain(url);

    if (!currentUser.installId()) {
        return;
    }

    // If the study isn't active, don't do anything with the entered password
    domainModel.isStudyActive(function (isStudyActive) {

        if (!isStudyActive) {
            _debug("password entered, but study is inactive", tab);
            return;
        }

        _debug("password entered", tab);

        kango.xhr.send({
            method: "GET",
            url: constants.webserviceDomain + "/password-entered",
            async: true,
            params: {
                "domain": currentUser.blindValue(domain),
                "url": currentUser.blindValue(url),
                "id": currentUser.installId()
            },
            contentType: "json",
        },
        function (result) {});
    });
});

/**
 * For the configuration page, listen for requests to fetch, set, and clear
 * the current extension configuration.
 */
kango.addMessageListener("request-for-config", function (event) {

    var configuration = {},
        tab = event.target,
        key;

    _debug("received request for config");

    configuration["installId"] = currentUser.installId();
    configuration["registrationTime"] = currentUser.registrationTime();
    configuration["checkInTime"] = currentUser.checkInTime();
    configuration["email"] = currentUser.email();

    if (currentUser.installId()) {
        _debug("found config information for extension.");
        for (key in configuration) {
            _debug(" - " + key + ": " + configuration[key]);
        }
    } else {
        _debug("no config info for extension found.");
    }

    tab.dispatchMessage("response-for-config", configuration);
});

kango.addMessageListener("request-set-email", function (event) {

    var tab = event.target,
        email = event.data;

    currentUser.registerUser(email, function (wasSuccess) {
        tab.dispatchMessage("response-set-email", wasSuccess);
    });
});

kango.addMessageListener("request-reset-config", function (event) {

    var tab = event.target;
    currentUser.clearState();
    domainModel.clearState(function () {
        tab.dispatchMessage("response-reset-config", true);
    });
});

});
