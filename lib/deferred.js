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
var Deferred = (function () {
    function Deferred() {
        var _this = this;
        this._promise = new promise_1.Promise(function (resolve, reject) {
            _this._resolve = resolve;
            _this._reject = reject;
        });
    }
    Object.defineProperty(Deferred.prototype, "promise", {
        get: function () {
            return this._promise;
        },
        enumerable: true,
        configurable: true
    });
    Deferred.prototype.resolve = function (value) {
        this._resolve(value);
    };
    Deferred.prototype.reject = function (reason) {
        this._reject(reason);
    };
    return Deferred;
})();
exports.Deferred = Deferred;
//# sourceMappingURL=file:///C|/dev/asyncjs/deferred.js.map