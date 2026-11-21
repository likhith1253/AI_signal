"use client";
import { useSyncExternalStore } from "react";

/**
 * Comparison selection, persisted in localStorage so it survives navigation
 * and reloads. The /compare page mirrors it into the URL for sharing.
 */
export interface CompareItem {
  slug: string;
  name: string;
  lab: string;
}

const KEY = "oneatlas.compare.v1";
import { MAX_COMPARE } from "./constants";
export { MAX_COMPARE };
type Listener = () => void;
const listeners = new Set<Listener>();
let cache: CompareItem[] | null = null;
const EMPTY: CompareItem[] = [];

function read(): CompareItem[] {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as CompareItem[]).slice(0, MAX_COMPARE) : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(items: CompareItem[]) {
  cache = items.slice(0, MAX_COMPARE);
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* storage unavailable: keep in memory */
  }
  listeners.forEach((l) => l());
}

export const compareStore = {
  get: read,
  set: write,
  toggle(item: CompareItem) {
    const cur = read();
    if (cur.some((c) => c.slug === item.slug)) write(cur.filter((c) => c.slug !== item.slug));
    else if (cur.length < MAX_COMPARE) write([...cur, item]);
  },
  remove(slug: string) {
    write(read().filter((c) => c.slug !== slug));
  },
  clear() {
    write([]);
  },
  subscribe(l: Listener) {
    listeners.add(l);
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) {
        cache = null;
        l();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(l);
      window.removeEventListener("storage", onStorage);
    };
  },
};

export function useCompare() {
  return useSyncExternalStore(compareStore.subscribe, read, () => EMPTY);
}
