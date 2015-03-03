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
import IPromise = promise.IPromise;
import Promise = promise.Promise;

export class Deferred<T> {
    private _promise: Promise<T>;
    private _resolve: (value?: IPromise<T> | T) => void;
    private _reject: (reason: any) => void;

    constructor() {
        this._promise = new Promise<T>((resolve, reject) => {
            this._resolve = resolve;
            this._reject = reject;
        });
    }

    public get promise(): Promise<T> {
        return this._promise;
    }

    public resolve(value?: IPromise<T> | T): void {
        this._resolve(value);
    }

    public reject(reason: any): void {
        this._reject(reason);
    }
}
