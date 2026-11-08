import { describe, expect, it } from 'vitest';
import {
  evaluateInactivity,
  planMembershipTracking,
  monthIndex,
  parseMonth,
  validThreshold,
  lastSubmittedMonth,
  type CompletionEvidence,
  type MemberTracking,
} from '../inactivity';

const tracking: MemberTracking = {
  guildId: 'a',
  discordUserId: 'human',
  firstEligibleAt: new Date('2025-01-15Z'),
  additionSource: 'schedule_fallback',
  firstObservedAt: new Date('2026-04-01Z'),
  lastObservedAt: new Date('2026-04-26Z'),
  hasAccess: true,
  accessSince: new Date('2025-01-15Z'),
  discordJoinedAt: '2025-01-01T00:00:00Z',
};
const base = {
  guildId: 'a',
  discordUserId: 'human',
  now: new Date('2026-04-26T00:00:00Z'),
  threshold: 3,
  sessionsPerMonth: 2,
  bot: false,
  access: true,
  joinedAt: tracking.discordJoinedAt,
  tracking,
  submissions: [] as CompletionEvidence[],
};
const completion = (month: number, source = 'player'): CompletionEvidence => ({
  guildId: 'a',
  discordUserId: 'human',
  year: 2026,
  month,
  completedAt: new Date('2026-02-01Z'),
  completionSource: source,
  writeVersion: 0,
  partialWriteVersion: null,
});

