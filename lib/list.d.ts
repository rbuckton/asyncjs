export declare class LinkedListNode<T> {
    value: T;
    private _list;
    private _previous;
    private _next;
    constructor(value?: T);
    /** Gets the LinkedList for this node */
    list: LinkedList<T>;
    /** Gets the previous node in the list */
    previous: LinkedListNode<T>;
    /** Gets the next node in the list */
    next: LinkedListNode<T>;
}
export declare class LinkedList<T> {
    private _head;
    private _cache;
    private _size;
    /** Gets the first node in the list */
    first: LinkedListNode<T>;
    /** Gets the last node in the list */
    last: LinkedListNode<T>;
    /** Gets the size of the list */
    size: number;
    addFirst(value: T): LinkedListNode<T>;
    addNodeFirst(newNode: LinkedListNode<T>): void;
    addLast(value: T): LinkedListNode<T>;
    addNodeLast(newNode: LinkedListNode<T>): void;
    addBefore(node: LinkedListNode<T>, value: T): LinkedListNode<T>;
    addNodeBefore(node: LinkedListNode<T>, newNode: LinkedListNode<T>): void;
    addAfter(node: LinkedListNode<T>, value: T): LinkedListNode<T>;
    addNodeAfter(node: LinkedListNode<T>, newNode: LinkedListNode<T>): void;
    has(value: T): boolean;
    find(value: T): LinkedListNode<T>;
    findLast(value: T): LinkedListNode<T>;
    delete(value: T): boolean;
    deleteNode(node: LinkedListNode<T>): void;
    deleteFirst(): boolean;
    deleteLast(): boolean;
    removeFirst(): T;
    removeLast(): T;
    clear(): void;
    forEach(callback: (value: T, node: LinkedListNode<T>, list: LinkedList<T>) => void): void;
    reduce(callback: (aggregate: T, value: T, node: LinkedListNode<T>, list: LinkedList<T>) => T): T;
    reduce<U>(callback: (aggregate: U, value: T, node: LinkedListNode<T>, list: LinkedList<T>) => U, initial: U): U;
    reduceRight(callback: (aggregate: T, value: T, node: LinkedListNode<T>, list: LinkedList<T>) => T): T;
    reduceRight<U>(callback: (aggregate: U, value: T, node: LinkedListNode<T>, list: LinkedList<T>) => U, initial: U): U;
    map<U>(callback: (value: T, node: LinkedListNode<T>, list: LinkedList<T>) => U): LinkedList<U>;
    filter(callback: (value: T, node: LinkedListNode<T>, list: LinkedList<T>) => boolean): LinkedList<T>;
    join(delimiter?: string): string;
    toArray(): T[];
    toArray<U>(selector: (value: T, node: LinkedListNode<T>, list: LinkedList<T>) => U): U[];
    toString(): string;
    toJSON(): any;
    private _checkNode(node);
    private _checkNewNode(newNode);
    private _insert(node, newNode);
    private _insertEmpty(newNode);
    private _delete(node);
    private _invalidate(node);
}
