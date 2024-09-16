"use client";

import { useMemo, useRef, type ReactNode } from "react";
import { SWRConfig } from "swr";
import { BailoutToCSRError } from "next/dist/shared/lib/lazy-dynamic/bailout-to-csr";
import { Context } from "./context";
import type { Stream, StreamItem } from "./stream";
import type { IsomorphicSWRConfig } from "./config";
import type { ServerRef } from "./server-ref";
import { resolveServerRef } from "./server-ref";
import type { FallbackSource, ServerFetcher } from "./types";
import { requestToKey } from "./key";
import { withResolver } from "./resolver";

const IS_SERVER = typeof window === "undefined";

/**
 * Client-side part of the isomorphic SWR provider. It receives all fallbacks
 * from server in the `stream` prop as an RSC stream.
 */
export function ClientProvider({
  config,
  serverFetcherRef,
  stream,
  children,
}: {
  config: IsomorphicSWRConfig;
  serverFetcherRef: ServerRef<ServerFetcher>;
  stream: Stream;
  children: ReactNode;
}): JSX.Element {
  const fallbackSourceRef = useRef<FallbackSource>(
    (() => {
      if (IS_SERVER) {
        const serverFetcher = resolveServerRef(serverFetcherRef);
        const source: FallbackSource = (req, fetchFn, cfg) => {
          if (!serverFetcher) {
            throw new BailoutToCSRError("Server fetcher not found");
          }
          return serverFetcher(req, fetchFn, cfg);
        };
        return source;
      }

      return resolveClientStream(stream);
    })()
  );

  const value = useMemo(
    () => ({
      config,
      fallbackSource: fallbackSourceRef.current,
    }),
    [config]
  );
  const swrConfig = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { ssr: _, ...other } = config;
    return other;
  }, [config]);

  return (
    <Context.Provider value={value}>
      <SWRConfig value={swrConfig}>{children}</SWRConfig>
    </Context.Provider>
  );
}

let globalFallbackSource: FallbackSource | undefined;

export function resetGlobalFallbackSource(): void {
  globalFallbackSource = undefined;
}

function resolveClientStream(stream: Stream): FallbackSource {
  if (globalFallbackSource) {
    return globalFallbackSource;
  }

  // It's critical that all promises returned by the fallback resolver
  // are stable. Otherwise, React will get into infinite loop trying
  // to resolve them.
  const stablePromiseMap = new Map<
    string,
    {
      promise: Promise<unknown>;
      resolve: undefined | ((value: unknown) => void);
      used: boolean;
    }
  >();

  let streamComplete = false;
  void resolveStreamItems(stablePromiseMap, stream).then(() => {
    streamComplete = true;

    // The stream is over. Any pending fallbacks in the stream are not
    // coming. Resolve them to undefined, so that `useSWR`s can requery
    // them.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const [_key, value] of stablePromiseMap) {
      if (value.resolve) {
        value.resolve(undefined);
        value.resolve = undefined;
      }
    }

    // Any fetch that the client received that wasn't used by a client-side
    // component might be a wasted fetch. E.g. a request computation on the
    // client might differ from the server. In this case, the server would
    // do an extra fetch, and the client would repeat it - lose-lose.
    if (process.env.NODE_ENV === "development") {
      setTimeout(() => {
        const notUsed: string[] = [];
        for (const [key, value] of stablePromiseMap) {
          if (!value.used) {
            notUsed.push(key);
          }
        }
        if (notUsed.length > 0) {
          // eslint-disable-next-line no-console
          console.warn(
            "Isomorphic SWR fallbacks were not used on the client:",
            notUsed
          );
        }
      }, 10_000);
    }
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const fallbackSource: FallbackSource = (req, _fetchFn, _config) => {
    // request can only be null when not required.
    if (!req) {
      // TODO: typecasting here is needed to satisfy compiler- fix.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any
      return undefined as any;
    }
    const key = requestToKey(req);
    const holder = stablePromiseMap.get(key);
    let stablePromise: Promise<unknown> | undefined = holder?.promise;
    if (!stablePromise && !streamComplete) {
      const { promise, resolve } = withResolver<unknown>();
      if (streamComplete) {
        resolve(undefined);
      }
      stablePromiseMap.set(key, { promise, resolve, used: true });
      stablePromise = promise;
    } else if (holder) {
      holder.used = true;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return stablePromise as Promise<any>;
  };
  globalFallbackSource = fallbackSource;
  return fallbackSource;
}

async function resolveStreamItems(
  map: Map<
    string,
    {
      promise: Promise<unknown>;
      resolve: undefined | ((value: unknown) => void);
      used: boolean;
    }
  >,
  stream: AsyncIterable<StreamItem>
): Promise<void> {
  for await (const streamItem of stream) {
    const key = requestToKey(streamItem.request);

    if (map.has(key)) {
      const value = map.get(key);
      if (value?.resolve) {
        value.resolve(streamItem.value);
        value.resolve = undefined;
      }
    } else {
      map.set(key, {
        promise: streamItem.value,
        resolve: undefined,
        used: false,
      });
    }
  }
}
