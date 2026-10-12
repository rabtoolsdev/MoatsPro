import { useEffect, useState } from "react";
import { getDataSourceStatuses } from "@/lib/data-source-status";

export function DataSourceNotice() {
  const [statuses, setStatuses] = useState(getDataSourceStatuses);
  useEffect(() => {
    const update = () => setStatuses(getDataSourceStatuses());
    window.addEventListener("moats-data-status", update);
    return () => window.removeEventListener("moats-data-status", update);
  }, []);
  if (!statuses.length) return null;
  return (
    <div role="status" className="fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-3xl rounded-lg border border-amber-400/30 bg-slate-950/95 px-4 py-3 text-xs text-amber-100 shadow-lg">
      <p className="font-semibold">Some data is temporarily delayed</p>
      {statuses.map((status) => <p key={status.source} className="mt-1">{status.source}: {status.message}</p>)}
      <p className="mt-1 text-amber-100/70">Previously loaded data may be out of date. Requests resume automatically.</p>
    </div>
  );
}
