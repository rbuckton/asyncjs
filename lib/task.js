function scheduleTask(task) {
    if (!queue) {
        queue = {};
    }
    var node = { task: task };
    enqueueTask(queue, node);
    scheduleTick();
    return node;
}
exports.scheduleTask = scheduleTask;
function cancelTask(handle) {
    if (!handle) {
        return;
    }
    var node = handle;
    if (node.queue === recoveryQueue || node.queue === queue) {
        removeTask(node.queue, node);
    }
    if (recoveryQueue && !recoveryQueue.head) {
        recoveryQueue = undefined;
    }
    if (queue && !queue.head) {
        queue = undefined;
    }
    if (!recoveryQueue && !queue) {
        cancelTick();
    }
}
exports.cancelTask = cancelTask;
var scheduler;
var handle;
var recoveryQueue;
var queue;
function scheduleTick() {
    if (handle !== void 0) {
        return;
    }
    if (!scheduler) {
        scheduler = getScheduler();
    }
    handle = scheduler.scheduleTick(onTick);
}
function cancelTick() {
    if (handle === void 0 || !scheduler) {
        return;
    }
    scheduler.cancelTick(handle);
    handle = undefined;
}
function onTick() {
    handle = undefined;
    processQueue(recoveryQueue);
    recoveryQueue = queue;
    queue = undefined;
    processQueue(recoveryQueue);
    recoveryQueue = undefined;
}
function processQueue(queue) {
    if (!queue) {
        return;
    }
    var node;
    var taskCompleted = false;
    while (node = dequeueTask(queue)) {
        var task = node.task;
        try {
            task();
            taskCompleted = true;
        }
        finally {
            if (!taskCompleted) {
                scheduleTick();
            }
        }
    }
}
function enqueueTask(queue, node) {
    node.previous = queue.tail;
    node.queue = queue;
    if (queue.tail) {
        queue.tail.next = node;
    }
    else {
        queue.head = node;
    }
    queue.tail = node;
}
function dequeueTask(queue) {
    if (!queue) {
        return;
    }
    var node = queue.tail;
    if (node) {
        removeTask(queue, node);
    }
    return node;
}
function removeTask(queue, node) {
    if (!queue) {
        return;
    }
    if (node.next) {
        node.next.previous = node.previous;
    }
    if (node.previous) {
        node.previous.next = node.next;
    }
    if (node === queue.tail) {
        queue.tail = node.previous;
    }
    if (node === queue.head) {
        queue.head = node.next;
    }
    node.next = undefined;
    node.previous = undefined;
    node.queue = undefined;
}
function getScheduler() {
    if (typeof setImmediate === "function") {
        return getSetImmediateScheduler();
    }
    else if (typeof msSetImmediate === "function") {
        return getMSSetImmediateScheduler();
    }
    else if (typeof process === "object" && typeof process.nextTick === "function") {
        return getNextTickScheduler();
    }
    else if (typeof setTimeout === "function") {
        return getSetTimeoutScheduler();
    }
    else {
        return getMissingScheduler();
    }
    function getSetImmediateScheduler() {
        return { scheduleTick: scheduleTick, cancelTick: cancelTick };
        function scheduleTick(callback) {
            return setImmediate(callback);
        }
        function cancelTick(handle) {
            clearImmediate(handle);
        }
    }
    function getMSSetImmediateScheduler() {
        return { scheduleTick: scheduleTick, cancelTick: cancelTick };
        function scheduleTick(callback) {
            return msSetImmediate(callback);
        }
        function cancelTick(handle) {
            msClearImmediate(handle);
        }
    }
    function getNextTickScheduler() {
        var nextHandle = 1;
        return { scheduleTick: scheduleTick, cancelTick: cancelTick };
        function scheduleTick(callback) {
            var handle = { canceled: false };
            process.nextTick(function () {
                if (handle.canceled)
                    return;
                callback();
            });
            return handle;
        }
        function cancelTick(handle) {
            if (handle)
                handle.canceled = true;
        }
    }
    function getSetTimeoutScheduler() {
        return { scheduleTick: scheduleTick, cancelTick: cancelTick };
        function scheduleTick(callback) {
            return setTimeout(callback, 0);
        }
        function cancelTick(handle) {
            clearTimeout(handle);
        }
    }
    function getMissingScheduler() {
        return { scheduleTick: scheduleTick, cancelTick: cancelTick };
        function scheduleTick() {
            throw new Error("Scheduler not available.");
        }
        function cancelTick() {
            throw new Error("Scheduler not available.");
        }
    }
}
//# sourceMappingURL=file:///C|/dev/asyncjs/task.js.map