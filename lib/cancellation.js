/*! *****************************************************************************
Copyright (C) Ron A. Buckton. All rights reserved.
Licensed under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the
License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.

See the License for the specific language governing permissions and
limitations under the License.
***************************************************************************** */
var list = require('./list');
var LinkedList = list.LinkedList;
var hasMsNonUserCodeExceptions = typeof Debug !== "undefined" &&
typeof Debug.setNonUserCodeExceptions === "boolean";
/**
  * A source for cancellation
  */
var CancellationTokenSource = (function () {
    /**
      * @param links Other `CancellationToken` instances that will cancel this source if the tokens are canceled.
      */
    function CancellationTokenSource(links) {
        var _this = this;
        this._token = new CancellationToken(this);
        Object.defineProperty(this, "_token", { writable: false, configurable: false });
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
                    _this.cancel(reason);
                }));
            }
        }
    }
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
        if (reason == null) {
            reason = new Error("operation was canceled.");
        }
        if (reason instanceof Error && !("stack" in reason)) {
            if (hasMsNonUserCodeExceptions) {
                Debug.setNonUserCodeExceptions = true;
            }
            try {
                throw reason;
            }
            catch (error) {
                reason = error;
            }
        }
        var callbacks = this._callbacks;
        this._canceled = true;
        this._reason = reason;
        this._callbacks = null;
        Object.freeze(this);
        if (callbacks) {
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
    /**
     * Closes the CancellationSource, preventing any future cancellation signal.
     */
    CancellationTokenSource.prototype.close = function () {
        if (Object.isFrozen(this)) {
            return;
        }
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
    CancellationTokenSource.prototype._register = function (callback) {
        if (this._canceled) {
            callback(this._reason);
            return emptyRegistration;
        }
        if (Object.isFrozen(this)) {
            return emptyRegistration;
        }
        var callbacks = this._callbacks;
        if (!callbacks) {
            callbacks = new LinkedList();
            this._callbacks = callbacks;
        }
        var cookie = callbacks.addLast(callback);
        return Object.freeze({
            unregister: function () {
                callbacks.deleteNode(cookie);
            }
        });
    };
    CancellationTokenSource.prototype._throwIfFrozen = function () {
        if (Object.isFrozen(this)) {
            throw new Error("cannot modify a closed source");
        }
    };
    return CancellationTokenSource;
})();
exports.CancellationTokenSource = CancellationTokenSource;
/**
  * A token used to recieve a cancellation signal.
  */
var CancellationToken = (function () {
    /*@internal*/
    function CancellationToken(source) {
        this._source = source;
        Object.freeze(this);
    }
    Object.defineProperty(CancellationToken, "none", {
        /**
          * Gets an empty cancellation token that will never be canceled.
          */
        get: function () {
            if (!CancellationToken._none) {
                CancellationToken._none = new CancellationToken(undefined);
            }
            return CancellationToken._none;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(CancellationToken.prototype, "canBeCanceled", {
        /**
          * Gets a value indicating whether the token can be canceled.
          */
        get: function () {
            return !!this._source && !Object.isFrozen(this._source);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(CancellationToken.prototype, "canceled", {
        /**
          * Gets a value indicating whether the token has received a cancellation signal.
          */
        get: function () {
            if (!this._source) {
                return false;
            }
            return this._source._canceled;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(CancellationToken.prototype, "reason", {
        /**
          * Gets the reason for cancellation, if one was supplied.
          */
        get: function () {
            if (!this._source) {
                return undefined;
            }
            return this._source._reason;
        },
        enumerable: true,
        configurable: true
    });
    /**
      * Throws an `Error` if the token has received a cancellation signal.
      */
    CancellationToken.prototype.throwIfCanceled = function (reason) {
        if (reason === void 0) { reason = this.reason; }
        if (!this._source) {
            return;
        }
        if (this.canceled) {
            throw reason;
        }
    };
    /**
      * Requests a callback when the token receives a cancellation signal to perform additional cleanup.
      * @param callback The callback to execute
      * @returns A `CancellationTokenRegistration` that that can be used to cancel the cleanup request.
      */
    CancellationToken.prototype.register = function (callback) {
        if (typeof callback !== "function") {
            throw new TypeError("Argument is not a Function object");
        }
        if (!this._source) {
            return emptyRegistration;
        }
        return this._source._register(callback);
    };
    return CancellationToken;
})();
exports.CancellationToken = CancellationToken;
var emptyRegistration = Object.freeze({ unregister: function () { } });
//# sourceMappingURL=file:///C|/dev/asyncjs/cancellation.js.map