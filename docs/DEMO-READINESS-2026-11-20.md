# November 20 demo-readiness check

Verified on production before recording fresh footage. Live searches use variable source coverage; completion does not imply every page was readable or every worker found an item.

| Check | Observed outcome |
| --- | --- |
| TypeScript, ESLint, existing regression test | Passed; no new unit tests added |
| Unauthenticated public, private, PC, and DoorDash search requests | HTTP 401 |
| Three-boat boat API run | Three finds, authenticated saved reload passed, partial source coverage |
| Three-boat browser voyage | One boat candidate, three workers stopped; auto-scroll, result details, city pin, saved favorite and reload verified |
| Fresh three-boat GPU recording | Four deduplicated finds, three workers complete and stopped, 18 calls, no HTTP 429 or failed calls; partial coverage |
| Private API verification | Preparation and search HTTP 200; gateway attestation verified; fictional recipient/budget omitted from public draft; three matches; VPN checked and sandbox deleted |
| Private database boundary | No private content in search records, zero source-evidence rows, zero generation rows; admission metadata retained |
| Fresh private browser recording | Three shopping sources; seller link opened; displayed $13.97 matched the original seller page; privacy receipt showed worker deletion |
| PC bonus mode | Eight parts, 17 sources; 4/18 checks supported, 14 need verification, no proven conflicts. Partial result, not a compatibility guarantee |
| Fresh 25-boat recording | 22 finds, 25 workers complete, 25 stopped, 166 calls, no HTTP 429 or failed calls; partial source coverage; 19 source photos and 19 city locations |
| Deck | Served file matches the supplied latest 12-slide PPTX; ZIP integrity passed |
| Existing media | Main MP4 and GIF served correctly; complete MP4 decode passed |
| Organizer listing | Duck.Sale appears in Demo Day Finalists at boathackathon.com with site, video and repo links |

## Corrections made during the audit

- Bring finished-search notices into view so an admission error is not hidden above the auto-scrolled map.
- Prevent rejected monetary claims from surviving in AI-written descriptions, match reasons, and highlights. Fresh GPU and 25-boat results had zero monetary mentions in those fields when their price lacked evidence.
- Instruct private shopping extraction to exclude news and historical exhibitions that do not offer an item for purchase or rental.
- Sort numbered worker IDs numerically in the live dock.
- Replace stale finalist status with the observed public listing. Individual photo and aboard-code receipts were not independently audited.

## Fresh recordings

- `/demo/duck-sale-demo.mp4`: 180 seconds, 1920×1080 H.264/AAC.
- `/demo/duck-sale-25-boats.mp4`: 90 seconds, 1920×1080 H.264/AAC.
- Both contain actual UI captures, captioned time compression and the original instrumental soundtrack. Illustrated boat movement is not physical travel.
- The earlier YouTube upload remains available and is labeled as an earlier demo.

Do not call Private Mode “zero trace.” The app handles the request transiently; admission metadata remains, providers have their own retention boundaries, and third-party erasure is not verified. Opening a seller link exposes the visitor's ordinary browser connection to that site.
