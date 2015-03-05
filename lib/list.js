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
var LinkedListNode = (function () {
    function LinkedListNode(value) {
        this.value = value;
    }
    Object.defineProperty(LinkedListNode.prototype, "list", {
        /** Gets the LinkedList for this node */
        get: function () {
            return this._list;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(LinkedListNode.prototype, "previous", {
        /** Gets the previous node in the list */
        get: function () {
            if (this._previous && this !== this._list.first) {
                return this._previous;
            }
            return undefined;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(LinkedListNode.prototype, "next", {
        /** Gets the next node in the list */
        get: function () {
            if (this._next && this._next !== this._list.first) {
                return this._next;
            }
            return undefined;
        },
        enumerable: true,
        configurable: true
    });
    return LinkedListNode;
})();
exports.LinkedListNode = LinkedListNode;
var LinkedList = (function () {
    function LinkedList() {
    }
    Object.defineProperty(LinkedList.prototype, "first", {
        /** Gets the first node in the list */
        get: function () {
            return this._head;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(LinkedList.prototype, "last", {
        /** Gets the last node in the list */
        get: function () {
            if (this._head) {
                return this._head._previous;
            }
            return undefined;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(LinkedList.prototype, "size", {
        /** Gets the size of the list */
        get: function () {
            return this._size;
        },
        enumerable: true,
        configurable: true
    });
    LinkedList.prototype.addFirst = function (value) {
        var newNode = new LinkedListNode(value);
        if (this.first) {
            this._insert(this.first, newNode);
            this._head = newNode;
        }
        else {
            this._insertEmpty(newNode);
        }
        return newNode;
    };
    LinkedList.prototype.addNodeFirst = function (newNode) {
        this._checkNewNode(newNode);
        if (this.first) {
            this._insert(this.first, newNode);
            this._head = newNode;
        }
        else {
            this._insertEmpty(newNode);
        }
    };
    LinkedList.prototype.addLast = function (value) {
        var newNode = new LinkedListNode(value);
        if (this.first) {
            this._insert(this.first, newNode);
        }
        else {
            this._insertEmpty(newNode);
        }
        return newNode;
    };
    LinkedList.prototype.addNodeLast = function (newNode) {
        this._checkNewNode(newNode);
        if (this.first) {
            this._insert(this.first, newNode);
        }
        else {
            this._insertEmpty(newNode);
        }
    };
    LinkedList.prototype.addBefore = function (node, value) {
        this._checkNode(node);
        var newNode = new LinkedListNode(value);
        this._insert(node, newNode);
        if (this._head === node) {
            this._head = newNode;
        }
        return newNode;
    };
    LinkedList.prototype.addNodeBefore = function (node, newNode) {
        this._checkNode(node);
        this._checkNewNode(newNode);
        this._insert(node, newNode);
        if (this._head === node) {
            this._head = newNode;
        }
    };
    LinkedList.prototype.addAfter = function (node, value) {
        this._checkNode(node);
        var newNode = new LinkedListNode(value);
        this._insert(node._next, newNode);
        return newNode;
    };
    LinkedList.prototype.addNodeAfter = function (node, newNode) {
        this._checkNode(node);
        this._checkNewNode(newNode);
        this._insert(node._next, newNode);
    };
    LinkedList.prototype.has = function (value) {
        if (this._cache && this._cache.value === value) {
            return true;
        }
        return !!this.find(value);
    };
    LinkedList.prototype.find = function (value) {
        var node = this._head;
        if (node) {
            do {
                if (node.value === value) {
                    this._cache = node;
                    return node;
                }
                node = node._next;
            } while (node !== this._head);
        }
        return undefined;
    };
    LinkedList.prototype.findLast = function (value) {
        var node = this._head;
        if (node) {
            node = node._previous;
            var tail = node;
            do {
                if (node.value === value) {
                    this._cache = node;
                    return node;
                }
                node = node._previous;
            } while (node !== tail);
        }
        return undefined;
    };
    LinkedList.prototype.delete = function (value) {
        var node = this.find(value);
        if (node) {
            this._delete(node);
            return true;
        }
        return false;
    };
    LinkedList.prototype.deleteNode = function (node) {
        this._checkNode(node);
        this._delete(node);
    };
    LinkedList.prototype.deleteFirst = function () {
        if (this._head) {
            this._delete(this._head);
            return true;
        }
        return false;
    };
    LinkedList.prototype.deleteLast = function () {
        if (this._head) {
            this._delete(this._head._previous);
            return true;
        }
        return false;
    };
    LinkedList.prototype.removeFirst = function () {
        var node = this._head;
        if (node) {
            this._delete(node);
            return node.value;
        }
        return undefined;
    };
    LinkedList.prototype.removeLast = function () {
        if (this._head) {
            var node = this._head._previous;
            this._delete(node);
            return node.value;
        }
        return undefined;
    };
    LinkedList.prototype.clear = function () {
        var next = this._head;
        while (next) {
            var node = next;
            next = node._next;
            this._invalidate(node);
            if (next === this._head) {
                break;
            }
        }
        this._cache = undefined;
        this._size = 0;
    };
    LinkedList.prototype.forEach = function (callback) {
        var next = this._head;
        while (next) {
            var node = next;
            next = node._next;
            callback(node.value, node, this);
            if (next === this._head) {
                break;
            }
        }
    };
    LinkedList.prototype._checkNode = function (node) {
        if (!node)
            throw new TypeError("Argument not optional: node");
        if (node.list !== this)
            throw new Error("Wrong list.");
    };
    LinkedList.prototype._checkNewNode = function (newNode) {
        if (!newNode)
            throw new TypeError("Argument not optional: newNode");
        if (newNode.list)
            throw new Error("Node is already attached to a list.");
    };
    LinkedList.prototype._insert = function (node, newNode) {
        newNode._list = this;
        newNode._next = node;
        newNode._previous = node._previous;
        node._previous._next = newNode;
        node._previous = newNode;
        this._cache = newNode;
        this._size++;
    };
    LinkedList.prototype._insertEmpty = function (newNode) {
        newNode._list = this;
        newNode._next = newNode;
        newNode._previous = newNode;
        this._head = newNode;
        this._cache = newNode;
        this._size++;
    };
    LinkedList.prototype._delete = function (node) {
        if (node._next === node) {
            this._head = undefined;
        }
        else {
            node._next._previous = node._previous;
            node._previous._next = node._next;
            if (this._head === node) {
                this._head = node._next;
            }
        }
        this._invalidate(node);
        this._cache = undefined;
        this._size--;
    };
    LinkedList.prototype._invalidate = function (node) {
        node._list = undefined;
        node._next = undefined;
        node._previous = undefined;
    };
    return LinkedList;
})();
exports.LinkedList = LinkedList;
//# sourceMappingURL=file:///C|/dev/asyncjs/list.js.map