__UIC(["models", "reauths"], function (global, ns) {

    var storageModel = global.platforms.storage.getInstance(),
        userModel = global.models.user.getInstance(),
        sha256 = sjcl.hash.sha256.hash,
        reauthsKey = "reauths";

    // Calls a given funciton with an unix timestamp of the last time the
    // user was forced to reauth with a given domain. If the user has never
    // been forced to reauth with the domain, the callback function's
    // paramter will be -1
    ns.getDateForReauthForDomain = function (domain, callback) {
        userModel.getConfig(function (config) {
            if (!config || !config['id']) {
                return;
            }

            storageModel.get(reauthsKey, function (reauths) {

                var hashed_domain = sha256(domain + config['id']);

                if (!reauths || !(hashed_domain in reauths)) {
                    callback(-1);
                } else {
                    callback(reauths[hashed_domain]);
                }
            });
        });
    };

    ns.setDateForReauthForDomain = function (domain, callback) {
        userModel.getConfig(function (config) {
            if (!config || !config['id']) {
                return;
            }

            storageModel.get(reauthsKey, function (reauths) {

                var hashed_domain = sha256(domain + config['id']),
                    record = {};

                // If this is the first time we've logged anyone out, we
                // just need to create a new record for storing which items
                // we've reauthed the user on.
                if (!reauths) {
                    reauths = {};
                }
                reauths[hashed_domain] = Date.now();
                storageModel.set(reauthsKey, reauths, function (rs) {

                    if (callback) {
                        callback(rs);
                    }
                });
            });
        });
    };
});
