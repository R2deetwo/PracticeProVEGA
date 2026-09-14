/**
 * ScheduledTabIcons — tiny shared icons for the Scheduled tab family.
 * (Extracted so AutomationWorkflows and ScheduledTab share one BoltIcon.)
 */
import React from 'react';

export const BoltIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 20 20" fill="currentColor">
    <path d="M11.983 1.907a.75.75 0 00-1.292-.657l-8.5 9.5A.75.75 0 002.75 12h4.572l-1.305 6.093a.75.75 0 001.292.657l8.5-9.5A.75.75 0 0015.25 8h-4.572l1.305-6.093z" />
  </svg>
);

export const PauseIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 20 20" fill="currentColor">
    <path d="M5.75 4h2.5v12h-2.5V4zm5.5 0h2.5v12h-2.5V4z" />
  </svg>
);

export const PlayIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 20 20" fill="currentColor">
    <path d="M6.5 4.5l9 5.5-9 5.5v-11z" />
  </svg>
);

/** Downward chevron for the "Who gets this message?" expanders (2026-09-14). */
export const ChevronDownIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 7.5l5 5 5-5" />
  </svg>
);

/** Shield for the same-day overlap-guard note on payment ladder cards. */
export const ShieldIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M10 1.5l6.5 2.6v4.4c0 4.2-2.7 7.6-6.5 9.5-3.8-1.9-6.5-5.3-6.5-9.5V4.1L10 1.5zm3.6 6.1a.9.9 0 00-1.3-1.3L9 9.7 7.7 8.4a.9.9 0 10-1.3 1.3l1.9 1.9a.9.9 0 001.3 0l3-3z" clipRule="evenodd" />
  </svg>
);
