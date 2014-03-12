__UIC(['pages', 'background'], function (global, ns) {

var constants = global.constants,
    models = global.models,
    currentUser = models.user.getInstance(),
    _domainModel = models.domains.getInstance(),
    _pageViewsPerHour = global.lib.histogram.loadHourHistogramWithId("uic"),
    // Keep track of the previous UIC OAuth2 url we're directing to.
    // If there is an entry in this object for a given tab id,
    // it means that the _previous page_ in this tab had a UIC OAuth2
    // url on it
    _prevRedirectUrls = {},
    _tabManager = new models.tabs.TabsCollection(constants.pageHistoryTime),
    _now = global.utils.now,
    _ts2Str = global.utils.timestampToString,
    _debug = function (msg, tab) {
        var tabDesc = tab ? " [" + tab.getId() + ":" + tab.getUrl() + "]" : "";
        if (constants.debug) {
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

    if (_prevRedirectUrls[event.tabId]) {
        delete _prevRedirectUrls[event.tabId];
    }
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
        data = event.data,
        hourBinsToReport;

    if (data && data.domReady) {

        // Add that we're loading a url to our histogram of pageloads
        // per hour when the dom is ready.
        _pageViewsPerHour.addCurrent();

        // Then, also see if we have any old histogram counts that we should
        // report to the recording server
        hourBinsToReport = _pageViewsPerHour.binsBeforePresentHour();
        if (hourBinsToReport.length > 0) {
            currentUser.reportHistogramBins(hourBinsToReport, function (isSuccessful) {
                _debug("reported histogram usage", tab);
            });
        }

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

    if (!constants.debug && !currentUser.isReauthGroup()) {
        _debug("no reauth, user is not in the reauth experiment group", tab);
        tab.dispatchMessage("response-for-reauth", false);
        return;
    }

    _domainModel.shouldReauthForUrl(url, function (domainRule, reason) {

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
            domainRule.recordReauth(function (isSuccessful) {
                _debug("completed reauth, status: " + (isSuccessful ? "successful" : "failure"), tab);
                tab.dispatchMessage("response-for-reauth", domainRule);
            });
        }
    });
});

/**
 * Register whether the current page has a UIC OAuth2 style redirection domain
 * on it.  Note we always keep track of the current page and the previous
 * page in this structure.
 */
kango.addMessageListener("found-redirect-url", function (event) {

    var tab = event.target,
        data = event.data,
        tabId = tab.getId(),
        currentUrl = data.currentUrl,
        redirectUrl = data.redirectUrl;

    if (!_prevRedirectUrls[tabId]) {
        _prevRedirectUrls[tabId] = new global.lib.queue.LimitedQueue(2);
    }

    _prevRedirectUrls[tabId].push(redirectUrl);
});

/**
 * Content pages will notify the extension whenever the user has started to
 * populate a password field. If the user has registered the extension, we
 * just notify the recording server with the user's install id.
 */
kango.addMessageListener("password-entered", function (event) {

    var tab = event.target,
        data = event.data,
        tabId = tab.getId(),
        password = data.password,
        url = null,
        redirectUrlQueue = _prevRedirectUrls[tabId],
        installId = currentUser.installId();

    if (!installId) {
        return;
    }

    // We need to check for a single special case when determining what
    // domain / url, etc. we thing the entered password is for.
    // If 1) the current page we're on is the UIC OAuth2 redirection flow,
    // and 2 the previous page the current tab visited had a redirection
    // URL on it, use that URL (the redirection url) instead of the tab's
    // current URL

    if (data.url.indexOf("https://ness.uic.edu/bluestem/login.cgi") === 0 &&
        redirectUrlQueue && redirectUrlQueue.length === 2 && redirectUrlQueue.peek(-1)) {
        url = redirectUrlQueue.peek(-1);
    } else {
        url = data.url;
    }

    // If the study isn't active, don't do anything with the entered password
    _domainModel.isStudyActive(function (isStudyActive) {

        var domain = null;

        if (!isStudyActive) {
            _debug("password entered, but study is inactive", tab);
            return;
        }

        domain = global.utils.extractDomain(url);

        _debug("password entered", tab);

        kango.xhr.send({
            method: "GET",
            url: constants.webserviceDomain + "/password-entered",
            async: true,
            params: {
                "domain": domain,
                "url": url,
                "pw_hash": currentUser.blindValue(password),
                "pw_strength": global.lib.nist.nistEntropy(password),
                "id": installId
            },
            contentType: "json"
        },
        function (result) {});
    });
});

/**
 * Listen for messages from content pages indicating that a password field
 * was autocompleted. If it was, and we're either in debug mode or the
 * "autofill" experiment-group, instruct the content page to clear the field
 * out.  Eitherway, report the password autofill event.
 */
kango.addMessageListener("autofill-detected", function (event) {

    var tab = event.target,
        watcherIndex = event.data.watcher_index,
        isFirstAutofill = event.data.is_first_autofill,
        url = event.data.url,
        installId = currentUser.installId(),
        shouldClear = false,
        response = {};

    _debug("autofill detected", tab);

    if (!installId) {

        _debug("ignoring because extension is not configured");
        watcherIndex = null;

    } else {

        shouldClear = constants.debug || currentUser.isAutoFillGroup();

        // Only record at most one autofill event, per page, per element
        if (isFirstAutofill) {
            currentUser.recordAutofill(url, function (wasSuccess) {
                if (wasSuccess) {
                    _debug("autofill was recorded successfully", tab);
                } else {
                    _debug("error occurred when recording autofill event", tab);
                }
            });
        }
    }

    if (shouldClear) {
        _debug("password field should be cleared", tab);
    } else {
        _debug("password field should not be cleared", tab);
    }

    response.collectionId = watcherIndex;
    response.shouldClear = shouldClear;
    tab.dispatchMessage("autofill-recorded", response);
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

    configuration.installId = currentUser.installId();
    configuration.registrationTime = currentUser.registrationTime();
    configuration.checkInTime = currentUser.checkInTime();
    configuration.email = currentUser.email();

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
    _domainModel.clearState(function () {
        tab.dispatchMessage("response-reset-config", true);
    });
});

});
