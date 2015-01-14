var promise = require('./promise');
var task = require('./task');
var Promise = promise.Promise;
var scheduleTask = task.scheduleTask;
var cancelTask = task.cancelTask;
function sleep(delay, token) {
    if (delay === void 0) { delay = 0; }
    if (typeof delay !== "number") {
        throw new TypeError("Number expected.");
    }
    if (token && token.canceled) {
        return Promise.reject(token.reason);
    }
    var schedule;
    var cancel;
    if (delay <= 0) {
        schedule = scheduleTask;
        cancel = cancelTask;
    }
    else {
        schedule = function (task) { return setTimeout(task, delay); };
        cancel = clearTimeout;
    }
    return new Promise(function (resolve, reject) {
        var registration;
        var handle = schedule(function () {
            if (registration) {
                registration.unregister();
                registration = undefined;
            }
            resolve();
        });
        if (token) {
            registration = token.register(function (reason) {
                cancel(handle);
                handle = undefined;
                reject(reason);
            });
        }
    });
}
exports.sleep = sleep;
//# sourceMappingURL=file:///C|/dev/asyncjs/utils.js.map