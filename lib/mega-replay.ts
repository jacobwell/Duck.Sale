import { z } from "zod";
import type { SearchEvent } from "./types";
const status = z.enum([
  "queued",
  "starting",
  "searching",
  "extracting",
  "complete",
  "failed",
]);
const call = z.object({
  id: z.string().max(100),
  service: z.string().max(80),
  operation: z.string().max(200),
  status: z.enum(["running", "complete", "failed"]),
  statusCode: z.number().optional(),
  target: z.string().max(300).optional(),
});
export const recordingSchema = z.object({
  version: z.literal(1),
  kind: z.literal("public-search-stream"),
  completed: z.boolean().default(false),
  runId: z.string().uuid(),
  query: z.string().max(1000),
  capturedAt: z.string(),
  durationMs: z.number().min(1).max(3600000),
  workers: z
    .array(
      z.object({
        id: z.string().max(80),
        name: z.string().max(100),
        frames: z
          .array(
            z.object({
              at: z.number().min(0).max(3600000),
              status,
              calls: z.array(call).max(100),
              finds: z.number().int().min(0),
            }),
          )
          .min(1)
          .max(500),
      }),
    )
    .min(1)
    .max(101),
  listings: z
    .array(
      z.object({
        title: z.string().max(200),
        sourceUrl: z
          .string()
          .url()
          .refine((v) => /^https?:\/\//.test(v)),
        price: z.number().nullable(),
        location: z.string().nullable(),
        workerId: z.string().max(80).optional(),
        foundAt: z.number().min(0).max(3600000).optional(),
        locationPoint: z
          .object({
            latitude: z.number().min(-90).max(90),
            longitude: z.number().min(-180).max(180),
            label: z.string().max(200),
          })
          .optional(),
      }),
    )
    .max(5000),
});
export type Recording = z.infer<typeof recordingSchema>;
export type Frame = Recording["workers"][number]["frames"][number];
export function newRecording(query: string): Recording {
  return {
    version: 1,
    kind: "public-search-stream",
    completed: false,
    runId: "00000000-0000-0000-0000-000000000000",
    query,
    capturedAt: new Date().toISOString(),
    durationMs: 1,
    workers: [],
    listings: [],
  };
}
// Explicit allowlist: never serialize auth headers, raw provider bodies or private traffic.
export function recordEvent(r: Recording, e: SearchEvent, at: number) {
  r.durationMs = Math.max(1, at);
  if (e.type === "run") r.runId = e.id;
  if (e.type === "worker") {
    const w = e.worker;
    let track = r.workers.find((x) => x.id === w.id);
    if (!track) {
      track = { id: w.id, name: w.name, frames: [] };
      r.workers.push(track);
    }
    const frame: Frame = {
      at,
      status: w.status,
      finds: w.count || 0,
      calls: (w.calls || []).map((c) => ({
        id: c.id,
        service: c.service,
        operation: c.operation,
        status: c.status,
        ...(c.statusCode !== undefined ? { statusCode: c.statusCode } : {}),
        ...(c.target ? { target: c.target } : {}),
      })),
    };
    const prev = track.frames.at(-1);
    if (
      !prev ||
      JSON.stringify({ ...prev, at: 0 }) !== JSON.stringify({ ...frame, at: 0 })
    )
      track.frames.push(frame);
  }
  if (e.type === "complete") r.completed = true;
  if (e.type === "results" || e.type === "complete") {
    const listings = e.type === "complete" ? e.run.listings : e.listings;
    for (const l of listings) {
      if (!r.listings.some((x) => x.sourceUrl === l.sourceUrl))
        r.listings.push({
          title: l.title,
          sourceUrl: l.sourceUrl,
          price: l.price,
          location: l.location,
          workerId: l.workerId,
          foundAt: at,
          ...(l.locationPoint
            ? {
                locationPoint: {
                  latitude: l.locationPoint.latitude,
                  longitude: l.locationPoint.longitude,
                  label: l.locationPoint.label,
                },
              }
            : {}),
        });
    }
  }
}
export function frameAt(frames: Frame[], at: number): Frame {
  let low = 0,
    high = frames.length - 1,
    found = -1;
  while (low <= high) {
    const mid = (low + high) >>> 1;
    if (frames[mid].at <= at) {
      found = mid;
      low = mid + 1;
    } else high = mid - 1;
  }
  return found < 0
    ? { at: 0, status: "queued", calls: [], finds: 0 }
    : frames[found];
}
export function validateRecording(value: unknown): Recording {
  const r = recordingSchema.parse(value);
  if (new Set(r.workers.map((w) => w.id)).size !== r.workers.length)
    throw new Error("Duplicate seed worker IDs.");
  for (const w of r.workers)
    for (let i = 0; i < w.frames.length; i++)
      if (
        w.frames[i].at > r.durationMs ||
        (i > 0 && w.frames[i].at < w.frames[i - 1].at)
      )
        throw new Error("Invalid recording timeline.");
  return r;
}
