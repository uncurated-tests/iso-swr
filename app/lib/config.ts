import type { SWRConfiguration } from "swr";

export type IsomorphicSWRConfig<Data = unknown> = Omit<
  SWRConfiguration<Data>,
  | "suspense"
  | "fallback"
  | "fallbackData"
  | "onLoadingSlow"
  | "onSuccess"
  | "onError"
  | "onErrorRetry"
> & {
  ssr?: boolean | SsrConfig;
  requestInit?: RequestInit;
};

export interface SsrConfig {
  timeout?: number;
}

export const defaultConfig: IsomorphicSWRConfig = {
  ssr: {
    timeout: process.env.NODE_ENV === "development" ? 5000 : 500,
  },
};

export function mergeConfig(
  config1: IsomorphicSWRConfig,
  config2: IsomorphicSWRConfig | undefined
): IsomorphicSWRConfig {
  return {
    ...config1,
    ...config2,
    ssr: mergeSsrConfig(config1.ssr, config2?.ssr),
  };
}

export function mergeSsrConfig(
  config1: boolean | SsrConfig | undefined,
  config2: boolean | SsrConfig | undefined
): boolean | SsrConfig | undefined {
  if (config2 === undefined) {
    return config1;
  }
  if (config2 === false) {
    return false;
  }
  return {
    ...(typeof config1 === "object" ? config1 : undefined),
    ...(typeof config2 === "object" ? config2 : undefined),
  };
}
