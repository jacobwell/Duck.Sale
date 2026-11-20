export type PrivateActivity = {
  type: "activity";
  id: string;
  service: "Boat.dev" | "WireGuard" | "Context.dev" | "NYTE" | "Duck.Sale";
  operation: string;
  status: "running" | "complete" | "failed";
  at: string;
  startedAt: string;
  finishedAt?: string;
  httpStatus?: number;
  count?: number;
};
export type PrivateEvent =
  | PrivateActivity
  | { type: "heartbeat"; at: string }
  | { type: "result"; status: number; body: Record<string, unknown> };
export type PrivateEmit = (event: PrivateActivity) => void;
