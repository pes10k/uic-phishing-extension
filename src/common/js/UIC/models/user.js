UIC(["models", "user"], function (global, ns) {

    var constants = global.constants,
        utils = global.lib.utils,
        locallyCachedRegistrationTime = null,
        locallyCachedCheckInTime = null,
        locallyCachedEmail = null,
        locallyCachedGroup = null,
        locallyCachedInstallId = null,
        locallyCachedSecret = null,
        locallyCachedIsDismissed = null;

    /**
     * Return a flag of whether the user marked that the extension
     * should just generally be ignored.
     */
    ns.extensionIsDismissed = function () {

        if (locallyCachedIsDismissed === null) {
            locallyCachedIsDismissed = kango.storage.getItem("is_dismissed");
        }

        return locallyCachedIsDismissed;
    };

    /**
     * Setter for the same above value, whether the user has marked the
     * extensions as being dismissed.
     */
    ns.setExtensionsIsDismissed = function (isDismissed) {
        locallyCachedIsDismissed = isDismissed;
        kango.storage.setItem("is_dismissed", isDismissed);
        return this;
    };


    /**
     * Returns the current install id for the extension. Will return the string
     * unique identifier for the extension instance if one exists.
     *
     * @return string|null
     *   Returns null if the extension has never been installed, or otherwise
     *   returns the unique identifier for the user.
     */
    ns.installId = function () {

        if (!locallyCachedInstallId) {
            locallyCachedInstallId = kango.storage.getItem("install_id");
        }

        return locallyCachedInstallId;
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

        if (locallyCachedSecret === null) {
            locallyCachedSecret = kango.storage.getItem("secret");
        }

        return locallyCachedSecret;
    };

    /**
     * Generates a blinded value by hashing the given value with the client's
     * secret and returning the hashed value
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

        if (!locallyCachedRegistrationTime) {
            locallyCachedRegistrationTime = kango.storage.getItem("registration_time");
        }

        return locallyCachedRegistrationTime;
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

        if (!locallyCachedCheckInTime) {
            locallyCachedCheckInTime = kango.storage.getItem("check_in_time");
        }

        return locallyCachedCheckInTime;
    };

    /**
     * Returns the email address used to register the extension.
     *
     * @return string|null
     *   Returns a string representation of the email address used to register
     *   the extension, or null if the extension hasn't been registered.
     */
    ns.email = function () {

        if (!locallyCachedEmail) {
            locallyCachedEmail = kango.storage.getItem("email");
        }

        return locallyCachedEmail;
    };

    /**
     * Returns a boolean description of whether the current user is in the
     * reauth experiment group.
     *
     * @return bool
     *   Returns true if the extension has been registered and was assigned to
     *   the reauth experiment group, otherwise false.
     */
    ns.isReauthGroup = function () {

        if (!locallyCachedGroup) {
            locallyCachedGroup = kango.storage.getItem("group");
        }

        return (locallyCachedGroup === "reauth");
    };

    /**
     * Returns a boolean description of whether the current user is in the
     * autofill experiment group.
     *
     * @return bool
     *   Returns true if the extension has been registered and was assigned to
     *   the autofill experiment group, otherwise false.
     */
    ns.isAutoFillGroup = function () {

        if (!locallyCachedGroup) {
            locallyCachedGroup = kango.storage.getItem("group");
        }

        return (locallyCachedGroup === "autofill");
    };

    /**
     * Unsets / deletes all user-related local state about the extension
     */
    ns.clearState = function () {

        locallyCachedSecret = null;
        kango.storage.removeItem("secret");

        locallyCachedEmail = null;
        kango.storage.removeItem("email");

        locallyCachedRegistrationTime = null;
        kango.storage.removeItem("registration_time");

        locallyCachedInstallId = null;
        kango.storage.removeItem("install_id");

        locallyCachedGroup = null;
        kango.storage.removeItem("group");

        locallyCachedCheckInTime = null;
        kango.storage.removeItem("check_in_time");

        locallyCachedIsDismissed = null;
        kango.storage.removeItem("is_dismissed");
    };

    /**
     * Registers the user with the recording server. This is a two part process,
     * for anonymity reasons.  First we register the email address, and then
     * the extension.  Only if both processes are successful is the current
     * state of the extension modified.
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
                "browser": constants.browser,
                "debug": constants.debug
            },
            contentType: "json"
        }, function (registerResult) {

            if (registerResult.status < 200 ||
                    registerResult.status >= 300 ||
                    !registerResult.response.ok) {
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
                contentType: "json"
            }, function (emailResult) {

                if (emailResult.status < 200 ||
                        emailResult.status >= 300 ||
                        !emailResult.response.ok) {
                    callback(false);
                    return;
                }

                kango.storage.setItem("secret", sjcl.codec.hex.fromBits(sjcl.random.randomWords(8)));
                kango.storage.setItem("email", email);
                kango.storage.setItem("install_id", registerResult.response._id);
                kango.storage.setItem("group", registerResult.response.group);
                kango.storage.setItem("registration_time", utils.now());
                kango.storage.setItem("check_in_time", utils.now());
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
     *   An optional function to call after the heartbeat has been completed, if
     *   needed. The function is called with a single parameter, true if the
     *   recording server was pinged, and false in all other situations (such
     *   as the user not having registered or the user not needing to ping)
    */
    ns.heartbeat = function (callback) {

        // Simple wrapper to allow us to gracefully deal with the case
        // when we don't have a callback function, without wrapping ifs all
        // over the place...
        var callCallback = function (arg) {
            if (callback) {
                callback(arg);
            }
        };

        if (!this.installId()) {
            callCallback(false);
            return;
        }

        if ((this.checkInTime() + constants.heartbeatTime) >= utils.now()) {
            callCallback(false);
            return;
        }

        kango.xhr.send({
            method: "GET",
            url: constants.webserviceDomain + "/email",
            async: true,
            params: {
                "version": constants.version,
                "email": this.email()
            },
            contentType: "json"
        }, function (result) {
            locallyCachedCheckInTime = utils.now();
            kango.storage.setItem("check_in_time", locallyCachedCheckInTime);
            callCallback(result.status >= 200 && result.status < 300);
        });
    };

    /**
     * Records with the recording server that a password field was autocompleted
     *
     * @param string url
     *   The url of the page hosting the autocompleted password field
     * @param function callback
     *   A function to call with the result of the autofill recording request
     *   The function will be called with a single boolean parameter, true if
     *   the server reported recording the event successfully, and false
     *   otherwise.
     */
    ns.recordAutofill = function (url, callback) {

        var installId = this.installId();

        if (!installId) {
            callback(false);
            return;
        }

        kango.xhr.send({
            method: "GET",
            url: constants.webserviceDomain + "/password-autofilled",
            async: true,
            params: {
                "domain": utils.extractDomain(url),
                "url": url,
                "id": installId
            },
            contentType: "json"
        }, function (result) {
            var wasSuccessful = (result.status >= 200 &&
                                    result.status < 300 &&
                                    result.response.ok);
            callback(wasSuccessful);
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
        }, function (result) {
            callback((result.status >= 200 && result.status < 300));
        });
    };
});
