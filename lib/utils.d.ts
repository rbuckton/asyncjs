import promise = require('./promise');
import cancellation = require('./cancellation');
import Promise = promise.Promise;
import CancellationToken = cancellation.CancellationToken;
export declare function sleep(delay: number, token?: CancellationToken): Promise<void>;
export declare function spin(token?: CancellationToken): Promise<void>;
export declare var resolvedPromise: promise.Promise<void>;