describe('unanswered submission cycles with automatic evidence', () => {
  it('qualifies a silent rollout player using the guild schedule fallback, without review', () => {
    const result = evaluateInactivity(base);
    expect(result.wouldPause).toBe(true);
    expect(result.classification).toBe('inactive');
    expect(result.automationEnabled).toBe(false);
    expect(result.months.map((m) => m.month)).toEqual(['2026-03', '2026-04', '2026-05']);
    expect(result.months.every((m) => m.status === 'missing')).toBe(true);
    expect(result.cutoff).toBe('2026-04-26T00:00:00.000Z');
  });
  it('still honors the configured threshold for rollout members', () => {
    expect(evaluateInactivity({ ...base, threshold: 12 }).wouldPause).toBe(true);
    const recentBaseline = { ...tracking, firstEligibleAt: new Date('2026-01-15Z') };
    expect(evaluateInactivity({ ...base, tracking: recentBaseline, threshold: 3 }).wouldPause).toBe(
      true,
    );
    expect(evaluateInactivity({ ...base, tracking: recentBaseline, threshold: 5 }).wouldPause).toBe(
      false,
    );
  });
  it('uses exact UTC T−4, not editing closure', () => {
    expect(
      evaluateInactivity({ ...base, now: new Date('2026-04-25T23:59:59.999Z') }).atCutoff,
    ).toBe(false);
    expect(evaluateInactivity(base).atCutoff).toBe(true);
    expect(evaluateInactivity({ ...base, now: new Date('2026-04-27Z') }).atCutoff).toBe(false);
  });
  it.each([3, 4, 5])(
    'a full completion for target month %i protects, irrespective of save month',
    (month) => {
      const result = evaluateInactivity({ ...base, submissions: [completion(month)] });
      expect(result.wouldPause).toBe(false);
      expect(result.classification).toBe('active');
    },
  );
  it('identifies full admin completion independently of subsequent partial day coverage', () => {
    const result = evaluateInactivity({ ...base, submissions: [completion(4, 'admin')] });
    expect(result.months[1]).toMatchObject({ status: 'complete', source: 'admin' });
  });
  it('conservatively counts legacy submission rows as responses without inventing full completion', () => {
    const result = evaluateInactivity({
      ...base,
      submissions: [{ ...completion(4), completedAt: null, completionSource: null }],
    });
    expect(result.months[1]).toMatchObject({
      status: 'legacy_response',
      source: null,
      completedAt: null,
    });
    expect(result.classification).toBe('active');
    expect(result.wouldPause).toBe(false);
  });
  it('a known post-tracking partial record does not establish full completion', () => {
    const result = evaluateInactivity({
      ...base,
      submissions: [
        {
          ...completion(4),
          completedAt: null,
          completionSource: 'partial',
          partialWriteVersion: 0,
        },
      ],
    });
    expect(result.months[1].status).toBe('missing');
    expect(result.wouldPause).toBe(true);
  });
  it.each(['2026-03-01T00:00:00Z', '2026-03-15T00:00:00Z'])(
    'exempts the addition month %s for a new observed member',
    (date) => {
      const member = {
        ...tracking,
        additionSource: 'first_observed' as const,
        firstEligibleAt: new Date(date),
        accessSince: new Date(date),
      };
      const april = evaluateInactivity({ ...base, tracking: member });
      expect(april.firstCountableMonth).toBe('2026-04');
      expect(april.classification).toBe('new_player');
      expect(
        evaluateInactivity({ ...base, tracking: member, now: new Date('2026-05-27Z') }).wouldPause,
      ).toBe(true);
    },
  );
  it('handles year rollover', () => {
    const result = evaluateInactivity({ ...base, now: new Date('2026-12-27Z') });
    expect(result.atCutoff).toBe(true);
    expect(result.months.map((m) => m.month)).toEqual(['2026-11', '2026-12', '2027-01']);
  });
  it('invalidates partial provenance after an old-version save, even when timestamps are unchanged', () => {
    const partial = {
      ...completion(4),
      completedAt: null,
      completionSource: 'partial',
      partialWriteVersion: 0,
    };
    expect(evaluateInactivity({ ...base, submissions: [partial] }).wouldPause).toBe(true);
    // The database trigger increments writeVersion for the legacy writer even
    // though it knows nothing about the provenance columns.
    const legacyFullSave = { ...partial, writeVersion: 1 };
    const protectedResult = evaluateInactivity({ ...base, submissions: [legacyFullSave] });
    expect(protectedResult.classification).toBe('active');
    expect(protectedResult.months[1]).toMatchObject({ status: 'legacy_response', source: null });
    expect(lastSubmittedMonth('a', 'human', [legacyFullSave])).toBe('2026-04');
    // A later new-version partial edit must not recertify a row whose full
    // legacy response could not be proven; SQL clears the invalid marker.
    const laterPartial = { ...legacyFullSave, writeVersion: 2, partialWriteVersion: null };
    expect(evaluateInactivity({ ...base, submissions: [laterPartial] }).classification).toBe(
      'active',
    );
  });
  it('treats pre-marker partial records conservatively and keeps full completion protected through legacy writes', () => {
    expect(
      evaluateInactivity({
        ...base,
        submissions: [{ ...completion(4), completionSource: 'partial', completedAt: null }],
      }).classification,
    ).toBe('active');
    expect(
      evaluateInactivity({ ...base, submissions: [{ ...completion(4), writeVersion: 20 }] })
        .classification,
    ).toBe('active');
  });
  it('missing tracking stays uncertain, not assumed inactive', () => {
    const result = evaluateInactivity({ ...base, tracking: undefined });
    expect(result.classification).toBe('uncertain');
    expect(result.wouldPause).toBe(false);
  });
  it('known access loss bounds the response history without changing original addition', () => {
    const result = evaluateInactivity({
      ...base,
      tracking: { ...tracking, accessSince: new Date('2026-04-15Z') },
    });
    expect(result.firstCountableMonth).toBe('2025-02');
    expect(result.classification).toBe('uncertain');
    expect(result.months.map((m) => m.status)).toEqual(['unknown', 'unknown', 'missing']);
  });
  it('cannot count across a known Discord rejoin even with a matched census', () => {
    const joinedAt = '2026-04-15T00:00:00Z';
    const result = evaluateInactivity({
      ...base,
      joinedAt,
      tracking: { ...tracking, discordJoinedAt: joinedAt },
    });
    expect(result.wouldPause).toBe(false);
    expect(result.firstCountableMonth).toBe('2025-02');
  });
  it.each([{ bot: true }, { access: false }, { sessionsPerMonth: null }, { sessionsPerMonth: 0 }])(
    'excludes population %j',
    (override) => {
      expect(evaluateInactivity({ ...base, ...override }).classification).toBe('excluded');
    },
  );
  it('includes No Limit and restores demand without resetting original history', () => {
    expect(evaluateInactivity({ ...base, sessionsPerMonth: 11 }).wouldPause).toBe(true);
    expect(evaluateInactivity({ ...base, sessionsPerMonth: 1 }).firstCountableMonth).toBe(
      '2025-02',
    );
  });
  it('isolates both completion and tracking evidence by guild/member', () => {
    expect(
      evaluateInactivity({ ...base, submissions: [{ ...completion(4), guildId: 'b' }] }).wouldPause,
    ).toBe(true);
    expect(
      evaluateInactivity({ ...base, tracking: { ...tracking, guildId: 'b' } }).wouldPause,
    ).toBe(false);
    expect(
      evaluateInactivity({ ...base, submissions: [{ ...completion(4), discordUserId: 'other' }] })
        .wouldPause,
    ).toBe(true);
  });
  it('validates threshold bounds', () => {
    for (const threshold of [0, 1, 13, 2.5, NaN]) expect(validThreshold(threshold)).toBe(false);
    expect(() => evaluateInactivity({ ...base, threshold: 1 })).toThrow();
  });
  it('uses UTC month arithmetic and leap boundaries', () => {
    expect(monthIndex(new Date('2026-03-01T00:00:00+01:00'))).toBe(parseMonth('2026-02'));
    expect(evaluateInactivity({ ...base, now: new Date('2028-02-25Z') }).cutoff).toBe(
      '2028-02-25T00:00:00.000Z',
    );
  });
});

