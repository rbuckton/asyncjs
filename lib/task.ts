export type Handle = {};

export function scheduleTask(task: () => void): Handle {
  if (!queue) {
    queue = {};
  }

  var node: TaskNode = { task };
  enqueueTask(queue, node);
  scheduleTick();
  return node;
}

export function cancelTask(handle: Handle): void {
  if (!handle) {
    return;
  }

  var node: TaskNode = handle;
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

interface TaskQueue {
  head?: TaskNode;
  tail?: TaskNode;
}

interface TaskNode {
  previous?: TaskNode;
  next?: TaskNode;
  queue?: TaskQueue;
  task?: () => void;
}

interface Scheduler {
  scheduleTick(callback: () => void): any;
  cancelTick(handle: any): void;
}

var scheduler: Scheduler;
var handle: any;
var recoveryQueue: TaskQueue;
var queue: TaskQueue;

function scheduleTick(): void {
  if (handle === void 0) {
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
  processQueue(recoveryQueue);
  recoveryQueue = queue;
  queue = undefined;
  processQueue(recoveryQueue);
  recoveryQueue = undefined;
}

function processQueue(queue: TaskQueue): void {
  if (!queue) {
    return;
  }

  var node: TaskNode;
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

function enqueueTask(queue: TaskQueue, node: TaskNode): void {
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

function dequeueTask(queue: TaskQueue): TaskNode {
  if (!queue) {
    return;
  }
  var node = queue.tail;
  if (node) {
    removeTask(queue, node);
  }
  return node;
}

function removeTask(queue: TaskQueue, node: TaskNode): void {
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

function getScheduler(): Scheduler {
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

  function getSetImmediateScheduler(): Scheduler {
    return { scheduleTick, cancelTick };
    function scheduleTick(callback: () => void): any {
      return setImmediate(callback);
    }
    function cancelTick(handle: any): void {
      clearImmediate(handle);
    }
  }

  function getMSSetImmediateScheduler(): Scheduler {
    return { scheduleTick, cancelTick };
    function scheduleTick(callback: () => void): any {
      return msSetImmediate(callback);
    }
    function cancelTick(handle: any): void {
      msClearImmediate(handle);
    }
  }

  function getNextTickScheduler(): Scheduler {
    var nextHandle: number = 1;
    return { scheduleTick, cancelTick };
    function scheduleTick(callback: () => void): any {
      var handle = { canceled: false };
      process.nextTick(function() { 
        if (handle.canceled) return;
        callback();
      })
      return handle;
    }
    function cancelTick(handle: any): void {
      if (handle) handle.canceled = true;
    }
  }

  function getSetTimeoutScheduler(): Scheduler {
    return { scheduleTick, cancelTick };
    function scheduleTick(callback: () => void): any {
      return setTimeout(callback, 0);
    }
    function cancelTick(handle: any): void {
      clearTimeout(handle);
    }
  }

  function getMissingScheduler(): Scheduler {
    return { scheduleTick, cancelTick };
    function scheduleTick(): void {
      throw new Error("Scheduler not available.");
    }
    function cancelTick(): void {
      throw new Error("Scheduler not available.");
    }
  }
}