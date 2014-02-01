__UIC(["models", "tabs"], function (global, ns) {

var _now = global.utils.now,
    PageView,
    RecentTabHistory,
    TabsCollection,
    _sharedTabsCollectionInstance;

/**
 * Constructor function, uses for creating objects that wrap up individal
 * page views (with a url and a timestamp) representing a single page
 * view in a tab in the current browsing session.
 *
 * The class also includes functionality for seeing if the page view
 * happened recently or before a given cuttof date (by default one)
 * minute ago
 *
 * @param int secTillExpiration
 *   The amount of time, in seconds, that a url should stay in the history
 *   before its removed / garbage collected
 */
PageView = function (url, secTillExpiration) {

    this.url = url;
    this.unixtime = _now();

    // Default to an expiration time of 60 seconds
    this.secTillExpiration = secTillExpiration || 60;

    // This will be lazy loaded, if needed
    this._domain = null;
};

PageView.prototype.isExpired = function () {
    return (this.unixtime + this.secTillExpiration) > _now();
};

PageView.prototype.domain = function () {

    var extractedDomain;

    if (!this._domain) {
        this._domain = global.utils.extractDomain(this.url);
    }

    return this._domain;
};

/**
 * Constructor function use for keeping track for the recent history
 * of which pages have been recently visited in a given tab (each
 * instance of this class represents a single tab).
 * Page views in the tab are represented by the above defined
 * PageView instances.
 *
 * The history tacked is loosly bounded with a time cut off, so that page
 * views that happened more than a given time ago (by default 60 seconds)
 * is excluded and not considered in this tabs history anymore.
 */
RecentTabHistory = function (secTillExpiration) {

    // Pages will be added, oldest to newest, so the first element
    // will be the oldest. It is extremely unlikely that this element
    // will ever get longer than a few elements (1-3 or so)
    this.pages = [];
    this.secTillExpiration = secTillExpiration || 60;
};

/**
 * Removes old page items that were entered before the set "seconds until
 * expiration" parameter. This will always leave at least one page (the current
 * page) in the history of each tab.
 *
 * @return int
 *   The number of pages that were removed / expired from the collection
 */
RecentTabHistory.prototype.garbageCollect = function () {

    var count = 0;

    // Since the oldest page is first on the list, we can just "pop" items
    // of the front of the array until we hit one thats still alive.
    // Note that at least one item is always left in the tab history,
    // so that even if a user has been on the current page for a long
    // time, the current page will always be in the history
    while (this.pages.length > 1 && this.pages[0].isExpired()) {
        this.pages.shift();
        count += 1;
    }

    return count;
};

RecentTabHistory.prototype.addUrl = function (url) {

    this.garbageCollect();
    this.pages.push(new PageView(url, this.secTillExpiration));
};

/**
 * Returns a boolean description of whether the given domain has been
 * visited in the recent history of the tab. The given value should
 * be a valid domain (example.org) w/o protocol or path information (but
 * with port info, if needed).
 *
 * @param string domain
 *   A domain to search for in the managed tab history
 *
 * @return bool
 *   true if the domain is in the recent history of any of the managed tabs,
 *   and otherwise false
 */
RecentTabHistory.prototype.isDomainInHistory = function (domain) {

    var match = false;

    this.pages.forEach(function (aPage) {

        if (!match && aPage.domain() === domain) {
            match = true;
        }
    });

    return match;
};

/**
 * Returns a boolean description of whether the domain associated with a
 * given url has been seen on this tab recently. The given value can be
 * any valid url.
 *
 * @param string url
 *   A full, absolute url being visited by a tab
 *
 * @return bool
 *   false if the given URL can't be parsed, or the domain of the given URL
 *   is not in the tab's recent history. Otherwise, true.
 */
RecentTabHistory.prototype.isDomainForUrlInHistory = function (url) {

    var rs = domainExtractor.exec(url);
    return (rs.length > 1) ? this.isDomainInHistory(rs[1]) : false;
};

/**
 * TabsCollection objects describe the entire collection of tabs showing
 * in the current browser process.
 *
 * @param int secTillExpiration
 *   The amount of time, in seconds, that a url should stay in the history
 *   before its removed / garbage collected
 */
TabsCollection = function (secTillExpiration) {

    // Stores a mapping of unique tab identifiers with RecentTabHistory
    // objects, describing which pages have recently been viewed in
    // each tab.
    this.tabs = {};
    this.secTillExpiration = secTillExpiration || 60;
};

/**
 * Removes a given tab from the collection of watched tabs. Returns a
 * boolean description of whether the requested tab was removed.
 *
 * @param string|int tabId
 *   The unique identifier of a tab being observered
 *
 * @return bool
 *   true if the given tabId matches a tab being managed by the collection, and
 *   so a tab was able to be removed. Otherwise, false.
 */
TabsCollection.prototype.removeTab = function (tabId) {

    if (!this.tabs[tabId]) {

        return false;

    } else {

        delete this.tabs[tabId];
        return true;

    }
};

/**
 * Creates a new tab in the managed tab collection, associated with the
 * given tabId. This ID must be unique.
 *
 * Method returns a boolean description of whether a new RecentTabHistory
 * object was successfully added to the collection (ie either the given
 * tabId was *not* already associated with a RecentTabHistory object
 *
 * @param string|int tabId
 *   The unique identifier of a tab being observered
 *
 * @return bool
 *    Returns true if the given tabId does not match any tabs currently being
 *    managed by the TabsCollection object, and so a new tab was added to the
 *    collection. Otherwise, false.
 */
TabsCollection.prototype.addTab = function (tabId) {

    if (this.tabs[tabId]) {

        return false;

    } else {

        this.tabs[tabId] = new RecentTabHistory(this.secTillExpiration);
        return true;

    }
};

/**
 * Records that a new url is being visited on a given tab. Returns a
 * boolean description of whether the url was succesfully added to
 * a tab's history (ie whether the given tabId matched a managed tab)
 *
 * @param string url
 *   A full, absolute url being visited by a tab
 * @param string|int tabId
 *   The unique identifier of a tab being observered
 *
 * @return bool
 *    true if the tabId was found in the list of watched tabs, and the url
 *    was added to that tab's history. In all other cases, false.
 */
TabsCollection.prototype.addUrlToTab = function (url, tabId) {

    if (!this.tabs[tabId]) {

        return false;

    } else {

        this.tabs[tabId].addUrl(url);
        return true;

    }
};

/**
 * Checks to see if the domain for the provided url is in the (recent)
 * history for any tabs being managed. Returns an array, containing each
 * unique identifier for each tab that has the url's domain in its
 * history.
 *
 * If we weren't able to extract a domain from the given URL for whatever
 * reason, null is returned.
 *
 * @param string url
 *   A full, absolute url
 *
 * @return
 *   An array of RecentTabHistory objects, each represeting the history of a
 *   tab that has recently visited the domain serving the resource represented
 *   by the provided url
 */
TabsCollection.prototype.tabHistoriesContainingDomainForUrl = function (url) {

    var extractedDomain = global.utils.extractDomain(url),
        aTabId,
        tabIdsWithDomain = [];

    if (!extractedDomain) {

        return null;

    } else {

        for (aTabId in this.tabs) {

            if (this.tabs[aTabId].isDomainInHistory(extractedDomain)) {
                tabIdsWithDomain.push(aTabId);
            }
        }

        return tabIdsWithDomain;
    }
};

ns.TabsCollection = TabsCollection;

/**
 * Returns a singleton instance of a TabsCollection object, used to
 * wrap / track the history of all tabs in the browser.
 */
ns.getInstance = function () {

    if (!_sharedTabsCollectionInstance) {
        _sharedTabsCollectionInstance = new TabsCollection();
    }

    return _sharedTabsCollectionInstance;
};

});
