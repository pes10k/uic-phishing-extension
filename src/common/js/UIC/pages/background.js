__UIC(['pages', 'background'], function (global, ns) {

var constants = global.constants,
    models = global.models,
    currentUser = models.user.getInstance(),
    domainModel = models.domains.getInstance(),
    // Because of the order that Kango loads platform specific libraries,
    // we lazy load the cookie model when we need it, instead of right away,
    // since this file will always be loaded first (since its platform
    // agnostic)
    cookiesModel = null,
    tabManager = new models.tabs.TabsCollection(constants.pageHistoryTime),
    _tabCouldReauth = {},
    _now = global.utils.now;

/**
 * When ever a user opens a new tab, we need to add that tab to the tab
 * manager we use to track tab behavior
 */
kango.browser.addEventListener(kango.browser.event.TAB_CREATED, function (event) {
    tabManager.addTab(event.tabId);
    _tabCouldReauth[event.tabId] = false;
});

/**
 * Similarly, whenever a user closes a tab, we don't need to watch it anymore,
 * so remove it from the collection of watched / tracked tabs.
 */
kango.browser.addEventListener(kango.browser.event.TAB_REMOVED, function (event) {
    tabManager.removeTab(event.tabId);
    delete _tabCouldReauth[event.tabId];
});

/**
 * Whenever we're about to visit a new page, before the content has been loaded,
 * we check the recent tab history to see if this content has been visited
 * recently in any tab. We then keep track of whether this page has been visited
 * in recent history locally.
 */
kango.browser.addEventListener(kango.browser.event.BEFORE_NAVIGATE, function (event) {

    var tabId = event.target.getId(),
        url = event.url;

    _tabCouldReauth[tabId] = (tabManager.isDomainForUrlInHistory(url).length === 0);
    tabManager.addPageToTab(tabId, url);
});

/**
 * On each page load the the content page will ask the extension if the user
 * has registred the extension.
 *
 * If so, heartbeat ping back to the recording server if needed. Reply to
 * the content page with "registered"
 *
 * If not, send a message back to the content page instructing it to display
 * the "you have not registered yet" message.  Reply to the content page
 * with "alert"
 */
kango.addMessageListener("check-for-registration", function (event) {

    var tab = event.target;

    if (!currentUser.installId()) {
        tab.dispatchMessage("response-for-registration", "alert");
    } else {
        currentUser.heartbeat(function () {});
        tab.dispatchMessage("response-for-registration", "registered");
    }
});

/**
 * Content pages will ask the background page on each page load whether they
 * should force the user to reauth for the current site.  The answer will be
 * true if all the below conditions have been met:
 *
 *  - The user has registered the extension (ie there is an installId)
 *  - The domain has not been recently visited in the current session
 *  - The user is in the expermient group OR we're in debug mode
 *  - It has been at least a given period of time since the user registered
 *    the extension
 *  - The current domain is one that we're watching and its been a while since
 *    we've forced the user to reauth
 */
kango.addMessageListener("check-for-reauth", function (event) {

    var tab = event.target,
        tabId = tab.getId(),
        url = tab.getUrl();

    if (!currentUser.installId()) {
        tab.dispatchMessage("response-for-reauth", false);
        return;
    }

    if (!_tabCouldReauth[tabId]) {
        tab.dispatchMessage("response-for-reauth", false);
        return;
    }

    if (!constants.debug && !currentUser.isExperimentGroup()) {
        tab.dispatchMessage("response-for-reauth", false);
        return;
    }

    if (!constants.debug && (currentUser.registrationTime() + constants.extensionSleepTime) > _now()) {
        tab.dispatchMessage("response-for-reauth", false);
        return;
    }

    domainModel.shouldReauthForUrl(url, function (shouldReauth) {

        if (!shouldReauth) {
            tab.dispatchMessage("response-for-reauth", false);
        } else {
            shouldReauth.setLastReauthTime(_now());
            tab.dispatchMessage("response-for-reauth", shouldReauth.title);
        }
    });
});

/**
 * Content pages will notify the extension whenever the user has started to
 * populate a password field. If the user has registered the extension, we
 * just notify the recording server with the user's install id.
 */
kango.addMessageListener("password-entered", function (event) {

    if (!currentUser.installId()) {
        return;
    }

    kango.xhr.send({
        method: "GET",
        url: constants.webserviceDomain + "/password-entered",
        async: true,
        params: {
            "id": currentUser.installId()
        },
        contentType: "json",
    },
    function (result) {});
});

/**
 * For the configuration page, listen for requests to fetch, set, and clear
 * the current extension configuration.
 */
kango.addMessageListener("request-for-config", function (event) {

    var configuration = {},
        tab = event.target;

    configuration["installId"] = currentUser.installId();
    configuration["registrationTime"] = currentUser.registrationTime();
    configuration["checkInTime"] = currentUser.checkInTime();
    configuration["email"] = currentUser.email();

    tab.dispatchMessage("response-for-config", configuration);
});

kango.addMessageListener("request-set-email", function (event) {

    var tab = event.target,
        email = event.data;

    currentUser.registerUser(email, function (wasSuccess) {
        tab.dispatchMessage("response-set-email", wasSuccess);
    });
});

kango.addMessageListener("request-reset-config", function (event) {

    var tab = event.target;
    currentUser.clearState();
    tab.dispatchMessage("response-reset-config", true);
});

});
