if (!window.uic) {
    window.uic = {};
}

(function () {

    var consts = window.uic.constants;

    window.uic.utilities = {
        // Simple function to extract the domain for a given url.
        // Just the domain, as a string is returned.
        extractDomain: function (url) {
            var domain = parseUri(url)['host'],
                parts = domain.split("."),
                num_parts = parts.length;

            return [parts[num_parts - 2], parts[num_parts - 1]].join(".");
        },

        p: function (msg) {
            if (consts.debug) {
                console.log(msg);
            }
        }
    };
}());
