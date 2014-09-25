/**
 * Track when cookies are set for the domains we care about, and handle deleting
 * or altering cookies when needed.
 */
UIC(['models', 'cookies'], function (global, ns) {

    Components.utils.import("resource://gre/modules/Services.jsm");

    var utils = global.lib.utils,
        domainsModel = global.models.domains,
        cookieManager = Components.classes["@mozilla.org/cookiemanager;1"]
            .getService(Components.interfaces.nsICookieManager),
        observerService = Components.classes["@mozilla.org/observer-service;1"]
            .getService(Components.interfaces.nsIObserverService),
        cookieService = Services.cookies,
        cookieEventName = "cookie-changed",
        cookieObserver,
        onDeletedCookieCallback = null;

    cookieObserver = {
        observe: function (subject, topic, data) {

            var cookie,
                cookieAsStr;

            utils.debug("Received cookie notification: " + data);

            // We only care about when a cookie is set or edited.  All other
            // cookie related events can be ignored
            if (data !== "added" && data !== "changed" && data !== "deleted") {
                utils.debug("Not acting on cookie because it not status " +
                    "'added', 'changed' or 'deleted'");
                return;
            }

            cookie = subject.QueryInterface(Components.interfaces.nsICookie2);
            cookieAsStr = utils.cookieToStr(cookie);

            domainsModel.shouldAlterCookie(
                cookie.host,
                cookie.name,
                function shouldAlterCookieCallback(shouldAlter, reason) {

                    var expireTime = utils.expirationTimeForNewCookie();

                    if (!shouldAlter) {
                        utils.debug(cookieAsStr + ": Not altering, " + reason);
                        return;
                    }

                    // If we're being notified that a cookie was
                    if (data === "delete") {
                        if (onDeletedCookieCallback) {
                            onDeletedCookieCallback(
                                cookie.host + cookie.path,
                                cookie.name,
                                cookie.isSecure
                            );
                        }
                        return;
                    }

                    if (cookie.expires <= expireTime) {
                        utils.debug(cookieAsStr + ": Not altering, current " +
                            "expiration time is sooner than the 'short' one.");
                        return;
                    }

                    utils.debug(cookieAsStr + ": Setting expiration at " +
                        utils.timestampToString(expireTime));

                    // First delete the cookie we're replacing
                    ns['delete'](cookie.host + cookie.path, cookie.name);

                    cookieService.add(
                        cookie.host,
                        cookie.path,
                        cookie.name,
                        cookie.value,
                        cookie.isSecure,
                        cookie.isHttpOnly,
                        cookie.isSession,
                        expireTime
                    );
                }
            );
        },
        register: function () {
            utils.debug("Registering for cookie notifications");
            observerService.addObserver(this, cookieEventName, false);
        },
        unregister: function () {
            observerService.removeObserver(this, cookieEventName);
        }
    };

    cookieObserver.register();

    /**
     * Set a function that will be called whenever a watched cookie is being
     * deleted / removed from the cookie store
     *
     * @param function callback
     *   A function that will be called with a single argument whenever a
     *   watched cookie is deleted.  That function will be called with three
     *   arguments, the cookies url, name, and a boolean description of
     *   whether it was a secure cookie.
     *
     * @return object
     *   A refrence to the current model object.
     */
     ns.setOnDeletedCookieCallback = function (callback) {
        onDeletedCookieCallback = callback;
        return this;
    };

    /**
     * Delete a cookie from the current browser cookie jar
     *
     * @param string url
     *   The url describing the cookie to delete
     * @param string name
     *   The name of the cookie to delete
     * @param function callback
     *   An optional function to call once the deletion call has completed.
     *   This funciton recieves four arguments: [url, name, wasDeleted, error].
     */
    ns['delete'] = function (url, name, callback) {

        var host = utils.extractDomain(url),
            path = url.substr(url.indexOf(host) + host.length),
            rawhost,
            cookiesFromHost,
            aCookie,
            wasDeleted = true;

        utils.debug("Attempting to remove cookie");
        utils.debug({
            host: host,
            path: path,
            name: name
        });

        cookieManager.remove(host, name, path, false);

        if (!callback) {
            return;
        }

        // Since the Firefox AddOn API doesn't return whether the cookie was
        // successfully deleted, we can just check to see if the cookie exists,
        // and if it doesn't we assume we were successful.
        //
        // To query though, we need to strip any possible leading dot from
        // the cookie's host
        rawhost = (host[0] === ".") ? host.substr(1) : host;
        cookiesFromHost = cookieService.getCookiesFromHost(rawhost);
        while (cookiesFromHost.hasMoreElements()) {
            aCookie = cookiesFromHost.getNext().QueryInterface(Components.interfaces.nsICookie2);
            if (aCookie.name === name && aCookie.path === path) {
                wasDeleted = false;
                break;
            }
        }

        callback(url, name, wasDeleted, null);
    };

    /**
     * Returns an array of all cookies being watched that apply to the given
     * url.
     *
     * @param string url
     *   A fully formed url, such as http://example.org/resource
     * @param function callback
     *   A function to call once we have an answer for how many cookies
     *   have been set in the client that apply to the given url.  The function
     *   is called with a single argument, an array of zero or more triples of
     *   values: [url, name, is secure, exp date (as unix timestamp)].
     */
    ns.cookiesForUrl = function (url, callback) {

        var domain = utils.extractDomain(url),
            path = utils.extractPath(url),
            cookieIterator,
            aCookie,
            possibleCookies = [];

        utils.debug("Searching for cookies with domain=" + domain);
        cookieIterator = cookieService.getCookiesFromHost(domain);
        while (cookieIterator.hasMoreElements()) {
            aCookie = cookieIterator.getNext().QueryInterface(Components.interfaces.nsICookie2);

            possibleCookies.push([
                aCookie.host + aCookie.path,
                aCookie.name,
                aCookie.isSecure,
                aCookie.expires
            ]);
        }

        utils.debug(possibleCookies);
        domainsModel.filterWatchedCookies(
            possibleCookies,
            function filterWatchedCookiesCallback (watchedCookies) {
                utils.debug(watchedCookies);
                callback(watchedCookies);
            }
        );
    };
});
