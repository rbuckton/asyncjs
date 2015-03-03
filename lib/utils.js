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