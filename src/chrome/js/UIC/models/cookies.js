__UIC(['models', 'cookies'], function (global, ns) {

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

    var url = "http" + (secure ? "s" : "") + "://" + domain + path;
    chrome.cookies.remove({"url": url, "name": key}, function (details) {
        callback(!!details);
    });
};

});
