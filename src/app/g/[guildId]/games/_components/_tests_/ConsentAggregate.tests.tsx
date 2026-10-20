import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import ConsentAggregate from '../ConsentAggregate';

const topic = {
  id: 'topic',
  name: 'Topic',
  parentTopicId: null,
  answer: 'enthusiastic' as const,
  headsUp: false,
  missingAnswers: 0,
  needsCare: false,
};
describe('care-first aggregate view', () => {
  it('shows boundaries, heads-up and missing answers with matching labels; fully good topics are collapsed', () => {
    render(
      <ConsentAggregate
        topics={[
          { ...topic, id: 'parent', name: 'Parent', answer: 'line', needsCare: true },
          {
            ...topic,
            id: 'child',
            name: 'Child',
            parentTopicId: 'parent',
            answer: 'veil',
            headsUp: true,
            missingAnswers: 1,
            needsCare: true,
          },
          { ...topic, id: 'good', name: 'Safe topic' },
        ]}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Needs care' })).toBeInTheDocument();
    expect(screen.getByText('Hard line')).toBeInTheDocument();
    expect(screen.getByText('Veiled')).toBeInTheDocument();
    expect(screen.getByText('Heads-up')).toBeInTheDocument();
    expect(screen.getByText('Missing 1 answer')).toBeInTheDocument();
    const details = screen.getByText('All good from everyone (1)').closest('details')!;
    expect(details).not.toHaveAttribute('open');
    expect(within(details).getByText('Safe topic')).toBeInTheDocument();
  });
  it('uses a generic missing-answer message when counts are withheld', () => {
    render(
      <ConsentAggregate
        topics={[{ ...topic, missingAnswers: null, hasMissingAnswers: true, needsCare: true }]}
      />,
    );
    expect(screen.getByText('Not everyone has answered')).toBeInTheDocument();
    expect(screen.queryByText(/Missing \\d/)).not.toBeInTheDocument();
  });

  it('sorts Needs care by boundary severity before flags or names, with unanswered topics last', () => {
    render(
      <ConsentAggregate
        privateNoteTopicIds={new Set(['veil', 'good', 'unknown'])}
        topics={[
          { ...topic, id: 'good', name: 'Beta', needsCare: true, headsUp: true },
          {
            ...topic,
            id: 'unknown',
            name: 'Aardvark',
            answer: null,
            needsCare: true,
            headsUp: true,
          },
          { ...topic, id: 'veil', name: 'Alpha', answer: 'veil', needsCare: true, headsUp: true },
          { ...topic, id: 'line', name: 'Zulu', answer: 'line', needsCare: true },
        ]}
      />,
    );
    expect(
      screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent),
    ).toEqual(['Zulu', 'Alpha', 'Beta', 'Aardvark']);
  });

  it.each(['line', 'veil', 'enthusiastic'] as const)(
    'sorts %s topics by both flags, private notes, heads-up, neither, then name',
    (answer) => {
      const cases = [
        { name: 'Alpha both', privateNote: true, headsUp: true },
        { name: 'Zulu both', privateNote: true, headsUp: true },
        { name: 'Alpha notes', privateNote: true, headsUp: false },
        { name: 'Zulu notes', privateNote: true, headsUp: false },
        { name: 'Alpha heads', privateNote: false, headsUp: true },
        { name: 'Zulu heads', privateNote: false, headsUp: true },
        { name: 'Alpha neither', privateNote: false, headsUp: false },
        { name: 'Zulu neither', privateNote: false, headsUp: false },
      ];
      const topics = cases
        .map((entry) => ({
          ...topic,
          id: entry.name,
          name: entry.name,
          answer,
          headsUp: entry.headsUp,
          needsCare: true,
        }))
        .reverse();
      const originalOrder = topics.map((entry) => entry.id);
      render(
        <ConsentAggregate
          topics={topics}
          privateNoteTopicIds={
            new Set(cases.filter((entry) => entry.privateNote).map((entry) => entry.name))
          }
        />,
      );
      expect(
        screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent),
      ).toEqual(cases.map((entry) => entry.name));
      expect(topics.map((entry) => entry.id)).toEqual(originalOrder);
    },
  );

  it('does not retain private-note ordering when private metadata is removed', () => {
    const topics = [
      { ...topic, id: 'z', name: 'Zulu', answer: 'veil' as const, needsCare: true },
      { ...topic, id: 'a', name: 'Alpha', answer: 'veil' as const, needsCare: true },
    ];
    const { rerender } = render(
      <ConsentAggregate topics={topics} privateNoteTopicIds={new Set(['z'])} />,
    );
    expect(
      screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent),
    ).toEqual(['Zulu', 'Alpha']);
    rerender(<ConsentAggregate topics={topics} />);
    expect(
      screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent),
    ).toEqual(['Alpha', 'Zulu']);
  });

  it('sorts the collapsed All good list alphabetically', () => {
    render(
      <ConsentAggregate
        topics={[
          { ...topic, id: 'z', name: 'Zulu' },
          { ...topic, id: 'b', name: 'beta' },
          { ...topic, id: 'a', name: 'Alpha' },
        ]}
      />,
    );
    const details = screen.getByText('All good from everyone (3)').closest('details')!;
    expect(details).not.toHaveAttribute('open');
    expect(
      within(details)
        .getAllByRole('heading', { level: 3, hidden: true })
        .map((heading) => heading.textContent),
    ).toEqual(['Alpha', 'beta', 'Zulu']);
  });

  it('does not present unknown topics as All good', () => {
    render(
      <ConsentAggregate
        topics={[{ ...topic, answer: null, missingAnswers: 2, needsCare: true }]}
      />,
    );
    expect(screen.getByText('No answers yet')).toBeInTheDocument();
    expect(screen.getByText('Missing 2 answers')).toBeInTheDocument();
    expect(screen.queryByText(/All good from everyone/)).not.toBeInTheDocument();
  });
});
