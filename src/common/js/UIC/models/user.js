__UIC(["models", "user"], function (global, ns) {

var constants = global.constants,
    _now = global.utils.now,
    _installId = null,
    _registrationTime = null,
    _checkInTime = null,
    _email = null,
    _group = null;

/**
 * Returns the current install id for the extension. Will return the string
 * unique identifier for the extension instance if one exists.
 *
 * @return string|null
 *   Returns null if the extension has never been installed, or otherwise
 *   returns the unique identifier for the user.
 */
ns.installId = function () {

    if (!_installId) {
        _installId = kango.storage.getItem("installId");
    }

    return _installId;
};

/**
 * Returns, as a unix timestamp, the time that the extension was installed.
 *
 * @return int|null
 *   Returns the integer unix timestamp of when the extension was installed,
 *   if the extension has been registered, and otherwise null
 */
ns.registrationTime = function () {

    if (!_registrationTime) {
        _registrationTime = kango.storage.getItem("registrationTime");
    }

    return _registrationTime;
};

/**
 * Returns the last time the user checked in with recording server, as a
 * unix timestamp.
 *
 * @return int|null
 *   Returns the unix timestamp of when the user last checked in with the
 *   recording server, if the user has checked in. Otherwise, if the user
 *   has never registered the extension, null is returned.
 */
ns.checkInTime = function () {

    if (!_checkInTime) {
        _checkInTime = kango.storage.getItem("checkInTime");
    }

    return _checkInTime;
};

/**
 * Returns the email address used to register the extension.
 *
 * @return string|null
 *   Returns a string representation of the email address used to register
 *   the extension, or null if the extension hasn't been registered.
 */
ns.email = function () {

    if (!_email) {
        _email = kango.storage.getItem("email");
    }

    return _email;
};

/**
 * Returns a boolean description of whether the current user is in the
 * experiment group.
 *
 * @return bool
 *   Returns true if the extension has been registered and was assigned to
 *   the experiment group, otherwise false.
 */
ns.isExperimentGroup = function () {

    if (!_group) {
        _group = kango.storage.getItem("experiment");
    }

    return (_group === "experiment");
};

/**
 * Unsets / deletes all user-related local state about the extension
 */
ns.clearState = function () {

    _email = null;
    kango.storage.removeItem("email");

    _registrationTime = null;
    kango.storage.removeItem("registrationTime");

    _installId = null;
    kango.storage.removeItem("installId");

    _group = null;
    kango.storage.removeItem("group");

    _checkInTime = null;
    kango.storage.removeItem("checkInTime");
};

/**
 * Registers the user with the recording server. This is a two part process,
 * for anonymity reasons.  First we register the email address, and then
 * the extension.  Only if both processes are successful is the current state
 * of the extension modified.
 *
 * @param string email
 *   An email address to register with the extension server
 * @param function callback
 *   A function that is called with true if registration was successful, and
 *   false in all other cases.
 */
ns.registerUser = function (email, callback) {

    kango.xhr.send({
        method: "GET",
        url: constants.webserviceDomain + "/register",
        async: true,
        params: {
            "version": constants.version,
            "browser": constants.browser
        },
        contentType: "json"
    },
    function (registerResult) {

        if (registerResult.status < 200 || registerResult.status >= 300 || !registerResult.response.ok) {
            callback(false);
            return;
        }

        kango.xhr.send({
            method: "GET",
            url: constants.webserviceDomain + "/email",
            async: true,
            params: {
                "email": email
            },
            contentType: "json",
        },
        function (emailResult) {

            if (emailResult.status < 200 || emailResult.status >= 300 || !emailResult.response.ok) {
                callback(false);
                return;
            }

            kango.storage.setItem("email", registerResult.response.email);
            kango.storage.setItem("installId", registerResult.response._id);
            kango.storage.setItem("group", registerResult.response.group);
            kango.storage.setItem("registrationTime", _now());
            kango.storage.setItem("checkInTime", _now());
            callback(true);
            return;
        });
    });
};

/**
 * Pings the recording server with the registered email address if its been
 * more than the configured amount of time since the last check in
 *
 * @param function callback
 *   A function to call after the heartbeat has been completed, if needed.
 *   The function is called with a single parameter, true if the recording
 *   server was pinged, and false in all other situations (such as the
 *   user not having registered or the user not needing to ping)
*/
ns.heartbeat = function (callback) {

    if (!this.installId()) {
        callback(false);
        return;
    }

    if ((this.checkInTime() + constants.heartbeatTime) >= _now()) {
        callback(false);
        return;
    }

    kango.xhr.send({
        method: "GET",
        url: constants.webserviceDomain + "/email",
        async: true,
        params: {
            "email": this.email()
        },
        contentType: "json",
    },
    function (result) {
        callback((result.status >= 200 && result.status < 300));
    });
};

});
