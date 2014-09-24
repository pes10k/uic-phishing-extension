/**
 * Track when cookies are set for the domains we care about, and handle deleting
 * or altering cookies when needed.
 */
_UIC(['models', 'cookies'], function (global, ns) {

    Components.utils.import("resource://gre/modules/Services.jsm");

    var utils = global.lib.utils,
        domainsModel = global.models.domains,
        cookieManager = Components.classes["@mozilla.org/cookiemanager;1"]
            .getService(Components.interfaces.nsICookieManager),
        observerService = Components.classes["@mozilla.org/observer-service;1"]
            .getService(Components.interfaces.nsIObserverService),
        cookieService = Services.cookies,
        cookieEventName = "cookie-changed",
        cookieObserver;

    cookieObserver = {
        observe: function (subject, topic, data) {

            var cookie,
                cookieAsStr;

            utils.debug("Received cookie notification: " + data);

            // We only care about when a cookie is set or edited.  All other
            // cookie related events can be ignored
            if (data !== "added" && data !== "changed") {
                utils.debug("Not acting on cookie because it not status " +
                    "'added' or 'changed'");
                return;
            }

            cookie = subject.QueryInterface(Components.interfaces.nsICookie2);
            cookieAsStr = utils.cookieToStr(cookie);

            domainsModel.shouldAlterCookie(cookie.host, cookie.name, function shouldAlterCookieCallback(shouldAlter, reason) {

                var expireTime = utils.expirationTimeForNewCookie();

                if (!shouldAlter) {
                    utils.debug(cookieAsStr + ": Not altering, " + reason);
                    return;
                }

                if (cookie.expires <= expireTime) {
                    utils.debug(cookieAsStr + ": Not altering, current " +
                        "expiration time is sooner than the 'shortend' one.");
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
            });
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

});
