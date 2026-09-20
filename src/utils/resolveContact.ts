/**
 * resolveContactById — resilient contact lookup by any id form.
 *
 * TASK 64: matters created before the stable client-UUID link may carry a
 * clientId in EITHER form — the client-side UUID (custom `id` field on the
 * contact document) or the raw Convex `_id` (written by the legacy backfill
 * in useMatters.onAddMatter, which used the local uuid that did not survive
 * the Phase B backend merge — the "Deleted Client" bug). Matching BOTH
 * fields (plus string-coerced comparisons) resolves every historical form.
 */
export const resolveContactById = (
  contacts: any[] | undefined | null,
  id: string | null | undefined
): any | undefined => {
  if (!id || !contacts || contacts.length === 0) return undefined;
  const sid = String(id);
  return contacts.find(
    (c) =>
      (c && c.id !== undefined && String(c.id) === sid) ||
      (c && c._id !== undefined && String(c._id) === sid)
  );
};
