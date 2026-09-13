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
