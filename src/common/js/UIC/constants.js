__UIC(['constants'], function (global, ns) {

    // The base url to make webservice calls against
    ns.webserviceDomain = "http://drano-dev.uicbits.net:8070";

    // How often, in seconds, must pass before a user needs to reauthenticate
    // on a site. Currently set to 48 hrs
    ns.defaultReauthTime = 172800; // 60 * 60 * 24 * 2

    // How often we should update the domian rules, which we set to once a day
    ns.ruleExpirationTime = 86400; // 60 * 60 * 24

    // The amount of time, in seconds, before the extension will start forcing
    // users to reauth at all.
    ns.extensionSleepTime = 86400; // 60 * 60 * 24

    // The minimum amount of time that needs to pass between pinging the
    // heartbeat server to let the service know that the user is still active
    ns.heartbeatTime = 86400; // 60 * 60 * 24

    // How long a page stays in a tab's history before its removed.
    // This value affects how often a user will need to reautenticate. If a
    // domain is in any tab's histroy, the user will not need to reauthenticate
    // with that domain.
    ns.pageHistoryTime = 60;

    ns.version = 1;

    ns.debug = false;

    ns.browser = kango.browser.getName();
});
