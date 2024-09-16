/**
 * Super-ugly hack. Isomorphic hook must be able to call into the server's
 * fetcher and deduplicator. There's no way to pass a server-side function
 * to the client-side component. So instead, this code passes the
 * server-side function as a symbolic reference on the `globalThis` object.
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface ServerRef<T> {
  __server_ref: never;
}

interface Holder<T> {
  value?: T;
}

let idCounter = 0;

export function createServerRef<T extends object>(value: T): ServerRef<T> {
  const refKey = `___SERVER_REF___${++idCounter}`;

  const holder: Holder<T> = { value };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
  (globalThis as any)[refKey] = holder;

  // Cheat and pretend that a string is a ref value.
  return refKey as unknown as ServerRef<T>;
}

export function resolveServerRef<T>(ref: ServerRef<T>): T | undefined {
  // Yep. Still hate it, but see above.
  const refKey = ref as unknown as string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
  const holder = (globalThis as any)[refKey] as Holder<T> | undefined;
  if (!holder) {
    console.error(`ServerRef not found: ${refKey}`);
    return undefined;
  }
  return holder.value;
}

export function releaseServerRef<T>(ref: ServerRef<T>): void {
  const refKey = ref as unknown as string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
  const holder = (globalThis as any)[refKey] as Holder<T> | undefined;

  if (!holder) {
    console.error(`releaseServerRef called with ${refKey} but no value set`);
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
  delete (globalThis as any)[refKey];
}
