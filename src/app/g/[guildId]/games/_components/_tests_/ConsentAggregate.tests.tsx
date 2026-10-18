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
