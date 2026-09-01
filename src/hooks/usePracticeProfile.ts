/**
 * PracticePro — usePracticeProfile hook
 * ============================================================
 * Resolves the firm's practice profile into a concrete "apply plan"
 * and executes it through the EXISTING generic item actions
 * (addItem / updateItem) so no backend or schema change is required.
 *
 * Merge semantics (non-negotiable):
 *  1. ADDITIVE ONLY — never deletes or overwrites a firm's existing
 *     configuration. The plan lists what WILL be created.
 *  2. IDEMPOTENT — anything that already exists (matched by
 *     case-insensitive name / type key) is skipped on re-run.
 *  3. PREVIEWABLE — the plan is pure data; the UI can show a diff
 *     ("14 contact types, 3 workflows, 2 checklists will be added")
 *     before anything is written.
 *  4. Workflow MERGE — if the firm already has a workflow of the same
 *     matter type, only the missing sub-categories are added to it
 *     (existing sub-categories and default stages are untouched).
 */

import { useCallback, useMemo, useState } from "react";
import {
  LEGAL_CORE_CONTACT_TYPES,
  LEGAL_CORE_DOCUMENT_CATEGORIES,
  LEGAL_CORE_EVENT_TYPES,
  GENERIC_STAGES,
  getProfilesForAreas,
  type ChecklistBlueprint,
  type EventTypeBlueprint,
  type PracticeProfile,
  type WorkflowBlueprint,
} from "../config/practiceProfileLibrary";
import {
  ATRIUM_CORE_CONTACT_TYPES,
  ATRIUM_CORE_DOCUMENT_CATEGORIES,
  getAtriumProfilesForPortfolio,
  type AtriumFocusOverlay,
} from "../config/atriumProfileLibrary";
import type { AtriumProfile } from "../config/practiceProfileLibrary";

// ---------------------------------------------------------------------------
// Plan types
// ---------------------------------------------------------------------------

export interface PlanItem {
  /** table passed to addItem */
  table:
    | "contactCategories"
    | "documentCategories"
    | "eventTypes"
    | "workflows"
    | "checklistTemplates";
  /** display label */
  label: string;
  /** payload ready for addItem (firmId injected by the hook) */
  data: Record<string, unknown>;
  /** true when the item will be SKIPPED because it already exists */
  duplicate?: boolean;
}

export interface ApplyPlan {
  items: PlanItem[];
  /** workflow merges: existing workflow id + sub-categories to add */
  workflowMerges: {
    workflowId: string;
    workflowType: string;
    subCategories: Record<string, { stages: string[]; suggestions: unknown }>;
  }[];
  automations: string[];
  counts: {
    contactTypes: number;
    matterTypes: number;
    subCategories: number;
    documentCategories: number;
    eventTypes: number;
    checklists: number;
  };
}

export interface ApplyResult {
  created: number;
  merged: number;
  skipped: number;
  errors: string[];
}

