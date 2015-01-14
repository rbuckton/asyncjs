import promise = require('./promise');
import cancellation = require('./cancellation');
import task = require('./task');
import Promise = promise.Promise;
import CancellationToken = cancellation.CancellationToken;
import CancellationRegistration = cancellation.CancellationRegistration;
import scheduleTask = task.scheduleTask;
import cancelTask = task.cancelTask;

export function sleep(delay: number = 0, token?: CancellationToken): Promise<void> {
    if (typeof delay !== "number") {
        throw new TypeError("Number expected.");
    }

    if (token && token.canceled) {
        return Promise.reject<void>(token.reason);
    }

    var schedule: (task: () => void) => any;
    var cancel: (handle: any) => void;

    if (delay <= 0) {
        schedule = scheduleTask;
        cancel = cancelTask;
    }
    else {
        schedule = task => setTimeout(task, delay);
        cancel = clearTimeout;
    }

    return new Promise<void>((resolve, reject) => {
        var registration: CancellationRegistration;
        var handle = schedule(() => {
            if (registration) {
                registration.unregister();
                registration = undefined;
            }

            resolve();
        });

        if (token) {
            registration = token.register(reason => {
                cancel(handle);
                handle = undefined;
                reject(reason);
            });
        }
    });
}