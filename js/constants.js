if (!window.uic) {
    window.uic = {};
}

window.uic.constants = {
    // The base url to make webservice calls against
    webserviceDomain: "http://drano-dev.uicbits.net:8070",

    // How often, in seconds, must pass before a user needs to reauthenticate
    // on a site.
    reauthThreshold: 86400,

    version: 1,

    debug: true,

    browser: (function () {
        return (window.chrome) ? "chrome" : "firefox";
    }())
};
