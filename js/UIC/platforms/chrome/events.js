UIC(["platforms", "events"], function (global, ns) {

    var eventCallbacks = {},
        chrome_event_handler = function (msg, sender, sendResponse) {

            var eventName = msg['event'];
            if (eventCallbacks[eventName]) {
                eventCallbacks[eventName](msg, sendResponse);
            }

            // If we don't return True here, chrome won't allow us to handle
            // or callback to the client on the event
            return true;
        };

    ns.onTabLoadStart = function (callback) {

        chrome.webNavigation.onBeforeNavigate.addListener(function (details) {
            if (details.frameId === 0) {
                callback(details.tabId, details.url);
            }
        });
    };

    ns.onTabLoadComplete = function (callback) {

        chrome.webNavigation.onCompleted.addListener(function (details) {
            // Ignore framed requests or requests for resources on the page, and
            // only keep track for the main page in each tab
            if (details.frameId === 0) {
                callback(details.tabId, details.url);
            }
        });
    };

    ns.onBrowserReady = function (callback) {
        chrome.runtime.onStartup.addListener(callback);
    };

    ns.onClientEvent = function (eventName, callback) {
        eventCallbacks[eventName] = callback;
        return true;
    };

    ns.sendClientEvent = function (eventName, data, callback) {

        var key,
            msg = {'event': eventName};

        if (data) {
            for (key in data) {
                msg[key] = data[key];
            }
        }

        chrome.runtime.sendMessage(null, msg, callback);
    };

    chrome.runtime.onMessage.addListener(chrome_event_handler);
});
