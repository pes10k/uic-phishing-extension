UIC(['pages', 'background'], function (global, ns) {

    var constants = global.constants,
        models = global.models,
        currentUser = models.user.getInstance(),
        utils = global.lib.utils,
        domainModel = models.domains.getInstance(),
        pageViewsPerHour = global.lib.histogram.loadHourHistogramWithId("uic"),
        // Keep track of the previous UIC OAuth2 url we're directing to.
        // If there is an entry in this object for a given tab id,
        // it means that the _previous page_ in this tab had a UIC OAuth2
        // url on it
        prevRedirectUrls = {},
        debug = utils.debug,
        nullFunction = function () {};

    /**
     * On each page load the the content page will ask the extension if the user
     * has registered the extension.
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

         if (currentUser.extensionIsDismissed()) {
            tab.dispatchMessage("response-for-registration", "dismissed");
        } else if (!currentUser.installId()) {
            tab.dispatchMessage("response-for-registration", "alert");
        } else {
            currentUser.heartbeat();
            tab.dispatchMessage("response-for-registration", "registered");
        }
    });

    /**
     * Users have the ability to permanatly dismiss the topbar / "please
     * configure" warning.  This is included mainly so that users can
     * ignore the extensions on sycned versions of the plugin.
     */
    kango.addMessageListener("top-bar-dismissed", function (event) {
        currentUser.setExtensionsIsDismissed(true);
    });

    /**
     * Every time a page is loaded, we should add it to the histograpm
     * for the user's browsing history.
     */
    kango.addMessageListener("page-loaded", function (event) {

        var tab = event.target,
            tabId = tab.getId(),
            url = tab.getUrl(),
            data = event.data,
            hourBinsToReport;

        if (data && data.domReady) {

            // Add that we're loading a url to our histogram of pageloads
            // per hour when the dom is ready.
            pageViewsPerHour.addCurrent();

            // Then, also see if we have any old histogram counts that we should
            // report to the recording server
            hourBinsToReport = pageViewsPerHour.binsBeforePresentHour();
            if (hourBinsToReport.length > 0) {
                currentUser.reportHistogramBins(hourBinsToReport, function (isSuccessful) {
                    debug("reported histogram usage", tab);
                });
            }
        }
    });

    /**
     * Register whether the current page has a UIC OAuth2 style redirection
     * domain on it.  Note we always keep track of the current page and the
     * previous page in this structure.
     */
    kango.addMessageListener("found-redirect-url", function (event) {

        var tab = event.target,
            data = event.data,
            tabId = tab.getId(),
            redirectUrl = data.redirectUrl;

        if (!prevRedirectUrls[tabId]) {
            prevRedirectUrls[tabId] = new global.lib.queue.LimitedQueue(2);
        }

        prevRedirectUrls[tabId].push(redirectUrl);
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
            redirectUrlQueue = prevRedirectUrls[tabId],
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
                redirectUrlQueue &&
                redirectUrlQueue.length === 2 &&
                redirectUrlQueue.peek(-1)) {
            url = redirectUrlQueue.peek(-1);
        } else {
            url = data.url;
        }

        // If the study isn't active, don't do anything with the entered
        // password
        domainModel.isStudyActive(function (isStudyActive) {

            var domain = null;

            if (!isStudyActive) {
                debug("password entered, but study is inactive", tab);
                return;
            }

            domain = utils.extractDomain(url);

            debug("password entered", tab);

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
            }, nullFunction);
        });
    });

    /**
     * Listen for messages from content pages indicating that a password field
     * was auto completed. If it was, and we're either in debug mode or the
     * "autofill" experiment-group, instruct the content page to clear the field
     * out.  Either way, report the password autofill event.
     */
    kango.addMessageListener("autofill-detected", function (event) {

        var tab = event.target,
            watcherIndex = event.data.watcher_index,
            isFirstAutofill = event.data.is_first_autofill,
            url = event.data.url,
            installId = currentUser.installId(),
            shouldClear = false,
            response = {};

        debug("autofill detected", tab);

        if (!installId) {

            debug("ignoring because extension is not configured");
            watcherIndex = null;

        } else {

            shouldClear = constants.debug || currentUser.isAutoFillGroup();

            // Only record at most one autofill event, per page, per element
            if (isFirstAutofill) {
                currentUser.recordAutofill(url, function (wasSuccess) {
                    if (wasSuccess) {
                        debug("autofill was recorded successfully", tab);
                    } else {
                        debug("error occurred when recording autofill event", tab);
                    }
                });
            }
        }

        if (shouldClear) {
            debug("password field should be cleared", tab);
        } else {
            debug("password field should not be cleared", tab);
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

        debug("received request for config");

        configuration.installId = currentUser.installId();
        configuration.registrationTime = currentUser.registrationTime();
        configuration.checkInTime = currentUser.checkInTime();
        configuration.email = currentUser.email();

        if (currentUser.installId()) {
            debug("found config information for extension.");
            for (key in configuration) {
                if (configuration.hasOwnProperty(key)) {
                    debug(" - " + key + ": " + configuration[key]);
                }
            }
        } else {
            debug("no config info for extension found.");
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
        domainModel.clearState(function () {
            tab.dispatchMessage("response-reset-config", true);
        });
        currentUser.clearState();
    });

    // If we're in debug mode, we want to add a button that allows the tester
    // to delete any watched / manipulated cookies for the current page / domain
    if (constants.debug) {

        // Set the a "*" note whenever we visit a page that sets one or more
        // cookies that we watch.  Otherwise, the browser button appears
        // un-adorned. For further debugging help, also set the tooltip for the
        // browser button to be a description (ie cookie-name@cookie-url
        // cookie-expiration) of each cookie watched on the current page.
        kango.browser.addEventListener(
            kango.browser.event.TAB_CHANGED,
            function (event) {
                var currentUrl = event.url;
                models.cookies.getInstance().cookiesForUrl(
                    currentUrl,
                    function cookiesForUrlCallback(cookies) {
                        var prettyCookies = cookies.map(function (cookie) {
                            var cookieUrl = cookie[0],
                                cookieName = cookie[1],
                                cookieDate = utils.timestampToString(cookie[3]);
                            return cookieName + "@" + cookieUrl + " (" + cookieDate + ")";
                        });

                        kango.ui.browserButton.setBadgeValue(cookies.length);
                        kango.ui.browserButton.setTooltipText(prettyCookies.join("\n"));
                    }
                );
            }
        );

        kango.ui.browserButton.addEventListener(
            kango.ui.browserButton.event.COMMAND,
            function browserButtonCallback() {
                kango.browser.tabs.getCurrent(function (tab) {
                    models.cookies.getInstance().cookiesForUrl(
                        tab.getUrl(),
                        function cookiesForUrlToDeleteCallback(cookies) {

                            var cookieModel = models.cookies.getInstance();

                            cookies.forEach(function (cookie) {
                                var cookieUrl = cookie[0],
                                    cookieName = cookie[1],
                                    cookieIsSecure = cookie[2],
                                    cookieProtocol = (cookieIsSecure
                                        ? 'https://'
                                        : 'http://'),
                                    fullCookieUrl = cookieProtocol + cookieUrl;

                                cookieModel.delete(
                                    fullCookieUrl,
                                    cookieName,
                                    function (url, name, wasDeleted, error) {
                                        if (wasDeleted) {
                                            debug("Successfully deleted " +
                                                  name + "@" + url);
                                        } else {
                                            debug("Error deleting " + name +
                                                  "@" + url + " (" + error + ")");
                                        }
                                    }
                                );
                            });

                            kango.ui.browserButton.setBadgeValue("");
                            kango.ui.browserButton.setTooltipText("");
                        }
                    );
                });
            }
        );
    }
});
