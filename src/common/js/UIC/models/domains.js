__UIC(['models', 'domains'], function (global, ns) {

var constants = global.constants,
    currentUser = global.models.user.getInstance(),
    _updateTime = null,
    _domainRulesRaw = null,
    _domainRules = null,
    _studyStatus = null,
    _updateDomainRules,
    _getDomainRulesRaw,
    _getDomainRules,
    _getParsedDomainRules,
    DomainRule;

/**
 * Updates the domain rules by calling to the webservice and updating the
 * locally cached version.
 *
 * @param function
 *   A callback function that is called with a single parameter, a boolean
 *   description of whether the domain rules were successfully updated.
 */
_updateDomainRules = function (callback) {

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
        contentType: "json",
    },
    function (result) {

        if (result.status < 200 || result.status >= 300 || !result.response.ok) {
            callback(false);
            return;
        }

        _updateTime = global.utils.now();
        kango.storage.setItem("domain_rules_ts", _updateTime);

        // The service will return back a json value, describing whether the
        // study is currently active or not
        _studyStatus = result.response.active;
        kango.storage.setItem("study_is_active", _studyStatus).

        // What we get back from the webservice is JSON, which is what we
        // serialize and store locally.  What we use internally though
        // is an object wrapped representation of each domain
        _domainRulesRaw = result.response.msg;
        kango.storage.setItem("domain_rules_raw", _domainRulesRaw);

        _domainRules = null;
        callback(true);
    });
};

