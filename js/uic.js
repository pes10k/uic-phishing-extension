(function () {

    var key,
        consts = (function () {

            var found_consts = {};

            return function () {

                if (!found_consts) {
                    if (window.UIC && window.UIC.constants) {
                        found_consts = window.UIC.constants;
                    }
                }

                return found_consts;
            };
        }()),
        should_log = (consts().debug && console && console.log),
        utils  = {
            // Simple function to extract the domain for a given url.
            // Just the domain, as a string is returned.
            extractDomain: function (url) {
                var domain = parseUri(url)['host'],
                    parts = domain.split("."),
                    num_parts = parts.length;

                return [parts[num_parts - 2], parts[num_parts - 1]].join(".");
            },

            p: function (msg) {
                if (should_log) {
                    console.log(msg);
                }
            },

            prepareNamespace: function (parts) {

                var i,
                    next_leaf,
                    current_leaf = window.UIC;

                for (i = 0; i < parts.length; i += 1) {

                    next_leaf = parts[i];
                    if (!current_leaf[next_leaf]) {
                        current_leaf[next_leaf] = {};
                    }
                    current_leaf = current_leaf[next_leaf];
                }

                return current_leaf;
            },

            init: function (parts, callback) {

                var ns = null;

                if (parts) {
                    ns = this.prepareNamespace(parts);
                    ns.getInstance = function () {
                        return ns;
                    };
                }
                callback(window.UIC, ns);
            },
        };

    UIC = window.UIC = function (parts, callback) {
        utils.init(parts, callback);
    };

    window.UIC.utils = utils;
}());
