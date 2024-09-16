import type { IsomorphicSWRConfig } from "./config";

// Fetcher provided by the isomorphic framework.
export type IsomorphicFetcher = <T = unknown>(
  url: string,
  init: RequestInit
) => Promise<T>;

// Fetch function for isomorphic SWR. A developer can provide
// this function to create a custom fetch request or to reformat the response.
// This function must call the provided isomorphic fetcher.
export type SwrFetchFn<R> = (
  request: string,
  fetcher: IsomorphicFetcher,
  init: RequestInit
) => Promise<R>;

// Server fetcher function.
export type ServerFetcher = <R>(
  req: string,
  fetchFn: SwrFetchFn<R>,
  config: IsomorphicSWRConfig
) => Promise<R>;

// Fallback resolver. Works differently on the server and client.
// Server-side: calls the `ServerFetcher` function.
// Client-side: looks for a fallback in the RSC stream.
export type FallbackSource = <R>(
  req: string,
  fetchFn: SwrFetchFn<R>,
  config: IsomorphicSWRConfig
) => Promise<R>;
