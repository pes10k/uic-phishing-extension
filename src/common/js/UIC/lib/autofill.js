__UIC(['lib', 'autofill'], function (global, ns) {

var AutofillWatcher,
    _pollInterval = 100;

AutofillWatcher = function (input, callback, pollForSecs) {

    var that = this;

    this._registeredElementHasKeyUped = function () {
        that._hasBeenKeyUped = true;
        that.input.removeEventListener("focus", this);
    };

    this._registedElementHasChanged = function () {
        this._hasBeenChanged = true;
        that.input.removeEventListener("change", this);
    };

    this.input = input;
    this._hasBeenKeyUped = false;
    this._hasBeenChanged = false;
    this._hasAutofilled = false;
    this._callback = callback;

    // Keep track of what timer is being used to watch this element,
    // so that we don't fire up multiple timers for the same element.
    this._timerId = null;

    // Flag that the input watched by an AutofillWatcher instance
    // has recieved focus at least once.
    this.input.addEventListener("keyup", this._registeredElementHasKeyUped, false);

    // Similarly, register that the input watched by an AutofillWatcher
    // isntance has been changed at least once
    this.input.addEventListener("change", this._registedElementHasChanged, false);

    this.watchForSecs(pollForSecs || 5);
};

/**
 * Schedules the autofill watcher to watch for an autofill event for the given
 * number of seconds.
 *
 * @param int secondsToWatch
 *   A integer number of seconds to watch the event for
 */
AutofillWatcher.prototype.watchForSecs = function (secondsToWatch) {

    var currentTime = new Date();
    this._watchUntil = currentTime.getTime() + (secondsToWatch * 1000);

    if (this._timerId !== null) {
        clearTimeout(this._timerId);
    }

    this.checkForAutofill();
};

/**
 * Returns a boolean description of whether the element has been autofilled
 * by the browser so far.
 *
 * @return boolean|null
 *   true if the element has been autofilled, and otherwise false
 */
AutofillWatcher.prototype.hasAutofilled = function () {

    var elementValue = this.input.value.trim();

    if (this._hasAutofilled === true) {
        return true;
    }

    // If the element being watched has a value, and its not a value hardcoded
    // into the HTML document, but the element has never received a "focus" or
    // "change" event, then we assume it received that value by the browser
    // autofilling it
    if (elementValue !== "" &&
        elementValue != this.input.getAttribute("value") &&
        !this._hasBeenKeyUped && !this._hasBeenChanged) {
        this._hasAutofilled = true;
    }

    return this._hasAutofilled;
};

/**
 * Notifies any watching elements that the form element being watched by
 * this instance has ben autofilled.
 */
AutofillWatcher.prototype.triggerEvent = function () {
    if (this._callback) {
        this._callback(this);
        this._callback = null;
    }
};

/**
 * Removes any remaining event listeners relevant to this object
 */
AutofillWatcher.prototype.remove = function () {

    if (!this._hasBeenKeyUped) {
        this.input.removeEventListener("focus", this._registeredElementHasKeyUped);
    }

    if (!this._hasBeenChanged) {
        this.input.removeEventListener("change", this._registedElementHasChanged);
    }

    this._timerId = null;
};

/**
 * Function used for schedling that the autofill watcher is called regularly,
 * and rescheduling as needed (ie until we get a match).
 */
AutofillWatcher.prototype.checkForAutofill = function () {

    var aDate,
        that = this;

    // If the watcher has been autofilled, notify any listeners
    // that that happened, but don't reschedule for future checking
    if (this.hasAutofilled()) {
        this.triggerEvent();
        this.remove();
        return;
    }

    aDate = new Date();

    // Next, check to see if we've been watching this element for too long
    // in which case we should just die and not check it any further
    if (aDate.getTime() > this._watchUntil) {
        return;
    }

    // Otherwise, check again in a little bit whether either of the above
    // conditions have been met
    this._timerId = setTimeout(function () {
        that.checkForAutofill();
    }, _pollInterval);
};

// Finally, place the above class somewhere the rest of the world can get
// to it.
ns.AutofillWatcher = AutofillWatcher;

});
