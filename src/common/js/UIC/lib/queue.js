__UIC(['lib', 'queue'], function (global, ns) {

/**
 * Implements a very simple LIFO queue of a fixed size, so that if you
 * push beyond the maximum size of the queue, the oldest item will
 * be removed.
 */
var LimitedQueue = function (maxSize) {

    this._maxSize = maxSize || 1;
    this._elements = [];
    this.length = 0;
};

LimitedQueue.prototype.push = function (item) {

    if (this.length === this._maxSize) {
        this._elements.shift();
        this._elements.push(item);
    } else {
        this.length += 1;
        this._elements.push(item);
    }
};

/**
 * Returns the requested element from the queue, with 0 being the
 * most recently added element, and -n being the element that
 * was added n "pushes" ago
 *
 * @param number index
 *   An integer index to look backwards in the queue for, should
 *   be <= 0.  Defaults to 0, or the most recently added item in the queue
 *
 * @return
 *   null on any error, otherwise the requested value
 */
LimitedQueue.prototype.peek = function (index) {

    var seekIndex = index || 0;

    if (seekIndex > 0 || Math.abs(seekIndex) > this.length) {
        return null;
    } else {
        return this._elements[this.length - Math.abs(seekIndex) - 1];
    }
};

ns.LimitedQueue = LimitedQueue;

});
