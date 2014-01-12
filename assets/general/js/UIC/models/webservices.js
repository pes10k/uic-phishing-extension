__UIC(["models", "webservices"], function (global, ns) {

    var constants = global.constants,
        ajax_request = function (url, params, callback) {
            jQuery.ajax({
                url: url,
                type: "get",
                data: params,
                dataType: "json",
                success: function (json) {
                    callback({success: true, data: json});
                },
                error: function (error) {
                    callback({success: false, error: error});
                }
            });
        };

    ns.registerExtension = function (callback) {
        ajax_request(
            constants.webserviceDomain + "/register",
            {"version": constants.version, "browser": constants.browser},
            callback
        );
    };

    ns.registerEmail = function (email, callback) {
        ajax_request(
            constants.webserviceDomain + "/email",
            {"email": email},
            callback
        );
    };

    ns.getAuthRules = function (install_id, callback) {
        ajax_request(
            constants.webserviceDomain + "/cookie-rules",
            {"id": install_id},
            callback
        );
    };

    ns.recordPasswordEntry = function (install_id, callback) {
        ajax_request(
            constants.webserviceDomain + "/password-entered",
            {"id": install_id},
            callback
        );
    };
});
