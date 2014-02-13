__UIC(["models", "user"], function (global, ns) {

var constants = global.constants,
    _now = global.utils.now,
    _installId = null,
    _registrationTime = null,
    _checkInTime = null,
    _email = null,
    _group = null,
    _secret = null;

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
 * Returns a 256bit secret value (represented as a string) used to hash
 * values generated client side, but which must be hidden by the server
 *
 * @return string|null
 *   Returns null if the client has not been registered yet and thus hasn't
 *   generated a secret yet.  Otherwise, returns the local secret as a
 *   string
 */
ns.clientSecret = function () {

    if (_secret === null) {
        _secret = kango.storage.getItem("secret");
    }

    return _secret;
};

/**
 * Generates a blinded value by hashing the given value with the client's secret
 * and returning the hashed value
 *
 * @param string value
 *   A value to blind / hide under the client's secret
 *
 * @return string|null
 *   null if the client hasn't generated a secret yet (ie the extension
 *   isn't installed). Otherwise, returns a hex version of hashing the given
 *   value and the client's secret under sha256.
 */
ns.blindValue = function (value) {

    var secret = ns.clientSecret();

    if (secret === null) {
        return null;
    }

    return sjcl.codec.hex.fromBits(sjcl.hash.sha256.hash(value + secret));
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

    _secret = null;
    kango.storage.removeItem("secret");

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
            "browser": constants.browser,
            "debug": constants.debug
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

            kango.storage.setItem("secret", sjcl.codec.hex.fromBits(sjcl.random.randomWords(8)));
            kango.storage.setItem("email", email);
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
        contentType: "json"
    },
    function (result) {
        _checkInTime = _now();
        kango.storage.setItem("checkInTime", _checkInTime);
        callback((result.status >= 200 && result.status < 300));
    });
};

/**
 * Reports to the recording server the counts of number of pages the user
 * has visited by hour.
 *
 * @param array histogramBins
 *   An array of 1 or more sub, two element arrays. Each child array should
 *   have an hour timestamp as the first element, and then an integer as the
 *   second
 * @param function callback
 *   A function to call with one parameter, false if there was an error
 *   reporting the histogram counts, and true in all other cases.
 */
ns.reportHistogramBins = function (histogramBins, callback) {

    var installId = this.installId();

    if (!installId) {
        callback(false);
        return;
    }

    kango.xhr.send({
        method: "GET",
        url: constants.webserviceDomain + "/browsing-counts",
        async: true,
        params: {
            "id": installId,
            "histograms": JSON.stringify(histogramBins)
        },
        contentType: "json"
    },
    function (result) {
        callback((result.status >= 200 && result.status < 300));
    });
};

});
