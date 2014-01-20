__UIC(['models', 'cookies'], function (global, ns) {

Components.utils.import("resource://gre/modules/Services.jsm");
var cookieService = Services.cookies,
    enumeratorLength = function (enumerator) {
        var count = 0;
        while (enumerator.hasMoreElements()) {
            enumerator.getNext();
            count += 1;
        }
        return count;
    };

/**
 * Deletes a cookie from the browsers cookie store.
 *
 * @param string key
 *   The name of the cookie to remove
 * @param string domain
 *   The domain of the cookie to remove
 * @param string path
 *   The path of the cookie to remove on the given domain
 * @param bool secure
 *   Whether the cookie is a secure cookie
 * @param function callback
 *   A function called with a single parameter, a boolean description o
 *   whether a cookie was succesfully deleted
 */
ns.remove = function (key, domain, path, secure, callback) {

    // Since the cookie service's remove method doesn't return any description
    // of whether a cookie was deleted, we can find the same information by
    // seeing if the remove count reduced the number of cookies on the domain
    var preCount = enumeratorLength(cookieService.getCookiesFromHost(domain)),
        postCount;

    cookieManager.remove(domain, key, path, false);
    postCount = enumeratorLength(cookieService.getCookiesFromHost(domain));

    callback(postCount < preCount);
};

});
