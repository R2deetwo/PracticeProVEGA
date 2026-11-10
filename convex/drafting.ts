import { mutation, query, action } from "./_generated/server";
import { v } from "convex/values";
import { requireFirmUser } from "./authHelpers";

interface FieldMapping {
  landlord_name?: string;
  landlord_address?: string;
  tenant_name?: string;
  tenant_address?: string;
  property_address?: string;
  rent_amount?: number;
  rent_period?: string;
  arrears_from?: Date;
  arrears_to?: Date;
  total_arrears?: number;
  demand_date?: Date;
  notice_period?: number;
}

/**
 * ROUND D (D8) — DELETION RECORD (Wave 3b, R81, 2026-11-10).
 *
 * generateRentDemand removed: session-gated orphan with zero product callers — the rent-demand letter flow never shipped UI. The drafting module's live functions are untouched.
 */
