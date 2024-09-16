import { timeoutPromise } from "./timeout-promise";
import { withResolver } from "./resolver";

export interface StreamItem<T = unknown> {
  request: string;
  value: Promise<T>;
}

export type Stream = AsyncIterable<StreamItem>;

export function createStreamGenerator({
  onComplete,
  timeout = 500,
}: {
  onComplete?: () => void;
  timeout?: number;
}): {
  push: (value: StreamItem) => void;
  values: AsyncGenerator<StreamItem>;
} {
  const stack: StreamItem[] = [];
  let offset = 0;
  let nextResolver: ReturnType<typeof withResolver> | undefined;
  let done = false;

  function resolve(): void {
    nextResolver?.resolve(undefined);
  }

  function handleReturnOrThrow(
    value: StreamItem
  ): Promise<IteratorResult<StreamItem>> {
    resolve();
    done = true;
    return Promise.resolve({ done: true, value });
  }

  async function* values(): AsyncGenerator<StreamItem> {
    while (!done) {
      const item = stack[offset];
      if (item) {
        yield item;
        offset++;
      } else {
        // If there isn't an item available, setup a race between waiting for a
        // new item to get pushed and timing out.
        nextResolver = withResolver();
        try {
          // eslint-disable-next-line no-await-in-loop
          await timeoutPromise(nextResolver.promise, timeout);
        } catch (err) {
          done = true;
        } finally {
          nextResolver = undefined;
        }
      }
    }
    onComplete?.();
  }

  const generator = values();

  generator.return = handleReturnOrThrow;
  generator.throw = handleReturnOrThrow;

  function push(item: StreamItem): void {
    stack.push(item);
    // Signal to the generator that we are ready to emit a value.
    resolve();
  }

  return { push, values: generator };
}
