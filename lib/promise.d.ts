export interface IPromise<T> {
    then<TResult>(onfulfilled: (value: T) => TResult | IPromise<TResult>, onrejected: (reason: any) => TResult | IPromise<TResult>): IPromise<TResult>;
}
/**
 * Represents the completion of an asynchronous operation
 */
export declare class Promise<T> {
    /**
     * Creates a new Promise.
     * @param init A callback used to initialize the promise. This callback is passed two arguments: a resolve callback used resolve the promise with a value or the result of another promise, and a reject callback used to reject the promise with a provided reason or error.
     */
    constructor(init: (resolve: (value?: IPromise<T> | T) => void, reject: (reason?: any) => void) => void);
    /**
     * Creates a new resolved promise for the provided value.
     * @param value A promise.
     * @returns A promise whose internal state matches the provided promise.
     */
    static resolve<T>(value: IPromise<T> | T): Promise<T>;
    /**
     * Creates a new resolved promise .
     * @returns A resolved promise.
     */
    static resolve(): Promise<void>;
    /**
     * Creates a new rejected promise for the provided reason.
     * @param reason The reason the promise was rejected.
     * @returns A new rejected Promise.
     */
    static reject(reason: any): Promise<void>;
    /**
     * Creates a new rejected promise for the provided reason.
     * @param reason The reason the promise was rejected.
     * @returns A new rejected Promise.
     */
    static reject<T>(reason: any): Promise<T>;
    /**
     * Creates a Promise that is resolved with an array of results when all of the provided Promises resolve, or rejected when any Promise is rejected.
     * @param values An array of Promises.
     * @returns A new Promise.
     */
    static all<T>(values: Array<IPromise<T> | T>): Promise<T[]>;
    /**
     * Creates a Promise that is resolved with an array of results when all of the provided Promises resolve, or rejected when any Promise is rejected.
     * @param values An array of values.
     * @returns A new Promise.
     */
    static all(values: IPromise<void>[]): Promise<void>;
    /**
     * Creates a Promise that is resolved or rejected when any of the provided Promises are resolved or rejected.
     * @param values An array of Promises.
     * @returns A new Promise.
     */
    static race<T>(values: Array<IPromise<T> | T>): Promise<T>;
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult>(onfulfilled?: (value: T) => IPromise<TResult> | TResult, onrejected?: (reason: any) => IPromise<TResult> | TResult): Promise<TResult>;
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch(onrejected: (reason: any) => IPromise<T> | T): Promise<T>;
    /**
     * Attaches a callback for that is executed regardless of the resolution or rejection of the promise.
     * @param onsettled The callback to execute when the Promise is settled.
     * @returns A Promise for the completion of the callback.
     */
    finally(onsettled: () => IPromise<void> | void): Promise<T>;
    private _resolve(rejecting, result);
    private _await(onresolved, onrejected);
    private _settle(rejecting, result);
    private _forward(prev, resolve, reject, rejecting, result, onresolved, onrejected, id);
}
