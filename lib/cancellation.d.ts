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
export declare class CancellationTokenSource {
    private static _canceled;
    private _callbacks;
    private _links;
    private _token;
    private _timer;
    private _canceled;
    private _reason;
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
    /**
     * Gets an already cancelled `CancellationToken`.
     */
    static canceled: CancellationToken;
    /**
     * Gets a value indicating whether the token has received a cancellation signal.
     */
    canceled: boolean;
    /**
     * Gets the reason for cancellation, if one was supplied.
     */
    reason: any;
    /**
     * Gets the `CancellationToken` for this source.
     */
    token: CancellationToken;
    /**
     * Signals the source is cancelled.
     * @param reason An optional reason for the cancellation.
     */
    cancel(reason?: any): void;
    /**
     * Signals the source is canceled after a delay.
     * @param delay The number of milliseconds to delay before signalling cancellation.
     * @param reason An optional reason for the cancellation.
     */
    cancelAfter(delay: number, reason?: any): void;
    /**
     * Closes the CancellationSource, preventing any future cancellation signal.
     */
    close(): void;
    private static _ontimeout(source, reason);
    private _register(callback);
    private _cancelCore(reason);
    private _clearTimeout();
    private _throwIfFrozen();
}
