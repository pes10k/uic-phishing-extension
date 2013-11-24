if (!window.uic) {
    window.uic = {};
}

if (!window.uic.model) {
    window.uic.model = {};
}

(function () {

    window.uic.model.rules = {};

    var userModel = window.uic.model.user.getInstance(),
        ws = window.uic.model.webservices.getInstance(),
        rules_key = "auth_rules",
        chromeModel = {

            updateRules: function (callback) {
                userModel.getConfig(function (config) {
                    if (config && config['id']) {
                        ws.getAuthRules(config['id'], function (data) {
                            console.log(data);
                            if (data.ok) {
                                chromeModel.setRules(data['msg']['rules'], callback);
                            }
                        });
                    }
                });
            },

            setRules: function (new_rules, callback) {
                var new_record = {};
                new_record[rules_key] = new_rules;
                console.log(new_record);
                chrome.storage.sync.set(new_record, function () {
                    userModel.getConfig(function (config) {
                        var a_data = new Date();
                        config.check_in_date = a_data.toISOString();
                        userModel.setConfig(config, function (new_config) {
                            callback(new_rules);
                        });
                    });
                });
            },

            getRules: function (callback) {
                chrome.storage.sync.get(rules_key, function (items) {
                    callback(items[rules_key]);
                });
            }
        };

    window.uic.model.rules.getInstance = function () {
        if (window.chrome) {
            return chromeModel;
        }
    };
}());
