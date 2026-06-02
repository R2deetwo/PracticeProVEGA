import { Matter, TaskStatus, CourtType } from '../types';
import { PROCEDURAL_RULES, ProceduralRule } from './proceduralRules';

export interface ComplianceWarning {
    type: 'LIMITATION' | 'PENDING_DOC' | 'FILING_DEADLINE' | 'PROCEDURAL_ERROR' | 'SATISFIED_REQ';
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'DONE';
    message: string;
    action?: string;
}

/**
 * Procedural Compliance Engine (PCE)
 * Runs deep checks on matter state based on Nigerian Law
 */
export const ComplianceEngine = {
    checkMatter: (matter: Matter, tasks: any[] = [], documents: any[] = []): ComplianceWarning[] => {
        const warnings: ComplianceWarning[] = [];

        // ── 1. Limitation Law Check ──────────────────────────────────────────
        const createdAt = new Date(matter.createdAt).getTime();
        const now = Date.now();
        const monthsElapsed = (now - createdAt) / (1000 * 60 * 60 * 24 * 30);

        // Public officer limitation: 3 months (Public Officers Protection Act)
        if (matter.type === 'Civil Litigation' && monthsElapsed > 3) {
            warnings.push({
                type: 'LIMITATION',
                severity: 'CRITICAL',
                message: 'Potential Limitation Bar: Action may be time-barred if Defendant is a Public Officer (3-month window under POPA).',
                action: 'Verify defendant status immediately and check if limitation period has expired.',
            });
        }

        // General state limitation: 5 years (most states), 6 years (Limitation Law Lagos)
        if (monthsElapsed > 60) {
            warnings.push({
                type: 'LIMITATION',
                severity: 'HIGH',
                message: 'Matter is older than 5 years — verify claim is within statutory limitation period.',
                action: 'Check the applicable State Limitation Law for specific cause of action.',
            });
        }

        // ── 2. Procedural Rule Stack Check ───────────────────────────────────
        // Look up the rule using originatingProcess and court
        const actionRules = matter.originatingProcess
            ? PROCEDURAL_RULES[matter.originatingProcess]
            : null;

        const rule: ProceduralRule | undefined = actionRules && matter.court
            ? (actionRules as Record<string, ProceduralRule>)[matter.court as CourtType]
            : undefined;

        if (rule) {
            const uploadedDocTitles = documents.map((d: any) =>
                (d.type || d.title || '').toLowerCase()
            );

            // Check for missing mandatory documents
            rule.requirements.forEach((req: string) => {
                const keyWord = req.toLowerCase().split('(')[0].trim();
                const found = uploadedDocTitles.some((t: string) => t.includes(keyWord));
                if (!found) {
                    warnings.push({
                        type: 'PENDING_DOC',
                        severity: 'HIGH',
                        message: `Not Done: "${req}"`,
                        action: 'Initialize and complete this filing to stay compliant.',
                    });
                } else {
                    warnings.push({
                        type: 'SATISFIED_REQ',
                        severity: 'DONE',
                        message: `Requirement met: "${req}"`,
                    });
                }
            });

            // Check active deadline tasks
            Object.entries(rule.deadlines).forEach(([item, deadline]: [string, string]) => {
                const keyWord = item.toLowerCase().split('(')[0].trim().substring(0, 20);
                const relatedTask = tasks.find((t: any) =>
                    (t.title || '').toLowerCase().includes(keyWord)
                );
                if (relatedTask && relatedTask.status !== TaskStatus.Done) {
                    warnings.push({
                        type: 'FILING_DEADLINE',
                        severity: 'MEDIUM',
                        message: `Pending Deadline: "${item}" — ${deadline}`,
                        action: 'Mark the related task complete or take action now.',
                    });
                }
            });
        } else if (matter.originatingProcess && matter.court) {
            // Has a process but no specific rule loaded
            warnings.push({
                type: 'PROCEDURAL_ERROR',
                severity: 'MEDIUM',
                message: `No specific procedural rules found for "${matter.originatingProcess}" in "${matter.court}". Generic compliance applies.`,
                action: 'Consult the applicable court rules manually.',
            });
        }

        return warnings;
    },
};
