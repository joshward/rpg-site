import type { ComponentProps } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
const mocks = vi.hoisted(() => ({
  aggregate: vi.fn(),
  notFound: vi.fn(),
  renderAggregate: vi.fn(),
  privateRead: vi.fn(),
}));
vi.mock('@/actions/consent-aggregate', () => ({ getGameConsentAggregate: mocks.aggregate }));
vi.mock('next/navigation', () => ({ notFound: mocks.notFound }));
vi.mock('@/actions/consent-private-details', () => ({
  getGameConsentTopicDetails: mocks.privateRead,
  getGameConsentOverallNotes: mocks.privateRead,
  getGameConsentNoteTopics: mocks.privateRead,
}));
vi.mock('@/actions/consent-game-status', () => ({ getGameConsentStatus: mocks.privateRead }));
vi.mock('../../../_components/ConsentOverview', () => ({
  default: () => {
    throw new Error('Never mount coordinator controls in the print route');
  },
}));
vi.mock('../../../_components/ConsentAggregate', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../_components/ConsentAggregate')>();
  return {
    ...actual,
    default: (props: ComponentProps<typeof actual.default>) => {
      mocks.renderAggregate(props);
      return <actual.default {...props} />;
    },
  };
});
import GameConsentPrintPage, { metadata } from './page';
const props = { params: Promise.resolve({ guildId: 'guild-1', gameId: 'game-1' }) };
const topic = {
  id: 'line',
  name: 'Care topic',
  parentTopicId: null,
  answer: 'line',
  headsUp: true,
  missingAnswers: 7,
  hasMissingAnswers: true,
  needsCare: true,
  groupNote: { note: 'Shared topic note', revision: 3 },
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.notFound.mockImplementation(() => {
    throw new Error('not found');
  });
  mocks.aggregate.mockResolvedValue({
    type: 'success',
    data: {
      gameName: 'Game',
      mode: 'requested',
      canViewContributions: true,
      overallGroupNote: { note: 'Shared overall note', revision: 2 },
      topics: [
        topic,
        {
          ...topic,
          id: 'good',
          name: 'Safe topic',
          answer: 'enthusiastic',
          headsUp: false,
          missingAnswers: 0,
          hasMissingAnswers: false,
          needsCare: false,
          groupNote: { note: '', revision: 0 },
        },
      ],
      privateNotes: 'PRIVATE OVERALL SENTINEL',
    },
  });
});
describe('authorized shared print view', () => {
  it('reuses the authorized aggregate read and prints shared notes with all topics expanded', async () => {
    render(await GameConsentPrintPage(props));
    expect(mocks.aggregate).toHaveBeenCalledExactlyOnceWith('guild-1', 'game-1');
    const document = within(screen.getByRole('article', { name: 'Printable consent overview' }));
    expect(
      document.getByRole('heading', { name: 'Content Consent Overview: Game' }),
    ).toBeInTheDocument();
    expect(document.getByText('Shared overall note')).toBeInTheDocument();
    expect(document.getByText('Shared topic note')).toBeInTheDocument();
    expect(document.getByText('Safe topic')).toBeVisible();
    expect(
      document.getByRole('heading', { name: 'All good from everyone (1)' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('article').querySelector('details')).toBeNull();
    expect(
      document.getByText(/Combined checklist answers.*Missing answers are unknown/),
    ).toBeInTheDocument();
    expect(mocks.privateRead).not.toHaveBeenCalled();
  });
  it('allowlists shared props and withholds counts and private metadata even from coordinators', async () => {
    mocks.aggregate.mockResolvedValueOnce({
      type: 'success',
      data: {
        gameName: 'Game',
        canViewContributions: true,
        overallGroupNote: { note: 'Shared overall note', revision: 2 },
        topics: [
          {
            ...topic,
            discordUserId: 'PRIVATE PLAYER SENTINEL',
            privateNote: 'PRIVATE TOPIC SENTINEL',
          },
        ],
        privateNoteTopicIds: ['line'],
        contributionStatus: 'PRIVATE STATUS SENTINEL',
      },
    });
    const { container } = render(await GameConsentPrintPage(props));
    expect(mocks.renderAggregate).toHaveBeenCalledWith({
      expandAllGood: true,
      topics: [
        {
          id: 'line',
          name: 'Care topic',
          parentTopicId: null,
          answer: 'line',
          headsUp: true,
          missingAnswers: null,
          hasMissingAnswers: true,
          needsCare: true,
          groupNote: { note: 'Shared topic note', revision: 0 },
        },
      ],
    });
    expect(screen.getByText('Not everyone has answered')).toBeInTheDocument();
    expect(container.innerHTML).not.toMatch(
      /PRIVATE|Missing 7|Unlock|Contribution status|Private notes/,
    );
    expect(screen.queryByRole('button', { name: /Edit|Add group note/ })).not.toBeInTheDocument();
    expect(mocks.privateRead).not.toHaveBeenCalled();
  });
  it('fails closed on a denied direct URL without rendering any document', async () => {
    mocks.aggregate.mockResolvedValueOnce({ type: 'failure', error: 'Denied' });
    await expect(GameConsentPrintPage(props)).rejects.toThrow('not found');
    expect(mocks.notFound).toHaveBeenCalledOnce();
    expect(mocks.renderAggregate).not.toHaveBeenCalled();
    expect(mocks.privateRead).not.toHaveBeenCalled();
  });
  it('handles an empty catalog and omits an empty overall note', async () => {
    mocks.aggregate.mockResolvedValueOnce({
      type: 'success',
      data: { gameName: 'Game', topics: [], overallGroupNote: { note: '', revision: 0 } },
    });
    render(await GameConsentPrintPage(props));
    expect(screen.getByText('Official consent topics are not configured yet.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Overall group notes' })).not.toBeInTheDocument();
  });
  it('prints only on an explicit click and shows snapshot/sharing limitations outside the document', async () => {
    const user = userEvent.setup();
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    render(await GameConsentPrintPage(props));
    expect(print).not.toHaveBeenCalled();
    expect(screen.getByText(/Saved copies do not update or revoke/)).toBeInTheDocument();
    expect(screen.getByRole('article').querySelector('time')).toHaveAttribute(
      'dateTime',
      expect.stringMatching(/^\d{4}-\d\d-\d\dT/),
    );
    expect(within(screen.getByRole('article')).queryByRole('button')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Print / save PDF' }));
    expect(print).toHaveBeenCalledOnce();
    print.mockRestore();
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
  it('renders shared Markdown consistently for overall and topic notes without loading images', async () => {
    mocks.aggregate.mockResolvedValueOnce({
      type: 'success',
      data: {
        gameName: 'Game',
        overallGroupNote: { note: '**Overall boundary**', revision: 1 },
        topics: [
          {
            ...topic,
            groupNote: {
              note: '**Topic boundary**\n\n![Alt only](https://example.invalid/tracker.png)',
              revision: 1,
            },
          },
        ],
      },
    });
    render(await GameConsentPrintPage(props));
    expect(screen.getByText('Overall boundary').tagName).toBe('STRONG');
    expect(screen.getByText('Topic boundary').tagName).toBe('STRONG');
    expect(screen.getByText('Alt only')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(mocks.privateRead).not.toHaveBeenCalled();
  });
  it('renders group notes as text, not executable markup', async () => {
    mocks.aggregate.mockResolvedValueOnce({
      type: 'success',
      data: {
        gameName: 'Game',
        topics: [],
        overallGroupNote: { note: '<img src=x onerror=alert(1)>', revision: 1 },
      },
    });
    render(await GameConsentPrintPage(props));
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
