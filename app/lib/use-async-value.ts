import { type Thenable, useEffect, useState } from "react";

export type AsyncState<T> = [data: T | undefined, isLoading: boolean];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const EXPECTING_DATA: AsyncState<any> = [undefined, true];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const NO_DATA: AsyncState<any> = [undefined, false];

export function useAsyncValue<T>(
  isServer: boolean,
  promise: Thenable<T> | undefined
): AsyncState<T> {
  if (isServer) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return promise ? EXPECTING_DATA : NO_DATA;
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [state, setState] = useState<AsyncState<T>>(
    promise ? EXPECTING_DATA : NO_DATA
  );
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (!promise) {
      // If we don't have a promise, make sure we're in the
      // no data state.
      setState(NO_DATA);
      return;
    }
    let waiting = true;
    const accept = (value: T | undefined): void => {
      if (waiting) {
        setState([value, false]);
      }
    };
    void promise.then(accept, () => {
      setState(NO_DATA);
    });
    return () => {
      waiting = false;
    };
  }, [promise]);
  return state;
}
