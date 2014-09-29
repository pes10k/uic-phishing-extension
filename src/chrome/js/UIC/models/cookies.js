/* global UIC, chrome */
/**
 * Track when cookies are set for the domains we care about, and handle deleting
 * or altering cookies when needed.
 */
UIC(['models', 'cookies'], function (global, ns) {

    var constants = global.constants,
        domainsModel = global.models.domains,
        utils = global.lib.utils,
        chromeCookies = chrome.cookies;

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
            function cookieDeleteCallback(details) {
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
            query = {
                url: url,
                session: false
            };

        utils.debug("Searching for cookies with domain=" + domain);

        chromeCookies.getAll(query, function cookiesForUrlCallback(cookies) {

            var shortCookies = cookies.map(function cookiesMap(cookie) {
                return [cookie.domain + cookie.path,
                        cookie.name,
                        cookie.secure,
                        cookie.expirationDate];
            });

            domainsModel.filterWatchedCookies(
                shortCookies,
                function filterWatchedCookiesCallback(watchedCookies) {
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
    chromeCookies.onChanged.addListener(function cookieChecker(changeInfo) {

        var removed = changeInfo.removed,
            cookie = changeInfo.cookie,
            cause = changeInfo.cause,
            cookieAsStr,
            uninterestingReasons = ["overwrite", "expired_overwrite"],
            userModel = global.models.user.getInstance();

        if (!cookie) {
            return;
        }

        // We only want to alter cookies of users in the "reauth" group, or
        // all users in debug mode.
        if (!constants.debug && !userModel.isReauthGroup()) {
            return;
        }

        if (removed && uninterestingReasons.indexOf(cause) === -1) {
            return;
        }

        cookieAsStr = utils.cookieToStr(cookie);

        domainsModel.shouldAlterCookie(
            cookie.domain,
            cookie.name,
            function shouldAlterCookieCallback(shouldAlter, reason) {

                var expireTime = utils.expirationTimeForNewCookie(),
                    cookieProtocol = cookie.secure ? "https://" : "http://",
                    newCookie;

                if (!shouldAlter) {
                    // Dont' print debug information if the reason we're not
                    // altering a cookie is because its name doesn't match that
                    // of a cookie we watch.  This is the common case and doing
                    // so adds WAY too much noise to the logs to be useful
                    if (reason !== 'no-name' && reason !== 'no-match') {
                        utils.debug(cookieAsStr + ": Not altering, " + reason);
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
                    url: cookieProtocol + cookie.domain + cookie.path,
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
                // Otherwise, don't set the domain at all, and it'll be a
                // host-only cookie
                if (cookie.domain.indexOf(".") === 0) {
                    newCookie.domain = cookie.domain;
                }

                chromeCookies.set(newCookie);
            }
        );
    });
});
