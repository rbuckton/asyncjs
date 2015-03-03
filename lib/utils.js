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
var cancellation = require('./cancellation');
var task = require('./task');
var Promise = promise.Promise;
var CancellationToken = cancellation.CancellationToken;
var scheduleTask = task.scheduleTask;
function sleep(delay, token) {
    if (delay === void 0) { delay = 0; }
    if (token === void 0) { token = CancellationToken.none; }
    if (typeof delay !== "number") {
        throw new TypeError("Number expected.");
    }
    if (token.canceled) {
        return Promise.reject(token.reason);
    }
    if (!token.canBeCanceled && delay <= 0) {
        return Promise.resolve();
    }
    return new Promise(function (resolve, reject) {
        token.register(reject);
        scheduleTask(resolve, delay, token);
    });
}
exports.sleep = sleep;
//# sourceMappingURL=file:///C|/dev/asyncjs/utils.js.map