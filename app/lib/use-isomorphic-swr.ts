"use client";

import { useContext, useEffect, useMemo, useRef } from "react";
import type { SWRResponse } from "swr";
// eslint-disable-next-line camelcase
import useSWR, { useSWRConfig, unstable_serialize } from "swr";
import type { IsomorphicSWRConfig } from "./config";
import { mergeConfig } from "./config";
import type { SwrFetchFn, IsomorphicFetcher } from "./types";
import { useAsyncValue } from "./use-async-value";
import { Context } from "./context";
import { fetcher as clientFetcher } from "./client-fetcher";

const IS_SERVER = typeof window === "undefined";

// request dedup cache for refetching data when iso fallback fails
const fallbackFailureRefetchCache = new Map<string, boolean>();

export type IsomorphicSWRResponse<T> = SWRResponse<T>;

export function useIsomorphicSWR<T>(
  request: string | null,
  opts?: IsomorphicSWRConfig
): IsomorphicSWRResponse<T>;

export function useIsomorphicSWR<T>(
  request: string | null,
  fetchFn: SwrFetchFn<T>,
  opts?: IsomorphicSWRConfig
): IsomorphicSWRResponse<T>;

export function useIsomorphicSWR<T>(
  request: string | null,
  fetchFnOrOps?: SwrFetchFn<T> | IsomorphicSWRConfig,
  maybeOpts?: IsomorphicSWRConfig
): IsomorphicSWRResponse<T> {
  const context = useContext(Context);

  const { config: contextConfig, fallbackSource } = context;

  const fetchFn: SwrFetchFn<T> = useMemo(
    () =>
      typeof fetchFnOrOps === "function"
        ? (req, f, init) => fetchFnOrOps(req, f, init)
        : (defaultFetchFn as SwrFetchFn<T>),
    [fetchFnOrOps]
  );
  const swrFetcher = useMemo(
    () => (req: string) => {
      if (IS_SERVER) {
        throw new Error("useSWR: swrFetcher is not available on server");
      }
      return fetchFn(
        req,
        clientFetcher,
        maybeOpts?.requestInit ?? {}
      ) as Promise<unknown>;
    },
    [fetchFn, maybeOpts]
  );
  const opts = typeof fetchFnOrOps === "object" ? fetchFnOrOps : maybeOpts;

  const { ...swrConfig } = opts ?? {};
  const config = mergeConfig(contextConfig, opts);

  const initialFallbackRequestKey = useRef(unstable_serialize(request));
  const fallbackDataPromiseRef = useRef(
    request ? fallbackSource?.(request, fetchFn, config) : undefined
  );

  // Resolve fallback promise into a `[data, isLoading]` pair.
  const [fallbackData, fallbackLoading] = useAsyncValue(
    IS_SERVER,
    fallbackDataPromiseRef.current
  );

  const { cache } = useSWRConfig();
  const hasCache = Boolean(request && cache.get(request));

  // Track if we revaidated on mount to avoid extra fallback refetch request.
  const revalidateOnMountRef = useRef(
    !IS_SERVER &&
      (swrConfig.revalidateOnMount ?? (!fallbackData && !fallbackLoading))
  );
  const response = useSWR(
    fallbackLoading && !IS_SERVER && !hasCache ? null : request,
    swrFetcher,
    {
      ...swrConfig,
      suspense: false,
      fallback: {
        [initialFallbackRequestKey.current]: fallbackData,
      },
      revalidateOnMount: revalidateOnMountRef.current,
    }
  );

  const { mutate } = response;
  useEffect(() => {
    // If we don't receive any fallback data and we're done loading, trigger
    // a mutate to refetch the data. This should only happen when we're not revalidating
    // on mount and not already refetching.
    if (
      fallbackData ||
      fallbackLoading ||
      fallbackFailureRefetchCache.get(initialFallbackRequestKey.current) ||
      revalidateOnMountRef.current
    ) {
      return;
    }
    void mutate().finally(() => {
      fallbackFailureRefetchCache.set(initialFallbackRequestKey.current, false);
    });
    fallbackFailureRefetchCache.set(initialFallbackRequestKey.current, true);
  }, [mutate, fallbackData, fallbackLoading]);

  return {
    ...response,
    isLoading:
      (response.isLoading && response.data === undefined) ||
      (fallbackLoading && !hasCache) ||
      IS_SERVER,
  } as IsomorphicSWRResponse<T>;
}

function defaultFetchFn<T>(
  req: string,
  fetcher: IsomorphicFetcher,
  init: RequestInit
): Promise<T> {
  return fetcher(req, init);
}
