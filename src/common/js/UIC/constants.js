__UIC(['constants'], function (global, ns) {

    // Whether we're using the extension in development / debug mode.
    // If true, will cause reauthentication and other related behaviors to
    // happen much more frequently than they otherwise would be triggered
    ns.debug = true;

    // The base url to make webservice calls against
    ns.webserviceDomain = ns.debug ? "http://drano-dev.uicbits.net:8070" : "http://23.23.163.147:8080";

    // How often, in seconds, must pass before a user needs to reauthenticate
    // on a site. Occurs every 10 minutes in debug mode, and every 48 hours in
    // normal deployment
    ns.defaultReauthTime = ns.debug ? 600 : 172800;

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
    ns.domainRuleWakeTimeRange = ns.debug ? 600 : 86400;

    // The minimum amount of time that needs to pass between pinging the
    // heartbeat server to let the service know that the user is still active
    // Occurs every 10 minutes in debug mode, and every 12 hours in
    // normal deployment
    ns.heartbeatTime = ns.debug ? 600 : 43200;

    // How long a page stays in a tab's history before its removed.
    // This value affects how often a user will need to reautenticate. If a
    // domain is in any tab's histroy, the user will not need to reauthenticate
    // with that domain.
    ns.pageHistoryTime = 60;

    ns.version = kango.getExtensionInfo().version;

    ns.browser = kango.browser.getName();
});
