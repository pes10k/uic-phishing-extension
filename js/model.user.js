if (!window.uic) {
    window.uic = {};
}

if (!window.uic.model) {
    window.uic.model = {};
}

(function () {

    window.uic.model.user = {};

    var config_key = "ext_config",
        firefoxModel = {},
        ws = window.uic.model.webservices.getInstance(),
        chromeModel = {
            getConfig: function (callback) {
                chrome.storage.sync.get(config_key, function (items) {
                    callback(items[config_key]);
                });
            },

            setConfig: function (new_config, callback) {
                var new_config_record = {};
                new_config_record[config_key] = new_config;
                chrome.storage.sync.set(new_config_record, function () {
                    callback(new_config);
                });
            },

            setEmail: function (new_email, callback) {
                ws.registerExtension(function (data) {
                    if (data.ok) {
                        var new_config = {
                            "email": new_email,
                            "id": data["_id"],
                            "start_date": data["created_on"],
                            "group": data["group"]
                        };
                        chromeModel.setConfig(new_config, callback);
                    }
                });
            },

            resetConfig: function (callback) {
                chrome.storage.sync.clear(callback);
            },

            recordPasswordEntry: function (callback) {
                chromeModel.getConfig(function (config) {
                    if (config && config['id']) {
                        ws.recordPasswordEntry(config['id'], function (data) {
                            callback(data && data['ok']);
                        });
                    }
                });
            }
        };

    window.uic.model.user.getInstance = function () {
        if (window.chrome) {
            return chromeModel;
        }
    };
}());
