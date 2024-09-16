import { IsomorphicFetcher } from "./types";

export const fetcher: IsomorphicFetcher = async (url, init) => {
  const resp = await fetch(url, init);
  if (resp.status >= 400) {
    throw new Error(`Fetch failed with ${resp.status}`);
  }
  return resp.json();
};
