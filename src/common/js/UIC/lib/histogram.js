__UIC(["lib", "histogram"], function (global, ns) {

var Histogram,
    HourHistogram;

Histogram = function (identifier) {
    this._id = "histogram::" + identifier;
    this._bins = {};
};

/**
 * Returns a JSON representation of the histogram, which can be used for
 * serialization, transport, etc.
 *
 * @return string
 *   A JSON string representing the contents of the histogram
 */
Histogram.prototype.toJSON = function () {
    return JSON.stringify({
        "bins": this._bins,
        "id": this._id
    });
};

/**
 * Populates the contents of the histogram with the state represented by
 * the serialized json string
 *
 * @param string json
 *   A JSON string representing the state of a previous histogram
 *
 * @return bool
 *   Returns true if we were able to populate the histogram object with
 *   the given json data, otherwise false.
 */
Histogram.prototype.fromJSON = function (json) {
    var parsedState = JSON.parse(json);

    if (!parsedState) {
        return false;
    }

    this._bins = parsedState.bins;
    this._id = parsedState.id;

    return true;
};

/**
 * Saves the histogram to persistant storage
 */
Histogram.prototype.save = function () {
    kango.storage.setItem(this._id, this.toJSON());
};

/**
 * Loads the histograms state from the persistant store
 *
 * @return boolean
 *   Returns true if we were able to recreate the objects state from the
 *   persistant store, and false in all other cases.
 */
Histogram.prototype.load = function () {

    var loadedState;

    if (!this._id) {
        return false;
    }

    loadedState = kango.storage.getItem("histogram::" + this._id);

    if (!loadedState) {
        return false;
    }

    return this.fromJSON(loadedState);
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
    this.save();
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
    this.save();
};

/**
 * Removes all internal state in the object and any backing persistant storage.
 * After calling this method the object will be unusable.
 */
Histogram.prototype.delete = function () {
    kango.storage.removeItem(this._id);
    delete this['_bins'];
    delete this['_id'];
};

/**
 * Resets the count of a given histogram bin to zero
 *
 * @param string bin
 *   Identifier for a bin
 * @param boolean saveChanges
 *   If false, we won't save the changes to the collection to the backing
 *   store, and trust that the caller will handle on their own later. Defaults
 *   to true
 *
 * @return boolean
 *   Returns true if the requested bin existed and was reset, otherwise
 *   returns false.
 */
Histogram.prototype.resetBin = function (bin, saveChanges) {

    if (saveChanges === undefined) {
        saveChanges = true;
    }

    if (this._bins[bin]) {
        delete this._bins[bin];
        if (!saveChanges) {
            this.save();
        }
        return true;
    }

    return false;
};

ns.Histogram = Histogram;

/**
 * Convenience method that returns a Histogram object with the state represented
 * by a JSON string
 *
 * @return Histogram|null
 *   Returns null if there was a problem creating a histogram object from the
 *   given JSON string, otherwise a Histogram object.
 */
ns.histogramFromJSON = function (json) {

    var hist = new Histogram();

    if (!hist.fromJSON(json)) {
        return null;
    }

    return hist;
};

/**
 * A special use case of the Histogram class that automatically creates bins by
 * hour.
 */
HourHistogram = function () {
    this._bins = {};
};

/**
 * Returns a string depecting the current hour, used for binning and comparisons
 * in instances of the HourHistogram
 *
 * @return string
 *   A string representing the current date, minus the minute and second
 *   information
 */
ns.currentHourString = function () {

    var aDate = new Date(),
        dateString = aDate.toLocaleDateString(),
        timeString = aDate.toLocaleTimeString(),
        timeParts = timeString.split(":");

    return dateString + " " + timeParts[0];
};

HourHistogram.prototype = new Histogram();

/**
 * Returns an array of histogram bins that are earlier than the current hour
 *
 * @return array
 *   An array of zero or more arrays, where each child array contains
 *   two items, the date of the bin and the corresponding count
 */
HourHistogram.prototype.binsBeforePresentHour = function () {

    var currentHour = ns.currentHourString(),
        sortedCounts = this.sortedCounts(),
        numCounts = sortedCounts.length,
        binsToReturn = [],
        i,
        currentBin;

    for (i = 0; i < numCounts; i += 1) {
        currentBin = sortedCounts[i];
        if (currentBin[0] < currentHour) {
            binsToReturn.push(currentBin);
            this.resetBin(currentBin[0], false);
        } else {
            break;
        }
    }

    // If we didn't remove any bins from the histogram, then nothing has changed
    // and there is no point in saving anything
    if (binsToReturn.length > 0) {
        this.save();
    }

    return binsToReturn;
};

/**
 * Add an element to a created bin, where the bin is just the name of the
 * current hour
 */
HourHistogram.prototype.addCurrent = function () {

    var hourTimestamp = ns.currentHourString();
    this._mostRecentTimestamp = hourTimestamp;
    this.add(hourTimestamp);
};

ns.HourHistogram = HourHistogram;

/**
 * Convenience method that returns a HourHistogram object with the state represented
 * by a JSON string
 *
 * @return HourHistogram|null
 *   Returns null if there was a problem creating a histogram object from the
 *   given JSON string, otherwise a HourHistogram object.
 */
ns.HourHistogramFromJSON = function (json) {

    var hist = new HourHistogram();

    if (!hist.fromJSON(json)) {
        return null;
    }

    return hist;
};

/**
 * Convenience method that will either load a histogram object from persistant
 * storage with the given identifier, or will return a new histogram with
 * that same identifeir
 *
 * @param string identifier
 *   A unique identifier for a histogram object
 */
ns.loadHourHistogramWithId = function (identifier) {
    var hist = new HourHistogram(identifier);
    hist.load();
    return hist;
};

});
