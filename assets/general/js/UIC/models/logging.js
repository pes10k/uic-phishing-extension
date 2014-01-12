__UIC(["models", "logging"], function (global, ns) {

    var storageKey = "debug_log",
        maxLogLength = 500,
        storageModel = global.platforms.storage.getInstance();

    ns.log = function (msg, type, callback) {

        storageModel.get(storageKey, function (currentLogs) {

            if (currentLogs === null) {
                currentLogs = [];
            }

            // If the log is already at its maximum length,
            // throw out the oldest item, which will be the first item
            if (currentLogs.length === maxLogLength) {
                currentLogs = currentLogs.slice(1);
            }

            currentLogs.push([Date.now(), type, msg]);
            storageModel.set(storageKey, currentLogs, callback || function () {});
        });
    };

    ns.get = function (callback) {
        storageModel.get(storageKey, callback);
    };

    ns.empty = function (callback) {
        storageModel.set(storageKey, [], callback);
    };
});