export interface UsePracticeProfileDeps {
  /** existing collections from CoreProvider state */
  contactCategories: { id?: string; name: string }[];
  documentCategories: { id?: string; name: string }[];
  eventTypes: { id?: string; name: string; color?: string }[];
  workflows: {
    id?: string;
    _id?: string;
    type: string;
    default?: { stages?: string[]; suggestions?: unknown };
    subCategories?: Record<string, unknown>;
  }[];
  checklistTemplates: { id?: string; name: string }[];
  firmId: string;
  /** addItem(table, data, label?) from CoreActions */
  addItem: (table: string, data: Record<string, unknown>, label?: string) => Promise<unknown>;
  /** updateItem(table, data) — for workflow merges */
  updateItem: (
    table: string,
    data: Record<string, unknown> & { id?: string; _id?: string },
  ) => Promise<unknown>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const norm = (v: string) => (v || "").trim().toLowerCase();

/**
 * Bridges speciality strings (onboarding, British) and matter-type
 * enum values (American): "Employment & Labour" == "Employment & Labor",
 * "Criminal Defence" == "Criminal Defense", "&" == "and".
 */
const normType = (v: string) =>
  norm(v)
    .replace(/&/g, "and")
    .replace(/labour/g, "labor")
    .replace(/defence/g, "defense");

const workflowTypeMatches = (a: string, b: string) => normType(a) === normType(b);

function unique<T>(arr: T[], key: (t: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of arr) {
    const k = key(item);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(item);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Plan builder
// ---------------------------------------------------------------------------

function buildLegalPlan(
  profiles: PracticeProfile[],
  deps: Pick<
    UsePracticeProfileDeps,
    | "contactCategories"
    | "documentCategories"
    | "eventTypes"
    | "workflows"
    | "checklistTemplates"
  >,
): { items: PlanItem[]; workflowMerges: ApplyPlan["workflowMerges"]; automations: string[]; counts: ApplyPlan["counts"] } {
  const {
    contactCategories,
    documentCategories,
    eventTypes,
    workflows,
    checklistTemplates,
  } = deps;

  const items: PlanItem[] = [];
  const workflowMerges: ApplyPlan["workflowMerges"] = [];

  // --- contact categories ---------------------------------------------
  const existingContacts = new Set(contactCategories.map((c) => norm(c.name)));
  const contactNames = unique(
    [
      ...LEGAL_CORE_CONTACT_TYPES,
      ...profiles.flatMap((p) => p.contactTypes),
    ],
    norm,
  );
  let contactCount = 0;
  for (const name of contactNames) {
    const dup = existingContacts.has(norm(name));
    if (!dup) contactCount++;
    items.push({
      table: "contactCategories",
      label: name,
      duplicate: dup,
      data: { name },
    });
  }

  // --- workflows -------------------------------------------------------
  const existingByType = new Map<string, (typeof workflows)[number]>();
  for (const w of workflows) {
    if (!existingByType.has(normType(w.type))) existingByType.set(normType(w.type), w);
  }
  // one blueprint per matter type across profiles (first profile wins,
  // later profiles contribute their missing sub-categories)
  const blueprints = new Map<string, WorkflowBlueprint>();
  for (const p of profiles) {
    for (const wf of p.workflows) {
      const k = normType(wf.type);
      const current = blueprints.get(k);
      if (!current) {
        blueprints.set(k, wf);
      } else {
        // merge sub-categories from this profile into the blueprint
        for (const [sub, def] of Object.entries(wf.subCategories || {})) {
          if (!current.subCategories[sub]) current.subCategories[sub] = def;
        }
      }
    }
  }
  let matterCount = 0;
  let subCount = 0;
  for (const bp of blueprints.values()) {
    const existing = existingByType.get(normType(bp.type));
    if (!existing) {
      matterCount++;
      subCount += Object.keys(bp.subCategories || {}).length;
      items.push({
        table: "workflows",
        label: `${bp.type} (with ${Object.keys(bp.subCategories || {}).length} sub-categories)`,
        data: {
          type: bp.type,
          default: {
            stages: bp.default.stages,
            suggestions: bp.default.suggestions || { processes: [], tasks: [] },
          },
          subCategories: bp.subCategories,
        },
      });
    } else {
      // merge missing sub-categories into the existing workflow
      const existingSubs = (existing.subCategories || {}) as Record<string, unknown>;
      const missing: Record<string, { stages: string[]; suggestions: unknown }> = {};
      for (const [sub, def] of Object.entries(bp.subCategories || {})) {
        if (!existingSubs[sub]) missing[sub] = def as { stages: string[]; suggestions: unknown };
      }
      if (Object.keys(missing).length > 0) {
        subCount += Object.keys(missing).length;
        workflowMerges.push({
          workflowId: (existing.id || existing._id || "") as string,
          workflowType: bp.type,
          subCategories: missing,
        });
      }
    }
  }

  // --- document categories --------------------------------------------
  const existingDocs = new Set(documentCategories.map((c) => norm(c.name)));
  const docNames = unique(
    [
      ...LEGAL_CORE_DOCUMENT_CATEGORIES,
      ...profiles.flatMap((p) => p.documentCategories),
    ],
    norm,
  );
  let docCount = 0;
  for (const name of docNames) {
    const dup = existingDocs.has(norm(name));
    if (!dup) docCount++;
    items.push({
      table: "documentCategories",
      label: name,
      duplicate: dup,
      data: { name, parentId: null },
    });
  }

  // --- event types ------------------------------------------------------
  const existingEvents = new Set(eventTypes.map((e) => norm(e.name)));
  const eventDefs = unique(
    [
      ...LEGAL_CORE_EVENT_TYPES,
      ...profiles.flatMap((p) => p.eventTypes),
    ],
    (e) => norm(e.name),
  );
  let eventCount = 0;
  for (const et of eventDefs) {
    const dup = existingEvents.has(norm(et.name));
    if (!dup) eventCount++;
    items.push({
      table: "eventTypes",
      label: et.name,
      duplicate: dup,
      data: { name: et.name, color: et.color },
    });
  }

  // --- checklists -------------------------------------------------------
  const existingChecklists = new Set(checklistTemplates.map((c) => norm(c.name)));
  let checklistCount = 0;
  for (const p of profiles) {
    for (const cl of p.checklists) {
      const dup = existingChecklists.has(norm(cl.name));
      if (!dup) checklistCount++;
      items.push({
        table: "checklistTemplates",
        label: cl.name,
        duplicate: dup,
        data: {
          name: cl.name,
          items: cl.items.map((text, i) => ({ id: `item_${Date.now()}_${i}`, text })),
          relevantMatterTypes: cl.relevantMatterTypes,
        },
      });
    }
  }

  return {
    items,
    workflowMerges,
    automations: unique(profiles.flatMap((p) => p.automations), norm),
    counts: {
      contactTypes: contactCount,
      matterTypes: matterCount,
      subCategories: subCount,
      documentCategories: docCount,
      eventTypes: eventCount,
      checklists: checklistCount,
    },
  };
}

/** Atrium variant — same engine, property payload. */
function buildAtriumPlan(
  profiles: AtriumProfile[],
  overlays: AtriumFocusOverlay[],
  deps: Pick<
    UsePracticeProfileDeps,
    | "contactCategories"
    | "documentCategories"
    | "eventTypes"
    | "workflows"
    | "checklistTemplates"
  >,
): { items: PlanItem[]; workflowMerges: ApplyPlan["workflowMerges"]; automations: string[]; counts: ApplyPlan["counts"] } {
  const {
    contactCategories,
    documentCategories,
    eventTypes,
    checklistTemplates,
  } = deps;

  const items: PlanItem[] = [];

  const existingContacts = new Set(contactCategories.map((c) => norm(c.name)));
  const contactNames = unique(
    [
      ...ATRIUM_CORE_CONTACT_TYPES,
      ...profiles.flatMap((p) => p.contactTypes),
      ...overlays.flatMap((o) => o.contactTypes || []),
    ],
    norm,
  );
  let contactCount = 0;
  for (const name of contactNames) {
    const dup = existingContacts.has(norm(name));
    if (!dup) contactCount++;
    items.push({ table: "contactCategories", label: name, duplicate: dup, data: { name } });
  }

  const existingDocs = new Set(documentCategories.map((c) => norm(c.name)));
  const docNames = unique(
    [
      ...ATRIUM_CORE_DOCUMENT_CATEGORIES,
      ...profiles.flatMap((p) => p.documentCategories),
      ...overlays.flatMap((o) => o.documentCategories || []),
    ],
    norm,
  );
  let docCount = 0;
  for (const name of docNames) {
    const dup = existingDocs.has(norm(name));
    if (!dup) docCount++;
    items.push({ table: "documentCategories", label: name, duplicate: dup, data: { name, parentId: null } });
  }

  const existingEvents = new Set(eventTypes.map((e) => norm(e.name)));
  const eventDefs = unique(profiles.flatMap((p) => p.eventTypes), (e) => norm(e.name));
  let eventCount = 0;
  for (const et of eventDefs) {
    const dup = existingEvents.has(norm(et.name));
    if (!dup) eventCount++;
    items.push({ table: "eventTypes", label: et.name, duplicate: dup, data: { name: et.name, color: et.color } });
  }

  const existingChecklists = new Set(checklistTemplates.map((c) => norm(c.name)));
  let checklistCount = 0;
  const allChecklists: { name: string; items: string[] }[] = [
    ...profiles.flatMap((p) => p.checklists),
    ...overlays.flatMap((o) => o.checklists || []),
  ];
  for (const cl of unique(allChecklists, (c) => norm(c.name))) {
    const dup = existingChecklists.has(norm(cl.name));
    if (!dup) checklistCount++;
    items.push({
      table: "checklistTemplates",
      label: cl.name,
      duplicate: dup,
      data: {
        name: cl.name,
        items: cl.items.map((text, i) => ({ id: `item_${Date.now()}_${i}`, text })),
        relevantMatterTypes: [],
      },
    });
  }

  return {
    items,
    workflowMerges: [],
    automations: unique(
      [...profiles.flatMap((p) => p.automations), ...overlays.flatMap((o) => o.automations || [])],
      norm,
    ),
    counts: {
      contactTypes: contactCount,
      matterTypes: 0,
      subCategories: 0,
      documentCategories: docCount,
      eventTypes: eventCount,
      checklists: checklistCount,
    },
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Combine a legal plan and an Atrium plan into one (for Komplete/unified
 * firms, which practise law AND manage property). Items are concatenated
 * and de-duplicated by (table, normalized label) so a row that appears in
 * both plans (e.g. a shared document folder) is only listed — and only
 * written — once. Counts are summed after de-duplication.
 */
export function mergePlans(a: ApplyPlan, b: ApplyPlan): ApplyPlan {
  const key = (table: string, label: string) =>
    `${table}:${norm(label.replace(/\s*\(with.*\)$/, ""))}`;
  const seen = new Map<string, PlanItem>();
  for (const item of [...a.items, ...b.items]) {
    const k = key(item.table, item.label);
    if (seen.has(k)) {
      const first = seen.get(k)!;
      if (first.duplicate && !item.duplicate) first.duplicate = false;
    } else {
      seen.set(k, { ...item });
    }
  }
  const items = Array.from(seen.values());
  const mergeKeys = new Set(
    a.workflowMerges.map((m) => key("workflows", m.workflowType)),
  );
  const workflowMerges = [
    ...a.workflowMerges,
    ...b.workflowMerges.filter(
      (m) => !mergeKeys.has(key("workflows", m.workflowType)),
    ),
  ];
  const recalc = (table: string) =>
    items.filter((i) => i.table === table && !i.duplicate).length;
  return {
    items,
    workflowMerges,
    automations: unique([...a.automations, ...b.automations], norm),
    counts: {
      contactTypes: recalc("contactCategories"),
      matterTypes: a.counts.matterTypes + b.counts.matterTypes,
      subCategories: a.counts.subCategories + b.counts.subCategories,
      documentCategories: recalc("documentCategories"),
      eventTypes: recalc("eventTypes"),
      checklists: recalc("checklistTemplates"),
    },
  };
}

export function usePracticeProfile(deps: UsePracticeProfileDeps) {
  const [running, setRunning] = useState(false);

  const buildPlan = useCallback(
    (mode: {
      kind: "legal";
      areas: string[];
    } | {
      kind: "atrium";
      portfolioTypes: string[];
      focusAreas: string[];
    }): ApplyPlan => {
      if (mode.kind === "legal") {
        const built = buildLegalPlan(getProfilesForAreas(mode.areas), deps);
        return { ...built, automations: built.automations } as ApplyPlan;
      }
      const { profiles, overlays } = getAtriumProfilesForPortfolio(
        mode.portfolioTypes,
        mode.focusAreas,
      );
      return buildAtriumPlan(profiles, overlays, deps) as ApplyPlan;
    },
    [deps],
  );

  /**
   * Execute a plan. Only non-duplicate items are written; workflow
   * merges update existing records. All writes go through the
   * firm-scoped generic actions, so server-side authorisation and
   * firmId stamping behave exactly like the settings UI.
   */
  const applyPlan = useCallback(
    async (plan: ApplyPlan, firmId: string): Promise<ApplyResult> => {
      const result: ApplyResult = { created: 0, merged: 0, skipped: 0, errors: [] };
      setRunning(true);
      try {
        for (const item of plan.items) {
          if (item.duplicate) {
            result.skipped++;
            continue;
          }
          try {
            await deps.addItem(item.table, { ...item.data, firmId });
            result.created++;
          } catch (err) {
            result.errors.push(`${item.label}: ${(err as Error).message}`);
          }
        }
        for (const merge of plan.workflowMerges) {
          const existing = deps.workflows.find(
            (w) =>
              (w.id || w._id) === merge.workflowId ||
              workflowTypeMatches(w.type, merge.workflowType),
          );
          if (!existing) continue;
          try {
            await deps.updateItem("workflows", {
              id: existing.id,
              _id: existing._id,
              subCategories: {
                ...(existing.subCategories || {}),
                ...merge.subCategories,
              },
            });
            result.merged++;
          } catch (err) {
            result.errors.push(`${merge.workflowType}: ${(err as Error).message}`);
          }
        }
      } finally {
        setRunning(false);
      }
      return result;
    },
    [deps],
  );

  return { buildPlan, applyPlan, running };
}

/** Convenience: suggested matter-type list for currently selected areas. */
export function useSuggestedMatterTypes(areas: string[]): string[] {
  return useMemo(() => {
    const profiles = getProfilesForAreas(areas);
    const types = new Set<string>();
    for (const p of profiles) for (const wf of p.workflows) types.add(wf.type);
    return Array.from(types);
  }, [areas]);
}

export { GENERIC_STAGES };
