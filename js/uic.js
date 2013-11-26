(function () {

    var key,
        consts = (function () {

            var found_consts = {};

            return function () {

                if (!found_consts) {
                    if (window.uic && window.uic.constants) {
                        found_consts = window.uic.constants;
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
                    current_leaf = window.uic;

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
                callback(window.uic, ns);
            },
        };

    uic = window.uic = function (parts, callback) {
        utils.init(parts, callback);
    };

    window.uic.utils = utils;
}());
