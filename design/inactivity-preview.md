# Inactivity preview (#190)

## Updated human-approved rollout policy

The guild owner reviewed the initial manual-evidence preview and explicitly replaced it with automatic membership tracking and a one-time schedule-date fallback. This supersedes the manual historical-review requirement and unknown-legacy-row behavior in the earlier `inactivity-policy.md` handoff. **No automated preference zeroing or replacement DM is enabled.**

### Existing players: fixed rollout cohort

The first successful complete Discord membership/role census captures current eligible non-bot members, including people who have never logged in or set preferences. Each receives the guild's earliest **retained scheduled-session creation timestamp** as a fallback addition date. This is an explicit guild-owner-approved rollout assumption, not a verified join date or inferred historical fact. If all original schedules were deleted, the earliest surviving record may be later than the true first schedule; this is conservative. The selected timestamp is stored once, not recomputed on every preview.

The addition month remains exempt. Thresholds always apply: for N cycles, check the upcoming target month and its preceding N−1 target months. Default N=3, supported integer range 2–12. There is no permanent threshold bypass, invented completion history, or blanket extra rollout grace. If no retained schedule exists (or its creation is in the future), use first observed eligibility instead and show that provenance.

### Later additions: automatic observation

Once initialized, newly discovered eligible humans receive **first observed eligibility**, never the old schedule fallback. Discord join dates are used to bound membership epochs, not as timestamps of role addition. The snapshot contains the member ID, original addition evidence/source, first/last actual observation, access state, latest membership join timestamp and start of the current reliable access interval. No app account or game membership is required.

A separate authenticated membership-only daily cron (`/api/cron/inactivity-tracking`, 17:00 UTC) refreshes guild membership metadata without invoking notification processing. Loading Users Config while inactivity management is enabled also runs this census automatically, so no per-person or separate initialization step is needed. The daily census continues recording eligibility while the preview setting is off, so toggling it on does not lose membership history. **Preview may update tracking metadata only; it never writes preferences, availability, schedules or sends messages.**

Census uses complete paginated membership plus one fresh role lookup, resolving the same access rules as authentication. Any Discord lookup/pagination failure prevents the entire guild snapshot from being committed. A guild-row transaction lock serializes initialization and writes; access-rule changes detected under the lock abort the census. The initial cohort and member original dates/sources do not change on subsequent sweeps.

### Access loss, rejoin and gaps

Observed role/access loss or departure records `hasAccess=false`. Restoration or a changed Discord join timestamp starts a new reliable access interval, but **does not move original addition**. Known unavailable periods cannot become misses. A census gap longer than three days likewise bounds reliable access from the next observation; missing history is uncertain, not proof of inactivity. Current join-month and restored-access partial months cannot count as full eligible months.

Polling cannot discover role removal/restoration that occurs entirely between successful daily snapshots. We do not claim precise role-event timestamps. Discord audit-log ingestion is not implemented in this slice; it can refine future history, but is not required for the approved rollout. A membership lookup failure never establishes inactivity. Long outages can therefore delay qualification conservatively.

### Submission evidence

- New deliberate full player submissions, signed Discord all-unavailable responses, and full admin submissions save `completed_at`/`completion_source` atomically with days. Impersonated submissions say `admin`.
- Full all-unavailable counts. Later partial edits never establish or clear an established completion.
- A submission without known completion/partial provenance is a `legacy_response`: conservatively treat it as activity/protection, without asserting full completion or inventing its source. This also safely handles submissions from an older app instance during deployment. No generic timestamp or day count is used to infer completion.
- New incremental records are explicitly marked `completion_source=partial` on insert only; conflict updates preserve full or ambiguous legacy provenance. A known partial record does not establish activity. If all checked cycles lack completion/protective legacy response and have eligible-history coverage, they are unanswered.
- A response belongs to its target year/month, not save timestamp. Current-month and early upcoming-month responses protect. Preferences are never restored by availability submission, and preference restoration never resets addition/history.

### Preview and clocks

The guild's main settings form contains an **Enable inactive player management** switch and the **Unanswered submission cycles** field. The field is disabled while switched off. Both values are drafts until **Save Changes** persists them atomically with the other settings; successful saves refresh the page and reload an open Users Config snapshot. The flag defaults off and controls the preview only in #190; enabling it does not start the not-yet-implemented #191 downgrade/DM processor.

There is no standalone inactivity section. When the saved setting is on, each eligible player's Sessions / Month cell shows `Last schedule <MMM, yy> - <status>`; the date is the latest full/legacy availability **target month**, or `Never`. Known partial-only records do not become last schedules. Values are snapshots at data load, refreshed after saved settings or preferences and when reopening Users Config. When off, the server does not load preview history for Users Config and the client shows no activity lines (including previously cached lines or open detail popups). States are colored text badges: jade Active, ruby Inactive, sage Not participating, violet New Player, and amber Unknown. Clicking a badge (or keyboard Enter/Space) opens a non-modal tooltip-style popover with the snapshot's checked cycles, threshold, response provenance, eligibility source, first countable month, reasons and cutoff. Escape, outside click or its close button dismisses it. Opening details performs no requests or writes and uses only the authorized snapshot loaded with Users Config.

The compact status names are:

- **Inactive:** every checked response cycle unanswered and eligible population/evidence; would pause at T−4, not an operation that has happened.
- **Active:** recent full submission or conservative legacy response protects.
- **New Player:** insufficient countable cycles after addition. A qualifying recent response takes precedence and shows Active instead.
- **Unknown:** missing access/join evidence or an observation/rejoin gap.
- **Not participating:** an eligible current player with missing/null desired sessions or an already-zero preference. Explicit nonzero desired sessions, including No Limit, remain required for pausing; game membership is not.

Users Config includes only current eligible non-bot members with allowed-role or guild-admin access. Departed/no-access members remain in internal tracking to preserve access history, but are not returned in the preview. This keeps lack of access separate from the familiar Not participating status.

`NOW_OVERRIDE` affects only cycle evaluation. Membership observations, initial census times and metadata use the real observation clock, so testing cannot fabricate earlier additions. T−4 remains four UTC calendar days before month-end; current-month editing remains open.

## Persistence and validation

`0023_inactivity_preview.sql` introduced additive completion fields, a defaulted threshold and the original review table. That table is retained for migration compatibility/audit, but is no longer read or written by the runtime and no manual review UI/action remains. `0024` adds guild/member tracking tables; `0025` adds a default-false `inactivity_enabled` guild setting. All previous application versions remain compatible. Do not rewrite a migration already applied to the local database.

The owner plans to refresh the separate local database from the latest data, then remove the local date override and review the actual Active/Inactive lists. Do not reset/copy a database or remove the override on their behalf without that next step being requested. Never run the notification cron against the clone. No role removal, game/schedule mutation, zeroing automation, or return-flow automation is included.

Before #191: human-review the real-date preview against the refreshed local database; implement transactional fresh completion/access checks, cycle idempotency, restoration/zeroing audit and DM retry safety separately. Membership snapshots and the approved fallback do not replace those mutation safeguards.
