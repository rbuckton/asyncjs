var hasMsNonUserCodeExceptions = typeof Debug !== "undefined" && typeof Debug.setNonUserCodeExceptions === "boolean";
/**
 * A source for cancellation
 */
var CancellationTokenSource = (function () {
    function CancellationTokenSource() {
        var _this = this;
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i - 0] = arguments[_i];
        }
        var delay = -1;
        var links;
        if (typeof args[0] === "number") {
            delay = args.shift() | 0;
            if (delay < 0)
                throw new RangeError();
        }
        if (Array.isArray(args[0])) {
            links = args.shift();
        }
        else if (args.length) {
            links = args;
        }
        var source = this;
        this._token = Object.freeze({
            get canceled() {
                return source._canceled;
            },
            get reason() {
                return source._reason;
            },
            throwIfCanceled: function () {
                if (source._canceled) {
                    throw source._reason;
                }
            },
            register: function (callback) {
                return source._register(callback);
            }
        });
        if (links) {
            this._links = new Array();
            for (var i = 0, l = links.length; i < l; i++) {
                var link = links[i];
                if (!link) {
                    continue;
                }
                if (link.canceled) {
                    this._canceled = true;
                    this._reason = link.reason;
                    return;
                }
                this._links.push(link.register(function (reason) {
                    _this._cancelCore(reason);
                }));
            }
        }
        if (delay >= 0) {
            this.cancelAfter(delay);
        }
    }
    Object.defineProperty(CancellationTokenSource, "canceled", {
        /**
         * Gets an already cancelled `CancellationToken`.
         */
        get: function () {
            if (!CancellationTokenSource._canceled) {
                var cts = new CancellationTokenSource();
                cts.cancel();
                CancellationTokenSource._canceled = cts.token;
            }
            return CancellationTokenSource._canceled;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(CancellationTokenSource.prototype, "canceled", {
        /**
         * Gets a value indicating whether the token has received a cancellation signal.
         */
        get: function () {
            return this._canceled;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(CancellationTokenSource.prototype, "reason", {
        /**
         * Gets the reason for cancellation, if one was supplied.
         */
        get: function () {
            return this._reason;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(CancellationTokenSource.prototype, "token", {
        /**
         * Gets the `CancellationToken` for this source.
         */
        get: function () {
            return this._token;
        },
        enumerable: true,
        configurable: true
    });
    /**
     * Signals the source is cancelled.
     * @param reason An optional reason for the cancellation.
     */
    CancellationTokenSource.prototype.cancel = function (reason) {
        if (this._canceled) {
            return;
        }
        this._throwIfFrozen();
        this._cancelCore(reason);
    };
    /**
     * Signals the source is canceled after a delay.
     * @param delay The number of milliseconds to delay before signalling cancellation.
     * @param reason An optional reason for the cancellation.
     */
    CancellationTokenSource.prototype.cancelAfter = function (delay, reason) {
        if (this._canceled) {
            return;
        }
        this._throwIfFrozen();
        this._clearTimeout();
        this._timer = setTimeout(CancellationTokenSource._ontimeout, delay, this, reason);
    };
    /**
     * Closes the CancellationSource, preventing any future cancellation signal.
     */
    CancellationTokenSource.prototype.close = function () {
        if (Object.isFrozen(this)) {
            return;
        }
        this._clearTimeout();
        if (this._links) {
            var links = this._links;
            for (var i = 0, l = links.length; i < l; i++) {
                links[i].unregister();
            }
        }
        if (this._callbacks) {
            this._callbacks.clear();
        }
        this._links = null;
        this._callbacks = null;
        Object.freeze(this);
    };
    CancellationTokenSource._ontimeout = function (source, reason) {
        source._timer = null;
        if (!Object.isFrozen(source)) {
            source._cancelCore(reason);
        }
    };
    CancellationTokenSource.prototype._register = function (callback) {
        if (typeof callback !== "function")
            throw new TypeError("argument is not a Function object");
        if (this._canceled) {
            callback(this._reason);
            return emptyRegistration;
        }
        if (Object.isFrozen(this)) {
            return emptyRegistration;
        }
        var cookie = {};
        var callbacks = this._callbacks || (this._callbacks = new Map());
        callbacks.set(cookie, callback);
        return {
            unregister: function () {
                callbacks.delete(cookie);
            }
        };
    };
    CancellationTokenSource.prototype._cancelCore = function (reason) {
        if (hasMsNonUserCodeExceptions)
            Debug.setNonUserCodeExceptions = true;
        if (this._canceled) {
            return;
        }
        this._clearTimeout();
        if (reason == null) {
            reason = new Error("operation was canceled.");
        }
        if (reason instanceof Error && !("stack" in reason)) {
            try {
                throw reason;
            }
            catch (error) {
                reason = error;
            }
        }
        this._canceled = true;
        this._reason = reason;
        if (this._callbacks) {
            var callbacks = this._callbacks;
            this._callbacks = null;
            try {
                callbacks.forEach(function (callback) {
                    callback(reason);
                });
            }
            finally {
                callbacks.clear();
            }
        }
    };
    CancellationTokenSource.prototype._clearTimeout = function () {
        if (this._timer != null) {
            clearTimeout(this._timer);
            this._timer = null;
        }
    };
    CancellationTokenSource.prototype._throwIfFrozen = function () {
        if (Object.isFrozen(this)) {
            throw new Error("cannot modify a closed source");
        }
    };
    return CancellationTokenSource;
})();
exports.CancellationTokenSource = CancellationTokenSource;
var emptyRegistration = Object.freeze({ unregister: function () {
} });
//# sourceMappingURL=file:///C|/dev/asyncjs/cancellation.js.map