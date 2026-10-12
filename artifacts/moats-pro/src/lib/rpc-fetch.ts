import { DataSourceError, setDataSourceStatus } from "./data-source-status";

export function createRpcFetch(source: string): typeof fetch {
  let retryAt = 0;
  return async (input, init) => {
    if (Date.now() < retryAt) {
      throw new DataSourceError(`${source} requests are paused while its provider recovers.`, 503, retryAt);
    }
    try {
      const response = await fetch(input, init);
      if (!response.ok) {
        retryAt = Date.now() + (Number(response.headers.get("retry-after")) || 30) * 1000;
        setDataSourceStatus(source, {
          message: "The RPC provider is unavailable. Contract data cannot refresh yet.",
          retryAt,
        });
      } else {
        setDataSourceStatus(source);
      }
      return response;
    } catch (error) {
      retryAt = Date.now() + 30_000;
      setDataSourceStatus(source, { message: "The RPC connection failed. Requests are paused.", retryAt });
      throw error;
    }
  };
}
