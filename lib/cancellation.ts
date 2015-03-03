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
import list = require('./list');
import LinkedList = list.LinkedList;
import LinkedListNode = list.LinkedListNode;

var hasMsNonUserCodeExceptions =
    typeof Debug !== "undefined" &&
    typeof Debug.setNonUserCodeExceptions === "boolean";

/**
  * A source for cancellation
  */
export class CancellationTokenSource {
    private static _canceled: CancellationToken;
    private _callbacks: LinkedList<(reason: any) => void>;
    private _links: Array<CancellationTokenRegistration>;
    private _token: CancellationToken;
    private _canceled: boolean;
    private _reason: any;

    /**
      * @param links Other `CancellationToken` instances that will cancel this source if the tokens are canceled.
      */
    constructor(links?: CancellationToken[]) {
        this._token = new CancellationToken(this);
        Object.defineProperty(this, "_token", { writable: false, configurable: false });
        if (links) {
            this._links = new Array<CancellationTokenRegistration>();
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
                    this.cancel(reason);
                }));
            }
        }
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
        if (reason == null) {
            reason = new Error("operation was canceled.");
        }
        if (reason instanceof Error && !("stack" in reason)) {
            if (hasMsNonUserCodeExceptions) {
                Debug.setNonUserCodeExceptions = true;
            }
            try {
                throw reason;
            }
            catch (error) {
                reason = error;
            }
        }
        var callbacks = this._callbacks;
        this._canceled = true;
        this._reason = reason;
        this._callbacks = null;
        Object.freeze(this);
        if (callbacks) {
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

    /**
     * Closes the CancellationSource, preventing any future cancellation signal.
     */
    public close(): void {
        if (Object.isFrozen(this)) {
            return;
        }
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

    private _register(callback: (reason: any) => void): CancellationTokenRegistration {
        if (typeof callback !== "function") throw new TypeError("argument is not a Function object");
        if (this._canceled) {
            callback(this._reason);
            return emptyRegistration;
        }
        if (Object.isFrozen(this)) {
            return emptyRegistration;
        }
        var callbacks = this._callbacks;
        if (!callbacks) {
            callbacks = new LinkedList<(reason: any) => void>();
            this._callbacks = callbacks;
        }        
        var cookie = callbacks.addLast(callback);
        return Object.freeze({
            unregister() {
                callbacks.deleteNode(cookie);
            }
        });
    }

    private _throwIfFrozen(): void {
        if (Object.isFrozen(this)) {
            throw new Error("cannot modify a closed source");
        }
    }
}

/**
  * A token used to recieve a cancellation signal.
  */
export class CancellationToken {
    private static _none: CancellationToken;
    private _source: CancellationTokenSource;
    
    /*@internal*/
    constructor(source: CancellationTokenSource) {
        this._source = source;
        Object.freeze(this);
    }
    
    /**
      * Gets an empty cancellation token that will never be canceled.
      */
    public static get none(): CancellationToken {
        if (!CancellationToken._none) {            
            CancellationToken._none = new CancellationToken(/*source*/ undefined);
        }
        return CancellationToken._none;
    }
    
    /**
      * Gets a value indicating whether the token has received a cancellation signal.
      */
    public get canceled(): boolean { 
        if (!this._source) {
            return false;
        }
        return (<any>this._source)._canceled;
    }
    
    /**
      * Gets the reason for cancellation, if one was supplied.
      */
    public get reason(): any {
        if (!this._source) {
            return undefined;
        }
        return (<any>this._source)._reason;
    }
    
    /**
      * Throws an `Error` if the token has received a cancellation signal.
      */
    public throwIfCanceled(reason: any = this.reason): void {
        if (!this._source) {
            return;
        }
        if (this.canceled) {
            throw reason;
        }
    }
    
    /**
      * Requests a callback when the token receives a cancellation signal to perform additional cleanup.
      * @param callback The callback to execute 
      * @returns A `CancellationTokenRegistration` that that can be used to cancel the cleanup request.
      */
    public register(callback: (reason: any) => void): CancellationTokenRegistration {
        if (!this._source) {
            return emptyRegistration;
        }
        
        return (<any>this._source)._register(callback);
    }
}

/**
  * An object used to unregister a callback delegate registered to a `CancellationToken`
  */
export interface CancellationTokenRegistration {
    /**
      * Unregisters the callback
      */
    unregister(): void;
}

var emptyRegistration: CancellationTokenRegistration = Object.freeze({ unregister(): void { } });