_getDomainRulesRaw = function () {

    if (!_domainRulesRaw) {
        _domainRulesRaw = kango.storage.getItem("domain_rules_raw");
    }

    return _domainRulesRaw;
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
_getParsedDomainRules = function () {

    var i,
        locallyFetchedDomainRules;

    if (_domainRules) {
        return _domainRules;
    }

    _domainRules = [];
    locallyFetchedDomainRules = _getDomainRulesRaw();
    for (i = 0; i < locallyFetchedDomainRules.length; i++) {
        _domainRules.push(new DomainRule(_domainRulesRaw[i]));
    }
    return _domainRules;
};

/**
 * Returns the domain rules, describing which domains are being watched, and
 * which cookies should be deleted on those domains. This method handles
 * updating the cookies from the webservice if needed.
 *
 * @param callback
 *   A function that will be called with a single parameter, either false
 *   if the domain rules are not available, or an array containing domain rule
 *   objects.
 */
_getDomainRules = function (callback) {

    if (!currentUser.installId()) {
        callback(false);
        return;
    }

    // If we haven't ever update the domain rules, or the domain rules are
    // out of date (ie the last time we updated the rules was before the
    // expiration date) then try to update the rule. Otherwise, pass back the
    // version of the rules that we have.
    if (!ns.getUpdateTime() ||
        (ns.getUpdateTime() + constants.ruleExpirationTime) < global.utils.now()) {

        _updateDomainRules(function (wasUpdated) {

            // If we unsuccesfully updated the domain rules, we can't do
            // nothing more, so just cut it all out.
            if (!wasUpdated) {
                callback(false);
                return;
            }

            // Otherwise, reparse the raw domain rule data and send that
            // back to the caller
            callback(_getParsedDomainRules());
        });
        return;
    }

    // Otherwise, pass back the objects that we have already parsed
    callback(_getParsedDomainRules());
    return;
};

/* ======================= */
/* ! Begin Public Methods  */
/* ======================= */

/**
 * Returns a boolean description of whether the study is currently active.
 *
 * @return bool|nulll
 *   Returns null if we're not able to tell if the study is currently active,
 *   and otherwise a boolean description of whether the study is active
 */
ns.isStudyActive = function () {

    if (_studyStatus === null) {
        _studyStatus = kango.storage.getItem("study_is_active");
    }

    return _studyStatus;
};

/**
 * Returns the unix timestamp of when the domain rules were last updated,
 * or null if the domain rules have never been fetched / updated.
 *
 * @return
 *   An integer unix timestamp, or null if no domain rules have been fetched
 *   yet.
 */
ns.getUpdateTime = function () {

    if (_updateTime) {
        return _updateTime;
    }

    _updateTime = kango.storage.getItem("domain_rules_ts") || null;
    return _updateTime;
};

/**
 * Returns a boolean description of whether the given URL belongs to the domain
 * that we watch and possibly remove users from.
 *
 * @param string url
 *   A url as a string, such as "http://example.org/test.html"
 * @param function callback
 *   A function to call with a single bool parameters, true if the given URL
 *   belongs to one of the domains that we watch and possibly log users out of,
 *   otherwise returns false.
 */
ns.isDomainOfUrlWatched = function (url, callback) {

    _getDomainRules(function (fetchedDomainRules) {

        var i;

        if (!fetchedDomainRules) {
            callback(false);
            return;
        }

        for (i = 0; i < fetchedDomainRules.length; i++) {
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
 * Returns a boolean description of whether the user should need to reauth
 * for the domain serving the given URL.
 *
 * @param string url
 *   A url as a string, such as "http://example.org/test.html"
 * @param function callback
 *   A function to call with two parameters. The first parameters is a bool,
 *   false if the user should not be reauthed for the given url, or the matching
 *   DomainRule object for the URL's domain if the user should reauth.
 *   The second is null if the user should be reauthed, or one of the following
 *   strings:
 *     - "no-rules": Indicates that the user should not be reauthed because
 *                   we were not able to fetch rules describing which domains
 *                   should be reauthed
 *     - "no-match": Indicates that the user should not be reauthed because
 *                   the given url does not match one of the domains that
 *                   that should be reauthed
 *     - "no-time":  Indicates that the user should not be reauthed because
 *                   the user was already made to reauth on this domain
 *                   recently
 *     - "asleep":   Indicates that a domain rule matches and that normally
 *                   the user would be logged out, but that the matching
 *                   domain rule is asleep
 */
ns.shouldReauthForUrl = function (url, callback) {

    _getDomainRules(function (fetchedDomainRules) {

        var i,
            reauthRs;

        if (!fetchedDomainRules) {
            callback(false, "no-rules");
            return;
        }

        for (i = 0; i < fetchedDomainRules.length; i++) {
            reauthRs = fetchedDomainRules[i].shouldReauthForUrl(url);
            if (reauthRs === true) {
                callback(fetchedDomainRules[i]);
                return;
            } else if (reauthRs === "no-time" || reauthRs === "asleep") {
                callback(false, reauthRs);
                return;
            }
        }

        callback(false, "no-match");
        return;
    });
};

/**
 * Clears out all persistantly stored information managed by the model
 *
 * @param function callback
 *   A function to be called when all persistant information has been removed
 */
ns.clearState = function (callback) {

    _getDomainRules(function (rules) {

        var i;

        if (rules) {

            for (i = 0; i < rules.length; i++) {
                rules[i].clearState();
            }
        }

        _studyStatus = null;
        kango.storage.removeItem("study_is_active");

        _updateTime = null;
        kango.storage.removeItem("domain_rules_ts");

        _domainRulesRaw = null;
        kango.storage.removeItem("domain_rules_raw");

        _domainRules = null;

        callback();
    });
};

/**
 * Object representing a single cookie rule. Each instance wraps a domain cookie
 * rule provided by the recording web service, and helps describe whether we
 * should log users out of the domain.
 */
DomainRule = function (domainRule) {
    this.title = domainRule.title;
    this.domain = domainRule.domain;
    this.cookies = domainRule.cookies;

    // Keeps track of when the last time the user was logged out of this domain.
    // The true value is stored in local storage, but also provide a local
    // memory version to make checks faster.
    this._lastReauthTime = null;

    // A key used to store persistant information about the domain, and when
    // the user was last reauthed on the domain.
    this._cacheKeyLastTime = "domain_rule::" + this.domain;

    // The first time the domain rule is "installed", we want the domain to
    // sleep for a while, a random amount between 4-5 days, before we
    // ever log a user out.
    this._cacheKeyWakeTime = "domain_rule_wake_date::" + this.domain;

    // Stores, as seconds, the maximum amount of time that should pass
    // between logging a user out of a domain, once the domain
    // is out of sleep time.
    this._reauthInterval = domainRule.reauthTime || constants.defaultReauthTime;

    // The date that this domain rule will become active, lazy loaded, either
    // from a value determined the first time this value is requested,
    // or if that value has already been determined, the previously saved
    // value.
    this._wakeTime = null;
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
    if (this._wakeTime) {
        return this._wakeTime;
    }

    // Next, see if we have a persistantly stored version of the date.
    // If so, load it into memory and return the value
    localWakeTime = kango.storage.getItem(this._cacheKeyWakeTime);
    if (localWakeTime) {
        this._wakeTime = localWakeTime;
        return localWakeTime;
    }

    // Last, if we still haven't been able to find a time that this domain rule
    // should become active, calculate it now and store it persistantly.
    localWakeTime = global.utils.now();
    localWakeTime += constants.domainRuleWakeTimeMin;
    localWakeTime += Math.floor(Math.random() * constants.domainRuleWakeTimeRange);
    this._wakeTime = localWakeTime;
    kango.storage.setItem(this._cacheKeyWakeTime, localWakeTime);
    return localWakeTime;
};

/**
 * Checks to see if the domain rule is asleep / hasn't become active yet.
 *
 * @return bool
 *   Returns true if enough time has passed that the domain rule should become
 *   active, and otherwise false.
 */
DomainRule.prototype.isAsleep = function () {

    var wakeTime = this.getWakeTime();
    return (wakeTime > global.utils.now());
};

/**
 * Returns a unix timestamp of the last time we logged a user out of this
 * domain. Lazy loads the value from the backing store as needed.
 *
 * @return int|null
 *   Returns the unix timestamp for the last time the user was logged out
 *   of this domain, or null if that has never happened.
 */
DomainRule.prototype.getLastReauthTime = function () {

    if (!this._lastReauthTime) {
        this._lastReauthTime = kango.storage.getItem(this._cacheKeyLastTime);
    }

    return this._lastReauthTime;
};

/**
 * Sets the unix timestamp of when when the user was logged out of this domain
 *
 * @param int timestamp
 *   A unix timestamp
 */
DomainRule.prototype.setLastReauthTime = function (timestamp) {
    this._lastReauthTime = timestamp;
    kango.storage.setItem(this._cacheKeyLastTime, timestamp);
};

/**
 * Returns a boolean description of whether the current domain rule matches
 * the given URL.
 *
 * @param string url
 *   A url as a string, such as "http://example.org/test.html"
 *
 * @return bool
 *   A boolean description of whether the current domain rule matches the domain
 *   in the given URL.
 */
DomainRule.prototype.isMatchingUrl = function (url) {

    var extractedDomain = global.utils.extractDomain(url);

    if (!extractedDomain) {
        return false;
    }

    return (extractedDomain.indexOf(this.domain) !== -1);
};

/**
 * Returns a boolean description of whether the user should be reauthed for the
 * domain in the given URL.
 *
 * @param string url
 *   A url as a string, such as "http://example.org/test.html"
 *
 * @return string|bool
 *   Either a string describing why the user should not need to reauth
 *   for the given url, or true indicating that the user should be reauthed.
 *   If a string the string will be one of the following values:
 *     - "no-match": Indicates that the user should not be reauthed because
 *                   the given url does not match one of the domains that
 *                   that should be reauthed
 *     - "no-time":  Indicates that the user should not be reauthed because
 *                   the user was already made to reauth on this domain
 *                   recently
 *     - "asleep":   Indicates that the rule would normally have been applied
 *                   to log the user out, but that the rule is still asleep
 */
DomainRule.prototype.shouldReauthForUrl = function (url) {

    // If the given URL doesn't match the domain this rule affects,
    // then the domain rule doesn't apply
    if (!this.isMatchingUrl(url)) {
        return "no-match";
    }

    // If the current domain rule is asleep, then we know the domain rule
    // doe not apply
    if (this.isAsleep()) {
        return "asleep";
    }

    // If the domain rule matches the domain of the current URL and the domain
    // rule is not alseep, then we know that the domain rule should be applied
    if (this.getLastReauthTime() === null) {
        return true;
    }

    // If the domain rule has been appled (ie the above condition fails),
    // but enough time has passed since the domain rule fired previously
    // that the domain rule should be applied again, then we're done
    if (this.getLastReauthTime() + this._reauthInterval < global.utils.now()) {
        return true;
    }

    // Otherwise, if the url belongs to the watched domain and the domain rule
    // is not asleep, and the domain rule has fired before, but enough time
    // hasn't passed for it to fire again, then we don't act, since we need
    // to wait for more time
    return "no-time";
};

/**
 * Removes all state information managed by this object, both from memory
 * and the persistant store.
 */
DomainRule.prototype.clearState = function () {
    kango.storage.removeItem(this._cacheKeyLastTime);
    kango.storage.reauthRs(this._cacheKeyWakeTime);
    this._lastReauthTime = null;
};

});
