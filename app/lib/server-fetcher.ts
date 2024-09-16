import { headers } from "next/headers";
import { IsomorphicFetcher } from "./types";

/**
 * Server-side fetch. Would normally be very similar to the client-side fetch, but
 * typically also does the following:
 * - Compute the correct host names for requests.
 * - Compute cookies and/or authorization headers.
 */
export const fetcher: IsomorphicFetcher = async (input, init) => {
  const url = new URL(input, "http://localhost:3000");
  const resp = await fetch(url, {
    ...init,
    headers: {
      ...init.headers,
      authorization: headers().get("authorization") ?? "<server-auth>",
    },
  });
  if (resp.status >= 400) {
    throw new Error(`Fetch failed with ${resp.status}`);
  }
  return resp.json();
};
