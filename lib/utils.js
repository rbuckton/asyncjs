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
var promise_1 = require('./promise');
var cancellation_1 = require('./cancellation');
var task_1 = require('./task');
function sleep(delay, token) {
    if (delay === void 0) { delay = 0; }
    if (token === void 0) { token = cancellation_1.CancellationToken.none; }
    if (typeof delay !== "number") {
        throw new TypeError("Number expected.");
    }
    if (token.canceled) {
        return promise_1.Promise.reject(token.reason);
    }
    if (!token.canBeCanceled && delay <= 0) {
        return promise_1.Promise.resolve();
    }
    return new promise_1.Promise(function (resolve, reject) {
        token.register(reject);
        task_1.scheduleTask(resolve, delay, token);
    });
}
exports.sleep = sleep;
//# sourceMappingURL=file:///C|/dev/asyncjs/utils.js.map