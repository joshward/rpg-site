import { type ComponentType } from 'react';
import {
  CheckCircledIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CircleBackslashIcon,
  DashIcon,
} from '@radix-ui/react-icons';
import type { AvailabilityStatus } from '@/actions/availability';

export interface StatusOption {
  value: AvailabilityStatus;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  /** Tailwind classes for the active/selected state */
  activeClass: string;
}

export const STATUS_OPTIONS: StatusOption[] = [
  {
    value: 'available',
    label: 'Available',
    description: 'All clear and open for scheduling',
    icon: CheckCircledIcon,
    activeClass: 'bg-jade-9 text-white',
  },
  {
    value: 'late',
    label: 'Late',
    description: 'I can make it late (probably not more than an hour late)',
    icon: ClockIcon,
    activeClass: 'bg-violet-9 text-white',
  },
  {
    value: 'if_needed',
    label: 'If Needed',
    description: "Not my preferred day but I'm willing to make it work",
    icon: ExclamationTriangleIcon,
    activeClass: 'bg-amber-9 text-black',
  },
  {
    value: 'unavailable',
    label: 'Unavailable',
    description: "This day won't work for me",
    icon: CircleBackslashIcon,
    activeClass: 'bg-ruby-9 text-white',
  },
];

export const STATUS_MAP = Object.fromEntries(
  STATUS_OPTIONS.map((opt) => [opt.value, opt]),
) as Record<AvailabilityStatus, StatusOption>;

/** UI-only unset state — never persisted to the database. */
export const UNSET_OPTION = {
  label: 'Unset',
  description: 'No selection made yet',
  icon: DashIcon,
  activeClass: 'bg-sage-7 text-sage-11',
} as const;
