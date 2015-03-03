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
import cancelTask = task.cancelTask;

export function sleep(delay: number = 0, token?: CancellationToken): Promise<void> {
    if (typeof delay !== "number") {
        throw new TypeError("Number expected.");
    }

    if (token && token.canceled) {
        return Promise.reject<void>(token.reason);
    }

    var schedule: (task: () => void) => any;
    var cancel: (handle: any) => void;

    if (delay <= 0) {
        schedule = scheduleTask;
        cancel = cancelTask;
    }
    else {
        schedule = task => setTimeout(task, delay);
        cancel = clearTimeout;
    }

    return new Promise<void>((resolve, reject) => {
        var registration: CancellationTokenRegistration;
        var handle = schedule(() => {
            if (registration) {
                registration.unregister();
                registration = undefined;
            }

            resolve();
        });

        if (token) {
            registration = token.register(reason => {
                cancel(handle);
                handle = undefined;
                reject(reason);
            });
        }
    });
}
