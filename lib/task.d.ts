import cancellation = require('./cancellation');
import CancellationToken = cancellation.CancellationToken;
export declare type Handle = {};
export declare function scheduleTask(task: () => void, delay?: number, token?: CancellationToken): void;
