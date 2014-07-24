/**
 * Various misc utitily that are useful though out the extension, but
 * don't fall neatly into a single model etc.
 */
__UIC(['lib', 'utils'], function (global, ns) {

var constants = global.constants;

/**
 * Returns the current date, as a unix timestamp integer.  Precision is an
 * integer measure of full seconds, instead of the milisecond count commonly
 * used in javascript dates.
 *
 * @return int
 *   A unix timestamp
 */
ns.now = function () {
    return Math.floor(Date.now() / 1000);
};

/**
 * Records a debugging message to whatever Kango is using for log writing
 * (usually an alias to console.log).
 *
 * @param string msg
 *   The debug message to write to the logs
 * @param KangoBrowserTab tag
 *   An optional tab instance, regarding where the event being logged
 *   occured.  If included, additional information about the tab
 *   will be included in the logs.
 */
ns.debug = function (msg, tab) {

    if (typeof msg === "object") {
        kango.console.log(msg);
        return;
    }

    var tabDesc = tab ? " [" + tab.getId() + ":" + tab.getUrl() + "]" : "";
    if (constants.debug) {
        kango.console.log(msg + tabDesc);
    }
};

/**
 * Returns the domain of a given url string.
 *
 * @param string url
 *   A proper url (ex http://example.org/index.html)
 *
 * @return string
 *   The domain portion of the given url (ex "example.org")
 */
ns.extractDomain = function (url) {
    return parseUri(url)['host'];
};

/**
 * Formats a unix timestamp into a human readable date string,
 * using the currnet locals settings.
 *
 * @param int timestamp
 *   A unix timestamp, with second level granularity.
 *
 * @return string
 *   A human readable version of the same date
 */
ns.timestampToString = function (timestamp) {
    var aDate = new Date(timestamp * 1000);
    return aDate.toLocaleDateString() + " " + aDate.toLocaleTimeString();
};

});
