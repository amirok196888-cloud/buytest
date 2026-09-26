# BuyTest analytics audit — 26 September 2026

Audited main: `d2d003e3547e5bb37a2d72c30f8aaf77593a6ab4`.
Its direct parent is `4bba1fd600a167cb17fcdd7c305254f97626578d`;
both requested changes are present. The SQL commit actually preceded the HTML commit.

## Verdict

The named route/insurance/129 events are wired and accepted by the live database
and live analytics Edge Function. This is **not** complete customer-flow tracking,
and the database change is **not covered by the observed deployment path**.
Manager click totals are usable, but they are not an ordered session funnel and
cannot establish where the same visitors stopped progressing.

This audit does not change runtime sources, prices, payments, WhatsApp or the
customer flow. The user's subsequent cancellation of the 149 offer is handled
separately in PR #9, with three passing tests preserving existing paid access.
Do not add new tracking or promotion for that cancelled offer.

## Findings, ordered by impact

### P1 — Deployment does not apply the SQL change

`supabase/click-tracking-setup.sql:1` replaces the event constraint, but it is
outside `supabase/migrations`. The last constraint replacement in a migration,
`20260920213000_add_blog_analytics.sql`, omits `click_before_route`,
`click_after_route`, `click_insurance_history`, and
`click_report_consultation_plan`. Replaying the checked-in migrations rejects all
four even though the frontend and Edge Function accept them.

