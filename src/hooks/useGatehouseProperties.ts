/**
 * useGatehouseProperties — Round 20.
 *
 * The public estate picker directory (visitorManagement.getGatekeeperProperties)
 * is a MUTATION now: its write-based throttle (checkRateLimit) is illegal in a
 * read-only Convex query and threw on every call in production, taking the
 * Security & Access page into the error boundary after its first paint. This
 * hook loads the picker ONCE per (firmId, enabled) change — no subscription.
 *
 * Returns null while disabled/loading, [] on error (a silent empty picker beats
 * a crashed page; the throttle errors stay server-side).
 */
import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export interface GatehouseProperty {
  id: string;
  name: string;
}

export function useGatehouseProperties(firmId: string, enabled = true) {
  const load = useMutation(api.visitorManagement.getGatekeeperProperties);
  // Keep the latest mutation handle without re-running the effect on every
  // render (useMutation's identity is not guaranteed stable).
  const loadRef = useRef(load);
  loadRef.current = load;

  const [properties, setProperties] = useState<GatehouseProperty[] | null>(null);

  useEffect(() => {
    if (!firmId || !enabled) {
      setProperties(null);
      return;
    }
    let cancelled = false;
    loadRef
      .current({ firmId })
      .then((rows: GatehouseProperty[] | null) => {
        if (!cancelled) setProperties(rows ?? []);
      })
      .catch(() => {
        if (!cancelled) setProperties([]);
      });
    return () => {
      cancelled = true;
    };
  }, [firmId, enabled]);

  return properties;
}
