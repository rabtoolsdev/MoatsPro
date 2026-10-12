export interface DataSourceStatus {
  source: string;
  message: string;
  retryAt?: number;
}
const statuses = new Map<string, DataSourceStatus>();

export function getDataSourceStatuses(): DataSourceStatus[] {
  return [...statuses.values()];
}

export function setDataSourceStatus(source: string, status?: Omit<DataSourceStatus, "source">) {
  if (status) statuses.set(source, { source, ...status });
  else statuses.delete(source);
  if (typeof window !== "undefined") window.dispatchEvent(new Event("moats-data-status"));
}

export class DataSourceError extends Error {
  constructor(message: string, public status: number, public retryAt: number) {
    super(message);
  }
}

export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (error instanceof DataSourceError) return false;
  let current = error;
  for (let depth = 0; depth < 5 && current && typeof current === "object"; depth++) {
    const value = current as { status?: number; code?: number; cause?: unknown; message?: string };
    if (value.status && (value.status === 503 || (value.status >= 400 && value.status < 500))) return false;
    if (value.code === -32005 || /rate.limit|too many requests|cors|failed to fetch/i.test(value.message ?? "")) return false;
    current = value.cause;
  }
  return failureCount < 1;
}
