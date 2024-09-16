"use client";

import { Weather } from "#/types";
import useSWR from "swr";

export default function Page() {
  const { data, isLoading } = useSWR<Weather>("/api/weather", () =>
    fetch("/api/weather").then((res) => res.json())
  );
  return (
    <main>
      <h1>Weather</h1>
      {isLoading ? (
        <p>Loading...</p>
      ) : (
        <p>
          The weather is {data?.current.condition?.text} with a temperature of{" "}
          {data?.current.temp_f}
          °F.
        </p>
      )}
    </main>
  );
}
