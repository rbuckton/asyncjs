!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.Promise=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
exports.Promise = require('./promise');
//# sourceMappingURL=file:///C|/dev/asyncjs/async.js.map
},{"./promise":undefined}],2:[function(require,module,exports){
var task = require('./task');
var scheduleTask = task.scheduleTask;
var hasMsDebug = typeof Debug !== "undefined" && typeof Debug.msTraceAsyncOperationStarting === "function" && typeof Debug.msTraceAsyncOperationCompleted === "function" && typeof Debug.msTraceAsyncCallbackStarting === "function" && typeof Debug.msTraceAsyncCallbackCompleted === "function";
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
        if (typeof init !== "function")
            throw new TypeError("argument is not a Function object");
        var resolve = function (rejecting, result) {
            resolve = null;
            _this._resolve(rejecting, result);
        };
        try {
            init(function (value) {
                resolve && resolve(false, value);
            }, function (error) {
                resolve && resolve(true, error);
            });
        }
        catch (error) {
            resolve(true, error);
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
            for (var i = 0; i < results.length; i++) {
                _this.resolve(values[i]).then((function (index) { return function (value) {
                    results[index] = value;
                    if (--countdown == 0) {
                        resolve(results);
                    }
                }; })(i), reject);
            }
        });
    };
    Promise.race = function (values) {
        var _this = this;
        return new this(function (resolve, reject) {
            var promises = values.map(_this.resolve, _this);
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
    Promise.prototype["catch"] = function (onrejected) {
        return this._await(undefined, onrejected);
    };
    Promise.prototype._resolve = function (rejecting, result) {
        var _this = this;
        if (!rejecting) {
            try {
                if (this === result)
                    throw new TypeError("Cannot resolve a promise with itself");
                if (result !== null && (typeof result === "object" || typeof result === "function") && "then" in result) {
                    var then = result.then;
                    if (typeof then === "function") {
                        var resolve = function (rejecting, result) {
                            resolve = null;
                            _this._resolve(rejecting, result);
                        };
                        try {
                            then.call(result, function (result) {
                                resolve && resolve(false, result);
                            }, function (result) {
                                resolve && resolve(true, result);
                            });
                        }
                        catch (error) {
                            resolve(true, error);
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
        var id = hasMsDebug && Debug.msTraceAsyncOperationStarting("Promise.then");
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
        prev && prev.call(this, rejecting, result);
        scheduleTask(function () {
            try {
                var handler = rejecting ? onrejected : onresolved;
                hasMsDebug && Debug.msTraceAsyncOperationCompleted(id, rejecting ? Debug.MS_ASYNC_OP_STATUS_ERROR : Debug.MS_ASYNC_OP_STATUS_SUCCESS);
                if (typeof handler === "function") {
                    hasMsDebug && Debug.msTraceAsyncCallbackStarting(id);
                    result = handler(result);
                    rejecting = false;
                }
            }
            catch (e) {
                result = e;
                rejecting = true;
            }
            finally {
                hasMsDebug && Debug.msTraceAsyncCallbackCompleted();
            }
            (rejecting ? reject : resolve)(result);
        });
    };
    return Promise;
})();
exports.Promise = Promise;
//# sourceMappingURL=file:///C|/dev/asyncjs/promise.js.map
},{"./task":undefined}],3:[function(require,module,exports){
function scheduleTask(task) {
    if (!queue) {
        queue = {};
    }
    var node = { task: task };
    enqueueTask(queue, node);
    scheduleTick();
    return node;
}
exports.scheduleTask = scheduleTask;
function cancelTask(handle) {
    if (!handle) {
        return;
    }
    var node = handle;
    if (node.queue === recoveryQueue || node.queue === queue) {
        removeTask(node.queue, node);
    }
    if (recoveryQueue && !recoveryQueue.head) {
        recoveryQueue = undefined;
    }
    if (queue && !queue.head) {
        queue = undefined;
    }
    if (!recoveryQueue && !queue) {
        cancelTick();
    }
}
exports.cancelTask = cancelTask;
var scheduler;
var handle;
var recoveryQueue;
var queue;
function scheduleTick() {
    if (handle === void 0) {
        return;
    }
    if (!scheduler) {
        scheduler = getScheduler();
    }
    handle = scheduler.scheduleTick(onTick);
}
function cancelTick() {
    if (handle === void 0 || !scheduler) {
        return;
    }
    scheduler.cancelTick(handle);
    handle = undefined;
}
function onTick() {
    processQueue(recoveryQueue);
    recoveryQueue = queue;
    queue = undefined;
    processQueue(recoveryQueue);
    recoveryQueue = undefined;
}
function processQueue(queue) {
    if (!queue) {
        return;
    }
    var node;
    var taskCompleted = false;
    while (node = dequeueTask(queue)) {
        var task = node.task;
        try {
            task();
            taskCompleted = true;
        }
        finally {
            if (!taskCompleted) {
                scheduleTick();
            }
        }
    }
}
function enqueueTask(queue, node) {
    node.previous = queue.tail;
    node.queue = queue;
    if (queue.tail) {
        queue.tail.next = node;
    }
    else {
        queue.head = node;
    }
    queue.tail = node;
}
function dequeueTask(queue) {
    if (!queue) {
        return;
    }
    var node = queue.tail;
    if (node) {
        removeTask(queue, node);
    }
    return node;
}
function removeTask(queue, node) {
    if (!queue) {
        return;
    }
    if (node.next) {
        node.next.previous = node.previous;
    }
    if (node.previous) {
        node.previous.next = node.next;
    }
    if (node === queue.tail) {
        queue.tail = node.previous;
    }
    if (node === queue.head) {
        queue.head = node.next;
    }
    node.next = undefined;
    node.previous = undefined;
    node.queue = undefined;
}
function getScheduler() {
    if (typeof setImmediate === "function") {
        return getSetImmediateScheduler();
    }
    else if (typeof msSetImmediate === "function") {
        return getMSSetImmediateScheduler();
    }
    else if (typeof process === "object" && typeof process.nextTick === "function") {
        return getNextTickScheduler();
    }
    else if (typeof setTimeout === "function") {
        return getSetTimeoutScheduler();
    }
    else {
        return getMissingScheduler();
    }
    function getSetImmediateScheduler() {
        return { scheduleTick: scheduleTick, cancelTick: cancelTick };
        function scheduleTick(callback) {
            return setImmediate(callback);
        }
        function cancelTick(handle) {
            clearImmediate(handle);
        }
    }
    function getMSSetImmediateScheduler() {
        return { scheduleTick: scheduleTick, cancelTick: cancelTick };
        function scheduleTick(callback) {
            return msSetImmediate(callback);
        }
        function cancelTick(handle) {
            msClearImmediate(handle);
        }
    }
    function getNextTickScheduler() {
        var nextHandle = 1;
        return { scheduleTick: scheduleTick, cancelTick: cancelTick };
        function scheduleTick(callback) {
            var handle = { canceled: false };
            process.nextTick(function () {
                if (handle.canceled)
                    return;
                callback();
            });
            return handle;
        }
        function cancelTick(handle) {
            if (handle)
                handle.canceled = true;
        }
    }
    function getSetTimeoutScheduler() {
        return { scheduleTick: scheduleTick, cancelTick: cancelTick };
        function scheduleTick(callback) {
            return setTimeout(callback, 0);
        }
        function cancelTick(handle) {
            clearTimeout(handle);
        }
    }
    function getMissingScheduler() {
        return { scheduleTick: scheduleTick, cancelTick: cancelTick };
        function scheduleTick() {
            throw new Error("Scheduler not available.");
        }
        function cancelTick() {
            throw new Error("Scheduler not available.");
        }
    }
}
//# sourceMappingURL=file:///C|/dev/asyncjs/task.js.map
},{}]},{},[1,2,3])(3)
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlc1xcYnJvd3NlcmlmeVxcbm9kZV9tb2R1bGVzXFxicm93c2VyLXBhY2tcXF9wcmVsdWRlLmpzIiwibGliXFxhc3luYy5qcyIsImxpYlxccHJvbWlzZS5qcyIsImxpYlxcdGFzay5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7O0FDREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJleHBvcnRzLlByb21pc2UgPSByZXF1aXJlKCcuL3Byb21pc2UnKTtcclxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZmlsZTovLy9DfC9kZXYvYXN5bmNqcy9hc3luYy5qcy5tYXAiLCJ2YXIgdGFzayA9IHJlcXVpcmUoJy4vdGFzaycpO1xyXG52YXIgc2NoZWR1bGVUYXNrID0gdGFzay5zY2hlZHVsZVRhc2s7XHJcbnZhciBoYXNNc0RlYnVnID0gdHlwZW9mIERlYnVnICE9PSBcInVuZGVmaW5lZFwiICYmIHR5cGVvZiBEZWJ1Zy5tc1RyYWNlQXN5bmNPcGVyYXRpb25TdGFydGluZyA9PT0gXCJmdW5jdGlvblwiICYmIHR5cGVvZiBEZWJ1Zy5tc1RyYWNlQXN5bmNPcGVyYXRpb25Db21wbGV0ZWQgPT09IFwiZnVuY3Rpb25cIiAmJiB0eXBlb2YgRGVidWcubXNUcmFjZUFzeW5jQ2FsbGJhY2tTdGFydGluZyA9PT0gXCJmdW5jdGlvblwiICYmIHR5cGVvZiBEZWJ1Zy5tc1RyYWNlQXN5bmNDYWxsYmFja0NvbXBsZXRlZCA9PT0gXCJmdW5jdGlvblwiO1xyXG4vKipcclxuICogUmVwcmVzZW50cyB0aGUgY29tcGxldGlvbiBvZiBhbiBhc3luY2hyb25vdXMgb3BlcmF0aW9uXHJcbiAqL1xyXG52YXIgUHJvbWlzZSA9IChmdW5jdGlvbiAoKSB7XHJcbiAgICAvKipcclxuICAgICAqIENyZWF0ZXMgYSBuZXcgUHJvbWlzZS5cclxuICAgICAqIEBwYXJhbSBpbml0IEEgY2FsbGJhY2sgdXNlZCB0byBpbml0aWFsaXplIHRoZSBwcm9taXNlLiBUaGlzIGNhbGxiYWNrIGlzIHBhc3NlZCB0d28gYXJndW1lbnRzOiBhIHJlc29sdmUgY2FsbGJhY2sgdXNlZCByZXNvbHZlIHRoZSBwcm9taXNlIHdpdGggYSB2YWx1ZSBvciB0aGUgcmVzdWx0IG9mIGFub3RoZXIgcHJvbWlzZSwgYW5kIGEgcmVqZWN0IGNhbGxiYWNrIHVzZWQgdG8gcmVqZWN0IHRoZSBwcm9taXNlIHdpdGggYSBwcm92aWRlZCByZWFzb24gb3IgZXJyb3IuXHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIFByb21pc2UoaW5pdCkge1xyXG4gICAgICAgIHZhciBfdGhpcyA9IHRoaXM7XHJcbiAgICAgICAgaWYgKHR5cGVvZiBpbml0ICE9PSBcImZ1bmN0aW9uXCIpXHJcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJhcmd1bWVudCBpcyBub3QgYSBGdW5jdGlvbiBvYmplY3RcIik7XHJcbiAgICAgICAgdmFyIHJlc29sdmUgPSBmdW5jdGlvbiAocmVqZWN0aW5nLCByZXN1bHQpIHtcclxuICAgICAgICAgICAgcmVzb2x2ZSA9IG51bGw7XHJcbiAgICAgICAgICAgIF90aGlzLl9yZXNvbHZlKHJlamVjdGluZywgcmVzdWx0KTtcclxuICAgICAgICB9O1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGluaXQoZnVuY3Rpb24gKHZhbHVlKSB7XHJcbiAgICAgICAgICAgICAgICByZXNvbHZlICYmIHJlc29sdmUoZmFsc2UsIHZhbHVlKTtcclxuICAgICAgICAgICAgfSwgZnVuY3Rpb24gKGVycm9yKSB7XHJcbiAgICAgICAgICAgICAgICByZXNvbHZlICYmIHJlc29sdmUodHJ1ZSwgZXJyb3IpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgICAgIHJlc29sdmUodHJ1ZSwgZXJyb3IpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIFByb21pc2UucmVzb2x2ZSA9IGZ1bmN0aW9uICh2YWx1ZSkge1xyXG4gICAgICAgIHJldHVybiAodmFsdWUgaW5zdGFuY2VvZiB0aGlzKSA/IHZhbHVlIDogbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUpIHsgcmV0dXJuIHJlc29sdmUodmFsdWUpOyB9KTtcclxuICAgIH07XHJcbiAgICBQcm9taXNlLnJlamVjdCA9IGZ1bmN0aW9uIChyZWFzb24pIHtcclxuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKF8sIHJlamVjdCkgeyByZXR1cm4gcmVqZWN0KHJlYXNvbik7IH0pO1xyXG4gICAgfTtcclxuICAgIFByb21pc2UuYWxsID0gZnVuY3Rpb24gKHZhbHVlcykge1xyXG4gICAgICAgIHZhciBfdGhpcyA9IHRoaXM7XHJcbiAgICAgICAgcmV0dXJuIG5ldyB0aGlzKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcclxuICAgICAgICAgICAgdmFyIGNvdW50ZG93biA9IHZhbHVlcy5sZW5ndGggfHwgMDtcclxuICAgICAgICAgICAgaWYgKGNvdW50ZG93biA8PSAwKSB7XHJcbiAgICAgICAgICAgICAgICByZXNvbHZlKFtdKTtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB2YXIgcmVzdWx0cyA9IEFycmF5KGNvdW50ZG93bik7XHJcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcmVzdWx0cy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICAgICAgX3RoaXMucmVzb2x2ZSh2YWx1ZXNbaV0pLnRoZW4oKGZ1bmN0aW9uIChpbmRleCkgeyByZXR1cm4gZnVuY3Rpb24gKHZhbHVlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0c1tpbmRleF0gPSB2YWx1ZTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoLS1jb3VudGRvd24gPT0gMCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHJlc3VsdHMpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH07IH0pKGkpLCByZWplY3QpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICB9O1xyXG4gICAgUHJvbWlzZS5yYWNlID0gZnVuY3Rpb24gKHZhbHVlcykge1xyXG4gICAgICAgIHZhciBfdGhpcyA9IHRoaXM7XHJcbiAgICAgICAgcmV0dXJuIG5ldyB0aGlzKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcclxuICAgICAgICAgICAgdmFyIHByb21pc2VzID0gdmFsdWVzLm1hcChfdGhpcy5yZXNvbHZlLCBfdGhpcyk7XHJcbiAgICAgICAgICAgIHByb21pc2VzLmZvckVhY2goZnVuY3Rpb24gKHByb21pc2UpIHsgcmV0dXJuIHByb21pc2UudGhlbihyZXNvbHZlLCByZWplY3QpOyB9KTtcclxuICAgICAgICB9KTtcclxuICAgIH07XHJcbiAgICAvKipcclxuICAgICAqIEF0dGFjaGVzIGNhbGxiYWNrcyBmb3IgdGhlIHJlc29sdXRpb24gYW5kL29yIHJlamVjdGlvbiBvZiB0aGUgUHJvbWlzZS5cclxuICAgICAqIEBwYXJhbSBvbmZ1bGZpbGxlZCBUaGUgY2FsbGJhY2sgdG8gZXhlY3V0ZSB3aGVuIHRoZSBQcm9taXNlIGlzIHJlc29sdmVkLlxyXG4gICAgICogQHBhcmFtIG9ucmVqZWN0ZWQgVGhlIGNhbGxiYWNrIHRvIGV4ZWN1dGUgd2hlbiB0aGUgUHJvbWlzZSBpcyByZWplY3RlZC5cclxuICAgICAqIEByZXR1cm5zIEEgUHJvbWlzZSBmb3IgdGhlIGNvbXBsZXRpb24gb2Ygd2hpY2ggZXZlciBjYWxsYmFjayBpcyBleGVjdXRlZC5cclxuICAgICAqL1xyXG4gICAgUHJvbWlzZS5wcm90b3R5cGUudGhlbiA9IGZ1bmN0aW9uIChvbmZ1bGZpbGxlZCwgb25yZWplY3RlZCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLl9hd2FpdChvbmZ1bGZpbGxlZCwgb25yZWplY3RlZCk7XHJcbiAgICB9O1xyXG4gICAgLyoqXHJcbiAgICAgKiBBdHRhY2hlcyBhIGNhbGxiYWNrIGZvciBvbmx5IHRoZSByZWplY3Rpb24gb2YgdGhlIFByb21pc2UuXHJcbiAgICAgKiBAcGFyYW0gb25yZWplY3RlZCBUaGUgY2FsbGJhY2sgdG8gZXhlY3V0ZSB3aGVuIHRoZSBQcm9taXNlIGlzIHJlamVjdGVkLlxyXG4gICAgICogQHJldHVybnMgQSBQcm9taXNlIGZvciB0aGUgY29tcGxldGlvbiBvZiB0aGUgY2FsbGJhY2suXHJcbiAgICAgKi9cclxuICAgIFByb21pc2UucHJvdG90eXBlW1wiY2F0Y2hcIl0gPSBmdW5jdGlvbiAob25yZWplY3RlZCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLl9hd2FpdCh1bmRlZmluZWQsIG9ucmVqZWN0ZWQpO1xyXG4gICAgfTtcclxuICAgIFByb21pc2UucHJvdG90eXBlLl9yZXNvbHZlID0gZnVuY3Rpb24gKHJlamVjdGluZywgcmVzdWx0KSB7XHJcbiAgICAgICAgdmFyIF90aGlzID0gdGhpcztcclxuICAgICAgICBpZiAoIXJlamVjdGluZykge1xyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMgPT09IHJlc3VsdClcclxuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IHJlc29sdmUgYSBwcm9taXNlIHdpdGggaXRzZWxmXCIpO1xyXG4gICAgICAgICAgICAgICAgaWYgKHJlc3VsdCAhPT0gbnVsbCAmJiAodHlwZW9mIHJlc3VsdCA9PT0gXCJvYmplY3RcIiB8fCB0eXBlb2YgcmVzdWx0ID09PSBcImZ1bmN0aW9uXCIpICYmIFwidGhlblwiIGluIHJlc3VsdCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciB0aGVuID0gcmVzdWx0LnRoZW47XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiB0aGVuID09PSBcImZ1bmN0aW9uXCIpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHJlc29sdmUgPSBmdW5jdGlvbiAocmVqZWN0aW5nLCByZXN1bHQpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUgPSBudWxsO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgX3RoaXMuX3Jlc29sdmUocmVqZWN0aW5nLCByZXN1bHQpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhlbi5jYWxsKHJlc3VsdCwgZnVuY3Rpb24gKHJlc3VsdCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUgJiYgcmVzb2x2ZShmYWxzZSwgcmVzdWx0KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sIGZ1bmN0aW9uIChyZXN1bHQpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlICYmIHJlc29sdmUodHJ1ZSwgcmVzdWx0KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSh0cnVlLCBlcnJvcik7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgICAgICAgICAgIHJlc3VsdCA9IGVycm9yO1xyXG4gICAgICAgICAgICAgICAgcmVqZWN0aW5nID0gdHJ1ZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLl9zZXR0bGUocmVqZWN0aW5nLCByZXN1bHQpO1xyXG4gICAgfTtcclxuICAgIFByb21pc2UucHJvdG90eXBlLl9hd2FpdCA9IGZ1bmN0aW9uIChvbnJlc29sdmVkLCBvbnJlamVjdGVkKSB7XHJcbiAgICAgICAgdmFyIF90aGlzID0gdGhpcztcclxuICAgICAgICB2YXIgaWQgPSBoYXNNc0RlYnVnICYmIERlYnVnLm1zVHJhY2VBc3luY09wZXJhdGlvblN0YXJ0aW5nKFwiUHJvbWlzZS50aGVuXCIpO1xyXG4gICAgICAgIHJldHVybiBuZXcgdGhpcy5jb25zdHJ1Y3RvcihmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XHJcbiAgICAgICAgICAgIHZhciBwcmV2ID0gX3RoaXMuX3NldHRsZTtcclxuICAgICAgICAgICAgX3RoaXMuX3NldHRsZSA9IGZ1bmN0aW9uIChyZWplY3RpbmcsIHJlc3VsdCkge1xyXG4gICAgICAgICAgICAgICAgX3RoaXMuX2ZvcndhcmQocHJldiwgcmVzb2x2ZSwgcmVqZWN0LCByZWplY3RpbmcsIHJlc3VsdCwgb25yZXNvbHZlZCwgb25yZWplY3RlZCwgaWQpO1xyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH0pO1xyXG4gICAgfTtcclxuICAgIFByb21pc2UucHJvdG90eXBlLl9zZXR0bGUgPSBmdW5jdGlvbiAocmVqZWN0aW5nLCByZXN1bHQpIHtcclxuICAgICAgICB2YXIgX3RoaXMgPSB0aGlzO1xyXG4gICAgICAgIHRoaXMuX3NldHRsZSA9IG51bGw7XHJcbiAgICAgICAgdGhpcy5fYXdhaXQgPSBmdW5jdGlvbiAob25mdWxmaWxsZWQsIG9ucmVqZWN0ZWQpIHtcclxuICAgICAgICAgICAgdmFyIGlkID0gaGFzTXNEZWJ1ZyAmJiBEZWJ1Zy5tc1RyYWNlQXN5bmNPcGVyYXRpb25TdGFydGluZyhcIlByb21pc2UudGhlblwiKTtcclxuICAgICAgICAgICAgcmV0dXJuIG5ldyBfdGhpcy5jb25zdHJ1Y3RvcihmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XHJcbiAgICAgICAgICAgICAgICBfdGhpcy5fZm9yd2FyZChudWxsLCByZXNvbHZlLCByZWplY3QsIHJlamVjdGluZywgcmVzdWx0LCBvbmZ1bGZpbGxlZCwgb25yZWplY3RlZCwgaWQpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9O1xyXG4gICAgfTtcclxuICAgIFByb21pc2UucHJvdG90eXBlLl9mb3J3YXJkID0gZnVuY3Rpb24gKHByZXYsIHJlc29sdmUsIHJlamVjdCwgcmVqZWN0aW5nLCByZXN1bHQsIG9ucmVzb2x2ZWQsIG9ucmVqZWN0ZWQsIGlkKSB7XHJcbiAgICAgICAgcHJldiAmJiBwcmV2LmNhbGwodGhpcywgcmVqZWN0aW5nLCByZXN1bHQpO1xyXG4gICAgICAgIHNjaGVkdWxlVGFzayhmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgaGFuZGxlciA9IHJlamVjdGluZyA/IG9ucmVqZWN0ZWQgOiBvbnJlc29sdmVkO1xyXG4gICAgICAgICAgICAgICAgaGFzTXNEZWJ1ZyAmJiBEZWJ1Zy5tc1RyYWNlQXN5bmNPcGVyYXRpb25Db21wbGV0ZWQoaWQsIHJlamVjdGluZyA/IERlYnVnLk1TX0FTWU5DX09QX1NUQVRVU19FUlJPUiA6IERlYnVnLk1TX0FTWU5DX09QX1NUQVRVU19TVUNDRVNTKTtcclxuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgaGFuZGxlciA9PT0gXCJmdW5jdGlvblwiKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaGFzTXNEZWJ1ZyAmJiBEZWJ1Zy5tc1RyYWNlQXN5bmNDYWxsYmFja1N0YXJ0aW5nKGlkKTtcclxuICAgICAgICAgICAgICAgICAgICByZXN1bHQgPSBoYW5kbGVyKHJlc3VsdCk7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0aW5nID0gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgY2F0Y2ggKGUpIHtcclxuICAgICAgICAgICAgICAgIHJlc3VsdCA9IGU7XHJcbiAgICAgICAgICAgICAgICByZWplY3RpbmcgPSB0cnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGZpbmFsbHkge1xyXG4gICAgICAgICAgICAgICAgaGFzTXNEZWJ1ZyAmJiBEZWJ1Zy5tc1RyYWNlQXN5bmNDYWxsYmFja0NvbXBsZXRlZCgpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIChyZWplY3RpbmcgPyByZWplY3QgOiByZXNvbHZlKShyZXN1bHQpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfTtcclxuICAgIHJldHVybiBQcm9taXNlO1xyXG59KSgpO1xyXG5leHBvcnRzLlByb21pc2UgPSBQcm9taXNlO1xyXG4vLyMgc291cmNlTWFwcGluZ1VSTD1maWxlOi8vL0N8L2Rldi9hc3luY2pzL3Byb21pc2UuanMubWFwIiwiZnVuY3Rpb24gc2NoZWR1bGVUYXNrKHRhc2spIHtcclxuICAgIGlmICghcXVldWUpIHtcclxuICAgICAgICBxdWV1ZSA9IHt9O1xyXG4gICAgfVxyXG4gICAgdmFyIG5vZGUgPSB7IHRhc2s6IHRhc2sgfTtcclxuICAgIGVucXVldWVUYXNrKHF1ZXVlLCBub2RlKTtcclxuICAgIHNjaGVkdWxlVGljaygpO1xyXG4gICAgcmV0dXJuIG5vZGU7XHJcbn1cclxuZXhwb3J0cy5zY2hlZHVsZVRhc2sgPSBzY2hlZHVsZVRhc2s7XHJcbmZ1bmN0aW9uIGNhbmNlbFRhc2soaGFuZGxlKSB7XHJcbiAgICBpZiAoIWhhbmRsZSkge1xyXG4gICAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIHZhciBub2RlID0gaGFuZGxlO1xyXG4gICAgaWYgKG5vZGUucXVldWUgPT09IHJlY292ZXJ5UXVldWUgfHwgbm9kZS5xdWV1ZSA9PT0gcXVldWUpIHtcclxuICAgICAgICByZW1vdmVUYXNrKG5vZGUucXVldWUsIG5vZGUpO1xyXG4gICAgfVxyXG4gICAgaWYgKHJlY292ZXJ5UXVldWUgJiYgIXJlY292ZXJ5UXVldWUuaGVhZCkge1xyXG4gICAgICAgIHJlY292ZXJ5UXVldWUgPSB1bmRlZmluZWQ7XHJcbiAgICB9XHJcbiAgICBpZiAocXVldWUgJiYgIXF1ZXVlLmhlYWQpIHtcclxuICAgICAgICBxdWV1ZSA9IHVuZGVmaW5lZDtcclxuICAgIH1cclxuICAgIGlmICghcmVjb3ZlcnlRdWV1ZSAmJiAhcXVldWUpIHtcclxuICAgICAgICBjYW5jZWxUaWNrKCk7XHJcbiAgICB9XHJcbn1cclxuZXhwb3J0cy5jYW5jZWxUYXNrID0gY2FuY2VsVGFzaztcclxudmFyIHNjaGVkdWxlcjtcclxudmFyIGhhbmRsZTtcclxudmFyIHJlY292ZXJ5UXVldWU7XHJcbnZhciBxdWV1ZTtcclxuZnVuY3Rpb24gc2NoZWR1bGVUaWNrKCkge1xyXG4gICAgaWYgKGhhbmRsZSA9PT0gdm9pZCAwKSB7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgaWYgKCFzY2hlZHVsZXIpIHtcclxuICAgICAgICBzY2hlZHVsZXIgPSBnZXRTY2hlZHVsZXIoKTtcclxuICAgIH1cclxuICAgIGhhbmRsZSA9IHNjaGVkdWxlci5zY2hlZHVsZVRpY2sob25UaWNrKTtcclxufVxyXG5mdW5jdGlvbiBjYW5jZWxUaWNrKCkge1xyXG4gICAgaWYgKGhhbmRsZSA9PT0gdm9pZCAwIHx8ICFzY2hlZHVsZXIpIHtcclxuICAgICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICBzY2hlZHVsZXIuY2FuY2VsVGljayhoYW5kbGUpO1xyXG4gICAgaGFuZGxlID0gdW5kZWZpbmVkO1xyXG59XHJcbmZ1bmN0aW9uIG9uVGljaygpIHtcclxuICAgIHByb2Nlc3NRdWV1ZShyZWNvdmVyeVF1ZXVlKTtcclxuICAgIHJlY292ZXJ5UXVldWUgPSBxdWV1ZTtcclxuICAgIHF1ZXVlID0gdW5kZWZpbmVkO1xyXG4gICAgcHJvY2Vzc1F1ZXVlKHJlY292ZXJ5UXVldWUpO1xyXG4gICAgcmVjb3ZlcnlRdWV1ZSA9IHVuZGVmaW5lZDtcclxufVxyXG5mdW5jdGlvbiBwcm9jZXNzUXVldWUocXVldWUpIHtcclxuICAgIGlmICghcXVldWUpIHtcclxuICAgICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICB2YXIgbm9kZTtcclxuICAgIHZhciB0YXNrQ29tcGxldGVkID0gZmFsc2U7XHJcbiAgICB3aGlsZSAobm9kZSA9IGRlcXVldWVUYXNrKHF1ZXVlKSkge1xyXG4gICAgICAgIHZhciB0YXNrID0gbm9kZS50YXNrO1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIHRhc2soKTtcclxuICAgICAgICAgICAgdGFza0NvbXBsZXRlZCA9IHRydWU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGZpbmFsbHkge1xyXG4gICAgICAgICAgICBpZiAoIXRhc2tDb21wbGV0ZWQpIHtcclxuICAgICAgICAgICAgICAgIHNjaGVkdWxlVGljaygpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59XHJcbmZ1bmN0aW9uIGVucXVldWVUYXNrKHF1ZXVlLCBub2RlKSB7XHJcbiAgICBub2RlLnByZXZpb3VzID0gcXVldWUudGFpbDtcclxuICAgIG5vZGUucXVldWUgPSBxdWV1ZTtcclxuICAgIGlmIChxdWV1ZS50YWlsKSB7XHJcbiAgICAgICAgcXVldWUudGFpbC5uZXh0ID0gbm9kZTtcclxuICAgIH1cclxuICAgIGVsc2Uge1xyXG4gICAgICAgIHF1ZXVlLmhlYWQgPSBub2RlO1xyXG4gICAgfVxyXG4gICAgcXVldWUudGFpbCA9IG5vZGU7XHJcbn1cclxuZnVuY3Rpb24gZGVxdWV1ZVRhc2socXVldWUpIHtcclxuICAgIGlmICghcXVldWUpIHtcclxuICAgICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICB2YXIgbm9kZSA9IHF1ZXVlLnRhaWw7XHJcbiAgICBpZiAobm9kZSkge1xyXG4gICAgICAgIHJlbW92ZVRhc2socXVldWUsIG5vZGUpO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIG5vZGU7XHJcbn1cclxuZnVuY3Rpb24gcmVtb3ZlVGFzayhxdWV1ZSwgbm9kZSkge1xyXG4gICAgaWYgKCFxdWV1ZSkge1xyXG4gICAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIGlmIChub2RlLm5leHQpIHtcclxuICAgICAgICBub2RlLm5leHQucHJldmlvdXMgPSBub2RlLnByZXZpb3VzO1xyXG4gICAgfVxyXG4gICAgaWYgKG5vZGUucHJldmlvdXMpIHtcclxuICAgICAgICBub2RlLnByZXZpb3VzLm5leHQgPSBub2RlLm5leHQ7XHJcbiAgICB9XHJcbiAgICBpZiAobm9kZSA9PT0gcXVldWUudGFpbCkge1xyXG4gICAgICAgIHF1ZXVlLnRhaWwgPSBub2RlLnByZXZpb3VzO1xyXG4gICAgfVxyXG4gICAgaWYgKG5vZGUgPT09IHF1ZXVlLmhlYWQpIHtcclxuICAgICAgICBxdWV1ZS5oZWFkID0gbm9kZS5uZXh0O1xyXG4gICAgfVxyXG4gICAgbm9kZS5uZXh0ID0gdW5kZWZpbmVkO1xyXG4gICAgbm9kZS5wcmV2aW91cyA9IHVuZGVmaW5lZDtcclxuICAgIG5vZGUucXVldWUgPSB1bmRlZmluZWQ7XHJcbn1cclxuZnVuY3Rpb24gZ2V0U2NoZWR1bGVyKCkge1xyXG4gICAgaWYgKHR5cGVvZiBzZXRJbW1lZGlhdGUgPT09IFwiZnVuY3Rpb25cIikge1xyXG4gICAgICAgIHJldHVybiBnZXRTZXRJbW1lZGlhdGVTY2hlZHVsZXIoKTtcclxuICAgIH1cclxuICAgIGVsc2UgaWYgKHR5cGVvZiBtc1NldEltbWVkaWF0ZSA9PT0gXCJmdW5jdGlvblwiKSB7XHJcbiAgICAgICAgcmV0dXJuIGdldE1TU2V0SW1tZWRpYXRlU2NoZWR1bGVyKCk7XHJcbiAgICB9XHJcbiAgICBlbHNlIGlmICh0eXBlb2YgcHJvY2VzcyA9PT0gXCJvYmplY3RcIiAmJiB0eXBlb2YgcHJvY2Vzcy5uZXh0VGljayA9PT0gXCJmdW5jdGlvblwiKSB7XHJcbiAgICAgICAgcmV0dXJuIGdldE5leHRUaWNrU2NoZWR1bGVyKCk7XHJcbiAgICB9XHJcbiAgICBlbHNlIGlmICh0eXBlb2Ygc2V0VGltZW91dCA9PT0gXCJmdW5jdGlvblwiKSB7XHJcbiAgICAgICAgcmV0dXJuIGdldFNldFRpbWVvdXRTY2hlZHVsZXIoKTtcclxuICAgIH1cclxuICAgIGVsc2Uge1xyXG4gICAgICAgIHJldHVybiBnZXRNaXNzaW5nU2NoZWR1bGVyKCk7XHJcbiAgICB9XHJcbiAgICBmdW5jdGlvbiBnZXRTZXRJbW1lZGlhdGVTY2hlZHVsZXIoKSB7XHJcbiAgICAgICAgcmV0dXJuIHsgc2NoZWR1bGVUaWNrOiBzY2hlZHVsZVRpY2ssIGNhbmNlbFRpY2s6IGNhbmNlbFRpY2sgfTtcclxuICAgICAgICBmdW5jdGlvbiBzY2hlZHVsZVRpY2soY2FsbGJhY2spIHtcclxuICAgICAgICAgICAgcmV0dXJuIHNldEltbWVkaWF0ZShjYWxsYmFjayk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGZ1bmN0aW9uIGNhbmNlbFRpY2soaGFuZGxlKSB7XHJcbiAgICAgICAgICAgIGNsZWFySW1tZWRpYXRlKGhhbmRsZSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgZnVuY3Rpb24gZ2V0TVNTZXRJbW1lZGlhdGVTY2hlZHVsZXIoKSB7XHJcbiAgICAgICAgcmV0dXJuIHsgc2NoZWR1bGVUaWNrOiBzY2hlZHVsZVRpY2ssIGNhbmNlbFRpY2s6IGNhbmNlbFRpY2sgfTtcclxuICAgICAgICBmdW5jdGlvbiBzY2hlZHVsZVRpY2soY2FsbGJhY2spIHtcclxuICAgICAgICAgICAgcmV0dXJuIG1zU2V0SW1tZWRpYXRlKGNhbGxiYWNrKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZnVuY3Rpb24gY2FuY2VsVGljayhoYW5kbGUpIHtcclxuICAgICAgICAgICAgbXNDbGVhckltbWVkaWF0ZShoYW5kbGUpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIGZ1bmN0aW9uIGdldE5leHRUaWNrU2NoZWR1bGVyKCkge1xyXG4gICAgICAgIHZhciBuZXh0SGFuZGxlID0gMTtcclxuICAgICAgICByZXR1cm4geyBzY2hlZHVsZVRpY2s6IHNjaGVkdWxlVGljaywgY2FuY2VsVGljazogY2FuY2VsVGljayB9O1xyXG4gICAgICAgIGZ1bmN0aW9uIHNjaGVkdWxlVGljayhjYWxsYmFjaykge1xyXG4gICAgICAgICAgICB2YXIgaGFuZGxlID0geyBjYW5jZWxlZDogZmFsc2UgfTtcclxuICAgICAgICAgICAgcHJvY2Vzcy5uZXh0VGljayhmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoaGFuZGxlLmNhbmNlbGVkKVxyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgICAgIGNhbGxiYWNrKCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICByZXR1cm4gaGFuZGxlO1xyXG4gICAgICAgIH1cclxuICAgICAgICBmdW5jdGlvbiBjYW5jZWxUaWNrKGhhbmRsZSkge1xyXG4gICAgICAgICAgICBpZiAoaGFuZGxlKVxyXG4gICAgICAgICAgICAgICAgaGFuZGxlLmNhbmNlbGVkID0gdHJ1ZTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBmdW5jdGlvbiBnZXRTZXRUaW1lb3V0U2NoZWR1bGVyKCkge1xyXG4gICAgICAgIHJldHVybiB7IHNjaGVkdWxlVGljazogc2NoZWR1bGVUaWNrLCBjYW5jZWxUaWNrOiBjYW5jZWxUaWNrIH07XHJcbiAgICAgICAgZnVuY3Rpb24gc2NoZWR1bGVUaWNrKGNhbGxiYWNrKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBzZXRUaW1lb3V0KGNhbGxiYWNrLCAwKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZnVuY3Rpb24gY2FuY2VsVGljayhoYW5kbGUpIHtcclxuICAgICAgICAgICAgY2xlYXJUaW1lb3V0KGhhbmRsZSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgZnVuY3Rpb24gZ2V0TWlzc2luZ1NjaGVkdWxlcigpIHtcclxuICAgICAgICByZXR1cm4geyBzY2hlZHVsZVRpY2s6IHNjaGVkdWxlVGljaywgY2FuY2VsVGljazogY2FuY2VsVGljayB9O1xyXG4gICAgICAgIGZ1bmN0aW9uIHNjaGVkdWxlVGljaygpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiU2NoZWR1bGVyIG5vdCBhdmFpbGFibGUuXCIpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBmdW5jdGlvbiBjYW5jZWxUaWNrKCkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJTY2hlZHVsZXIgbm90IGF2YWlsYWJsZS5cIik7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59XHJcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWZpbGU6Ly8vQ3wvZGV2L2FzeW5janMvdGFzay5qcy5tYXAiXX0=
