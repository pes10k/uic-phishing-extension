__UIC(['models', 'domains'], function (global, ns) {

var constants = global.constants,
    currentUser = global.models.user.getInstance(),
    _updateTime = null,
    _domainRulesRaw = null,
    _domainRules = null,
    DomainRule;

/**
 * Updates the domain rules by calling to the webservice and updating the
 * locally cached version.
 *
 * @param function
 *   A callback function that is called with a single parameter, a boolean
 *   description of whether the domain rules were successfully updated.
 */
ns._updateDomainRules = function (callback) {

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

        if (result.status < 200 || result.status >= 300) {
            callback(false);
            return;
        }

        _updateTime = global.utils.now();
        kango.storage.setItem("domain_rules_ts", _updateTime);

        // What we get back from the webservice is JSON, which is what we
        // serialize and store locally.  What we use internally though
        // is an object wrapped representation of each domain
        _domainRulesRaw = result.response;
        kango.storage.setItem("domain_rules_raw", _domainRulesRaw);

        _domainRules = null;
        callback(true);
    });
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
ns._parsedDomainRules = function () {

    var i;

    if (_domainRules) {
        return _domainRules;
    }

    _domainRules = [];
    for (i = 0; i < _domainRulesRaw.length; i++) {
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
ns._getDomainRules = function (callback) {

    if (!currentUser.installId()) {
        callback(false);
        return;
    }

    // If we haven't ever update the domain rules, or the domain rules are
    // out of date (ie the last time we updated the rules was before the
    // expiration date) then try to update the rule. Otherwise, pass back the
    // version of the rules that we have.
    if (!this.getUpdateTime() ||
        (this.getUpdateTime() + constants.ruleExpirationTime) < global.utils.now()) {

        this._updateDomainRules(function (wasUpdated) {

            // If we unsuccesfully updated the domain rules, we can't do
            // nothing more, so just cut it all out.
            if (!wasUpdated) {
                callback(false);
                return;
            }

            // Otherwise, reparse the raw domain rule data and send that
            // back to the caller
            callback(ns._parsedDomainRules());
        });
        return;
    }

    // Otherwise, pass back the objects that we have already parsed
    callback(ns._parsedDomainRules());
    return;
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

    this._getDomainRules(function (fetchedDomainRules) {

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
 *   A function to call with a single parameter, false if the user should
 *   not be reauthed for the given url, or the matching DomainRule object
 *   for the URL's domain if the user should reauth.
 */
ns.shouldReauthForUrl = function (url, callback) {

    this._getDomainRules(function (fetchedDomainRules) {

        var i;

        if (!fetchedDomainRules) {
            callback(false);
            return;
        }

        for (i = 0; i < fetchedDomainRules.length; i++) {
            if (fetchedDomainRules[i].shouldReauthForUrl(url)) {
                callback(fetchedDomainRules[i]);
                return;
            }
        }

        callback(false);
        return;
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

    // Stores, as seconds, the maximum amount of time that should pass
    // between logging a user out of a domain.
    this.reauthTime = domainRule.reauthTime || constants.defaultReauthTime;
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

    if (this._lastReauthTime === null) {
        return this._lastReauth;
    }

    this._lastReauthTime = kango.storage.getItem("domain_rule::" + this.domain);
    return this._lastReauth;
};

/**
 * Sets the unix timestamp of when when the user was logged out of this domain
 *
 * @param int timestamp
 *   A unix timestamp
 */
DomainRule.prototype.setLastReauthTime = function (timestamp) {
    this._lastReauthTime = timestamp;
    kango.storage.setItem("domain_rule::" + this.domain, timestamp);
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
 * @return bool
 *   A boolean description of whether the user should reauth for the domain
 */
DomainRule.prototype.shouldReauthForUrl = function (url) {

    if (!this.isMatchingUrl(url)) {
        return false;
    }

    if (this.getLastReauthTime() === null) {
        return true;
    }

    if (this.getLastReauthTime() + this.reauthTime < global.utils.now()) {
        return true;
    }

    return false;
};

});
