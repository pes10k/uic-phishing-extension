if (!window.uic) {
    window.uic = {};
}

if (!window.uic.model) {
    window.uic.model = {};
}

(function () {

    var constants = window.uic.constants,
        model;

    window.uic.model.webservices = {};

    model = {
        getInstance: function () {
            return this;
        },

        registerExtension: function (callback) {
            $.get(
                constants.webserviceDomain + "/register", {
                    "version": constants['version'],
                    "browser": constants.browser
                },
                callback,
                "json"
            );
        },

        getAuthRules: function (install_id, callback) {
            $.get(
                constants.webserviceDomain + "/cookie-rules", {
                    "id": install_id
                },
                callback,
                "json"
            );
        },

        recordPasswordEntry: function (install_id, callback) {
            $.get(
                constants.webserviceDomain + "/password-entered", {
                    "id": install_id
                },
                callback,
                "json"
            );
        }
    };

    window.uic.model.webservices.getInstance = function () {
        return model;
    };
}());
