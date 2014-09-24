UIC(['constants'], function constantsModuleLoaded (global, ns) {

    // Whether we're using the extension in development / debug mode.
    // If true, will cause reauthentication and other related behaviors to
    // happen much more frequently than they otherwise would be triggered
    ns.debug = true;

    // The base url to make webservice calls against
    ns.webserviceDomain = ns.debug ? "http://drano-dev.uicbits.net:8070" : "https://uchar16.cs.uic.edu:8443";

    // How often, in seconds, must pass before a user needs to reauthenticate
    // on a site. Occurs every 10 minutes in debug mode, and every 48 hours in
    // normal deployment
    ns.defaultReauthTime = ns.debug ? 86400 : 172800;

    // In order to make detection of the shortend cookie / session length
    // less predictable, some noise is added to the adjusted cookie lenght.
    // The below values are the maximum amount of change / noise, in seconds
    // that will be added to the above `defaultReauthTime`.  The actual
    // value will be selected from (-ns.reauthTimeNoise, ns.reauthTimeNoise)
    ns.reauthTimeNoise = ns.debug ? 360 : 43200;

    // How often we should update the domian rules, which we set to once a day
    // Occurs every 10 minutes in debug mode, and every 24 hours in
    // normal deployment
    ns.ruleExpirationTime = ns.debug ? 600 : 86400;

    // Each domain rule will sleep for a while before waking up
    // and logging users out. This value is the floor of that value (4 days).
    // It is added to the below range value to create the actual amount of
    // time that will need to pass before a domain rule becomes active.
    ns.domainRuleWakeTimeMin = ns.debug ? 0 : 345600;

    // When a domain rule is downlaoded / installed for the first time,
    // the date of when the rule should become active by adding the above
    // domainRuleWakeTimeMin value to a randomly determined value, taken
    // between 0 and the below value.
    ns.domainRuleWakeTimeNoise = ns.debug ? 0 : 86400;

    // The minimum amount of time that needs to pass between pinging the
    // heartbeat server to let the service know that the user is still active
    // Occurs every 10 minutes in debug mode, and every hour in
    // normal deployment
    ns.heartbeatTime = ns.debug ? 3600 : 3600;

    ns.version = kango.getExtensionInfo ? kango.getExtensionInfo().version : null;

    ns.browser = kango.browser ? kango.browser.getName() : null;
});
