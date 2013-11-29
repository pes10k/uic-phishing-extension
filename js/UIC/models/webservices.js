UIC(["models", "webservices"], function (global, ns) {

    var constants = global.constants;

    ns.registerExtension = function (callback) {
        jQuery.get(
            constants.webserviceDomain + "/register", {
                "version": constants.version,
                "browser": constants.browser
            },
            callback,
            "json"
        );
    };

    ns.getAuthRules = function (install_id, callback) {
        jQuery.get(
            constants.webserviceDomain + "/cookie-rules", {
                "id": install_id
            },
            callback,
            "json"
        );
    };

    ns.recordPasswordEntry = function (install_id, callback) {
        jQuery.get(
            constants.webserviceDomain + "/password-entered", {
                "id": install_id
            },
            callback,
            "json"
        );
    };
});
