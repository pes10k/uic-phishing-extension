UIC(['models', 'domains'], function (global, ns) {

    var constants = global.constants,
        utils = global.lib.utils,
        currentUser = global.models.user.getInstance(),
        updateTime = null,
        domainRulesRaw = null,
        domainRules = null,
        studyStatus = null,
        updateDomainRules,
        getDomainRulesRaw,
        getDomainRules,
        getParsedDomainRules,
        DomainRule;

    /**
     * Updates the domain rules by calling to the webservice and updating the
     * locally cached version.
     *
     * @param function
     *   A callback function that is called with a single parameter, a boolean
     *   description of whether the domain rules were successfully updated.
     */
    updateDomainRules = function (callback) {

        if (!currentUser.installId()) {
            callback(false);
            return;
        }

        kango.xhr.send({
            method: "GET",
            url: constants.webserviceDomain + "/cookie-rules",
            async: true,
            params: {
                "id": currentUser.installId()
            },
            contentType: "json"
        }, function (result) {

            if (result.status < 200 ||
                    result.status >= 300 ||
                    !result.response.ok) {
                callback(false);
                return;
            }

            updateTime = utils.now();
            kango.storage.setItem("domain_rules_ts", updateTime);

            // The service will return back a json value, describing whether the
            // study is currently active or not
            studyStatus = result.response.active;
            kango.storage.setItem("study_is_active", studyStatus);

            // What we get back from the webservice is JSON, which is what we
            // store locally.  What we use internally though is an object
            // wrapped representation of each domain
            domainRulesRaw = result.response.msg;
            kango.storage.setItem("domain_rules_raw", domainRulesRaw);

            domainRules = null;
            callback(true);
        });
    };

    getDomainRulesRaw = function () {

        if (!domainRulesRaw) {
            domainRulesRaw = kango.storage.getItem("domain_rules_raw");
        }

        return domainRulesRaw;
    };

    /**
     * Returns a set of objects, each representing one of the domain rules that
     * that control the cookies we watch.
     *
     * @return array|null
     *   Returns null if we don't have a local version of cookie / domain rules
     *   to represent, or an array of DomainRule objects otherwise representing
     *   each of the domains we watch.
     */
    getParsedDomainRules = function () {

        var locallyFetchedDomainRules;

        if (domainRules) {
            return domainRules;
        }

        domainRules = [];
        locallyFetchedDomainRules = getDomainRulesRaw();

        locallyFetchedDomainRules.forEach(function (aRawRule) {
            var aParsedRule = new DomainRule(aRawRule);
            domainRules.push(aParsedRule);
        });

        return domainRules;
    };

    /**
     * Returns the domain rules, describing which domains are being watched, and
     * which cookies should be deleted on those domains. This method handles
     * updating the cookies from the webservice if needed.
     *
     * @param callback
     *   A function that will be called with a single parameter, either false
     *   if the domain rules are not available, or an array containing domain
     *   rule objects.
     */
    getDomainRules = function (callback) {

        if (!currentUser.installId()) {
            callback(false);
            return;
        }

        // If we haven't ever updated the domain rules, or the domain rules are
        // out of date (ie the last time we updated the rules was before the
        // expiration date) then try to update the rule. Otherwise, pass back
        // the version of the rules that we have.
        if (!ns.getUpdateTime() ||
                (ns.getUpdateTime() + constants.ruleExpirationTime) < utils.now()) {

            updateDomainRules(function (wasUpdated) {

                // If we unsuccessfully updated the domain rules, we can't do
                // nothing more, so just cut it all out.
                if (!wasUpdated) {
                    callback(false);
                    return;
                }

                // Otherwise, re-parse the raw domain rule data and send that
                // back to the caller
                callback(getParsedDomainRules());
            });
            return;
        }

        // Otherwise, pass back the objects that we have already parsed
        callback(getParsedDomainRules());
        return;
    };

    /* ======================= */
    /* ! Begin Public Methods  */
    /* ======================= */

    /**
     * Returns a boolean description of whether the study is currently active.
     *
     * @param function callback
     *  A function to call with the result of whether the study is currently
     *  active. The function will be called with a single parameter, null if
     *  we're not able to tell if the study is currently active, otherwise a
     *  boolean description of whether the study is active
     */
    ns.isStudyActive = function (callback) {

        getDomainRules(function () {

            if (studyStatus === null) {
                studyStatus = kango.storage.getItem("study_is_active");
            }

            callback(studyStatus);
        });
    };

    /**
     * Returns the unix timestamp of when the domain rules were last updated,
     * or null if the domain rules have never been fetched / updated.
     *
     * @return int
     *   An integer unix timestamp, or null if no domain rules have been fetched
     *   yet.
     */
    ns.getUpdateTime = function () {

        if (updateTime) {
            return updateTime;
        }

        updateTime = kango.storage.getItem("domain_rules_ts");
        return updateTime;
    };

    /**
     * Returns a boolean description of whether the given URL belongs to the
     * domain that we watch and possibly remove users from.
     *
     * @param string url
     *   A url as a string, such as "http://example.org/test.html"
     * @param function callback
     *   A function to call with a single bool parameters, true if the given URL
     *   belongs to one of the domains that we watch and possibly log users out
     *   of, otherwise returns false.
     */
    ns.isDomainOfUrlWatched = function (url, callback) {

        getDomainRules(function (fetchedDomainRules) {

            var i;

            if (!fetchedDomainRules) {
                callback(false);
                return;
            }

            for (i = 0; i < fetchedDomainRules.length; i += 1) {
                if (fetchedDomainRules[i].isMatchingUrl(url)) {
                    callback(true);
                    return;
                }
            }

            callback(false);
            return;
        });
    };

    /**
     * Clears out all persistently stored information managed by the model
     *
     * @param function callback
     *   A function to be called when all persistent information has been
     *   removed.
     */
    ns.clearState = function (callback) {

        utils.debug("Clearing state for all domain rules...");

        getDomainRules(function (rules) {

            if (rules) {
                rules.forEach(function (aRule) {
                    aRule.clearState();
                });
            }

            studyStatus = null;
            kango.storage.removeItem("study_is_active");

            updateTime = null;
            kango.storage.removeItem("domain_rules_ts");

            domainRulesRaw = null;
            kango.storage.removeItem("domain_rules_raw");

            domainRules = null;

            callback();
        });
    };

    /**
    * Returns a boolean description of whether the cookies for a given domain
    * should be altered to have a shorter expiration time.
    *
    * @param string url
    *   A url as a string, such as "http://example.org/test.html"
    * @param string name
    *   The name of the cookie value being set
    * @param function callback
    *   A function to call with two parameters. The first parameters is a bool,
    *   false if the user should not be reauthed for the given url, or the
    *   matching DomainRule object for the URL's domain if the user should
    *   reauth. The second is null if the user should be reauthed, or one of
    *   the following strings:
    *     - "inactive": Indicates that the entire study is currently disabled
    *                   so the user should not be logged out
    *     - "no-rules": Indicates that the user should not be reauthed because
    *                   we were not able to fetch rules describing which domains
    *                   should be reauthed
    *     - "no-match": Indicates that the user should not be reauthed because
    *                   the given url does not match one of the domains that
    *                   that should be reauthed
    *     - "asleep":   Indicates that a domain rule matches and that normally
    *                   the user would be logged out, but that the matching
    *                   domain rule is asleep. In this case, a third argument
    *                   will be passed to the callback, the date that the domain
    *                   rule wakes up
    */
    ns.shouldAlterCookie = function (url, name, callback) {

        getDomainRules(function (fetchedDomainRules) {

            var i,
                reauthReason,
                aDomainRule;

            if (studyStatus === null) {
                studyStatus = kango.storage.getItem("study_is_active");
            }

            if (!studyStatus) {
                callback(false, "inactive");
                return;
            }

            if (!fetchedDomainRules) {
                callback(false, "no-rules");
                return;
            }

            for (i = 0; i < fetchedDomainRules.length; i += 1) {

                aDomainRule = fetchedDomainRules[i];
                reauthReason = aDomainRule.shouldAlterCookie(url, name);

                if (reauthReason === true) {
                    callback(aDomainRule);
                    return;
                }

                if (reauthReason === "asleep") {
                    callback(false, reauthReason, aDomainRule.getWakeTime());
                    return;
                }

                if (reauthReason === "no-name") {
                    callback(false, reauthReason);
                    return;
                }
            }

            callback(false, "no-match");
            return;
        });
    };

    /**
     * Receives an array of cookie descriptions (pairs of urls and names for
     * cookies), and returns the subset of them that correspond to cookies that
     * are being watched by the extension.
     *
     * @param array cookies
     *   An array of arrays, with each contained array having two values in it,
     *   a url that the cookie is set on, and the name of the cookie
     * @param function callback
     *   A function to call when the filtering is complete.  This function will
     *   be called with one argument, an array of zero or more elements from the
     *   provided cookies array that correspond to watched cookies.
     */
    ns.filterWatchedCookies = function (cookies, callback) {

        getDomainRules(function (fetchedDomainRules) {

            var matchingCookies = [];

            if (studyStatus === null) {
                studyStatus = kango.storage.getItem("study_is_active");
            }

            if (!studyStatus) {
                callback(matchingCookies);
                return;
            }

            if (!fetchedDomainRules) {
                callback(matchingCookies);
                return;
            }

            matchingCookies = cookies.filter(function (value) {

                var cookieUrl = value[0],
                    cookieName = value[1];

                return fetchedDomainRules.some(function (aRule) {
                    return (aRule.shouldAlterCookie(cookieUrl, cookieName) === true);
                });
            });

            callback(matchingCookies);
        });
    };

    /**
     * Object representing a single cookie rule. Each instance wraps a domain
     * cookie * rule provided by the recording web service, and helps describe
     * whether we should log users out of the domain.
     */
    DomainRule = function (domainRule) {

        // Human readable name for this domain cookie rule
        this.title = domainRule.title;

        // The domain to watch that cookies are set on.  A string like
        // ".example.org" or ".subdomain.example.org"
        this.domain = domainRule.domain;

        // A list of names of cookies that are session cookies, which need to
        // be manually cleared out whenever one of the watched
        // standard-expiration cookies are deleted.
        this.session_cookies = domainRule.session || [];

        // A list of cookie value names that should be altered to expire
        // earlier than they normally would.  Cookie values here are sets of
        // values, in the form [name, path, isSecure]
        this.cookies = domainRule.cookies;

        // The first time the domain rule is "installed", we want the domain to
        // sleep for a while, a random amount between 4-5 days, before we
        // ever log a user out.
        this.cacheKeyWakeTime = "domain_rule_wake_date::" + this.domain;

        // The first time a domain rule is installed, we also want to delete any
        // cookies that we're watching that area already installed in the
        // client. This values stores whether we've done so for this cookie
        // already.
        this.cacheKeyDeletedCookies = "domain_rule_delete_initial::" + this.domain;

        // The date that this domain rule will become active, lazy loaded,
        // either from a value determined the first time this value is
        // requested, or if that value has already been determined, the
        // previously saved value.
        this.wakeTime = null;

        // We want to clear out any cookies that were in place before we
        // installed the browser extension.
        this.deleteCookies();
    };

    /**
     * Removes the cookies tracked by the given Domain Rule from the current
     * browser session, if it exists.
     *
     * Note that this function will only run once, all future calls to it will
     * be a NOOP until the underlying storage has been cleared
     * (eg this.clearState)
     *
     * @return boolean
     *   Returns true if the method attempted to delete any cookies, otherwise
     *   false.
     */
    DomainRule.prototype.deleteCookies = function () {

        var cookiesModel = global.models.cookies,
            onCookieDelete,
            cookieDomain = this.domain;

        onCookieDelete = function (url, name, wasDeleted, error) {

            var cookieStr = name + "@" + url;

            if (wasDeleted) {
                utils.debug("Successfully deleted cookie: " + cookieStr);
            } else {
                utils.debug("Error deleting " + cookieStr + ": " + error);
            }
        };

        if (kango.storage.getItem(this.cacheKeyDeletedCookies)) {
            utils.debug("Not deleting existing cookies from " + this.domain);
            return false;
        }

        this.cookies.forEach(function (aCookie) {
            var cookieName = aCookie[0],
                cookiePath = aCookie[1],
                cookieIsSecure = aCookie[2],
                cookieProtocol = (cookieIsSecure ? 'https' : 'http'),
                cookieUrl = cookieProtocol + "://" + cookieDomain + cookiePath;
            utils.debug("Attempting to delete " + cookieName + "@" + cookieUrl);
            cookiesModel['delete'](cookieUrl, cookieName, onCookieDelete);
        });

        kango.storage.setItem(this.cacheKeyDeletedCookies, true);
        return true;
    };

    /**
     * Checks to see if the domain rule is asleep / hasn't become active yet.
     *
     * @return bool
     *   Returns true if enough time has passed that the domain rule should
     *   become active, and otherwise false.
     */
    DomainRule.prototype.isAsleep = function () {

        var wakeTime = this.getWakeTime();
        return (wakeTime > utils.now());
    };

    /**
     * Returns a timestamp of when this domain rule should become active.
     *
     * @return int
     *   A unix timestamp describing when the domain rule should become active.
     */
    DomainRule.prototype.getWakeTime = function () {

        var localWakeTime;

        // First check to see if we already have a locally calculated
        // version of this date
        if (this.wakeTime) {
            return this.wakeTime;
        }

        // Next, see if we have a persistantly stored version of the date.
        // If so, load it into memory and return the value
        localWakeTime = kango.storage.getItem(this.cacheKeyWakeTime);
        if (localWakeTime) {
            this.wakeTime = localWakeTime;
            return localWakeTime;
        }

        // Last, if we still haven't been able to find a time that this domain
        // rule should become active, calculate it now and store it
        // persistently.
        localWakeTime = utils.now();
        localWakeTime += constants.domainRuleWakeTimeMin;
        localWakeTime += Math.floor(Math.random() * constants.domainRuleWakeTimeNoise);
        this.wakeTime = localWakeTime;
        kango.storage.setItem(this.cacheKeyWakeTime, localWakeTime);
        return localWakeTime;
    };

    /**
     * Returns a boolean description of whether the current domain rule matches
     * the given URL.
     *
     * @param string url
     *   A url as a string, such as "http://example.org/test.html"
     *
     * @return bool
     *   A boolean description of whether the current domain rule matches the
     *   domain in the given URL.
     */
    DomainRule.prototype.isMatchingUrl = function (url) {

        var extractedDomain = utils.extractDomain(url);

        if (!extractedDomain) {
            return false;
        }

        return (extractedDomain === this.domain);
    };

    /**
    * Returns a boolean description of whether the user should be reauthed for
    * the domain in the given URL.
    *
    * @param string url
    *   A url as a string, such as "http://example.org/test.html"
    * @param string name
    *   The name of the cookie value being set
    *
    * @return string|bool
    *   Either a string describing why the user should not need to reauth
    *   for the given url, or true indicating that the user should be reauthed.
    *   If a string the string will be one of the following values:
    *     - "no-match": Indicates that the user should not be reauthed because
    *                   the given url does not match one of the domains that
    *                   that should be reauthed
    *     - "asleep":   Indicates that the rule would normally have been applied
    *                   to log the user out, but that the rule is still asleep
    *     - "no-name":  Indicates that the cookie should not be altered because
    *                   it is not one of the cookies on this domain we care
    *                   about.
    */
    DomainRule.prototype.shouldAlterCookie = function (url, name) {

        var foundMatchingCookie = false;

        // If the given URL doesn't match the domain this rule affects,
        // then the domain rule doesn't apply
        if (!this.isMatchingUrl(url)) {
            return "no-match";
        }

        // If the current domain rule is asleep, then we know the domain rule
        // does not apply
        if (this.isAsleep()) {
            return "asleep";
        }

        this.cookies.forEach(function (aCookie) {
            var cookieName = aCookie[0];
            if (cookieName === name) {
                foundMatchingCookie = true;
            }
        });

        if (!foundMatchingCookie) {
            return "no-name";
        }

        // If the domain rule matches the domain of the current URL and the
        // domain rule is not asleep, then we know that the domain rule should
        // be applied
        return true;
    };

    /**
     * Removes all state information managed by this object, both from memory
     * and the persistent store.
     */
    DomainRule.prototype.clearState = function () {

        utils.debug("Clearing state for domain rule: " + this.domain);
        kango.storage.removeItem(this.cacheKeyWakeTime);
        kango.storage.removeItem(this.cacheKeyDeletedCookies);
    };

});
