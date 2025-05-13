// tailOrHead marker
const tailOrHead = Symbol('tailOrHead');

/**
 * A set-like collection of objects that can do iteration sorted by a specified index property.
 * It also allows retrieving an object by its index property, and quickly getting the object
 * that comes immediately after a given object.
 * 
 * It's implemented as a skiplist, maintaining all meta-data as part of the objects that it
 * is tracking, for performance.
 */
export class ReverseSortedSet<T extends object, KeyPropT extends keyof T> {
    // Per-level skiplists mapping item to previous item
    private lists: Map<T|typeof tailOrHead,T|typeof tailOrHead>[];

    /**
     * Create an empty SortedSet.
     * 
     * @param keyProp The name of the property that should be used as the index of this collection. Comparison
     * using `<` will be done on this property, so it should probably be a number or a string (or something that
     * has a useful toString-conversion).
     */
    constructor(private keyProp: KeyPropT) {
        this.lists = [
            new Map([[tailOrHead, tailOrHead]]) // initialize level 0 already
        ];
    }

    /**
     * Add an object to the `SortedSet`.
     * 
     * @param item The object to be added to the set. One or more properties with
     *  `Symbol` keys will be added to it, for `SortedSet` internals.
     * @returns `true` if the item was added, or `false` if it was *not* added
     *  because the item already was part of this set.
     * 
     * Note that though an item object may only be part of a particular `SortedSet`
     * once, index properties may be duplicate and an item object may be part of
     * more than one `SortedSet`.
     * 
     * **IMPORTANT:** After adding an object, do not modify its index property,
     * as this will lead to undefined (broken) behavior on the entire set.
     * 
     * Time complexity: O(log n)
     */
    add(item: T): boolean {
        if (this.lists[0].has(item)) return false; // Already included

        // Start at level 1. Keep upping the level by 1 with 1/8 chance.
        const level = 1 + (Math.clz32(Math.random() * 0xFFFFFFFF) >> 2)
        for(let l = this.lists.length; l < level; l++) this.lists.push(new Map([[tailOrHead, tailOrHead]]))

        const keyProp = this.keyProp
        const key = item[keyProp]
    
        // prev is always a complete T, current might be tail only contain pointers
        let current: T | typeof tailOrHead = tailOrHead;
        for (let l = this.lists.length-1; l>=0; l--) {
            const list = this.lists[l]
            let prev = list.get(current);
            while (prev !== undefined && prev !== tailOrHead && prev[keyProp] > key) {
                current = prev;
                prev = list.get(current);
            }
            if (prev === undefined) {
                throw new Error('should not happen');
            }
            if (l < level) {
                list.set(current, item);
                list.set(item, prev)
            }
        }

        return true // Added
    }

    /**
     * @param item An object to test for inclusion in the set.
     * @returns true if this object item is already part of the set.
     */
    has(item: T): boolean {
        return this.lists[0].has(item);
    }

    /**
     * Remove and return the last item.
     * @returns what was previously the last item in the sorted set, or `undefined` if the set was empty.
     */
    fetchLast(): T | undefined {
        let item = this.lists[0].get(tailOrHead)
        if (item && item !== tailOrHead) {
            this.remove(item);
            return item;
        }
    }

    /**
     * @returns whether the set is empty (`true`) or has at least one item (`false`).
     */
    isEmpty(): boolean {
        return this.lists[0].get(tailOrHead) === undefined;
    }

    /**
     * Retrieve an item object based on its index property value. 
     * 
     * @param indexValue The index property value to search for.
     * @returns `undefined` if the index property value does not exist in the `SortedSet` or
     *  otherwise the *first* item object that has this index value (meaning any further
     *  instances can be iterated using `next()`).
     * 
     * Time complexity: O(log n)
     */
    get(indexValue: T[KeyPropT]): T | undefined {
        const keyProp = this.keyProp

        // prev is always a complete T, current might be tail only contain pointers
        let prev: T | typeof tailOrHead | undefined;
        let current: T | typeof tailOrHead = tailOrHead;
        for (let l = this.lists.length-1; l>=0; l--) {
            const list = this.lists[l]
            while ((prev = list.get(current)) && prev !== tailOrHead && prev[keyProp] > indexValue) current = prev;
        }
        const item = this.lists[0].get(current);
        return (item && item !== tailOrHead && item[keyProp] === indexValue) ? item : undefined;
    }

    /**
     * The iterator will go through the items in reverse index-order.
     */
    *[Symbol.iterator](): IterableIterator<T> {
        const list0 = this.lists[0];
        let node = list0.get(tailOrHead);
        while (node && node !== tailOrHead) {
            yield node;
            node = list0.get(node);
        }
    }

    /**
     * Given an item object, returns the one that comes right before in the set.
     * @param item The object to start from.
     * @returns The next object, or `undefined` if there is none.
     * 
     * Time complexity: O(1)
     */
    prev(item: T): T | undefined {
        const prev = this.lists[0].get(item);
        return prev !== tailOrHead ? prev : undefined;
    }

    /**
     * Remove an item object from the set, deleting all meta-data keys that
     * were created on `add()`.
     * @param item The object to be removed.
     * @returns `true` on success or `false` when the item was not part of the set.
     *
     * Time complexity: O(log n)
     */
    remove(item: T): boolean {
        if (!this.lists[0].has(item)) return false;
        const keyProp = this.keyProp
        const prop = item[keyProp];
        
        // prev is always a complete T, current might be tail only contain pointers
        let prev: T | typeof tailOrHead | undefined;
        let current: T | typeof tailOrHead = tailOrHead;
        for (let l = this.lists.length - 1; l >= 0; l--) {
            const list = this.lists[l];
            while ((prev = list.get(current)) && prev !== tailOrHead && prev[keyProp] >= prop && prev !== item) current = prev
            if (prev === item) {
                const prevPrev = list.get(prev);
                list.set(current, prevPrev ?? tailOrHead);
                list.delete(prev);
            }
        }

        return prev === item
    }

    /**
     * Remove all items for the set.
     *
     * Time complexity: 1
     */    
    clear(): void {
        this.lists = [new Map()];
    }
}

