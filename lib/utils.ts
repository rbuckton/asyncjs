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
import promise = require('./promise');
import cancellation = require('./cancellation');
import task = require('./task');
import Promise = promise.Promise;
import CancellationToken = cancellation.CancellationToken;
import CancellationTokenRegistration = cancellation.CancellationTokenRegistration;
import scheduleTask = task.scheduleTask;

export function sleep(delay: number = 0, token: CancellationToken = CancellationToken.none): Promise<void> {
    if (typeof delay !== "number") {
        throw new TypeError("Number expected.");
    }
    if (token.canceled) {
        return Promise.reject<void>(token.reason);
    }
    if (!token.canBeCanceled && delay <= 0) {
        return Promise.resolve();
    }
    return new Promise<void>((resolve, reject) => {
        token.register(reject);
        scheduleTask(resolve, delay, token);
    });
}
