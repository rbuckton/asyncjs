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
import task = require('./task');
import scheduleTask = task.scheduleTask;

var hasMsDebug = 
    typeof Debug !== "undefined" &&
    typeof Debug.msTraceAsyncOperationStarting === "function" &&
    typeof Debug.msTraceAsyncOperationCompleted === "function" &&
    typeof Debug.msTraceAsyncCallbackStarting === "function" &&
    typeof Debug.msTraceAsyncCallbackCompleted === "function";

export interface IPromise<T> {
    then<TResult>(onfulfilled: (value: T) => TResult | IPromise<TResult>, onrejected: (reason: any) => TResult | IPromise<TResult>): IPromise<TResult>;
}

/**
 * Represents the completion of an asynchronous operation
 */
export class Promise<T> {
    /**
     * Creates a new Promise.
     * @param init A callback used to initialize the promise. This callback is passed two arguments: a resolve callback used resolve the promise with a value or the result of another promise, and a reject callback used to reject the promise with a provided reason or error.
     */
    constructor(init: (resolve: (value?: IPromise<T> | T) => void, reject: (reason?: any) => void) => void) {
        if (typeof init !== "function") throw new TypeError("argument is not a Function object");
        var resolve = (rejecting: boolean, result: any) => { resolve = null; this._resolve(rejecting, result); };
        try {
            init(value => { resolve && resolve(false, value) }, error => { resolve && resolve(true, error) });
        }
        catch (error) {
            resolve(true, error);
        }
    }

    /**
     * Creates a new resolved promise for the provided value.
     * @param value A promise.
     * @returns A promise whose internal state matches the provided promise.
     */
    public static resolve<T>(value: IPromise<T> | T): Promise<T>;

    /**
     * Creates a new resolved promise .
     * @returns A resolved promise.
     */
    public static resolve(): Promise<void>;

    public static resolve(value?: any): Promise<any> {
        return (value instanceof this) ? value : new Promise<any>(resolve => resolve(value));
    }

    /**
     * Creates a new rejected promise for the provided reason.
     * @param reason The reason the promise was rejected.
     * @returns A new rejected Promise.
     */
    public static reject(reason: any): Promise<void>;

    /**
     * Creates a new rejected promise for the provided reason.
     * @param reason The reason the promise was rejected.
     * @returns A new rejected Promise.
     */
    public static reject<T>(reason: any): Promise<T>;

    public static reject<T>(reason: any): Promise<T> {
        return new Promise<any>((_, reject) => reject(reason));
    }

    /**
     * Creates a Promise that is resolved with an array of results when all of the provided Promises resolve, or rejected when any Promise is rejected.
     * @param values An array of Promises.
     * @returns A new Promise.
     */
    public static all<T>(values: Array<IPromise<T> | T>): Promise<T[]>;

    /**
     * Creates a Promise that is resolved with an array of results when all of the provided Promises resolve, or rejected when any Promise is rejected.
     * @param values An array of values.
     * @returns A new Promise.
     */
    public static all(values: IPromise<void>[]): Promise<void>;

    public static all(values: any[]): Promise<any> {
        return new this((resolve, reject) => {
            var countdown = values.length || 0;
            if (countdown <= 0) {
                resolve([]);
                return;
            }

            var results = Array(countdown);
            for (var i = 0; i < results.length; i++) {
                this.resolve(values[i]).then(((index: number) => (value: any) => {
                    results[index] = value;
                    if (--countdown == 0) {
                        resolve(results);
                    }
                })(i), reject);
            }
        });
    }

    /**
     * Creates a Promise that is resolved or rejected when any of the provided Promises are resolved or rejected.
     * @param values An array of Promises.
     * @returns A new Promise.
     */
    public static race<T>(values: Array<IPromise<T> | T>): Promise<T>;

    public static race(values: any[]): Promise<any> {
        return new this((resolve, reject) => {
            var promises: Promise<any>[] = values.map<Promise<any>>(this.resolve, this);
            promises.forEach(promise => promise.then<any>(resolve, reject));
        });
    }

    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved. 
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    public then<TResult>(
        onfulfilled?: (value: T) => IPromise<TResult> | TResult,
        onrejected?: (reason: any) => IPromise<TResult> | TResult): Promise<TResult> {
        return this._await(onfulfilled, onrejected);
    }

    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    public catch(onrejected: (reason: any) => IPromise<T> | T): Promise<T> {
        return this._await(undefined, onrejected);
    }

    /**
     * Attaches a callback for that is executed regardless of the resolution or rejection of the promise.
     * @param onsettled The callback to execute when the Promise is settled.
     * @returns A Promise for the completion of the callback.
     */
    public finally(onsettled: () => IPromise<void> | void): Promise<T> {
        return this._await(
            value => new Promise<void>(resolve => resolve(onsettled())).then(() => Promise.resolve(value)),
            reason => new Promise<void>(resolve => resolve(onsettled())).then(() => Promise.reject(reason)));
    }

    private _resolve(rejecting: boolean, result: any): void {
        if (!rejecting) {
            try {
                if (this === result) throw new TypeError("Cannot resolve a promise with itself");
                if (result !== null && (typeof result === "object" || typeof result === "function") && "then" in result) {
                    var then = result.then;
                    if (typeof then === "function") {
                        var resolve = (rejecting: boolean, result: any) => { resolve = null; this._resolve(rejecting, result) };
                        try {
                            then.call(result,(result: any) => { resolve && resolve(false, result) },(result: any) => { resolve && resolve(true, result) });
                        }
                        catch (error) {
                            resolve(true, error);
                        }

                        return;
                    }
                }
            }
            catch (error) {
                result = error;
                rejecting = true;
            }
        }

        this._settle(rejecting, result);
    }

    private _await(onresolved: (value: any) => any, onrejected: (value: any) => any): Promise<any> {
        var id = hasMsDebug && Debug.msTraceAsyncOperationStarting("Promise.then");
        return new (<typeof Promise>this.constructor)((resolve, reject) => {
            var prev = this._settle;
            this._settle = (rejecting: boolean, result: any): void => {
                this._forward(prev, resolve, reject, rejecting, result, onresolved, onrejected, id);
            }
        });
    }

    private _settle(rejecting: boolean, result: any): void {
        this._settle = null;
        this._await = (onfulfilled: (value: any) => any, onrejected: (value: any) => any): Promise<any> => {
            var id = hasMsDebug && Debug.msTraceAsyncOperationStarting("Promise.then");
            return new (<typeof Promise>this.constructor)((resolve, reject) => {
                this._forward(null, resolve, reject, rejecting, result, onfulfilled, onrejected, id);
            });
        }
    }

    private _forward(prev: (rejecting: boolean, result: any) => void, resolve: (value: any) => void, reject: (value: any) => void, rejecting: boolean, result: any, onresolved: (value: any) => any, onrejected: (error: any) => any, id: number): void {
        prev && prev.call(this, rejecting, result);
        scheduleTask(() => {
            try {
                var handler = rejecting ? onrejected : onresolved;
                hasMsDebug && Debug.msTraceAsyncOperationCompleted(id, rejecting ? Debug.MS_ASYNC_OP_STATUS_ERROR : Debug.MS_ASYNC_OP_STATUS_SUCCESS);
                if (typeof handler === "function") {
                    hasMsDebug && Debug.msTraceAsyncCallbackStarting(id);
                    result = handler(result);
                    rejecting = false;
                }
            }
            catch (e) {
                result = e;
                rejecting = true;
            }
            finally {
                hasMsDebug && Debug.msTraceAsyncCallbackCompleted();
            }

            (rejecting ? reject : resolve)(result);
        });
    }
}
