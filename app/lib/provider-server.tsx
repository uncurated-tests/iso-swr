import { cache, type ReactNode } from "react";
// eslint-disable-next-line camelcase
import { unstable_after } from "next/server";
import { staticGenerationAsyncStorage } from "next/dist/client/components/static-generation-async-storage.external";
import { BailoutToCSRError } from "next/dist/shared/lib/lazy-dynamic/bailout-to-csr";
import { ClientProvider } from "./provider-client";
import { type Stream, createStreamGenerator } from "./stream";
import type { IsomorphicSWRConfig, SsrConfig } from "./config";
import { defaultConfig, mergeConfig } from "./config";
import { createServerRef, releaseServerRef } from "./server-ref";
import { timeoutPromise } from "./timeout-promise";
import type { IsomorphicFetcher, ServerFetcher, SwrFetchFn } from "./types";
import { requestToKey } from "./key";
import { fetcher as serverFetch } from "./server-fetcher";

/**
 * Servr-side provider. The goal is to deduplicate all fallback requests
 * and stream responses as a `stream` in a RSC prop to the client component.
 */
export function IsomorphicSwrProvider({
  config: inputConfig,
  children,
}: {
  config?: IsomorphicSWRConfig;
  children: ReactNode;
}): JSX.Element {
  if (shouldSkipIsoSwr()) {
    return <>{children}</>;
  }

  const config = mergeConfig(defaultConfig, inputConfig);
  const { fetcher, stream, setConfig } = createFetcherAndStream();
  setConfig(config.ssr);
  const fetcherRef = createServerRef(fetcher);
  unstable_after(
    cache(() => {
      releaseServerRef(fetcherRef);
    })
  );

  return (
    <ClientProvider
      config={config}
      serverFetcherRef={fetcherRef}
      stream={stream}
    >
      {children}
    </ClientProvider>
  );
}

export function fetchIsomorphicSWR<T>(
  request: string,
  fetchFn?: SwrFetchFn<T>,
  opts?: SsrConfig
): Promise<T | undefined> {
  if (shouldSkipIsoSwr()) {
    return Promise.resolve(undefined);
  }

  const { fetcher } = createFetcherAndStream();
  return fetcher(request, fetchFn ?? defaultFetchFn, {
    ssr: { ...opts },
  }) as Promise<T>;
}

export function prefetchIsomorphicSWR<T>(
  request: string,
  fetchFn?: SwrFetchFn<T>,
  opts?: SsrConfig
): void {
  // Skip a micro-task.
  void Promise.resolve().then(() =>
    fetchIsomorphicSWR(request, fetchFn, {
      ...opts,
      prefetch: true,
    } as SsrConfigWithPrefetch)
  );
}

type SsrConfigWithPrefetch = SsrConfig & { prefetch?: boolean };

function defaultFetchFn<T>(
  req: string,
  fetcher: IsomorphicFetcher,
  init: RequestInit
): Promise<T> {
  if (typeof req !== "string") {
    throw new Error(
      "Only plain string keys are allowed without fetch function"
    );
  }
  return fetcher(req, init);
}

const createFetcherAndStream: () => {
  fetcher: ServerFetcher;
  stream: Stream;
  setConfig: (ssr: boolean | SsrConfig | undefined) => void;
} = cache(() => {
  const requestCache = new Map<string, Promise<unknown>>();
  const unusedPrefetches = new Set<string>();

  let globalConfig: SsrConfig = {};

  const setConfig = (ssr: boolean | SsrConfig | undefined): void => {
    if (ssr && typeof ssr === "object") {
      globalConfig = ssr;
    }
  };

  const streamer = createStreamGenerator({
    onComplete: () => {},
    timeout: globalConfig.timeout,
  });

  // Server-side fallback fetcher. It makes an actual fetch request and
  // pushes the resulting promise to the server/client stream.
  const fetcher: ServerFetcher = (request, fetchFn, config) => {
    const ssr = config.ssr ?? true;
    const prefetch =
      typeof ssr === "object"
        ? Boolean((ssr as SsrConfigWithPrefetch).prefetch)
        : false;
    if (!request || ssr === false) {
      // If we're in suspense mode, bail out to CSR.
      if (!prefetch) {
        throw new BailoutToCSRError("SSR disabled");
      }

      // TODO: typecasting here is needed to satisfy compiler- fix.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any
      return undefined as any;
    }
    const key = requestToKey(request);

    if (prefetch) {
      unusedPrefetches.add(key);
    } else if (unusedPrefetches.has(key)) {
      unusedPrefetches.delete(key);
    }

    const cachedValue = requestCache.get(key);
    if (cachedValue) {
      return cachedValue;
    }

    let ssrTimeout =
      (typeof ssr === "object" ? ssr.timeout : undefined) ??
      globalConfig.timeout;
    if (ssrTimeout !== undefined && process.env.NODE_ENV === "development") {
      // DEV is slow. Increase the timeout.
      ssrTimeout = Math.max(ssrTimeout, 2000);
    }

    const promise = timeoutPromise(
      fetchFn(request, serverFetch, config.requestInit ?? {}),
      ssrTimeout
    ).catch((reason) => {
      // Tolerate the server error, since it will be retried on the client.
      // However, prevent the client to see the initial error - too much senstive
      // info that client won't use anyway.

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      console.warn("Server useSWR recoverable:", { request, reason });
      return undefined;
    });
    streamer.push({
      request,
      value: promise,
    });
    requestCache.set(key, promise);

    return promise as Promise<typeof request>;
  };

  return { fetcher, setConfig, stream: streamer.values };
});

function shouldSkipIsoSwr(): boolean {
  // TODO: Some internal Next APIs called here. This code is not strictly necessary.
  return Boolean(
    staticGenerationAsyncStorage.getStore()?.isPrerendering ||
      staticGenerationAsyncStorage.getStore()?.isStaticGeneration ||
      staticGenerationAsyncStorage.getStore()?.dynamicShouldError
  );
}
