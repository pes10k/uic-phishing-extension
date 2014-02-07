(function () {

    var key,
        consts = (function () {

            var found_consts = {};

            return function () {

                if (!found_consts) {
                    if (window.__UIC && window.__UIC.constants) {
                        found_consts = window.__UIC.constants;
                    }
                }

                return found_consts;
            };
        }()),
        utils  = {

            now: function () {
                return Math.floor(Date.now() / 1000);
            },

            // Simple function to extract the domain for a given url.
            // Just the domain, as a string is returned.
            extractDomain: function (url) {
                return parseUri(url)['host'];
            },

            prepareNamespace: function (parts) {

                var i,
                    next_leaf,
                    current_leaf = window.__UIC;

                for (i = 0; i < parts.length; i += 1) {

                    next_leaf = parts[i];
                    if (!current_leaf[next_leaf]) {
                        current_leaf[next_leaf] = {};
                    }
                    current_leaf = current_leaf[next_leaf];
                }

                return current_leaf;
            },

            /**
             * Formats a unix timestamp into a human readable date string,
             * using the currnet locals settings.
             *
             * @param int timestamp
             *   A unix timestamp, with second level granularity.
             *
             * @return string
             *   A human readable version of the same date
             */
            timestampToString: function (timestamp) {

                var aDate = new Date(timestamp * 1000);
                return aDate.toLocaleDateString() + " " + aDate.toLocaleTimeString();
            },

            init: function (parts, callback) {

                var ns = null;

                if (parts) {
                    ns = this.prepareNamespace(parts);
                    ns.getInstance = function () {
                        return ns;
                    };
                }


                callback(window.__UIC, ns);
            },
        };

    __UIC = window.__UIC = function (parts, callback) {

        var date = new Date();

        // If its not 2014 any more, than looks like we got left around
        // by accident and we should just stop doing anything.
        if (date.getFullYear() !== 2014) {
            return;
        }

        utils.init(parts, callback);
    };

    window.__UIC.utils = utils;
}());