Observed GitHub run [36239803351](https://github.com/amirok196888-cloud/buytest/actions/runs/36239803351)
succeeded for the audited main. Its jobs are `build`, `report-build-status`, and
`deploy`; steps build Jekyll, upload an artifact, and deploy GitHub Pages. None
executes SQL or deploys an Edge Function. The recursive main tree contains no
checked-in workflow or database deployment script. This is concrete evidence
about that deployment; an undocumented external/manual deployment cannot be
ruled out.

Read-only inspection of the live BuyTest project on this date confirmed the
constraint already includes the four events. Edge Function `buytest-analytics`
version 17 matches the checked-in source, including all four events. Therefore
the problem is reproducibility/deployment coverage, not evidence that these four
are currently rejected by the live database. No production event was inserted
by this audit.

Live migration history has no entry for this setup file. It also differs from
repository timestamps (e.g. live analytics base `20260909091526`, repository
`20260909093000`) and contains baseline changes missing from the repository.
Do not blindly add `db push --include-all`: first reconcile schema and migration
history, capture the incremental analytics change with the Supabase CLI, and
establish an explicit migration-before-function-before-frontend release gate.
The current repo alone is not a demonstrated clean-room database bootstrap.

### P1 — Important current actions emit no click event

See the inventory below and executable failing tests. Missing coverage includes
opening the seller questions, opening license verification, crossing to the
after-inspection page, confirming its vehicle, payment form submission/cancel,
original insurance PDF, general WhatsApp, and supplementary uploads/removals.
The global capture listener only observes `[data-analytics-click]`. These
controls have no attribute and no equivalent explicit click event in their
handlers. Do not equate `free_started` or an external advertising event with
these separate actions.

### P1 — Manager totals cannot measure same-session advancement/drop-off

`buytest_analytics_click_summary` groups independently by source, event and UTM,
counting distinct sessions. The authenticated `stats` response returns only
`stats`, `clicks`, and `blog`; no transition cohorts are calculated. For example:

| Observed sessions | Before-route clicks | Question clicks | Same-session progression |
| --- | ---: | ---: | ---: |
| A: route + questions; B: route | 2 | 1 | 1 of 2 |
| A: route; B: route; C: questions | 2 | 1 | 0 of 2 |

Both yield the same click totals. Subtracting totals would be incorrect.
Consultation buttons in different locations also share `click_consultation_plan`,
so location-specific abandonment cannot be recovered. `renderBuyTestClickAnalytics`
filters out zero counts entirely. A zero stage, an uninstrumented stage, and a
failed collection path are not distinguishable to the manager.

A follow-up should define route-specific transitions over the **same sessions**,
with time ordering and an explicit range/cohort rule; report "not yet continued"
for still-open sessions rather than asserting abandonment. Show zero and unknown
separately, preserve campaign/source attribution, and keep verified order
payments separate from purchase-button intent. Add a stable control/placement
identifier if different consultation entry points must be distinguished.

### P2 — After-inspection lookup pollutes the free-start metric

`loadAfterPageVehicle` explicitly calls `setCustomerRoute('free')` before
`loadVehicle`. On a successful lookup, `loadVehicle` consequently emits
`free_started`, although the visitor is in the after-inspection route. The
deterministic test executes the real handler and checks its interaction with
the actual free-start guard. Route-specific denominators must not use this
metric unchanged.

### P2 — Two supported manager entry URLs leak customer events

Initialization recognizes `?manager`, `?admin`, and `?mode=manager`.
`trackBuyTestEvent` excludes only `?manager` and `body.manager-mode`.
Before authentication adds that class, the other two entry URLs can emit
`page_view` and button events. Runtime tests reproduce both cases; the regular
manager link and authenticated preview are correctly excluded.

### P2 — A meaningful current free-completion boundary is missing

The current license section is a static seven-item guide, with no completion
control. `continueToInsuranceFlow()` calls `trackBuyTestFreeCompletedOnce`, but
has no current customer caller. `buildReport()` also emits completion; its PDF
fallback is not evidence that a visitor finished the current questions/license
route. Do not interpret the existing freeCompleted number as completion of that
current route. Decide on an observable milestone without changing the visible
flow (for example, stage opened), label it honestly, and keep historic completion
events distinct. This semantic limitation is documented rather than inventing
a customer observation or silently changing the flow.

## Customer control inventory

Existing event names and prices below describe the audited code, not new pricing.
The 129 service was already present; nothing in this audit reinstates or reprices it.

| Control / handler | Current tracking | Assessment |
| --- | --- | --- |
| Before route | click_before_route | Dispatch, edge allowlist and Hebrew label pass |
| After route | click_after_route | Same |
| Free lookup CTA | click_landing_free; free_started after successful data load | Click and success are distinct |
| Lower lookup anchor | click_vehicle_lookup | Anchor intent only, not successful lookup |
| After-route continue / report purchase | click_report_plan | Multiple placements merged |
| Copy seller questions | click_copy_questions | Pass |
| Insurance purchase | click_insurance_history | Pass; click may only reveal required seller fields |
| Report + consultation 129 | click_report_consultation_plan | Pass |
| Consultation purchase, three placements | click_consultation_plan | Pass, but placements indistinguishable |
| Examiner upload picker | click_report_upload | Picker opened, not file uploaded |
| Analyze | click_analyze | Attempt, not completed interpretation |
| Interpretation PDF | click_report_pdf | Attempt, not successful share/download |
| Insurance summary PDF | click_balcar_pdf | Attempt, not successful share/download |
| Prebuy / post-report WhatsApp | click_prebuy_whatsapp / click_post_report_whatsapp | Open attempt; not proof of message sent |
| continueToFreeFlow | None | Missing seller-question transition |
| showLicenseFlow | None | Missing license transition |
| openAfterPage from before-route prompt | None | Missing cross-route transition |
| loadAfterPageVehicle | None | Also misclassifies free_started |
| closeInspectionRoutes / closeAfterPage / returnToVehicle | None | Missing back-navigation intent |
| App back-to-services anchor | None | Missing return-navigation intent |
| retryPaidBalcarWithDetails / dynamic loadPaidBalcarReport retry | None | Missing insurance retry intent |
| Original insurance report link | None | Missing original PDF opening |
| Computer-test picker / consultation photos picker | None | Missing supplementary upload intent |
| Remove examiner/computer file; dynamic photo removal | None | Missing remove/retry behavior |
| General WhatsApp footer link | None | Missing general contact intent |
| Payment submit / close | None in internal click analytics | Cannot measure this checkout boundary from click report |
| full149 runtime purchase offer | Untracked in original main | Superseded by explicit cancellation; removal in PR #9 |
| Legacy single/three-car WhatsApp offers | Removed synchronously by package script | Not current customer controls; do not revive |
| Legacy external/self/summary buttons | Labels persist but controls removed | Historic events, not evidence of current tracking |
| Legal dialogs, rating stars, feedback form, image zoom, ordinary nav | No core-funnel click contract | Utility/content controls; separate scope from purchase funnel |
| Manager controls | Should never count as customer flow | Authenticated exclusion passes; URL aliases fail |

## Deterministic regression suite

Run with Node 24 (uses built-in TypeScript stripping; no packages required):

```sh
node --test tests/analytics-audit.test.mjs
```

**46 tests: 20 pass, 26 fail, 0 skipped, 0 TODO. Exit status 1 is intentional:**
these are executable desired-behavior regression gates that expose the current
gaps, not a claim that the gaps have been repaired. No test is suppressed to make
the audit appear green. Keep this as a draft until the failing contracts are
implemented and verified.

Passing tests execute the existing event dispatcher, validate the specified
events/labels, verify capture and nested-target handling, disabled/unrelated
click exclusion, non-blocking failure handling, manager-mode exclusion, and
escaped campaign rendering. Failing tests cover 19 missing actions, two
manager aliases, wrong-route free-start classification, migration allowlist
replay, absent deployment integration, hidden zero stages, and absent session
transition data. The stats API test executes the checked-in TypeScript handler
with deterministic HTTP/RPC fixtures; it does not contact production.

The migration test inspects the final constraint in migration order; it does not
claim to have bootstrapped the incomplete historical schema. The deployment test
is a source contract, supported by the observed Pages job steps above. A future
workflow needs actual successful deployment evidence as well as a passing source
check. Handler/DOM tests are isolated tests, not a live browser end-to-end run.

Audit production access was read-only. No real payment, report order or WhatsApp
message was sent. No customer behavior was inferred from invented observations.