describe('last availability target month', () => {
  it('uses the latest full or legacy target month, not save time or a known partial edit', () => {
    expect(
      lastSubmittedMonth('a', 'human', [
        completion(3),
        { ...completion(4), completedAt: null, completionSource: null },
        {
          ...completion(5),
          completedAt: null,
          completionSource: 'partial',
          partialWriteVersion: 0,
        },
        { ...completion(6), guildId: 'other' },
      ]),
    ).toBe('2026-04');
    expect(lastSubmittedMonth('a', 'missing', [completion(3)])).toBe(null);
  });
  it('a recent response takes precedence over new-player grace', () => {
    const result = evaluateInactivity({
      ...base,
      tracking: { ...tracking, firstEligibleAt: new Date('2026-04-01Z') },
      submissions: [completion(4)],
    });
    expect(result.classification).toBe('active');
  });
});

describe('automatic membership census planning', () => {
  const observedAt = new Date('2026-04-26Z');
  const member = { discordUserId: 'never-logged-in', eligible: true, joinedAt: '2025-01-01Z' };
  const input = {
    guildId: 'a',
    observedAt,
    initialized: false,
    scheduleFallbackAt: new Date('2025-01-15Z'),
    existing: [] as MemberTracking[],
    members: [member],
  };
  it('captures currently eligible humans using first retained schedule creation, without login or preferences', () => {
    const [result] = planMembershipTracking(input);
    expect(result.additionSource).toBe('schedule_fallback');
    expect(result.firstEligibleAt).toEqual(input.scheduleFallbackAt);
  });
  it('never assigns the rollout fallback to later discoveries', () => {
    const [result] = planMembershipTracking({ ...input, initialized: true });
    expect(result.additionSource).toBe('first_observed');
    expect(result.firstEligibleAt).toEqual(observedAt);
  });
  it('gracefully handles no schedules and invalid future schedule dates', () => {
    for (const date of [null, new Date('2027-01-01Z')]) {
      expect(planMembershipTracking({ ...input, scheduleFallbackAt: date })[0].additionSource).toBe(
        'first_observed',
      );
    }
  });
  it('does not enroll bots/no-access members in the fallback cohort', () => {
    expect(planMembershipTracking({ ...input, members: [{ ...member, eligible: false }] })).toEqual(
      [],
    );
  });
  it('freezes original addition and source on repeat sweeps or later schedule changes', () => {
    const original = planMembershipTracking(input);
    const [again] = planMembershipTracking({
      ...input,
      initialized: true,
      existing: original,
      scheduleFallbackAt: new Date('2020-01-01Z'),
    });
    expect(again.firstEligibleAt).toEqual(original[0].firstEligibleAt);
    expect(again.additionSource).toBe('schedule_fallback');
  });
  it('records departure or loss of allowed roles, and restoration without resetting original addition', () => {
    const original = planMembershipTracking(input);
    const lost = planMembershipTracking({
      ...input,
      initialized: true,
      existing: original,
      members: [],
    });
    expect(lost[0].hasAccess).toBe(false);
    const [restored] = planMembershipTracking({
      ...input,
      observedAt: new Date('2026-05-01Z'),
      initialized: true,
      existing: lost,
    });
    expect(restored.firstEligibleAt).toEqual(original[0].firstEligibleAt);
    expect(restored.accessSince).toEqual(new Date('2026-05-01Z'));
  });
  it('detects rejoin and preserves the original addition date', () => {
    const existing = planMembershipTracking(input);
    const [again] = planMembershipTracking({
      ...input,
      initialized: true,
      existing,
      members: [{ ...member, joinedAt: '2026-04-26Z' }],
    });
    expect(again.accessSince).toEqual(observedAt);
    expect(again.firstEligibleAt).toEqual(input.scheduleFallbackAt);
  });
  it('bounds unreliable history after a census gap longer than three days', () => {
    const existing = planMembershipTracking(input);
    const later = new Date('2026-05-01Z');
    expect(
      planMembershipTracking({ ...input, observedAt: later, initialized: true, existing })[0]
        .accessSince,
    ).toEqual(later);
  });
});
