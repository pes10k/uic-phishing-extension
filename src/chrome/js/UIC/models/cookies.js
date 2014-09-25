/**
 * Track when cookies are set for the domains we care about, and handle deleting
 * or altering cookies when needed.
 */
UIC(['models', 'cookies'], function (global, ns) {

    var domainsModel = global.models.domains,
        utils = global.lib.utils,
        chromeCookies = chrome.cookies,
        onDeletedCookieCallback = null;

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
     *   This funciton recieves four arguments: [url, name, wasDeleted, error]
     */
    ns['delete'] = function (url, name, callback) {

        var cookieDetails = {
            url: url,
            name: name
        };

        if (!callback) {
            chromeCookies.remove(cookieDetails);
            return;
        }

        chromeCookies.remove(
            cookieDetails,
            function cookieDeleteCallback (details) {
                if (!callback) {
                    return;
                }
                callback(
                    url,
                    name,
                    !!details,
                    (details === null ? chrome.runtime.lastError : null)
                );
            }
        );
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
     *   values: [url, name, isSecure, exp date (as unix timestamp)].
     */
    ns.cookiesForUrl = function (url, callback) {

        var domain = utils.extractDomain(url),
            path = utils.extractPath(url);

        utils.debug("Searching for cookies with domain=" + domain);

        var query = {
            url: url,
            session: false
        };

        chromeCookies.getAll(query, function cookiesForUrlCallback (cookies) {

            var shortCookies = cookies.map(function cookiesMap (cookie) {
                return [cookie.domain + cookie.path,
                        cookie.name,
                        cookie.secure,
                        cookie.expirationDate];
            });

            domainsModel.filterWatchedCookies(
                shortCookies,
                function filterWatchedCookiesCallback (watchedCookies) {
                    callback(watchedCookies);
                }
            );
        });
    };

    /**
     * Check to see whenever a cookie is set to see if its for one of the
     * domains we watch for.  If it is, we adjust the expiration time of the
     * cookie to be whatever is set in the constants file (ie something much
     * shorter that what the host is specifying).
    */
    chromeCookies.onChanged.addListener(function cookieChecker (changeInfo) {

        var removed = changeInfo.removed,
            cookie = changeInfo.cookie,
            cause = changeInfo.cause,
            cookieAsStr;

        if (!cookie) {
            return;
        }

        cookieAsStr = utils.cookieToStr(cookie);

        domainsModel.shouldAlterCookie(
            cookie.domain, cookie.name,
            function shouldAlterCookieCallback (shouldAlter, reason) {

            var expireTime = utils.expirationTimeForNewCookie(),
                newCookie;

            if (!shouldAlter) {
                // Dont' print debug information if the reason we're not
                // altering a cookie is because its name doesn't match that of
                // a cookie we watch.  This is the common case and doing so adds
                // WAY too much noise to the logs to be useful
                if (reason !== 'no-name') {
                    utils.debug(cookieAsStr + ": Not altering, " + reason);
                }
                return;
            }

            // If a cookie is being removed, the we call the given callback
            // function of it exists and don't handle further
            if (removed && !(cause in ["overwrite", "expired_overwrite"])) {
                if (onDeletedCookieCallback) {
                    onDeletedCookieCallback(
                        cookie.domain + cookie.path,
                        cookie.name,
                        cookie.secure
                    );
                }
                return;
            }

            if (cookie.expirationDate <= expireTime) {
                utils.debug(cookieAsStr +
                            ": Not altering, current expiration time is " +
                            "sooner than the 'shortend' one.");
                return;
            }

            utils.debug(cookieAsStr + ": Setting expiration at " +
                        utils.timestampToString(expireTime));

            newCookie = {
                url: (cookie.secure ? "https://" : "http://") + cookie.domain + cookie.path,
                name: cookie.name,
                value: cookie.value,
                httpOnly: cookie.httpOnly,
                storeId: cookie.storeId,
                secure: cookie.secure,
                expirationDate: expireTime,
                path: cookie.path
            };

            // If the cookie is set to cover subdomains, explicitly set the
            // domain, which chrome will interpret as "." + cookie.domain.
            // Otherwise, don't set the domain at all, and it'll be a host-only
            // cookie
            if (cookie.domain.indexOf(".") === 0) {
                newCookie['domain'] = cookie.domain;
            }

            chromeCookies.set(newCookie);
        });
    });
});
