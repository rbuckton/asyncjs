import cancellation = require('./cancellation');
import CancellationToken = cancellation.CancellationToken;
export declare type Handle = {};
export declare function scheduleImmediateTask(task: () => void, token?: CancellationToken): void;
export declare function scheduleDelayedTask(task: () => void, delay: number, token?: CancellationToken): void;
