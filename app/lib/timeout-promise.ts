export function timeoutPromise<T>(
  promise: Promise<T>,
  timeout: number | undefined
): Promise<T> {
  if (!timeout || timeout === -1) {
    return promise;
  }

  let timer: NodeJS.Timeout | undefined;
  const mainPromise = promise.finally(() => {
    if (timer) {
      clearTimeout(timer);
    }
  });
  const timeoutPromise_ = new Promise<T>((_, aReject) => {
    timer = setTimeout(() => {
      aReject(new Error("timeout"));
    }, timeout);
  });
  const result = Promise.race([mainPromise, timeoutPromise_]);
  return result;
}
