import React, { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useAuth } from '../../contexts/AuthContext';
import { Button, Textarea } from '../ui';

import { Z_CLASS } from '../../overlays/constants';
/**
 * ConflictReviewDialog — V3 (V-MATTER-6): the human-review step of the
 * conflict-of-interest screen, shown BEFORE a matter is created when the
 * screen surfaced potential matches.
 *
 * The dialog NEVER declares a legal conflict by itself. It shows what the
 * normalised matching found (with each match's strength and what it
 * matched on), and a person records the disposition:
 *   • "Reviewed — proceed" records a reviewed false positive (note
 *     required) and continues creation;
 *   • "Confirmed conflict" records a genuine conflict (note required) and
 *     stops creation;
 *   • "Back" returns to the form without recording anything.
 */

export interface ConflictMatchView {
  kind: 'contact' | 'matter';
  id: string;
  name: string;
  detail: string;
  matchedOn: string;
  matchType: string;
  strength: 'strong' | 'possible';
  matchedValue: string;
}

interface ConflictReviewDialogProps {
  matches: ConflictMatchView[];
  clientName?: string;
  opposingParties: string[];
  counsel: string[];
  onDecision: (decision: { proceed: boolean; note: string }) => void;
  onBack: () => void;
}

const ConflictReviewDialog: React.FC<ConflictReviewDialogProps> = ({
  matches, clientName, opposingParties, counsel, onDecision, onBack,
}) => {
  const { currentUser, bearerToken } = useAuth();
  const [note, setNote] = useState('');
  const [recording, setRecording] = useState(false);
  const recordCheck = useMutation(api.conflictCheck.recordConflictCheck);

  const authArgs = {
    userEmail: currentUser?.email,
    sessionToken: (bearerToken ?? undefined),
  };

  const record = async (outcome: 'reviewed-false-positive' | 'confirmed-conflict') => {
    if (!note.trim()) return;
    setRecording(true);
    try {
      await recordCheck({
        ...authArgs,
        clientName: clientName || '',
        opposingParties,
        counsel,
        matches,
        outcome,
        note: note.trim(),
      });
      onDecision({ proceed: outcome === 'reviewed-false-positive', note: note.trim() });
    } finally {
      setRecording(false);
    }
  };

  const strongCount = matches.filter(m => m.strength === 'strong').length;

  return (
    <div className={`fixed inset-0 ${Z_CLASS.panelOverlay} flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4`}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-700">
        <div className="p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Potential conflict of interest
              </h2>
              <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
                {matches.length} possible match{matches.length === 1 ? '' : 'es'} found ({strongCount} strong) for
                {clientName ? ` client "${clientName}"` : ' this matter'}{opposingParties.length > 0 ? `, opposing part${opposingParties.length === 1 ? 'y' : 'ies'} ${opposingParties.join(', ')}` : ''}.
              </p>
            </div>
          </div>

          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-xs text-amber-800 dark:text-amber-300">
            These matches come from normalised name comparison — they are <strong>not</strong> a legal determination.
            A person must review them: proceed only if you have verified these are different parties.
          </div>

          <div className="space-y-2">
            {matches.map((m, i) => (
              <div key={`${m.kind}-${m.id}-${i}`} className="flex items-start justify-between gap-3 p-3 rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/50">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{m.name}</p>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">{m.detail}</p>
                  <p className="text-2xs text-slate-400 dark:text-zinc-500 mt-0.5">
                    Matched “{m.matchedOn}” ({m.matchType}) via {m.matchedValue}
                  </p>
                </div>
                <span className={`flex-shrink-0 px-2 py-0.5 text-2xs font-bold uppercase rounded ${m.strength === 'strong' ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300' : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'}`}>
                  {m.strength}
                </span>
              </div>
            ))}
          </div>

          <Textarea
            label="Review note (required)"
            styleVariant="bare"
            containerClassName=""
            textareaClassName="text-slate-900 dark:text-white w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg shadow-sm p-3 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm resize-none outline-none"
            rows={3}
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Why are you proceeding? e.g. 'Verified: the opposing party is a different person with the same name — different RC number.'"
          />

          <div className="pt-2 flex flex-col sm:flex-row-reverse gap-2 sm:justify-start">
            <Button
              variant="bare"
              className="px-5 py-2 bg-primary-600 text-white rounded-lg font-bold text-sm hover:bg-primary-700 disabled:opacity-50 transition-colors shadow-md"
              onClick={() => record('reviewed-false-positive')}
              disabled={!note.trim() || recording}
            >
              {recording ? 'Recording…' : 'Reviewed — proceed with creation'}
            </Button>
            <Button
              variant="bare"
              className="px-5 py-2 bg-red-600 text-white rounded-lg font-bold text-sm hover:bg-red-700 disabled:opacity-50 transition-colors"
              onClick={() => record('confirmed-conflict')}
              disabled={!note.trim() || recording}
            >
              Confirmed conflict — do not create
            </Button>
            <Button
              variant="bare"
              className="px-4 py-2 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded-lg font-bold text-sm hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
              onClick={onBack}
              disabled={recording}
            >
              Back
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConflictReviewDialog;
