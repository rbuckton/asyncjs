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
var hasMsNonUserCodeExceptions =
    typeof Debug !== "undefined" &&
    typeof Debug.setNonUserCodeExceptions === "boolean";

/**
 * A token used to recieve a cancellation signal.
 */
export interface CancellationToken {
    /**
     * Gets a value indicating whether the token has received a cancellation signal.
     */
    canceled: boolean;

    /**
     * Gets the reason for cancellation, if one was supplied.
     */
    reason: any;

    /**
     * Throws an `Error` if the token has received a cancellation signal.
     */
    throwIfCanceled(): void;

    /**
     * Requests a callback when the token receives a cancellation signal, to perform additional cleanup.
     * @param callback The callback to execute 
     * @returns A `CancellationRegistration` that that can be used to cancel the cleanup request.
     */
    register(callback: (reason: any) => void): CancellationRegistration;
}

/**
 * An object used to unregister a callback delegate registered to a `CancellationToken`
 */
export interface CancellationRegistration {
    /**
     * Unregisters the callback
     */
    unregister(): void;
}

/**
 * A source for cancellation
 */
export class CancellationTokenSource {

    private static _canceled: CancellationToken;

    private _callbacks: Map<any, (reason: any) => void>;
    private _links: Array<CancellationRegistration>;
    private _token: CancellationToken;
    private _timer: any;
    private _canceled: boolean;
    private _reason: any;

    /**
     * A source for cancellation
     * @param delay The number of milliseconds to wait before cancelling the source
     * @param links Other `CancellationToken` instances that will cancel this source if the tokens are canceled.
     */
    constructor(delay: number, ...links: CancellationToken[]);

    /**
     * A source for cancellation
     * @param delay The number of milliseconds to wait before cancelling the source
     * @param links Other `CancellationToken` instances that will cancel this source if the tokens are canceled.
     */
    constructor(delay: number, links: CancellationToken[]);

    /**
     * A source for cancellation
     * @param delay The number of milliseconds to wait before cancelling the source
     */
    constructor(delay: number);

    /**
     * A source for cancellation
     * @param links Other `CancellationToken` instances that will cancel this source if the tokens are canceled.
     */
    constructor(...links: CancellationToken[]);

    /**
     * A source for cancellation
     * @param links Other `CancellationToken` instances that will cancel this source if the tokens are canceled.
     */
    constructor(links: CancellationToken[]);

    constructor(...args: any[]) {
        var delay = -1;
        var links: CancellationToken[];

        if (typeof args[0] === "number") {
            delay = args.shift() | 0;
            if (delay < 0) throw new RangeError();
        }

        if (Array.isArray(args[0])) {
            links = args.shift();
        }
        else if (args.length) {
            links = args;
        }

        var source = this;
        this._token = Object.freeze({
            get canceled(): boolean {
                return source._canceled;
            },
            get reason(): any {
                return source._reason;
            },
            throwIfCanceled(): void {
                if (source._canceled) {
                    throw source._reason;
                }
            },
            register(callback: (reason: any) => void): CancellationRegistration {
                return source._register(callback);
            }
        });

        if (links) {
            this._links = new Array<CancellationRegistration>();
            for (var i = 0, l = links.length; i < l; i++) {
                var link = links[i];
                if (!link) {
                    continue;
                }

                if (link.canceled) {
                    this._canceled = true;
                    this._reason = link.reason;
                    return;
                }

                this._links.push(link.register(reason => {
                    this._cancelCore(reason);
                }));
            }
        }

        if (delay >= 0) {
            this.cancelAfter(delay);
        }
    }

    /**
     * Gets an already cancelled `CancellationToken`.
     */
    public static get canceled(): CancellationToken {
        if (!CancellationTokenSource._canceled) {
            var cts = new CancellationTokenSource();
            cts.cancel();
            CancellationTokenSource._canceled = cts.token;
        }

        return CancellationTokenSource._canceled;
    }

    /**
     * Gets a value indicating whether the token has received a cancellation signal.
     */
    public get canceled(): boolean {
        return this._canceled;
    }

    /**
     * Gets the reason for cancellation, if one was supplied.
     */
    public get reason(): any {
        return this._reason;
    }

    /**
     * Gets the `CancellationToken` for this source.
     */
    public get token(): CancellationToken {
        return this._token;
    }

    /**
     * Signals the source is cancelled.
     * @param reason An optional reason for the cancellation.
     */
    public cancel(reason?: any): void {
        if (this._canceled) {
            return;
        }

        this._throwIfFrozen();
        this._cancelCore(reason);
    }

    /**
     * Signals the source is canceled after a delay.
     * @param delay The number of milliseconds to delay before signalling cancellation.
     * @param reason An optional reason for the cancellation.
     */
    public cancelAfter(delay: number, reason?: any): void {
        if (this._canceled) {
            return;
        }

        this._throwIfFrozen();
        this._clearTimeout();
        this._timer = setTimeout(CancellationTokenSource._ontimeout, delay, this, reason);
    }

    /**
     * Closes the CancellationSource, preventing any future cancellation signal.
     */
    public close(): void {
        if (Object.isFrozen(this)) {
            return;
        }

        this._clearTimeout();

        if (this._links) {
            var links = this._links;
            for (var i = 0, l = links.length; i < l; i++) {
                links[i].unregister();
            }
        }

        if (this._callbacks) {
            this._callbacks.clear();
        }

        this._links = null;
        this._callbacks = null;

        Object.freeze(this);
    }

    private static _ontimeout(source: CancellationTokenSource, reason: any): void {
        source._timer = null;

        if (!Object.isFrozen(source)) {
            source._cancelCore(reason);
        }
    }

    private _register(callback: (reason: any) => void): CancellationRegistration {
        if (typeof callback !== "function") throw new TypeError("argument is not a Function object");

        if (this._canceled) {
            callback(this._reason);
            return emptyRegistration;
        }

        if (Object.isFrozen(this)) {
            return emptyRegistration;
        }

        var cookie = {};
        var callbacks = this._callbacks || (this._callbacks = new Map<any,(reason: any) => void>());
        callbacks.set(cookie, callback);

        return {
            unregister() {
                callbacks.delete (cookie);
            }
        };
    }

    private _cancelCore(reason: any): void {
        if (hasMsNonUserCodeExceptions) Debug.setNonUserCodeExceptions = true;
        if (this._canceled) {
            return;
        }

        this._clearTimeout();

        if (reason == null) {
            reason = new Error("operation was canceled.");
        }

        if (reason instanceof Error && !("stack" in reason)) {
            try {
                throw reason;
            }
            catch (error) {
                reason = error;
            }
        }

        this._canceled = true;
        this._reason = reason;

        if (this._callbacks) {
            var callbacks = this._callbacks;
            this._callbacks = null;

            try {
                callbacks.forEach(callback => {
                    callback(reason);
                });
            }
            finally {
                callbacks.clear();
            }
        }
    }

    private _clearTimeout(): void {
        if (this._timer != null) {
            clearTimeout(this._timer);
            this._timer = null;
        }
    }

    private _throwIfFrozen(): void {
        if (Object.isFrozen(this)) {
            throw new Error("cannot modify a closed source");
        }
    }
}

var emptyRegistration: CancellationRegistration = Object.freeze({ unregister() { } });