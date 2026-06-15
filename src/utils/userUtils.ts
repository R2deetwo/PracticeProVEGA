/**
 * User Role Filtering Utilities
 *
 * Centralized helpers for filtering users by their role.
 * These ensure that portal users (Tenants, Clients) never leak into
 * internal team views, billing calculations, compliance reports,
 * task assignments, or any other app-side feature.
 *
 * PORTAL USERS (Tenant, Client, Pending) must NEVER appear in:
 * - Billing/subscription seat counts
 * - Compliance reports
 * - Task assignment filters
 * - Team chat member lists
 * - Matter team assignment
 * - Audit log user filters
 * - Reporting/timesheet selectors
 * - Document sharing (internal)
 * - Channel member lists
 * - Invoice numbering logic
 */

import { User, UserRole } from '../types';

/** Roles that are portal/external users — never shown in internal team views */
const PORTAL_ROLES: UserRole[] = [UserRole.Client, UserRole.Tenant, UserRole.Pending];

/** Roles that should NOT count as billable seats */
const NON_SEAT_ROLES: UserRole[] = [
    UserRole.Client,
    UserRole.Tenant,
    UserRole.ExternalCounsel,
    UserRole.Pending,
];

/**
 * Get only internal team members.
 * Excludes: Client, Tenant, Pending, ExternalCounsel
 * Includes: Admin, Lawyer, Paralegal
 */
export function getInternalUsers(users: User[]): User[] {
    return users.filter(u =>
        u.role !== UserRole.Client &&
        u.role !== UserRole.Tenant &&
        u.role !== UserRole.ExternalCounsel &&
        u.role !== UserRole.Pending
    );
}

/**
 * Get only billable seat users.
 * Excludes: Client, Tenant, ExternalCounsel, Pending
 * Includes: Admin, Lawyer, Paralegal
 *
 * Use this for subscription/billing seat counts.
 */
export function getSeatUsers(users: User[]): User[] {
    return users.filter(u => !NON_SEAT_ROLES.includes(u.role));
}

/**
 * Check if a user is a portal user (Tenant or Client).
 * Portal users should never access the app backend.
 */
export function isPortalUser(user: User): boolean {
    return user.role === UserRole.Tenant || user.role === UserRole.Client;
}

/**
 * Check if a user is an internal team member.
 * Internal = Admin, Lawyer, Paralegal
 */
export function isInternalUser(user: User): boolean {
    return !PORTAL_ROLES.includes(user.role) && user.role !== UserRole.ExternalCounsel;
}

/**
 * Get the count of billable seats.
 * Use this for billing/subscription calculations.
 */
export function getSeatCount(users: User[]): number {
    return getSeatUsers(users).length;
}
