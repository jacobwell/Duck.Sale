# Mega fleet lab

Open `/mega` or `/?mega=true`. Normal search and its live fleet limits are unchanged.

## Record → replay

1. Sign in on the main page, then open the lab on the same origin.
2. Enter a public search and choose **Launch & record 25 real boats**. This makes one real production-style search and consumes normal provider credits. Keep the tab open while capturing. Navigating away stops browser capture, not the server-owned voyage.
3. The latest recording is saved in this browser's IndexedDB. Download its JSON for a portable copy. Import accepts the versioned, validated format, up to 20 MB.
4. Or load the bundled real 25-boat seed. This only fetches a static JSON file; it launches no workers.
5. Select 101, 250, 500, 1,000, 2,500 or 10,000 virtual boats. Play, pause, scrub or change speed. Optional ~5% failure injection is explicitly synthetic.

## What is recorded

An explicit allowlist captures elapsed worker-state transitions, public API-call metadata (service, operation, target, status and HTTP code), and extracted listing titles, source URLs, locations and prices. No bearer tokens, request headers, raw HTTP bodies, account IDs, private-mode traffic, or private inference is recorded. This is an application-event replay, not an HTTP proxy or exact provider-response cassette. Public listing claims can be stale or wrong; replay does not refresh them.

## Scale and honesty

The original seed workers are repeated deterministically with a 120 ms stagger per flotilla. Each flotilla contains up to 25 virtual boats. The overview renders one summary per flotilla; only the selected flotilla renders individual berths. The selected virtual boat shows at most 20 call records. Source links remain unique and are never multiplied into new discoveries. A persistent simulation banner distinguishes the lab from live search.

Timeline lookup uses binary search. The playback clock updates at 5 Hz; it does not replay thousands of React updates per captured event. This stresses client-side fleet calculation, grouping and rendering. It does **not** measure real provider concurrency, database throughput, HTTP stream throughput or sandbox limits. The displayed effect-to-frame delay is a rough browser scheduling observation, not FPS or a comprehensive performance benchmark.

The lab keeps no additional server records beyond the ordinary authenticated search. Recordings are local unless explicitly exported or bundled as a public seed. Do not commit personal-query recordings without review.

## Treasure map

The mega view leads with a US map using recorded city coordinates. Representative seekers follow illustrated curved courses to each find. At the recorded find time, a treasure chest appears; its boat and wake fade over six replay seconds while the chest remains. Nearby pins are clustered in screen space, and a chest opens its recorded source links and selects the seed seeker in the dock. Routes are representative, not multiplied for every virtual worker; active paths are capped at 60. Unplaced and out-of-map listings are counted, never assigned invented coordinates. The full flotilla index remains available in a collapsed section below.

New recordings include city coordinates, seeker IDs and first-result timestamps. The bundled seed was enriched from the same saved search's geocoded listing data; its find times use each seeker's first recorded nonzero-find frame. Older imported/local recordings still work, but need the updated seed or a new recording for geographic plotting.
