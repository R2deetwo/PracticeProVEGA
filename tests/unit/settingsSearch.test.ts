/**
 * settingsSearch — the Settings nav quick-search filter grammar (2026-11-25
 * audit response: "Navigation Overload — over 18 settings sections … hard
 * to locate specific preferences").
 */
import { describe, it, expect } from 'vitest';
import { filterSettingsGroups, isSettingsSearchActive } from '../../src/utils/settingsSearch';

interface Child { id: string; label: string; visible: boolean }
interface Group {
  key: string;
  label: string;
  description?: string;
  section: 'account' | 'practice' | 'system';
  children: Child[];
}

const makeGroups = (): Group[] => [
  {
    key: 'profile', label: 'My Profile', description: 'Your info & account details',
    section: 'account',
    children: [
      { id: 'profile', label: 'Profile', visible: true },
      { id: 'notifications', label: 'Notifications', visible: true },
      { id: 'recovery', label: 'Account Recovery', visible: true },
    ],
  },
  {
    key: 'security', label: 'Data & Security', description: 'Audit logs, backup & cleanup',
    section: 'system',
    children: [
      { id: 'security', label: 'Security', visible: true },
      { id: 'data', label: 'Data & Export', visible: true },
    ],
  },
];

describe('filterSettingsGroups', () => {
  it('empty / whitespace query passes the groups through untouched', () => {
    const groups = makeGroups();
    expect(filterSettingsGroups(groups, '')).toEqual(groups);
    expect(filterSettingsGroups(groups, '   ')).toEqual(groups);
    // Identity, not a clone: no defensive copying on the pass-through path.
    expect(filterSettingsGroups(groups, '')).toBe(groups);
  });

  it('a GROUP-level hit keeps the group AND all of its children', () => {
    const out = filterSettingsGroups(makeGroups(), 'security');
    expect(out).toHaveLength(1);
    expect(out[0].key).toBe('security');
    expect(out[0].children).toHaveLength(2);
  });

  it('a DESCRIPTION-level hit also keeps the whole group (users search words they see)', () => {
    const out = filterSettingsGroups(makeGroups(), 'backup');
    expect(out).toHaveLength(1);
    expect(out[0].key).toBe('security');
    expect(out[0].children).toHaveLength(2);
  });

  it('a CHILD-only hit prunes the group to the matching children', () => {
    const out = filterSettingsGroups(makeGroups(), 'recovery');
    expect(out).toHaveLength(1);
    expect(out[0].key).toBe('profile');
    expect(out[0].children.map((c) => c.id)).toEqual(['recovery']);
  });

  it('matching is case-insensitive on trimmed input', () => {
    const out = filterSettingsGroups(makeGroups(), '  NOTIFICATIONS  ');
    expect(out).toHaveLength(1);
    expect(out[0].children.map((c) => c.id)).toEqual(['notifications']);
  });

  it('no hits returns an empty array (the caller renders the no-match note)', () => {
    expect(filterSettingsGroups(makeGroups(), 'kanban')).toEqual([]);
  });

  it('a query matching a child in one group and a group label in another returns both', () => {
    const out = filterSettingsGroups(makeGroups(), 'a'); // 'a' hits many
    const keys = out.map((g) => g.key);
    expect(keys).toContain('profile');
    expect(keys).toContain('security');
  });
});

describe('isSettingsSearchActive', () => {
  it('active only when the trimmed query is non-empty', () => {
    expect(isSettingsSearchActive('billing')).toBe(true);
    expect(isSettingsSearchActive('  billing  ')).toBe(true);
    expect(isSettingsSearchActive('')).toBe(false);
    expect(isSettingsSearchActive('   ')).toBe(false);
  });
});
