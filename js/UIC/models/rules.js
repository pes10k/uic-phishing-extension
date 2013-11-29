UIC(["models", "rules"], function (global, ns) {

    var storageModel = global.platforms.storage.getInstance(),
        userModel = global.models.user.getInstance(),
        webservicesModel = global.models.webservices.getInstance(),
        rulesKey = "auth_rules";

    ns.updateRules = function (callback) {
        userModel.getConfig(function (config) {
            if (config && config['id']) {
                webservicesModel.getAuthRules(config['id'], function (data) {
                    if (data.ok) {
                        ns.setRules(data['msg']['rules'], callback);
                    }
                });
            }
        });
    };

    ns.setRules = function (rules, callback) {
        storageModel.set(rulesKey, rules, function () {
            userModel.getConfig(function (old_config) {
                var a_data = new Date(),
                    new_config = old_config;
                new_config['check_in_date'] = a_data.toISOString();
                userModel.setConfig(new_config, function () {
                    callback(new_config);
                });
            });
        });
    };

    ns.getRules = function (callback) {
        storageModel.get(rulesKey, callback);
    };
});

