import { Promise } from './promise';
import { CancellationToken } from './cancellation';
export declare function sleep(delay?: number, token?: CancellationToken): Promise<void>;
