__UIC(['constants'], function (global, ns) {

    // Whether we're using the extension in development / debug mode.
    // If true, will cause reauthentication and other related behaviors to
    // happen much *more* frequently than they otherwise would
    ns.debug = true;

    // The base url to make webservice calls against
    ns.webserviceDomain = "http://drano-dev.uicbits.net:8070";

    // How often, in seconds, must pass before a user needs to reauthenticate
    // on a site. Occurs every 30 minutes in debug mode, and every 24 hours in
    // normal deployment
    ns.defaultReauthTime = ns.debug ? 1800 : 86400;

    // How often we should update the domian rules, which we set to once a day
    // Occurs every 30 minutes in debug mode, and every 24 hours in
    // normal deployment
    ns.ruleExpirationTime = ns.debug ? 1800 : 86400;

    // The amount of time, in seconds, before the extension will start forcing
    // users to reauth at all. Doesn't sleep at all in debug mode, and waits
    // 24 hours before altering the browsing experience in normal deployment
    ns.extensionSleepTime = ns.debug ? 0 : 86400;

    // The minimum amount of time that needs to pass between pinging the
    // heartbeat server to let the service know that the user is still active
    // Occurs every 30 minutes in debug mode, and every 24 hours in
    // normal deployment
    ns.heartbeatTime = ns.debug ? 1800 : 86400;

    // How long a page stays in a tab's history before its removed.
    // This value affects how often a user will need to reautenticate. If a
    // domain is in any tab's histroy, the user will not need to reauthenticate
    // with that domain.
    ns.pageHistoryTime = 60;

    ns.version = kango.getExtensionInfo().version;

    ns.browser = kango.browser.getName();
});
