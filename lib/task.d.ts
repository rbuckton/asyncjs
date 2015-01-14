export declare type Handle = {};
export declare function scheduleTask(task: () => void): Handle;
export declare function cancelTask(handle: Handle): void;
