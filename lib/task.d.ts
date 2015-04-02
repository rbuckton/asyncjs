import { CancellationToken } from './cancellation';
export declare type Handle = {};
export declare function scheduleTask(task: () => void, delay?: number, token?: CancellationToken): void;
