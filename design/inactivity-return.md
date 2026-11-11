# Inactivity explanations and return setup (#192)

This extends #191 without changing its eligibility policy, reminder timing, default-off rollout gate, or single-attempt delivery policy. No new notification, automatic restoration, wizard, or role/game/schedule change is introduced.

## Existing player surfaces

- Guild home replaces the generic not-participating explanation only when the current zero is explicitly linked to an automatic pause. When core-game demand exceeds the zero preference, the same warning contains the pause explanation and retains the existing core-game warning/contact guidance. The generic upcoming-availability prompt is suppressed while this explanation already provides that link; other banners are unchanged.
- Availability extends `MemberAvailabilitySummary`, not a new banner. It retains core/optional-game summaries and warnings. Zero does not block submitting availability. The admin-targeted availability view links to Users Config rather than the admin's own preference setup.
- My Preferences puts the explanation beside the existing session selector. The player must explicitly choose a value. Successful nonzero saves include an availability link in existing success feedback; failed saves retain the explanation. Successful saves refresh the relevant routes and clear current-pause text. Submitting availability does not restore desired sessions.
- Player text contains only the automatic-pause date in the viewer’s browser locale/timezone, reason, reminders-paused explanation, return links, and the note that preferences and availability are separate actions. It does not expose internal membership/access evidence or DM delivery status. No new player-facing list of checked months is added.

## Current reason versus historical audit

Additive migration `0028_current_inactivity_pause.sql` adds nullable `member_preferences.inactivity_pause_month`. The processor sets it to the target month in the same transaction as zeroing and audit insertion. Self reads match the marker against the guild/member/target-month audit key and return only `pausedAt`; null, nonzero, unmarked or unmatched preferences do not get an invented automatic-zero explanation.

A deliberate player/admin/Discord preference save clears the marker, even a same-value zero save. Original audit records, membership tracking and addition dates remain unchanged. A PostgreSQL trigger also clears an unchanged marker on old-version updates, and always clears it for nonzero/null preferences. This protects mixed-version deploys/rollback writers that do not know about the marker. The trigger is limited to writes targeting the preference/marker columns, so login-time account linking and other metadata-only updates preserve current attribution. New automation sets a different marker (from null or an earlier cycle) and retains it.

There is deliberately **no historical backfill**: an old audit plus a current zero cannot prove that no voluntary save occurred in between. Existing audit records remain inspectable by admins, but unmarked zeros are not attributed to automation. The older deployed processor remains compatible and can still pause without the new marker; new-version processing records the marker explicitly. Keep automation off until rollout review.

`saveMemberPreference` is now an internal server-only helper rather than an exported callable action. Authorized player/admin actions and verified signed Discord interactions invoke it. New history/marker reads remain behind the existing self/guild-admin authorization boundaries.

## Admin correction and history

Users Config extends the existing activity-status popover. A current automatic pause is labeled **Automatically paused**; with preview off, a previous event is labeled **Previous automatic pause**. With live preview on, its candidate classification remains separate from the historical event. The latest event shows actual change date in the viewer’s local timezone, previous preference (including No Limit), checked response months, threshold and DM outcome. `reserved` is explicitly an unknown delivery outcome, not proof of delivery.

Historical details remain available even when preview/automation is disabled. Only month labels are extracted from audit JSON; raw Discord membership/access observations are never sent to the client. Users Config continues filtering eligible non-bot members. Admins correct preferences with the existing selector; saving reloads both current attribution and history regardless of the preview flag.

Restoration alone does not reset addition/access history or create completion evidence. #191's per-cycle key prevents same-cycle loops; a later eligible cycle can pause restored nonzero demand again unless a qualifying completion protects it. Completing availability alone leaves desired sessions zero. Completing both steps, in either order, permits explicit demand while recording the completion protection.

## Validation

Synthetic PGlite tests apply the actual additive migration/trigger and cover current versus historical attribution, same-value voluntary zero, previous-version writes, self/admin authorization and guild/member isolation, privacy of player/admin DTOs, admin restoration, availability-only return, both-step return in either order, retained history, same-cycle protection and later-cycle recurrence. Component tests cover existing-banner replacement, core warnings, optional-game guidance, targeted admin links, successful/failed preference saves, neutral voluntary zero, current/historical popovers and unknown/failed delivery.

The human-led local walkthrough passed: current-pause banners, availability-only return, player restoration with availability retained, subsequent voluntary zero, admin historical details, and admin restoration. The verified local migration applied successfully. Pause dates were adjusted to the viewer’s local timezone and the availability explanation was condensed after review. Synthetic pause/availability records were removed, original local preference and notification-channel settings restored, and the preview stopped after testing.

Before merging, run the full tests, lint, format check, TypeScript and production build. Use only designated synthetic/test-player pause records for a pause demonstration; never run the notification cron or enable zeroing against copied production data. No production activation is part of this slice.
