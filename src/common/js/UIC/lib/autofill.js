UIC(['lib', 'autofill'], function autofillLoadedCallback (global, ns) {

var autofillWatchedElement = function (input) {

    var autofillCount = 0,
        lastCheckedValue = input.value,
        isFocused = false,
        expectedValue = input.value;

    input.addEventListener("focus", function (e) {
        if (input.value !== lastCheckedValue) {
            input.value = "";
        }
    }, false);

    input.addEventListener("keydown", function (e) {
        isFocused = true;
    }, false);

    input.addEventListener("blur", function (e) {
        isFocused = false;
    }, false);

    return {
        hasFocused: function () {
            return isFocused;
        },
        value: function () {
            return input.value;
        },
        setValue: function (value) {
            input.value = value;
            lastCheckedValue = value;
        },
        watchedElement: function () {
            return input;
        },
        autofillCount: function () {
            return autofillCount;
        },
        checkForAutofill: function () {
            var wasAutofilled = false;

            if (!isFocused && input.value !== lastCheckedValue) {
                wasAutofilled = true;
                autofillCount += 1;
            }

            lastCheckedValue = input.value;

            return wasAutofilled;
        }
    };
};


/**
 * Returns an object that watches one or more elements on a page,
 * keeps track of how many times they have been autofilled by the browser,
 * and calls a callback function with information about the element
 * that has been autofilled.
 *
 * @param function callback
 *   A function to be called whenever a watched element has been autofilled
 *   by the browser
 * @param int pollInterval
 *   How often watched elements should be checked for a possible autofill
 *   event
 */
ns.autofillWatcher = function (callback, pollInterval) {

    var _pollInterval = pollInterval || 100,
        numElements = 0,
        watchedElements = [],
        aWatchedElement,
        i,
        elm;

    elm = {
        /**
         * Adds a form element to the collection of elements that should
         * be watched for autofill events
         *
         * @param input input
         *   A dom input element to watch for auto fill events
         *
         * @return int
         *   Returns the index of the watching object in the current
         *   collection of watched objects
         */
        addInput: function (input) {

            watchedElements.push(autofillWatchedElement(input));

            // Once the first element is added to this collection,
            // start checking / polling for autofill events
            this.checkForAutofills();

            return numElements++;
        },
        get: function (index) {
            return watchedElements[index];
        },
        checkForAutofills: function () {

            for (i = 0; i < numElements; i += 1) {
                aWatchedElement = watchedElements[i];
                if (aWatchedElement.checkForAutofill()) {
                    callback(aWatchedElement, i);
                }
            }

            setTimeout(elm.checkForAutofills, _pollInterval);
        }
    };

    return elm;
};

});
