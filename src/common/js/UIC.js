(function () {

    var prepareNamespace = function (parts) {

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
        toNotify = [],
        init = function (parts, callback) {

            var ns = null;

            if (parts) {
                ns = prepareNamespace(parts);
                ns.getInstance = function () {
                    return ns;
                };
            }

            callback(window.UIC, ns);
            toNotify.forEach(function (aCallback) {
                aCallback(window.UIC, parts);
            });
        },
        UIC;

    UIC = window.UIC = function (parts, callback, notificationCallback) {

        var date = new Date();

        if (notificationCallback) {
            toNotify.push(notificationCallback);
        }

        // If its not 2014 any more, than looks like we got left around
        // by accident and we should just stop doing anything.
        if (date.getFullYear() !== 2014) {
            return;
        }

        init(parts, callback);
    };
}());
