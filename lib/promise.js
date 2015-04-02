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
var task_1 = require('./task');
var hasMsDebug = typeof Debug !== "undefined" &&
    typeof Debug.msTraceAsyncOperationStarting === "function" &&
    typeof Debug.msTraceAsyncOperationCompleted === "function" &&
    typeof Debug.msTraceAsyncCallbackStarting === "function" &&
    typeof Debug.msTraceAsyncCallbackCompleted === "function";
var hasMsNonUserCodeExceptions = typeof Debug !== "undefined" &&
    typeof Debug.setNonUserCodeExceptions === "boolean";
/**
 * Represents the completion of an asynchronous operation
 */
var Promise = (function () {
    /**
     * Creates a new Promise.
     * @param init A callback used to initialize the promise. This callback is passed two arguments: a resolve callback used resolve the promise with a value or the result of another promise, and a reject callback used to reject the promise with a provided reason or error.
     */
    function Promise(init) {
        var _this = this;
        if (typeof init !== "function") {
            throw new TypeError("argument is not a Function object");
        }
        if (hasMsNonUserCodeExceptions) {
            Debug.setNonUserCodeExceptions = true;
        }
        var resolver = function (rejecting, result) {
            if (resolver) {
                resolver = null;
                _this._resolve(rejecting, result);
            }
        };
        var resolve = function (value) { return resolver(false, value); };
        var reject = function (reason) { return resolver(true, reason); };
        try {
            init(resolve, reject);
        }
        catch (error) {
            reject(error);
        }
    }
    Promise.resolve = function (value) {
        return (value instanceof this) ? value : new Promise(function (resolve) { return resolve(value); });
    };
    Promise.reject = function (reason) {
        return new Promise(function (_, reject) { return reject(reason); });
    };
    Promise.all = function (values) {
        var _this = this;
        return new this(function (resolve, reject) {
            var countdown = values.length || 0;
            if (countdown <= 0) {
                resolve([]);
                return;
            }
            var results = Array(countdown);
            var resolver = function (index) { return function (value) {
                results[index] = value;
                if (--countdown === 0) {
                    resolve(results);
                }
            }; };
            for (var i = 0; i < results.length; i++) {
                _this.resolve(values[i]).then(resolver(i), reject);
            }
        });
    };
    Promise.race = function (values) {
        var _this = this;
        return new this(function (resolve, reject) {
            var promises = values.map(function (value) { return _this.resolve(value); });
            promises.forEach(function (promise) { return promise.then(resolve, reject); });
        });
    };
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    Promise.prototype.then = function (onfulfilled, onrejected) {
        return this._await(onfulfilled, onrejected);
    };
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    Promise.prototype.catch = function (onrejected) {
        return this._await(undefined, onrejected);
    };
    /**
     * Attaches a callback for that is executed regardless of the resolution or rejection of the promise.
     * @param onsettled The callback to execute when the Promise is settled.
     * @returns A Promise for the completion of the callback.
     */
    Promise.prototype.finally = function (onsettled) {
        return this._await(function (value) { return new Promise(function (resolve) { return resolve(onsettled()); }).then(function () { return value; }); }, function (reason) { return new Promise(function (resolve) { return resolve(onsettled()); }).then(function () { return Promise.reject(reason); }); });
    };
    Promise.prototype._resolve = function (rejecting, result) {
        var _this = this;
        if (!rejecting) {
            if (hasMsNonUserCodeExceptions) {
                Debug.setNonUserCodeExceptions = true;
            }
            try {
                if (this === result) {
                    throw new TypeError("Cannot resolve a promise with itself");
                }
                if (result !== null && (typeof result === "object" || typeof result === "function") && "then" in result) {
                    var then = result.then;
                    if (typeof then === "function") {
                        var resolver = function (rejecting, result) {
                            if (resolver) {
                                resolver = null;
                                _this._resolve(rejecting, result);
                            }
                        };
                        var resolve = function (value) { return resolver(false, value); };
                        var reject = function (reason) { return resolver(true, reason); };
                        try {
                            then.call(result, resolve, reject);
                        }
                        catch (error) {
                            reject(error);
                        }
                        return;
                    }
                }
            }
            catch (error) {
                result = error;
                rejecting = true;
            }
        }
        this._settle(rejecting, result);
    };
    Promise.prototype._await = function (onresolved, onrejected) {
        var _this = this;
        var id;
        if (hasMsDebug) {
            Debug.msTraceAsyncOperationStarting("Promise.then");
        }
        return new this.constructor(function (resolve, reject) {
            var prev = _this._settle;
            _this._settle = function (rejecting, result) {
                _this._forward(prev, resolve, reject, rejecting, result, onresolved, onrejected, id);
            };
        });
    };
    Promise.prototype._settle = function (rejecting, result) {
        var _this = this;
        this._settle = null;
        this._await = function (onfulfilled, onrejected) {
            var id = hasMsDebug && Debug.msTraceAsyncOperationStarting("Promise.then");
            return new _this.constructor(function (resolve, reject) {
                _this._forward(null, resolve, reject, rejecting, result, onfulfilled, onrejected, id);
            });
        };
    };
    Promise.prototype._forward = function (prev, resolve, reject, rejecting, result, onresolved, onrejected, id) {
        if (prev) {
            prev.call(this, rejecting, result);
        }
        task_1.scheduleTask(function () {
            if (hasMsNonUserCodeExceptions) {
                Debug.setNonUserCodeExceptions = true;
            }
            if (hasMsDebug) {
                Debug.msTraceAsyncOperationCompleted(id, rejecting ? Debug.MS_ASYNC_OP_STATUS_ERROR : Debug.MS_ASYNC_OP_STATUS_SUCCESS);
            }
            var handler = rejecting ? onrejected : onresolved;
            if (typeof handler === "function") {
                if (hasMsDebug) {
                    Debug.msTraceAsyncCallbackStarting(id);
                }
                try {
                    result = handler(result);
                    rejecting = false;
                }
                catch (e) {
                    result = e;
                    rejecting = true;
                }
                finally {
                    if (hasMsDebug) {
                        Debug.msTraceAsyncCallbackCompleted();
                    }
                }
            }
            (rejecting ? reject : resolve)(result);
        });
    };
    return Promise;
})();
exports.Promise = Promise;
//# sourceMappingURL=file:///C|/dev/asyncjs/promise.js.map