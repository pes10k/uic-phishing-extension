__UIC(['constants'], function (global, ns) {

    // The base url to make webservice calls against
    ns.webserviceDomain = "http://drano-dev.uicbits.net:8070";

    // How often, in seconds, must pass before a user needs to reauthenticate
    // on a site.
    ns.reauthThreshold = 60;

    // How long a page stays in a tab's history before its removed.
    // This value affects how often a user will need to reautenticate. If a
    // domain is in any tab's histroy, the user will not need to reauthenticate
    // with that domain.
    ns.pageHistoryTime = 60;

    ns.version = 1;

    ns.debug = false;

    ns.browser = (function () {
        return (window.chrome) ? "chrome" : "firefox";
    }());
});
