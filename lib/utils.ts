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
import { Promise } from './promise';
import { CancellationToken, CancellationTokenRegistration } from './cancellation';
import { scheduleImmediateTask, scheduleDelayedTask } from './task';

export function sleep(delay: number, token: CancellationToken = CancellationToken.none): Promise<void> {
    if ((delay |= 0) < 0) {
        throw new RangeError();
    }
    if (token.canceled) {
        return Promise.reject(token.reason);
    }
    return new Promise<void>((resolve, reject) => {
        scheduleDelayedTask(resolve, delay, token);
        token.register(reject);
    });
}

export function spin(token: CancellationToken = CancellationToken.none): Promise<void> {
    if (token.canceled) {
        return Promise.reject(token.reason);
    }
    return new Promise<void>((resolve, reject) => {
        scheduleImmediateTask(resolve, token);
        token.register(reject);
    });
}

export var resolvedPromise = <Promise<void>>Object.freeze(Promise.resolve());