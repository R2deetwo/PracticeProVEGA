import React, { useState, useMemo } from 'react';
import { Contact } from '../../types';
import { SearchIcon, UserCircleIcon } from '../../constants';
import { Button } from '../ui';

interface MergeContactModalProps {
  sourceContact: Contact;
  allContacts: Contact[];
  onConfirm: (sourceId: string, targetId: string) => void;
  onClose: () => void;
}

/**
 * V3 (V-MATTER-5): match-reason evidence on every candidate. Merging is a
 * manual human action, but the dialog now shows WHY two contacts might be
 * duplicates — shared email (authoritative), shared phone (a warning:
 * different people share numbers), or a name match alone (the weakest
 * signal there is). When the selected target matches on NOTHING but the
 * name, the merge requires an explicit verification.
 */
type MatchReason = 'email' | 'phone' | 'name' | null;

const digits = (s?: string) => (s || '').replace(/\D/g, '');
const nameKey = (s?: string) => (s || '').trim().toLowerCase();

function matchReasonFor(source: Contact, candidate: Contact): MatchReason {
  if (source.email && candidate.email && source.email.trim().toLowerCase() === candidate.email.trim().toLowerCase()) {
    return 'email';
  }
  const sp = digits(source.phone);
  const cp = digits(candidate.phone);
  if (sp.length >= 7 && cp.length >= 7 && sp === cp) {
    return 'phone';
  }
  if (nameKey(source.name) && nameKey(source.name) === nameKey(candidate.name)) {
    return 'name';
  }
  return null;
}

const REASON_BADGE: Record<Exclude<MatchReason, null>, { label: string; cls: string; hint: string }> = {
  email: {
    label: 'Same email',
    cls: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
    hint: 'Same email — the strongest duplicate signal.',
  },
  phone: {
    label: 'Same phone',
    cls: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
    hint: 'Shares a phone number — different people can share numbers. Verify before merging.',
  },
  name: {
    label: 'Name match only',
    cls: 'bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300',
    hint: 'Matches on display name only — names coincide. Verify these are the same person before merging.',
  },
};

const MergeContactModal: React.FC<MergeContactModalProps> = ({ sourceContact, allContacts, onConfirm, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);

  const availableContacts = useMemo(() => {
    return allContacts.filter(c => c.id !== sourceContact.id);
  }, [allContacts, sourceContact.id]);

  const reasonByContact = useMemo(() => {
    const map = new Map<string, MatchReason>();
    for (const c of availableContacts) map.set(c.id, matchReasonFor(sourceContact, c));
    return map;
  }, [availableContacts, sourceContact]);

  const filteredContacts = useMemo(() => {
    const base = availableContacts;
    if (!searchTerm) {
      // Suggested duplicates (email/phone matches) float to the top.
      return [...base].sort((a, b) => {
        const rank = (r: MatchReason) => (r === 'email' ? 0 : r === 'phone' ? 1 : r === 'name' ? 2 : 3);
        return rank(reasonByContact.get(a.id) ?? null) - rank(reasonByContact.get(b.id) ?? null);
      });
    }
    const term = searchTerm.toLowerCase();
    return base.filter(c =>
      c.name.toLowerCase().includes(term) ||
      (c.email || '').toLowerCase().includes(term)
    );
  }, [availableContacts, searchTerm, reasonByContact]);

  const selectedReason = selectedTargetId ? (reasonByContact.get(selectedTargetId) ?? null) : null;
  // A merge justified by nothing but a matching display name requires
  // explicit human verification.
  const needsVerification = selectedReason === 'name' || selectedReason === null;

  const handleMerge = () => {
    if (selectedTargetId && (!needsVerification || verified)) {
      onConfirm(sourceContact.id, selectedTargetId);
      onClose();
    }
  };

  return (
    <div className="flex flex-col h-full max-h-[80vh]">
      <div className="mb-4">
        <p className="text-sm text-slate-500">
          You are merging <span className="font-bold text-slate-900 dark:text-white">{sourceContact.name}</span> into another contact.
          Their matters, properties, portal access and notes move to the target contact; the source is kept as an
          auditable, archived record.
        </p>
      </div>

      <div className="relative mb-3">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input autoComplete="off" data-lpignore="true" 
          type="text"
          placeholder="Search target contact..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
        />
      </div>

      {selectedTargetId && (
        <div className={`mb-3 p-3 rounded-lg border text-xs ${selectedReason ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300' : 'border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400'}`}>
          {selectedReason
            ? REASON_BADGE[selectedReason].hint
            : 'This contact shares no email, phone or name with the source — make sure this is really the same person.'}
          {needsVerification && (
            <Button
                variant="bare"
                aria-pressed={verified}
                onClick={() => setVerified(v => !v)}
                className={`mt-2 w-full text-left px-2 py-1.5 rounded-md border text-xs font-semibold transition-colors ${verified
                    ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
                    : 'border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:border-primary-400'}`}
            >
                <span className={`inline-flex items-center justify-center w-4 h-4 mr-2 rounded border ${verified ? 'bg-primary-600 border-primary-600 text-white' : 'border-slate-300 dark:border-zinc-500'}`}>
                    {verified && (
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                    )}
                </span>
                I have verified these two records are the same person.
            </Button>
          )}
        </div>
      )}

      <div className="flex-grow overflow-y-auto custom-scrollbar space-y-2 pr-1 min-h-[260px]">
        {filteredContacts.length > 0 ? (
          filteredContacts.map(contact => {
            const reason = reasonByContact.get(contact.id) ?? null;
            const badge = reason ? REASON_BADGE[reason] : null;
            return (
              <button
                key={contact.id}
                onClick={() => { setSelectedTargetId(contact.id); setVerified(false); }}
                className={`w-full text-left p-4 rounded-lg border transition-all flex items-center justify-between group ${
                  selectedTargetId === contact.id 
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30' 
                    : 'border-slate-100 hover:border-slate-300 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800 dark:bg-zinc-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                    selectedTargetId === contact.id ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-300' : 'bg-slate-100 dark:bg-zinc-800 text-slate-500'
                  }`}>
                    {contact.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white text-sm">{contact.name}</p>
                    <p className="text-xs text-slate-500">{contact.email || 'No email'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {badge && (
                    <span className={`px-2 py-0.5 text-2xs font-bold uppercase rounded ${badge.cls}`} title={badge.hint}>
                      {badge.label}
                    </span>
                  )}
                  {selectedTargetId === contact.id && (
                    <div className="w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center text-white">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>
              </button>
            );
          })
        ) : (
          <div className="text-center py-12">
            <UserCircleIcon className="w-12 h-12 text-slate-200 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No contacts found.</p>
          </div>
        )}
      </div>

      <div className="mt-6 pt-4 border-t border-slate-100 dark:border-zinc-800 flex justify-end gap-3">
        <button 
          onClick={onClose}
          className="px-6 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 dark:hover:text-zinc-200 dark:text-zinc-300"
        >
          Cancel
        </button>
        <button 
          onClick={handleMerge}
          disabled={!selectedTargetId || (needsVerification && !verified)}
          title={needsVerification && !verified ? 'Verify that these records are the same person first' : 'Merge the contacts'}
          className="px-8 py-2 bg-primary-600 text-white rounded-lg text-sm font-bold shadow-lg shadow-primary-500/20 hover:bg-primary-700 disabled:opacity-50 disabled:shadow-none transition-all"
        >
          Merge Contacts
        </button>
      </div>
    </div>
  );
};

export default MergeContactModal;
