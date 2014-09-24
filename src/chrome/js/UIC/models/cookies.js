/**
 * Track when cookies are set for the domains we care about, and handle deleting
 * or altering cookies when needed.
 */
UIC(['models', 'cookies'], function (global, ns) {

var domainsModel = global.models.domains,
    utils = global.lib.utils,
    cookies = chrome.cookies;

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
        cookies.remove(cookieDetails);
        return;
    }

    cookies.remove(cookieDetails, function chromeCookieDeleteCallback (details) {
        callback(url, name, !!details, (details === null ? chrome.runtime.lastError : null));
    });
};

/**
 * Returns an array of all cookies being watched that apply to the given url.
 *
 * @param string url
 *   A fully formed url, such as http://example.org/resource
 * @param function callback
 *   A function to call once we have an answer for how many cookies
 *   have been set in the client that apply to the given url.  The function
 *   is called with a single argument, an array of zero or more pairs of values,
 *   with the first being the "url" of the cookie (ie domain + path), and the
 *   second being the cookies name.
 */
ns.cookiesForUrl = function (url, callback) {

    var domain = utils.extractDomain(url),
        path = utils.extractPath(url);

    utils.debug("Searching for cookies with domain=" + domain);

    var query = {
        url: url
    };

    cookies.getAll(query, function cookiesForUrlCallback (cookies) {

        var shortCookies = cookies.map(function cookiesMap (cookie) {
            return [cookie.domain + cookie.path, cookie.name];
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
 * Check to see whenever a cookie is set to see if its for one of the domains
 * we watch for.  If it is, we adjust the expiration time of the cookie
 * to be whatever is set in the constants file (ie something much shorter
 * that what the host is specifying).
*/
cookies.onChanged.addListener(function cookieChecker (changeInfo) {

    var removed = changeInfo.removed,
        cookie = changeInfo.cookie,
        cause = changeInfo.cause,
        cookieAsStr;

    if (!cookie) {
        return;
    }

    cookieAsStr = utils.cookieToStr(cookie);

    // If a cookie is being removed, don't do anything to it.  We're only
    // interested in reducing the expiration time for a subset of cookies
    // being set
    if (removed && !(cause in ["overwrite", "expired_overwrite"])) {
        return;
    }

    domainsModel.shouldAlterCookie(
        cookie.domain, cookie.name,
        function shouldAlterCookieCallback (shouldAlter, reason) {

        var expireTime = utils.expirationTimeForNewCookie(),
            newCookie;

        if (!shouldAlter) {
            utils.debug(cookieAsStr + ": Not altering, " + reason);
            return;
        }

        if (cookie.expirationDate <= expireTime) {
            utils.debug(cookieAsStr + ": Not altering, current expiration time is sooner than the 'shortend' one.");
            return;
        }

        utils.debug(cookieAsStr + ": Setting expiration at " + utils.timestampToString(expireTime));
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

        // If the cookie is set to cover subdomains, explicitly set the domain,
        // which chrome will interpret as "." + cookie.domain.  Otherwise, don't
        // set the domain at all, and it'll be a host-only cookie
        if (cookie.domain.indexOf(".") === 0) {
            newCookie['domain'] = cookie.domain;
        }

        cookies.set(newCookie);
    });
});

});
