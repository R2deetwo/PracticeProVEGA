/**
 * Round 19 — the container's data memos: user/event-type name maps, the
 * privacy-filtered visible matters + events (canSeeMatter defence-in-depth),
 * the court-mode matters, the day-grouped diary (getCourtDiary) + its filter
 * (filterDiary), and the selected matter's hearings.
 */
import { useMemo } from "react";
import type { CalendarEvent } from "../../../types";
import { canSeeMatter, filterDiary, getCourtDiary, getCourtHearings, getCourtModeMatters, todayDayKey } from "../courtModeUtils";

export interface CourtModeDataArgs {
  viewerId: string;
  scope: "mine" | "firm";
  query: string;
  selectedMatterId: string;
  users: { id: string; name: string }[];
  eventTypes: { name?: string }[];
  matters: Parameters<typeof canSeeMatter>[0][];
  events: CalendarEvent[];
  notePages: Parameters<typeof getCourtDiary>[2];
}

export function useCourtModeData(args: CourtModeDataArgs) {
  const { viewerId, scope, query, selectedMatterId, users, eventTypes, matters, events, notePages } = args;

  const userNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const user of users || []) map[user.id] = user.name;
    return map;
  }, [users]);

  const eventTypeNames = useMemo(
    () => (eventTypes || []).map((type) => type.name).filter(Boolean) as string[],
    [eventTypes],
  );

  // Privacy defence-in-depth: only visible matters/events feed the diary,
  // the briefing's risk chips and the clash scan.
  const visibleMatters = useMemo(
    () => (matters || []).filter((matter) => canSeeMatter(matter, viewerId)),
    [matters, viewerId],
  );
  const visibleCourtMatters = useMemo(
    () => getCourtModeMatters(visibleMatters, events, todayDayKey()),
    [visibleMatters, events],
  );
  const visibleEventList = useMemo(() => {
    const visibleIds = new Set(visibleMatters.map((matter) => matter.id));
    return (events || []).filter((event) => !event.matterId || visibleIds.has(event.matterId));
  }, [events, visibleMatters]);

  const diary = useMemo(
    () => getCourtDiary(matters, events, notePages, { viewerId, scope, userNames, today: todayDayKey() }),
    [matters, events, notePages, viewerId, scope, userNames],
  );
  const filteredDiary = useMemo(() => filterDiary(diary, query), [diary, query]);

  const selectedMatter = useMemo(
    () => visibleMatters.find((matter) => matter.id === selectedMatterId) || null,
    [visibleMatters, selectedMatterId],
  );
  const selectedCourtMatter = useMemo(() => {
    const fromDiary = visibleCourtMatters.find((courtMatter) => courtMatter.matter.id === selectedMatterId);
    if (fromDiary) return fromDiary;
    return selectedMatter ? getCourtHearings(selectedMatter, events, todayDayKey()) : null;
  }, [visibleCourtMatters, selectedMatterId, selectedMatter, events]);

  return {
    userNames,
    eventTypeNames,
    visibleMatters,
    visibleCourtMatters,
    visibleEventList,
    diary,
    filteredDiary,
    selectedMatter,
    selectedCourtMatter,
  };
}
