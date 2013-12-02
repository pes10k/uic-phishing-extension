__UIC(["platforms", "storage"], function (global, ns) {

    ns.get = function (key, callback) {
        chrome.storage.sync.get(key, function (items) {
            if (items && items[key]) {
                callback(items[key]);
            } else {
                callback(null);
            }
        });
    };

    ns.set = function (key, value, callback) {
        var record = {};
        record[key] = value;
        chrome.storage.sync.set(record, callback);
    };

    ns.remove = function (key, callback) {
        chrome.storage.sync.remove(key, callback);
    };
});
