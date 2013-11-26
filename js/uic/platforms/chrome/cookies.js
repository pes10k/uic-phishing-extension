uic(["platforms", "cookies"], function (global, ns) {

    ns.getCookiesForDomain = function (domain, callback) {
        chrome.cookies.getAll(
            {"domain": domain},
            callback
        );
    };

    ns.deleteCookiesForDomain = function (domain, callback) {
        chromeModel.getCookiesForDomain(domain, function (cookies_to_delete) {
            var i, item, url;
            for (i = 0; i < cookies_to_delete.length; i += 1) {
                item = cookies_to_delete[i];
                url = "http" + (item.secure ? "s" : "") + "://" + item.domain + item.path;
                chrome.cookies.remove({"url": url, "name": item.name});
            }

            if (callback) {
                callback();
            }
        });
    };
});
