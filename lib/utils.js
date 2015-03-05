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
var _promise = require('./promise');
var _cancellation = require('./cancellation');
var _task = require('./task');
function sleep(delay, token) {
    if (token === void 0) { token = _cancellation.CancellationToken.none; }
    if ((delay |= 0) < 0) {
        throw new RangeError();
    }
    if (token.canceled) {
        return _promise.Promise.reject(token.reason);
    }
    return new _promise.Promise(function (resolve, reject) {
        _task.scheduleDelayedTask(resolve, delay, token);
        token.register(reject);
    });
}
exports.sleep = sleep;
function spin(token) {
    if (token === void 0) { token = _cancellation.CancellationToken.none; }
    if (token.canceled) {
        return _promise.Promise.reject(token.reason);
    }
    return new _promise.Promise(function (resolve, reject) {
        _task.scheduleImmediateTask(resolve, token);
        token.register(reject);
    });
}
exports.spin = spin;
exports.resolvedPromise = Object.freeze(_promise.Promise.resolve());
//# sourceMappingURL=file:///C|/dev/asyncjs/utils.js.map