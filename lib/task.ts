/*! *****************************************************************************
Copyright (C) Ron A. Buckton. All rights reserved.
Licensed under the Apache License, Version 2.0 (the "License"); you may not use 
this file except in compliance with the License. You may obtain a copy of the 
License at http://www.apache.org/licenses/LICENSE-2.0 

Unless required by applicable law or agreed to in writing, software 
distributed under the License is distributed on an "AS IS" BASIS, 
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. 

See the License for the specific language governing permissions and 
limitations under the License. 
***************************************************************************** */
import list = require('./list');
import LinkedList = list.LinkedList;
import LinkedListNode = list.LinkedListNode;

declare var process: any;

export type Handle = {};

export function scheduleTask(task: () => void): Handle {
    if (!queue) {
        queue = new LinkedList<() => void>();
    }
    
    var node = queue.addLast(task);
    scheduleTick();
    return node;
}

export function cancelTask(handle: Handle): void {
    if (!handle) {
        return;
    }

    var node = <LinkedListNode<() => void>>handle;
    if (node.list === recoveryQueue || node.list === queue) {
        node.list.deleteNode(node);
    }

    if (recoveryQueue && !recoveryQueue.first) {
        recoveryQueue = undefined;
    }
    
    if (queue && !queue.first) {
        queue = undefined;
    }

    if (!recoveryQueue && !queue) {
        cancelTick();
    }
}

interface Scheduler {
    scheduleTick(callback: () => void): any;
    cancelTick(handle: any): void;
}

var scheduler: Scheduler;
var handle: any;
var recoveryQueue: LinkedList<() => void>;
var queue: LinkedList<() => void>;

function scheduleTick(): void {
    if (handle !== void 0) {
        return;
    }
    if (!scheduler) {
        scheduler = getScheduler();
    }
    handle = scheduler.scheduleTick(onTick);
}

function cancelTick(): void {
    if (handle === void 0 || !scheduler) {
        return;
    }

    scheduler.cancelTick(handle);
    handle = undefined;
}

function onTick(): void {
    handle = undefined;
    processQueue(recoveryQueue);
    recoveryQueue = queue;
    queue = undefined;
    processQueue(recoveryQueue);
    recoveryQueue = undefined;
}

function processQueue(queue: LinkedList<() => void>): void {
    if (!queue) {
        return;
    }

    var node: LinkedListNode<() => void>;
    var taskCompleted = false;
    while (node = queue.first) {
        queue.deleteNode(node);
        var task = node.value;
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

function getScheduler(): Scheduler {
    function getSetImmediateScheduler(): Scheduler {
        return {
            scheduleTick(callback: () => void): any {
                return setImmediate(callback);
            },
            cancelTick(handle: any): void {
                clearImmediate(handle);
            }
        };
    }

    function getMSSetImmediateScheduler(): Scheduler {
        return {
            scheduleTick(callback: () => void): any {
                return msSetImmediate(callback);
            },
            cancelTick(handle: any): void {
                msClearImmediate(handle);
            }
        };
    }

    function getNextTickScheduler(): Scheduler {
        var queue = new LinkedList<() => void>();        
        function ontick() {
            var node = queue.first;
            if (node) {
                queue.deleteFirst();
                var callback = node.value;
                callback();
            }
        }
        return {
            scheduleTick(callback: () => void): any {
                var handle = queue.addLast(callback);
                process.nextTick(ontick);
                return handle;
            },
            cancelTick(handle: any): void {
                if (handle && handle.list === queue) {
                    queue.deleteNode(handle);
                }
            }
        };
    }
    
    function getMessageChannelScheduler(): Scheduler {
        var queue = new LinkedList<() => void>();        
        var channel = new MessageChannel();
        channel.port2.onmessage = () => {
            var node = queue.first;
            if (node) {
                queue.deleteFirst();
                var callback = node.value;
                callback();
            }
        }
        return {
            scheduleTick(callback: () => void): any {
                var handle = queue.addLast(callback);
                channel.port1.postMessage(undefined);
                return handle;
            },
            cancelTick(handle: any): void {
                if (handle && handle.list === queue) {
                    queue.deleteNode(handle);
                }
            }
        };
    }

    function getSetTimeoutScheduler(): Scheduler {
        return {
            scheduleTick(callback: () => void): any {
                return setTimeout(callback, 0);
            },
            cancelTick(handle: any): void {
                clearTimeout(handle);
            }
        };
    }

    function getMissingScheduler(): Scheduler {
        return {
            scheduleTick(callback: () => void): any {
                throw new Error("Scheduler not available.");
            },
            cancelTick(handle: any): void {
                throw new Error("Scheduler not available.");
            }
        };
    }

    if (typeof setImmediate === "function") {
        return getSetImmediateScheduler();
    }
    else if (typeof msSetImmediate === "function") {
        return getMSSetImmediateScheduler();
    }
    else if (typeof MessageChannel === "function") {
        return getMessageChannelScheduler();
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
}