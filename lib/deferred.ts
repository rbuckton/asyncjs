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