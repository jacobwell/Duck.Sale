# Boat Hackathon eligibility and demo

Source: supplied Teamily group announcement, checked alongside https://boathackathon.com on November 17, 2026. Times below follow the San Francisco event schedule.

| Requirement                                          | Evidence needed                                                        | Status                     |
| ---------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------- |
| Accepted builder on BoatHackathon.com                | Acceptance receipt                                                     | User to confirm            |
| Ship at least one line of code while aboard any boat | Commit/deployment made aboard, boat/date noted                         | User to complete/confirm   |
| Public boat photo                                    | Post containing #boathackathon and tagging @boathackathon and @teamily | User to provide public URL |
| Submission form includes public photo link           | Submission receipt                                                     | Pending                    |
| Submit by November 20, 2026, 5 p.m.                  | Organizer submission confirmation                                      | Pending                    |
| Selected for invite-only November 21, 1–5 p.m. demo  | Invitation                                                             | Pending                    |

## Sponsor integration

- Boat.dev: three concurrent sandbox workers, with IDs recorded on the run.
- Context.dev: web search, page extraction and source images from inside each sandbox.
- Vercel: Next.js hosting and AI Gateway for planning and extraction.
- Supabase: authenticated, private search records and generation history.
- NY Token Exchange / LetsEncrypt.AI / TrustedRouter private-AI prize: Private Mode now uses the NYTE confidential-only endpoint with required confidential routing and a fresh, TLS-exporter-bound gateway attestation. A real private search passed on preview with no content stored in app search tables. Sponsor eligibility and judging remain subject to organizer verification; ordinary Gateway searches are not confidential inference. See PRIVATE-MODE.md and its receipts.

## 90-second demo

1. “There is no single marketplace for finding anything. Duck.Sale sends a small fleet out to look.”
2. Enter a boat request with location and budget.
3. Show three real Boat sandbox IDs and Context discovery progress.
4. Show normalized prices, source images, availability evidence and unknown fields.
5. Save two results and compare; open the original source.
6. Reload the private search URL to demonstrate Supabase persistence.
7. Show the source/worker audit and explain that partial failures remain visible.

For a fast visual opening, click “Watch 20-boat voyage”: three ducks reveal 20 recorded source listings across both coasts and inland lakes in about 28 seconds. Use pause, replay, or show all. Introduce it as recorded source data with simulated movement and no live calls. Then launch an authenticated live search to demonstrate actual sponsor execution.
