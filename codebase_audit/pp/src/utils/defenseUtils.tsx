
import { LitigationParty, AloaHint, CourtType } from '../types';
import { Scale, FileText, Ban, Building, Baby, UserX, Landmark, ScrollText, Wallet } from 'lucide-react';

/**
 * Analyzes a party name for Nigerian litigation standards.
 */
export const analyzePartyName = (name: string, side: 'claimant' | 'defendant', allClaimants: string[], allDefendants: string[]): AloaHint[] => {
    if (!name || typeof name !== 'string' || !name.trim()) return [];
    const n = name.trim();
    const nLower = n.toLowerCase();
    const hints: AloaHint[] = [];

    // 1. Joint naming (Mr. and Mrs X)
    if (/\band\b/i.test(n) && /\b(mr\.?|mrs\.?|dr\.?|chief|alhaji|mallam)\b/i.test(n)) {
        hints.push({
            id: 'joint-title',
            icon: <Scale className="w-4 h-4" />,
            type: 'warning',
            text: `Joint Party Detection: In Nigerian courts, titles like "Mr. and Mrs." are usually rejected. List each person separately — e.g. "Mr. X" as ${side === 'claimant' ? '1st Claimant' : '1st Defendant'} and "Mrs. X" as ${side === 'claimant' ? '2nd Claimant' : '2nd Defendant'}.`
        });
    }

    // 2. Informal "and brother/sister/friend"
    if (/\b(and (his |her )?(brother|sister|friend|son|daughter|relative|cousin|nephew|uncle|aunt))\b/i.test(n)) {
        hints.push({
            id: 'informal-joint',
            icon: <FileText className="w-4 h-4" />,
            type: 'warning',
            text: 'Informal Joinder: Relationship-based joinder (e.g., "and family") lacks legal standing. Provide full independent names for all parties.'
        });
    }

    // 3. Same party on both sides
    const oppositeSide = side === 'claimant' ? allDefendants : allClaimants;
    if (oppositeSide.some(op => op.toLowerCase().trim() === nLower)) {
        hints.push({
            id: 'same-party',
            icon: <Ban className="w-4 h-4" />,
            type: 'error',
            text: 'Conflict Detected: The same entity is listed as both Claimant and Defendant. This will likely result in a strike-out.'
        });
    }

    // 4. Corporate entity detection
    if (/\b(limited|ltd\.?|plc|ngo|foundation|ventures|enterprises|associates|holdings|group|inc\.?)\b/i.test(n)) {
        hints.push({
            id: 'corporate',
            icon: <Building className="w-4 h-4" />,
            type: 'info',
            text: 'Entity Verification: Ensure the name matches the CAC registration exactly. For Ltd/Plc, the RC number should be cited in the pleadings.'
        });
    }

    // 6. Minor / infant
    if (/\b(minor|infant|child|age \d|\d+ years? old)\b/i.test(nLower)) {
        hints.push({
            id: 'minor',
            icon: <Baby className="w-4 h-4" />,
            type: 'warning',
            text: 'Legal Capacity: Minors cannot sue in their own name. Designation should be "[Name] (suing through [Guardian Name] as Litigation Guardian)".'
        });
    }

    // 7. Deceased persons / estate
    if (/\b(estate of|late |deceased|administrator of the estate)\b/i.test(nLower)) {
        hints.push({
            id: 'deceased',
            icon: <UserX className="w-4 h-4" />,
            type: 'warning',
            text: 'Probate Standing: A deceased person cannot be a party. The party must be the "Executor/Administrator of the Estate of [Name]".'
        });
    }

    // 8. Government entities
    if (/\b(state|minister|federal|government|commission|authority|board of|council of|attorney.general)\b/i.test(nLower)) {
        if (!/\b(attorney.general of|commissioner for|honourable|minister of)\b/i.test(nLower)) {
            hints.push({
                id: 'govt-entity',
                icon: <Landmark className="w-4 h-4" />,
                type: 'info',
                text: 'Statutory Body: Government entities should be sued via their statutory office (e.g., "Attorney-General of the Federation") per the Law Officers Act.'
            });
        }
    }

    return hints;
};

/**
 * Analyzes matter metadata for common jurisdictional or procedural pitfalls.
 */
export const analyzeMatterIntelligence = (title: unknown, court?: unknown, value?: unknown): AloaHint[] => {
    const hints: AloaHint[] = [];
    if (typeof title !== 'string') return hints;
    const t = title.toLowerCase();
    const safeCourt = typeof court === 'string' ? court : '';

    // 1. Jurisdiction: Land matters in Magistrate Court
    if (/\b(land|chieftaincy|property|estate|title|trespass to land)\b/.test(t) && safeCourt.toLowerCase().includes('magistrate')) {
        hints.push({
            id: 'land-jurisdiction',
            icon: <Scale className="w-4 h-4" />,
            type: 'error',
            text: 'Subject Matter Jurisdiction: Magistrate Courts lack jurisdiction over land title or chieftaincy matters in Nigeria, regardless of the claim amount. Recommend file in State High Court.'
        });
    }

    // 2. Fundamental Rights
    if (/\b(fundamental rights?|human rights?|police|enforcement)\b/.test(t)) {
        hints.push({
            id: 'frep-rules',
            icon: <ScrollText className="w-4 h-4" />,
            type: 'info',
            text: 'FREP Rules: Ensure compliance with the Fundamental Rights (Enforcement Procedure) Rules 2009. These matters take precedence over ordinary civil suits.'
        });
    }

    // 3. Monetary Jurisdiction (Approximate for Magistrate)
    if (typeof value === 'number' && value > 10000000 && safeCourt.toLowerCase().includes('magistrate')) {
        hints.push({
            id: 'monetary-limit',
            icon: <Wallet className="w-4 h-4" />,
            type: 'warning',
            text: `High Value Claim: A ₦${value.toLocaleString()} claim likely exceeds Magistrate Court limits (e.g., ₦10m in Lagos). Verified jurisdictional limits before filing.`
        });
    }

    return hints;
};
