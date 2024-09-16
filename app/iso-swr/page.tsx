"use client";

import { Weather } from "#/types";
import { useIsomorphicSWR } from "../lib/use-isomorphic-swr";

export default function Page() {
  const { data, isLoading } = useIsomorphicSWR<Weather>("/api/weather");
  return (
    <main>
      <h1>Weather</h1>
      {isLoading ? (
        <p>Loading...</p>
      ) : (
        <>
          <p>
            The weather is {data?.current.condition?.text} with a temperature of{" "}
            {data?.current.temp_f}
            °F.
          </p>
          <p>Auth: {data?.auth}</p>
        </>
      )}
    </main>
  );
}
