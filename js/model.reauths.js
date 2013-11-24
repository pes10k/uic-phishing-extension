if (!window.uic) {
    window.uic = {};
}

if (!window.uic.model) {
    window.uic.model = {};
}

(function () {

    window.uic.model.reauths = {};

    var um = window.uic.model.user.getInstance(),
        reauths_key = "reauths",
        chromeModel = {

            // Calls a given funciton with an unix timestamp of the last time the
            // user was forced to reauth with a given domain. If the user has never
            // been forced to reauth with the domain, the callback function's
            // paramter will be -1
            getDateForReauthForDomain: function (domain, callback) {
                um.getConfig(function (config) {
                    if (!config || !config['id']) {
                        return;
                    }

                    chrome.storage.sync.get(reauths_key, function (items) {
                        var reauths = items[reauths_key],
                            hashed_domain = sjcl.hash.sha256.hash(domain + config['id']);

                        if (!reauths || !(hashed_domain in reauths)) {
                            callback(-1);
                        } else {
                            callback(reauths[hashed_domain]);
                        }
                    });
                });
            },

            setDateForReauthForDomain: function (domain, callback) {
                um.getConfig(function (config) {
                    if (!config || !config['id']) {
                        return;
                    }

                    chrome.storage.sync.get(reauths_key, function (items) {

                        var reauths = items[reauths_key],
                            hashed_domain = sjcl.hash.sha256.hash(domain + config['id']),
                            record = {};

                        // If this is the first time we've logged anyone out, we
                        // just need to create a new record for storing which items
                        // we've reauthed the user on.
                        if (!reauths) {
                            reauths = {};
                        }
                        reauths[hashed_domain] = Date.now();
                        record[reauths_key] = reauths;
                        chrome.storage.sync.set(record, function (write_rs) {

                            if (callback) {
                                callback(write_rs);
                            }
                        });
                    });
                });
            }
        };

    window.uic.model.reauths.getInstance = function () {
        if (window.chrome) {
            return chromeModel;
        }
    };
}());
