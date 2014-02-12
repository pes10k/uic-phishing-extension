__UIC(["lib", "histogram"], function (global, ns) {

var Histogram,
    HourHistogram;

Histogram = function () {
    this._bins = {};
};

/**
 * Add elements to a given histogram
 *
 * @param mixed bin
 *   Add a value to a given bin
 * @param number amount
 *   The amount to add to a bin, defaults to 1
 */
Histogram.prototype.add = function (bin, amount) {

    var addAmount = amount || 1;

    if (!this._bins[bin]) {
        this._bins[bin] = 0;
    }

    this._bins[bin] += addAmount;
};

/**
 * Returns a count of the number of items for a given bin
 *
 * @param string bin
 *   Identifier for a bin
 *
 * @return int
 *   Returns the count of items that have been tallied for a given bin,
 *   or 0 if no items have been stored in the bin.
 */
Histogram.prototype.countForBin = function (bin) {
    return this._bins[bin] || 0;
};

/**
 * Returns an array of arrays, where the first value in each child array
 * is the name of the bin, and the second the count for that bin
 *
 * @return array
 *   An array of one or more arrays, each with two elements
 */
Histogram.prototype.counts = function () {

    var counts = [],
        bin;

    for (bin in this._bins) {
        counts.push([bin, this.countForBin(bin)]);
    }

    return counts;
};

/**
 * Returns an array of arrays, where the first value in each child array
 * is the name of the bin, and the second the count for that bin. The bins
 * are sorted by key
 *
 * @return array
 *   An array of one or more arrays, each with two elements
 */
Histogram.prototype.sortedCounts = function () {

    var keys = [],
        counts = [],
        numKeys,
        i,
        bin,
        aBin;

    for (bin in this._bins) {
        keys.push(bin);
    }

    keys.sort();
    numKeys = keys.length;

    for (i = 0; i < numKeys; i += 1) {
        aBin = keys[i];
        counts.push([aBin, this.countForBin(aBin)]);
    }

    return counts;
};

/**
 * Empties out the current histogram so that there are no bins currently
 * being maintained
 */
Histogram.prototype.clear = function () {
    this._bins = {};
};

/**
 * Resets the count of a given histogram bin to zero
 *
 * @param string bin
 *   Identifier for a bin
 *
 * @return boolean
 *   Returns true if the requested bin existed and was reset, otherwise
 *   returns false.
 */
Histogram.prototype.resetBin = function (bin) {

    if (this._bins[bin]) {
        delete this._bins[bin];
        return true;
    }

    return false;
};

ns.Histogram = Histogram;

/**
 * A special use case of the Histogram class that automatically creates bins by
 * hour.
 */
HourHistogram = function () {
    this._bins = {};
};

HourHistogram.prototype = new Histogram();

/**
 * Add an element to a created bin, where the bin is just the name of the
 * current hour
 */
HourHistogram.prototype.addCurrent = function () {

    var aDate = new Date(),
        dateString = aDate.toLocaleDateString(),
        timeString = aDate.toLocaleTimeString(),
        timeParts = timeString.split(":"),
        hourString = [timeParts[0], timeParts[1]].join(":"),
        binName = dateString + " " + hourString;

    this.add(binName);
};

ns.HourHistogram = HourHistogram;

});
