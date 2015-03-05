import promise = require('./promise');
import Promise = promise.Promise;
/**
  * A source for cancellation
  */
export declare class CancellationTokenSource {
    private static _canceled;
    private _callbacks;
    private _links;
    private _token;
    private _canceled;
    private _reason;
    /**
      * @param links Other `CancellationToken` instances that will cancel this source if the tokens are canceled.
      */
    constructor(links?: CancellationToken[]);
    /**
     * Gets the `CancellationToken` for this source.
     */
    token: CancellationToken;
    /**
     * Signals the source is cancelled.
     * @param reason An optional reason for the cancellation.
     */
    cancel(reason?: any): Promise<void>;
    /**
     * Closes the CancellationSource, preventing any future cancellation signal.
     */
    close(): void;
    private _register(callback);
    private _throwIfFrozen();
}
/**
  * A token used to recieve a cancellation signal.
  */
export declare class CancellationToken {
    private static _none;
    private _source;
    constructor(source: CancellationTokenSource);
    /**
      * Gets an empty cancellation token that will never be canceled.
      */
    static none: CancellationToken;
    /**
      * Gets a value indicating whether the token can be canceled.
      */
    canBeCanceled: boolean;
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
    throwIfCanceled(reason?: any): void;
    /**
      * Requests a callback when the token receives a cancellation signal to perform additional cleanup.
      * @param callback The callback to execute
      * @returns A `CancellationTokenRegistration` that that can be used to cancel the cleanup request.
      */
    register(callback: (reason: any) => void): CancellationTokenRegistration;
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
