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
export class LinkedListNode<T> {
    public value: T;

    private _list: LinkedList<T>;
    private _previous: LinkedListNode<T>;
    private _next: LinkedListNode<T>;
    
    constructor(value?: T) {
        this.value = value;
    }

    /** Gets the LinkedList for this node */
    public get list(): LinkedList<T> {
        return this._list;
    }

    /** Gets the previous node in the list */
    public get previous(): LinkedListNode<T> {
        if (this._previous && this !== this._list.first) {
            return this._previous;
        }
        return undefined;
    }

    /** Gets the next node in the list */
    public get next(): LinkedListNode<T> {
        if (this._next && this._next !== this._list.first) {
            return this._next;
        }
        return undefined;
    }
}

export class LinkedList<T> {
    private _head: LinkedListNode<T>;
    private _cache: LinkedListNode<T>;
    private _size: number;

    /** Gets the first node in the list */
    public get first(): LinkedListNode<T> {
        return this._head;
    }

    /** Gets the last node in the list */
    public get last(): LinkedListNode<T> {
        if (this._head) {
            return (<any>this._head)._previous;
        }
        return undefined;
    }

    /** Gets the size of the list */
    public get size(): number {
        return this._size;
    }
        
    public addFirst(value: T): LinkedListNode<T> {
        var newNode = new LinkedListNode<T>(value);
        if (this.first) {
            this._insert(this.first, newNode);
            this._head = newNode;
        }
        else {
            this._insertEmpty(newNode);
        }
        return newNode;
    }
    
    public addNodeFirst(newNode: LinkedListNode<T>): void {
        this._checkNewNode(newNode);
        if (this.first) {
            this._insert(this.first, newNode);
            this._head = newNode;
        }
        else {
            this._insertEmpty(newNode);
        }
    }

    public addLast(value: T): LinkedListNode<T> {
        var newNode = new LinkedListNode<T>(value);
        if (this.first) {
            this._insert(this.first, newNode);
        }
        else {
            this._insertEmpty(newNode);
        }
        return newNode;
    }
    
    public addNodeLast(newNode: LinkedListNode<T>): void {
        this._checkNewNode(newNode);
        if (this.first) {
            this._insert(this.first, newNode);            
        }
        else {
            this._insertEmpty(newNode);
        }
    }

    public addBefore(node: LinkedListNode<T>, value: T): LinkedListNode<T> {
        this._checkNode(node);
        var newNode = new LinkedListNode<T>(value);
        this._insert(node, newNode);
        if (this._head === node) {
            this._head = newNode;
        }
        return newNode;
    }
    
    public addNodeBefore(node: LinkedListNode<T>, newNode: LinkedListNode<T>): void {
        this._checkNode(node);
        this._checkNewNode(newNode);
        this._insert(node, newNode);
        if (this._head === node) {
            this._head = newNode;
        }
    }

    public addAfter(node: LinkedListNode<T>, value: T): LinkedListNode<T> {
        this._checkNode(node);
        var newNode = new LinkedListNode<T>(value);
        this._insert((<any>node)._next, newNode);
        return newNode;
    }
    
    public addNodeAfter(node: LinkedListNode<T>, newNode: LinkedListNode<T>): void {
        this._checkNode(node);
        this._checkNewNode(newNode);
        this._insert((<any>node)._next, newNode);        
    }

    public has(value: T): boolean {
        if (this._cache && this._cache.value === value) {
            return true;
        }
        
        return !!this.find(value);
    }

    public find(value: T): LinkedListNode<T> {
        var node = this._head;
        if (node) {
            do {
                if (node.value === value) {
                    this._cache = node;
                    return node;
                }
                node = (<any>node)._next;
            } while (node !== this._head);
        }
        return undefined;
    }

    public findLast(value: T): LinkedListNode<T> {
        var node = this._head;
        if (node) {
            node = (<any>node)._previous;
            var tail = node;
            do {
                if (node.value === value) {
                    this._cache = node;
                    return node;
                }
                node = (<any>node)._previous;
            }
            while (node !== tail)
        }
        return undefined;
    }

    public delete(value: T): boolean {
        var node = this.find(value);
        if (node) {
            this._delete(node);
            return true;
        }
        return false;
    }

    public deleteNode(node: LinkedListNode<T>): void {
        this._checkNode(node);
        this._delete(node);
    }

    public deleteFirst(): boolean {
        if (this._head) {
            this._delete(this._head);
            return true;
        }
        return false;
    }

    public deleteLast(): boolean {
        if (this._head) {
            this._delete((<any>this._head)._previous);
            return true;
        }
        return false;
    }

    public clear(): void {
        var next = this._head;
        while (next) {
            var node = next;
            next = (<any>node)._next;
            this._invalidate(node);
            if (next === this._head) {
                break;
            }
        }
        this._cache = undefined;
        this._size = 0;
    }

    public forEach(callback: (value: T, node: LinkedListNode<T>, list: LinkedList<T>) => void) {
        var next = this._head;
        while (next) {
            var node = next;
            next = (<any>node)._next;
            callback(node.value, node, this);
            if (next === this._head) {
                break;
            }
        }
    }
    
    private _checkNode(node: LinkedListNode<T>): void {
        if (!node) throw new TypeError("Argument not optional: node");
        if (node.list !== this) throw new Error("Wrong list.");
    }
    
    private _checkNewNode(newNode: LinkedListNode<T>): void {
        if (!newNode) throw new TypeError("Argument not optional: newNode");
        if (newNode.list) throw new Error("Node is already attached to a list.");
    }

    private _insert(node: LinkedListNode<T>, newNode: LinkedListNode<T>): void {
        (<any>newNode)._list = this;
        (<any>newNode)._next = node;
        (<any>newNode)._previous = (<any>node)._previous;
        (<any>node)._previous._next = newNode;
        (<any>node)._previous = newNode;
        this._cache = newNode;
        this._size++;
    }

    private _insertEmpty(newNode: LinkedListNode<T>): void {
        (<any>newNode)._list = this;
        (<any>newNode)._next = newNode;
        (<any>newNode)._previous = newNode;
        this._head = newNode;
        this._cache = newNode;
        this._size++;
    }
    
    private _delete(node: LinkedListNode<T>): void {
        if ((<any>node)._next === node) {
            this._head = undefined;
        }
        else {
            (<any>node)._next._previous = (<any>node)._previous;
            (<any>node)._previous._next = (<any>node)._next;
            if (this._head === node) {
                this._head = (<any>node)._next;
            }
        }
        this._invalidate(node);
        this._cache = undefined;
        this._size--;
    }
    
    private _invalidate(node: LinkedListNode<T>): void {
        (<any>node)._list = undefined;
        (<any>node)._next = undefined;
        (<any>node)._previous = undefined;
    }
}