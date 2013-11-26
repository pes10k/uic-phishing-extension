uic(['constants'], function (global, ns) {

    // The base url to make webservice calls against
    ns.webserviceDomain = "http://drano-dev.uicbits.net:8070";

    // How often, in seconds, must pass before a user needs to reauthenticate
    // on a site.
    ns.reauthThreshold = 86400;

    ns.version = 1;

    ns.debug = true;

    ns.browser = (function () {
        return (window.chrome) ? "chrome" : "firefox";
    }());
});
