import type { AvailabilityStatus } from '@/actions/availability';

export interface StatusOption {
  value: AvailabilityStatus;
  label: string;
  /** Tailwind classes for the active/selected state */
  activeClass: string;
}

export const STATUS_OPTIONS: StatusOption[] = [
  { value: 'available', label: 'Available', activeClass: 'bg-green-9 text-white' },
  { value: 'late', label: 'Late', activeClass: 'bg-amber-9 text-white' },
  { value: 'if_needed', label: 'If Needed', activeClass: 'bg-orange-9 text-white' },
  { value: 'no', label: 'No', activeClass: 'bg-ruby-9 text-white' },
];

export const STATUS_MAP = Object.fromEntries(
  STATUS_OPTIONS.map((opt) => [opt.value, opt]),
) as Record<AvailabilityStatus, StatusOption>;
