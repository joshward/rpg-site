# Inactivity policy and missed-month calculation

Status: policy/design for [#189](https://github.com/joshward/rpg-site/issues/189), under [#188](https://github.com/joshward/rpg-site/issues/188). Updated following human review. No runtime changes or authorization to enable automation. Review the #190 preview before #191 automation.

## Agreed direction

- Default experience: **two ordinary availability reminder cycles, then immediate zeroing with one explanatory DM attempt in the third cycle**, replacing the ordinary reminder for that player.
- This is an eligibility threshold, not a requirement that the new feature personally send two earlier reminders. Existing long-inactive players can qualify in the first cycle after release.
- Set **desired sessions** to zero, not availability days. Never remove roles, game memberships, availability history, or existing scheduled sessions.
- Already-zero players receive no subsequent availability reminder DMs under the current cohort rules.
- Returning players explicitly choose nonzero desired sessions again and submit monthly availability. Neither action silently performs the other.
- Restoring desired sessions, whether by the player or an admin, **does not reset inactivity history or grant fresh grace**. Without a qualifying submission, they can be zeroed and receive the explanation again in a later cycle.
- A qualifying completed submission counts even when every day is unavailable. Full admin submissions count; partial admin edits do not.

### Two versus three

The original issue compared 2 and 3 consecutive missed months. A two-cycle pause would remove stale demand sooner but allow only one ordinary reminder cycle first. The chosen default is the **third-cycle pause**, allowing two ordinary reminder cycles first. This does not mean waiting for three completed calendar months.

The missed-history count may exceed two: a player absent for six months is still eligible. Explanatory wording must not claim everyone missed exactly two months or received exactly two reminders. Do not claim successful DM delivery without evidence.

## Reminder and zeroing behavior

At **T−4**, four UTC calendar days before the end of the month, in the third or any later eligible cycle:

1. Recheck guild access, preference, qualifying submission evidence, and whether this cycle was already processed.
2. If still eligible with nonzero desired sessions, set them to zero and record the reason and previous value.
3. Attempt one explanatory DM instead of the normal T−4 availability reminder. No separate advance warning or second final-warning DM.
4. Preserve a distinction between inactivity zeroing and voluntary zero.

Suggested meaning, not final copy: “You haven't submitted availability for several months, so we've set your desired sessions to zero and paused availability reminders. If you're still interested, choose your desired sessions again and submit your availability. Your existing games and scheduled sessions haven't been changed.” Link to both relevant controls.

Discord delivery failure must not prevent zeroing. Retry safety must avoid repeatedly zeroing or notifying an already-processed player. If the player/admin later explicitly restores nonzero demand but no availability is submitted, they remain eligible in a later cycle. Do not re-zero immediately on saving preferences or create a same-cycle notification loop; the next eligible reminder cycle is the next opportunity. Exact delivery/retry persistence belongs to #191.

Current ordinary reminders (`src/lib/notifications/service.ts`):

- Required in any active game: T−7, T−4, T−2 while missing.
- Optional cohort: T−4 while missing; game membership is not required.
- T−N is calculated from UTC calendar days remaining in the preceding month.

Only T−4 changes. Required players still receive their ordinary T−7 DM, including in the zeroing cycle. At T−4 the explanation replaces their ordinary T−4 DM; zero preferences then exclude them from T−2. Optional players receive the T−4 explanation instead of their ordinary T−4 DM. This deliberately allows a required player to receive both T−7 and the T−4 explanation.

## Completion versus partial editing

A qualifying completion is a successful, deliberate full-month submit for one `(guildId, discordUserId, target year, target month)`, with exactly one valid status for every real calendar day. Valid statuses are `available`, `late`, `if_needed`, and `unavailable`; their distribution does not affect activity.

- All-unavailable counts exactly like any other complete submission.
- Confirming conversion of unset form days to unavailable and submitting counts. Viewing a page or leaving unsaved selections does not.
- An admin explicitly submitting the full monthly form on the player's behalf counts. Preview must identify admin rather than direct player activity.
- Single-day edits, clearing days, or incrementally filling all days do not establish explicit completion.
- Later partial edits do not erase a previously established full completion, nor establish activity for another month.
- Logging in, changing preferences, or being scheduled does not establish monthly completion.

Completion belongs to the **target month**, not the timestamp's calendar month. March availability submitted in February counts for March. Repeated March saves do not count as multiple months. Backdated January admin submissions do not establish February activity.

A current or early next-month qualifying submission protects a returning player from zeroing based solely on an old streak. It does not fill historical gaps. The next inactivity streak starts after that completed target month. Submitting availability while desired sessions remain zero does not restore demand.

## Month boundaries and agreed calculation

Use UTC year/month arithmetic, not rolling 60/90-day timers or browser/server local time.

Current player editing (`src/lib/availability.ts`) permits current and next calendar months throughout the current month. For target March 2026:

- Normal editing opens February 1 at `00:00:00Z`.
- The reminder/default-view helper opens 11 calendar days before March 1; it does not restrict editing.
- Normal editing closes April 1 at `00:00:00Z`.

**Human-approved revision to #189's original window-end requirement:** inactivity is evaluated by unanswered submission cycles at T−4, not by waiting until calendar editing closes. Current-month availability can still be edited. Zeroing does not close editing or claim that three full calendar months have elapsed.

At April's T−4 reminder for May, require missing qualifying completions for **March, April, and May**: the two prior target months plus the upcoming target month. A completed submission for any of these three prevents zeroing that cycle. Early May submissions count for May even if saved in April. Longer preceding absence does not require any additional waiting or newly delivered reminders.

Deterministic default calculation, using one UTC evaluation instant:

1. Verify the population and nonzero-preference rules, reliable historical evidence, and cycle idempotency.
2. Set `target` to next calendar month, and derive its two immediately preceding months with year/month arithmetic.
3. Set `firstCountableMonth` to the month after the player's original eligible-addition month. Require both preceding months to be on or after it.
4. Require confirmed absence of qualifying completions for all three target months. Unknown evidence is not confirmed absence.
5. At T−4 only, recheck these facts before zeroing and attempting the replacement DM. Preview can show eligibility without mutating or sending messages.

For an April evaluation, T−4 is April 26; April 25 at `23:59:59.999Z` is not yet T−4, and April 26 at `00:00:00Z` is. A completion persisted before mutation prevents a stale downgrade. A late submission after zeroing records activity but does not restore desired sessions automatically.

## Population, rollout, and new players

Evaluate each guild separately. Current non-bot members resolving to `member` or `admin` under guild access rules are in scope; admin status is not an exemption. Exclude departed/no-access members. Lookup failures are not proof of inactivity: skip mutation when eligibility cannot be verified.

Only explicit nonzero desired sessions, including No Limit, are candidates. Missing/null preferences are excluded pending setup. Already-zero preferences are excluded regardless of why they are zero. Required game membership does not override this policy or authorize schedule changes.

### Existing long-inactive players

No blanket rollout grace: someone with six or more months of established non-submission can receive the new explanatory zeroing DM in the first post-release cycle. They need not wait through two new reminders from this feature.

However, age, account creation, login history, or a generic timestamp does not prove six months of eligible non-submission. The preview must explain the historical evidence and distinguish missing records from ambiguous records. A never-submitted longstanding player is not automatically a newly joined player.

### Genuine new players

Only count from the **first full calendar month after the player was added as an eligible player in that guild**. Do not count their addition month, including additions on its first day. This is not their Discord account creation date or first site login.

Example: added during March, first countable month April. At April's T−4 for May, March is exempt. At May's T−4 for June, April and May are countable prior months; if April, May, and June all lack qualifying completions, the player can first be zeroed then.

Use the original eligible-addition date, not the latest preference update. Restoring desired sessions by the player or an admin does not move it or grant fresh grace. If that historical date cannot be established reliably, surface the uncertainty in preview rather than guessing. Evidence-source/storage selection belongs to #190. Access loss/rejoin handling remains to be specified; do not count known periods without access as missed opportunities.

## Evidence and implementation handoff

Relevant current code:

- `src/actions/availability.ts`: `submitAvailability` and `adminSubmitMemberAvailability` validate full months. `adminUpdateMemberAvailability` can create a submission from one edit or remove a day. These share submission timestamps.
- `src/db/schema/availability.ts`: no durable full-completion marker, source, or completion timestamp. Complete current day coverage cannot prove deliberate full submission; partial coverage cannot disprove an earlier full submission.
- `src/db/schema/member-preferences.ts`: generic timestamps do not establish inactivity zeroing, restoration, or initial eligibility history.
- `src/lib/notifications/cohorts.ts`: reminders currently treat any submission row as submitted. Do not reuse row existence as proof of full completion. They exclude zero preferences but accept 1 session and even null/missing preferences; the mutation population above is narrower.

Later implementation needs reliable completion provenance and zeroing history. Record successful full completion atomically with saving, retain it through partial edits, and record automated zeroing separately from voluntary zero. Scope every read/write to the authorized guild. Schema design belongs to #190/#191; migrations must remain additive and compatible with the previously deployed app.

Do not infer historical completions or player activity from `updatedAt` or current day counts. Distinguish:

- **Confirmed missing:** no completion/submission evidence for a period when the member was eligible and the relevant records are known to be reliable. This may support first-cycle rollout zeroing.
- **Unknown:** ambiguous legacy partial/admin records, uncertain eligibility, or tracking/data gaps. Preview must surface uncertainty, not automatically treat it as a confirmed miss.

Historical validation and any explicit admin review path for unknown records must be settled in the preview. This is not permission to fabricate historical completion provenance. Automation remains off by default and must recheck fresh evidence at mutation time.

## Examples ready to become tests

Unless stated otherwise: eligible human, same guild, explicit nonzero desired sessions, reliably established history, and no new qualifying completion. Evaluate at UTC T−4.

| Case | Evidence / action | Expected result |
| --- | --- | --- |
| First missing cycle | No target-month submission | Ordinary reminder rules |
| Second missing cycle | Still no submission | Ordinary reminder rules |
| Third missing cycle | April 26, 2026; March, April, May all unsubmitted | Immediately zero desired sessions; one explanatory DM attempt replaces T−4; required-player T−7 was unchanged |
| One prior completion | Same, but March or April completed | No zeroing this cycle |
| Upcoming completion | Same, but May completed early | No zeroing this cycle |
| T−4 boundary | April 25 at `23:59:59.999Z`, then April 26 at `00:00:00Z` | No mutation before boundary; eligible at boundary if all checks still pass |
| Longer absence at rollout | Six or more established missing months; first cycle after release | Eligible for zeroing immediately in that cycle; no two-new-reminder prerequisite |
| Old never-submitted player | Longstanding eligibility and reliably absent submissions | Not automatically granted new-player or rollout grace |
| Already zero | Previous voluntary or automatic zero | No availability DM or repeated mutation |
| Restore without submission | Player changes zero to 2 after zeroing | History unchanged; no immediate same-cycle loop; zero again with explanation in a later eligible cycle if still missing |
| Admin restores | Admin changes zero to nonzero without full submission | Same as player restoration; no fresh grace |
| Submit without restoring | Zeroed player completes current/next month | Activity recorded; desired sessions stay zero |
| Restore and submit | Player/admin restores demand and completes current/next month | Completion breaks old inactivity streak; no stale zeroing |
| All unavailable | Explicit full submission with every day unavailable | Counts as activity |
| Full admin submission | Admin deliberately submits full form | Counts; provenance says admin |
| Partial admin edit | One day edited, recent `updatedAt` | Does not establish completion |
| Incremental full coverage | Admin fills all days using individual edits | Coverage alone does not establish explicit completion |
| Edit after completion | Admin unsets one day after known full submission | Historical completion remains activity |
| Early next month | March completed in February | Counts for March, protects against older streak; does not fill February |
| Year rollover | December 27, 2026 T−4 for January; November, December, January missing | Eligible if November is countable; year rollover does not reset history |
| Leap year | Full February 2028 submission | Requires 29 distinct valid days |
| Open month | February T−4 for March; January, February, March missing | Can qualify although February is still editable; response cycles, not three closed calendar months |
| New player | Added March 15; no completions | April first countable; not eligible April T−4; first eligible May T−4 for June |
| First-day addition | Added March 1 at `00:00:00Z` | Same rule: April first countable; addition month exempt |
| Legacy ambiguity | Partial/admin records without completion provenance | Unknown, not inferred complete or confirmed missed |
| Guild isolation | March completion in guild A only | Does not break guild B's streak |
| Stale preview | Fresh completion before mutation | Recheck prevents zeroing |
| Failed DM | Discord rejects explanatory DM | Desired sessions remain zero; no ordinary reminder fallback or repeated notification loop |

## Decisions still required before implementation

- #189 policy decisions are settled: T−4 replacement only, two prior countable target months plus unsubmitted upcoming month, and first countable month after original eligible addition. Its original window-end criterion is explicitly revised above.
- Choose configuration bounds in #190. Express configuration in unanswered submission cycles, not fully closed calendar months; the default is third-cycle pause.
- Define the source/persistence of eligible-addition evidence, access/rejoin handling, historical evidence validation, and treatment of unknown legacy data in #190. These implementation evidence questions must not silently introduce rollout or resumption grace.
- Define retry/idempotency and restoration provenance in #191, including later-cycle repeat zeroing without same-cycle loops.
- Final player wording, links, and correction UX belong to #191/#192. The prior #192 suggestion that resumption grants fresh grace is superseded by the human decision here: preference restoration alone does not reset inactivity.
- No role removal, automatic preference restoration, general workflow engine, or runtime/Discord changes are implemented by this design issue.
