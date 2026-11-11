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
        // V5 (legal AI reliability): limitation warnings are now clearly ADVISORY
        // and cause-aware in wording. They are keyed to the matter RECORD age
        // (the date of cause of action is not captured), so they must never
        // assert a specific limitation number for a state — the old "5 years
        // (most states), 6 years (Lagos)" claim was unverifiable and varied
        // by cause of action.
        const createdAt = new Date(matter.createdAt).getTime();
        const now = Date.now();
        const monthsElapsed = (now - createdAt) / (1000 * 60 * 60 * 24 * 30);

        // Public officer limitation: 3 months (Public Officers Protection Act)
        if (matter.type === 'Civil Litigation' && monthsElapsed > 3) {
            warnings.push({
                type: 'LIMITATION',
                severity: 'HIGH',
                message: 'Advisory — potential limitation bar: if the Defendant is a Public Officer, the Public Officers Protection Act applies a 3-month window. Confirm the defendant\'s status and whether the claim is already barred.',
                action: 'Verify defendant status and, if a public officer, confirm the limitation window with counsel before filing.',
            });
        }

        // Cause-of-action limitation reminder (advisory — record age only)
        if (monthsElapsed > 60) {
            warnings.push({
                type: 'LIMITATION',
                severity: 'HIGH',
                message: 'Advisory — this matter record is over 5 years old. Confirm the applicable limitation period for the specific cause of action under the relevant Limitation Law (state or federal, as applicable) — periods differ by state and by cause of action.',
                action: 'Check the applicable Limitation Law for the specific cause of action and the date it accrued.',
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
