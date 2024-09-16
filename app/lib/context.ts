import { createContext } from "react";
import type { IsomorphicSWRConfig } from "./config";
import type { FallbackSource } from "./types";

export interface ContextValue {
  config: IsomorphicSWRConfig;
  fallbackSource: FallbackSource | undefined;
}

const defaultContext: ContextValue = {
  config: { ssr: false },
  fallbackSource: undefined,
};

export const Context = createContext<ContextValue>(defaultContext);
