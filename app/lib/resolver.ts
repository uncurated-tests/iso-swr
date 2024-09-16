export function withResolver<T>(): {
  promise: Promise<T>;
  resolve: (value: T | Promise<T>) => void;
} {
  let resolve: (value: T | Promise<T>) => void;
  const promise = new Promise<T>((aResolve) => {
    resolve = aResolve;
  });
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return { promise, resolve: resolve! };
}
