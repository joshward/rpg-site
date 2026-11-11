# Inactivity processing (#191)

This implements the policy and evidence in `inactivity-preview.md`. **Deployment does not enable automated changes.** The guild's existing `inactivity_enabled` flag continues to permit preview, but mutations additionally require the server-only `INACTIVITY_AUTOMATION_ENABLED=true` rollout gate. This gate is unset/off by default; no environment file enables it in this change. Review the real-date preview and rollout before intentionally enabling the gate. Existing guild flags are not modified.

## Scheduled behavior

The authenticated `/api/cron/notifications` job runs the processor only at UTC T−4, before loading reminder cohorts. Mutation also requires the evaluated UTC date to equal the actual UTC date, so historical/future cron date parameters and testing clocks cannot perform historical/future pauses. No separate cron is added. T−7 required-player reminders remain unchanged.

For each currently eligible non-bot member with explicit nonzero desired sessions (including No Limit), the processor rereads current guild settings, preference, tracking and submission evidence, and obtains fresh uncached Discord membership/roles. It applies the same evaluator as preview. Unknown/legacy responses protect conservatively; full player/admin/all-unavailable completion in any checked target month protects. Original addition, access gaps, rejoins and threshold rules are unchanged. Game membership is not required.

Only desired sessions and the new audit record change. Roles, memberships, availability, original tracking dates and scheduled sessions do not. Saves do not synchronously invoke zeroing, and submitting availability does not restore preferences.

## Atomicity and concurrency

A transaction locks the guild row, serializing settings/census updates and same-guild inactivity workers. It locks the current preference row and reevaluates its current value, rather than trusting a preview or earlier cohort. After fresh Discord reads, it takes a PostgreSQL `SHARE` table lock on `availability_submissions`, then reads evidence and atomically inserts the audit and zeroes the preference. This also protects missing submission rows, and works with previous app versions that know nothing about the processor. A submission committed before the lock is visible to the recheck; one arriving after the lock serializes after zeroing. A failing mutation rolls back both audit and preference.

**Tradeoff:** this brief table lock blocks submission writes across guilds while the evidence query/audit/preference writes commit. There are no network calls under the submission lock. The guild/preference locks do span fresh Discord reads. Monitor latency before rollout; do not replace this with row locks on existing submissions alone (which cannot protect absent rows). Discord membership changes cannot be atomic with PostgreSQL, but uncached mutation-time checks minimize that unavoidable external-system race. Lookup failure aborts the guild's T−4 pass without falling back to ordinary DMs.

## Provenance and message delivery

Additive migration `0027_inactivity_pauses.sql` creates a record keyed by `(guild_id, discord_user_id, target_month)`. It records actual pause time, previous preference, threshold, checked months/cutoff and membership evidence. Voluntary zero creates no such record. Guild-scoped authorized return/history presentation is described in `inactivity-return.md` (#192); this processor persists its evidence and sends the explanatory DM. Audit data must not be exposed through unauthenticated reads.

The mutation transaction also reserves **one explanatory DM attempt**, replacing—not preceding or accompanying—the ordinary T−4 reminder. The message uses the existing blue Discord card format, friendly first-person copy, and link buttons for preferences and availability. It explains an action already taken, does not assert exactly two missed months/delivered reminders, and includes a small note that returning requires updating both desired sessions and availability. Checked response months remain in the audit record, not in the player-facing card. It uses the existing DM development-recipient restrictions.

Delivery status is `reserved`, `sent`, `failed`, or `blocked`, with a finish timestamp when known. A rejection does not roll back zeroing. `reserved` after a crash means delivery is unknown: it is never automatically retried. This intentionally chooses **at-most-one attempt, not guaranteed delivery**, because Discord cannot commit atomically with the database. A crash between commit and send can mean no explanation is delivered; retrying ambiguous sends could duplicate messages. There is no automatic redelivery or ordinary-reminder fallback.

All existing audit IDs for this guild/cycle are suppressed from ordinary T−4 DMs, even if a preference has been restored, the guild/rollout gate is subsequently disabled, or an earlier DM failed. A same-cycle restoration is not zeroed again. A later cycle may zero and explain again unless a qualifying response protects. Freshly zero preferences are excluded by the existing reminder cohorts, including subsequent T−2.

## Isolated explanation DM utility

The existing development-only DM utility supports `INACTIVITY`:

```powershell
npm run dev:test-dm! -- <test-user-id> <test-guild-id> INACTIVITY
```

Use an approved local preview with `SITE_URL=http://localhost:3000`, test-guild configuration, and an explicit test recipient in `ALLOWED_DM_RECIPIENTS`. This command sends a **real Discord DM**, not a dry run. It does not invoke the cron or processor, inspect player submission/preference history, zero preferences, or create audit records. Keep the automation gate off. The type works on any date and with the guild flag off; its availability link uses the upcoming target month from `getNow()` (including `NOW_OVERRIDE`), including year rollover. Both paths use `generateInactivityPauseMessage`; the utility adds a prominent preview-only/no-preferences-changed/synthetic-evidence disclaimer and the usual development message prefix.

The existing `--force` switch still bypasses the development recipient allowlist; omit it for normal testing. The endpoint remains forbidden outside development. This is an isolated message-format/delivery check, not a test of eligibility, zeroing, idempotency or cron execution; those remain covered by the synthetic database tests. Do not run it against copied production data. No live test sends are performed by unit tests.

## Validation and rollout

Tests use synthetic PostgreSQL/PGlite data and mocked Discord/DM boundaries. They cover audit/zero atomicity, default-off gating, fresh preferences/completions/access, guild isolation, first-cycle longstanding inactivity, No Limit, legacy protection, restoration with/without completion, later cycles, repeat/reserved/failed delivery, real UTC cutoff gating, T−4 replacement and fail-closed behavior, T−7 regression, zero-preference reminder exclusion, and cron authorization. Existing evaluator tests cover new-player/access/month/year boundaries.

No live database migration, notification cron, or DM test should be run against a copied production dataset. Before rollout, obtain human approval for a verified local migration and an isolated synthetic-recipient smoke test. Apply the additive migration before enabling the gate. Turning the gate off stops new pauses; it does not restore previous preferences or erase audit data. Code rollback needs no destructive migration rollback.
