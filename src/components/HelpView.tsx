
import React, { useState, useRef, useMemo } from 'react';
import { SearchIcon, HelpCircleIcon, ZapIcon, UserCircleIcon, OfficeBuildingIcon, SparklesIcon, ShieldCheckIcon } from '../constants';
import Accordion, { AccordionItem } from './Accordion';
import { useAloa } from '../contexts/AloaProvider';
import { useUI } from '../contexts/UIContext';
import { useProduct } from '../contexts/ProductContext';
import { getAssistantName, getAssistantFullName } from '../utils/assistantIdentity';

const HelpView: React.FC = () => {
    const { currentHistoryEntry, navigateTo } = useUI();
    const [searchQuery, setSearchQuery] = useState('');
    const [isAskingAloa, setIsAskingAloa] = useState(false);
    const [activeSection, setActiveSection] = useState<string | null>(currentHistoryEntry.context?.activeSection || 'getting-started');
    const { togglePanel } = useAloa();
    const { isProperty, hasPropertyFeatures, hasLegalFeatures, isUnified } = useProduct();
    const assistantName = getAssistantName(isProperty);
    const assistantFullName = getAssistantFullName(isProperty);
    const accordionRef = useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (currentHistoryEntry.context?.activeSection) {
            setActiveSection(currentHistoryEntry.context.activeSection);
            setTimeout(() => {
                const element = document.getElementById(currentHistoryEntry.context!.activeSection);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 100);
        }
    }, [currentHistoryEntry.context?.activeSection]);

    const handleCardClick = (sectionId: string) => {
        setActiveSection(sectionId);
        setTimeout(() => {
            const element = document.getElementById(sectionId);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 100);
    };

    const handleAskAloa = () => {
        setIsAskingAloa(true);
        togglePanel();
        setTimeout(() => {
            const query = searchQuery.trim();
            const message = query
                ? `I searched the Help Center for "${query}" but couldn't find an answer. Can you help me with this?`
                : `I have a question about how to use PracticePro. `;
            const event = new CustomEvent('practicepro:inject-chat-context', {
                detail: { message }
            });
            window.dispatchEvent(event);
            setTimeout(() => setIsAskingAloa(false), 1000);
        }, 300);
    };

    // ─── Search filtering with clickable results ─────────────────────
    const hasSearch = searchQuery.trim().length > 0;
    const normalizedQuery = searchQuery.trim().toLowerCase();

    // Section metadata: id + title + subtitle + keywords for search matching.
    // Updated to reflect all current features. Obsolete sections removed;
    // new sections added for Messaging, Portals, Trust Accounting, etc.
    const SECTIONS = useMemo(() => [
        { id: 'getting-started', title: 'Getting Started: The Basics', subtitle: 'Dashboard, modules, and navigation', keywords: ['welcome', 'practicepro', 'modules', 'dashboard', 'overview', 'basics', 'navigation', 'sidebar'] },
        { id: 'aloa-tips', title: `Mastering ${assistantName} (AI Assistant)`, subtitle: 'Voice dictation, drafting, research, and daily briefings', keywords: ['ai', 'assistant', 'voice', 'dictation', 'briefing', 'rag', 'brain', 'chat', 'notetaker', 'recorder', assistantName.toLowerCase(), 'aromitse', 'aria'] },
        { id: 'notes-backlinks', title: 'Notes & Bidirectional Backlinks', subtitle: 'Link notes to matters, contacts, properties, and documents', keywords: ['notes', 'backlinks', 'bidirectional', 'link', 'endorsements', 'mention', 'notebook', '[['] },
        { id: 'draftpro-editor', title: 'DraftPro Document Editor', subtitle: 'AI drafting, watermarks, focus mode, zoom, line spacing', keywords: ['draftpro', 'editor', 'drafting', 'document', 'page', 'font', 'watermark', 'focus', 'zoom', 'spacing', 'ribbon', 'toolbar', 'placeholder', 'template', 'redraft', 'auto-format'] },
        { id: 'messaging', title: 'Messaging & Compose', subtitle: 'Conversations, notices, scheduled messages, bulk compose', keywords: ['messaging', 'messages', 'compose', 'whatsapp', 'email', 'notice', 'scheduled', 'ticket', 'conversation', 'inbox', 'resident', 'client', 'team'] },
        { id: 'admin-guide', title: 'Admin Guide & Settings', subtitle: 'Users, branding, letterhead, templates, portal access', keywords: ['admin', 'settings', 'users', 'branding', 'firm', 'logo', 'letterhead', 'workflow', 'template', 'portal', 'invite', 'permissions'] },
        { id: 'research-guide', title: 'Research Studio', subtitle: 'Chronology, legal matrix, gap analysis, audio briefings', keywords: ['research', 'chronology', 'case law', 'notebook', 'discovery', 'matrix', 'gap', 'audio', 'briefing'] },
        { id: 'aldia-analysis', title: 'ALDIA Document Analysis', subtitle: 'Risk scoring, metadata extraction, PII detection', keywords: ['aldia', 'document', 'analysis', 'risk', 'metadata', 'pii', 'ndpa', 'rpc', 'compliance', 'opposing counsel'] },
        { id: 'litigation-tracking', title: 'Litigation Tracking', subtitle: 'Court process pipeline: Preparation → Filing → Service → Proof', keywords: ['litigation', 'court', 'filing', 'deadline', 'process', 'pipeline', 'service', 'proof', 'court process'] },
        { id: 'property-management', title: 'Property Management', subtitle: 'Properties, rent, maintenance, leases, service charges', keywords: ['property', 'rent', 'resident', 'lease', 'maintenance', 'service charge', 'unit', 'tenant', 'landlord'] },
        { id: 'revenue-engine', title: 'Revenue Monitor (Atrium)', subtitle: 'Defaulter dashboard, ledger, automations, rent collection', keywords: ['revenue', 'monitor', 'defaulter', 'ledger', 'rent', 'collection', 'atrium', 'service charge', 'sce', 'automations'] },
        { id: 'portals', title: 'Client & Resident Portals', subtitle: 'Self-service portal for clients and residents', keywords: ['portal', 'client', 'resident', 'tenant', 'self-service', 'intake', 'access', 'invite', 'password'] },
        { id: 'trust-accounting', title: 'Trust Accounting', subtitle: 'Trust ledger, deposits, withdrawals, transfers', keywords: ['trust', 'accounting', 'ledger', 'deposit', 'withdrawal', 'transfer', 'escrow', 'client funds'] },
        { id: 'enterprise-jurisdiction', title: 'Enterprise Jurisdiction & Intake', subtitle: 'Procedural intelligence, party representation, intake wizard', keywords: ['enterprise', 'jurisdiction', 'intake', 'court rules', 'procedural', 'wizard', 'party', 'claimant', 'defendant'] },
        { id: 'ai-research-mode', title: `${assistantName} Research Mode & AI Engine`, subtitle: 'Auto/Flash/Pro/Research modes, web querying, citations, jurisdiction guardrails', keywords: ['research', 'mode', 'auto', 'flash', 'pro', 'engine', 'citation', 'jurisdiction', 'web', 'url', 'fetch', 'bluebook', 'oscola', 'nigerian', 'reasoning', 'thinking'] },
        { id: 'security-2fa', title: 'Security & 2FA', subtitle: 'Two-factor authentication, biometrics, lockout recovery, admin reset', keywords: ['security', '2fa', 'two-factor', 'biometric', 'fingerprint', 'face id', 'lockout', 'recovery', 'disable', 'admin', 'account'] },
    ], [assistantName]);

    // Filter sections based on search query
    const visibleSections = hasSearch
        ? SECTIONS.filter(s =>
            s.title.toLowerCase().includes(normalizedQuery) ||
            s.subtitle.toLowerCase().includes(normalizedQuery) ||
            s.keywords.some(k => k.includes(normalizedQuery))
        )
        : SECTIONS;

    const noResults = hasSearch && visibleSections.length === 0;

    // When searching, all visible sections are open
    const isSectionOpen = (sectionId: string) => {
        if (hasSearch) return visibleSections.some(s => s.id === sectionId);
        return activeSection === sectionId;
    };

    const handleSectionToggle = (sectionId: string) => {
        if (hasSearch) return;
        setActiveSection(activeSection === sectionId ? null : sectionId);
    };

    // Click a search result to jump to that section
    const handleResultClick = (sectionId: string) => {
        setActiveSection(sectionId);
        setSearchQuery(''); // Clear search so the accordion returns to normal mode
        setTimeout(() => {
            const element = document.getElementById(sectionId);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 150);
    };

    return (
        <div className="h-full overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-zinc-900 pb-32">
            <header className="sticky top-0 pt-safe z-30 glass flex-shrink-0 py-4 px-4 sm:px-6 lg:px-8 shadow-sm border-b border-slate-200 dark:border-zinc-700 flex justify-between items-center mb-10">
                <div>
                    <h2 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Help Center</h2>
                    <p className="text-xs font-medium text-slate-500 dark:text-zinc-400 mt-1">Find answers and master workflows.</p>
                </div>
            </header>

            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                <header className="mb-10 text-center">
                    <p className="text-slate-600 dark:text-zinc-400 mb-6 max-w-2xl mx-auto text-lg">
                        Find answers, master workflows, and learn how to get the most out of PracticePro.
                    </p>
                    <div className="max-w-lg mx-auto mb-3">
                        <div className="relative">
                            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input autoComplete="off" data-lpignore="true"
                                type="text"
                                placeholder="Search for help articles..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-12 pr-12 py-3 rounded-full border border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300"
                                    title="Clear search"
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Live search results — clickable list of matching articles.
                        As the user types, matching articles appear as clickable
                        cards. Clicking one clears the search and scrolls to that
                        section. This gives immediate visual feedback that the
                        search is working, and lets users jump directly to the
                        article they need. */}
                    {hasSearch && !noResults && (
                        <div className="max-w-lg mx-auto mt-3 text-left">
                            <p className="text-xs text-slate-500 dark:text-zinc-400 mb-2 text-center">
                                {visibleSections.length} article{visibleSections.length !== 1 ? 's' : ''} found — click to open:
                            </p>
                            <div className="space-y-1.5 max-h-64 overflow-y-auto custom-scrollbar">
                                {visibleSections.map(s => (
                                    <button
                                        key={s.id}
                                        onClick={() => handleResultClick(s.id)}
                                        className="w-full flex items-start gap-3 p-3 rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-sm transition-all text-left group"
                                    >
                                        <div className="w-8 h-8 rounded-full bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center flex-shrink-0 group-hover:bg-primary-100 dark:group-hover:bg-primary-900/40 transition-colors">
                                            <svg className="w-4 h-4 text-primary-600 dark:text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-4.5a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 9.75v4.5m15 0v3a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 17.25v-3m15 0H4.5" />
                                            </svg>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                                                {s.title}
                                            </p>
                                            <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">
                                                {s.subtitle}
                                            </p>
                                        </div>
                                        <svg className="w-4 h-4 text-slate-300 dark:text-zinc-600 group-hover:text-primary-400 flex-shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                        </svg>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    {noResults && (
                        <p className="text-xs text-slate-400 dark:text-zinc-500 mt-2">
                            No articles match "{searchQuery}"
                        </p>
                    )}
                    {!hasSearch && (
                        <p className="text-xs text-slate-400 dark:text-zinc-500 mt-2">
                            Searches PracticePro documentation only.
                        </p>
                    )}
                </header>

                {/* Quick Access Cards */}
                <div className="grid md:grid-cols-3 gap-6 mb-12">
                    <button
                        onClick={() => handleCardClick('getting-started')}
                        className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg border border-blue-100 dark:border-blue-800/50 hover:shadow-lg transition-all text-left group hover:-translate-y-1"
                    >
                        <div className="w-12 h-12 bg-blue-100 dark:bg-blue-800 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-200 mb-4 group-hover:scale-110 transition-transform">
                            <HelpCircleIcon className="w-6 h-6" />
                        </div>
                        <h3 className="font-bold text-lg mb-2 text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">Getting Started</h3>
                        <p className="text-sm text-slate-600 dark:text-zinc-400">New to PracticePro? Learn the basics of setting up your {isProperty ? 'agency' : 'firm'} and managing {isProperty ? 'properties' : 'cases'}.</p>
                    </button>

                    <button
                        onClick={() => handleCardClick('aloa-tips')}
                        className="bg-emerald-50 dark:bg-emerald-900/20 p-6 rounded-lg border border-emerald-100 dark:border-emerald-800/50 hover:shadow-lg transition-all text-left group hover:-translate-y-1"
                    >
                        <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-800 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-200 mb-4 group-hover:scale-110 transition-transform">
                            <ZapIcon className="w-6 h-6" />
                        </div>
                        <h3 className="font-bold text-lg mb-2 text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400">{assistantName} Tips</h3>
                        <p className="text-sm text-slate-600 dark:text-zinc-400">Master your AI assistant. Learn commands for drafting, research, and analysis.</p>
                    </button>

                    <button
                        onClick={() => handleCardClick('draftpro-editor')}
                        className="bg-amber-50 dark:bg-amber-900/20 p-6 rounded-lg border border-amber-100 dark:border-amber-800/50 hover:shadow-lg transition-all text-left group hover:-translate-y-1"
                    >
                        <div className="w-12 h-12 bg-amber-100 dark:bg-amber-800 rounded-full flex items-center justify-center text-amber-600 dark:text-amber-200 mb-4 group-hover:scale-110 transition-transform">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" /></svg>
                        </div>
                        <h3 className="font-bold text-lg mb-2 text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400">DraftPro</h3>
                        <p className="text-sm text-slate-600 dark:text-zinc-400">AI-powered document editor with watermarks, focus mode, and legal formatting.</p>
                    </button>
                </div>

                {/* Security & Access Architecture — quick link to the dedicated page */}
                <div className="mb-12">
                    <button
                        onClick={() => navigateTo('securityAccess')}
                        className="w-full bg-gradient-to-r from-slate-800 to-slate-900 dark:from-black dark:to-zinc-950 text-white p-6 rounded-lg border border-slate-700 dark:border-zinc-800 hover:shadow-xl transition-all text-left group hover:-translate-y-0.5 flex items-center gap-4"
                    >
                        <div className="w-12 h-12 bg-white/15 rounded-full flex items-center justify-center text-white flex-shrink-0 group-hover:scale-110 transition-transform">
                            <ShieldCheckIcon className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-lg mb-1 text-white">Security & Access Architecture</h3>
                            <p className="text-sm text-white/80">
                                Learn how access codes are generated, verified, and shipped as a product.
                                Understand the security model behind visitor management, data isolation, and audit trails.
                            </p>
                        </div>
                        <svg className="w-5 h-5 text-white/50 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </div>

                <div ref={accordionRef} className="bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-gray-200 dark:border-zinc-800 p-6 sm:p-8">
                    <Accordion>
                        <AccordionItem
                            id="getting-started"
                            title="Getting Started: The Basics"
                            isOpen={isSectionOpen('getting-started')}
                            onToggle={() => handleSectionToggle('getting-started')}
                        >
                            <div className="space-y-6">
                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-2">What is PracticePro?</h4>
                                    <p>{isProperty ? 'PracticePro is a Property Management System designed to help property agencies and real estate professionals' : 'PracticePro is a Legal Practice Management System designed to help law firms'} manage matters, documents, tasks, billing, and team collaboration — all in one place.</p>
                                </div>

                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-2">Three Products in One Platform</h4>
                                    <p className="mb-2 text-sm">PracticePro supports three product configurations:</p>
                                    <ul className="list-disc pl-5 space-y-1 text-sm text-slate-700 dark:text-zinc-300">
                                        <li><strong>Atrium</strong> — Property management only (properties, residents, rent, maintenance)</li>
                                        <li><strong>Vega</strong> — Legal practice only (matters, clients, court processes, document analysis)</li>
                                        <li><strong>Komplete</strong> — Both property management and legal practice combined</li>
                                    </ul>
                                    <p className="mt-2 text-xs text-slate-500 dark:text-zinc-400">The app adapts its labels and features based on your product. For example, Atrium firms see "Properties" in the nav, Vega firms see "Matters", and Komplete firms see both.</p>
                                </div>

                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-2">Modules & How They Connect</h4>
                                    <ul className="list-disc pl-5 space-y-1 marker:text-primary-500">
                                        <li><strong>Dashboard:</strong> Quick view of active {isProperty ? 'properties' : 'matters'}, your tasks, upcoming deadlines, and recent activity.</li>
                                        <li><strong>{isProperty ? 'Properties' : 'Matters'}:</strong> Central hub for {isProperty ? 'property details' : 'case details'}. Track progress, view documents, tasks, notes, and endorsements.</li>
                                        <li><strong>Contacts:</strong> Universal across all products — manages {hasLegalFeatures ? ' clients, opposing counsel' : ''}{hasPropertyFeatures ? ' landlords, residents, vendors' : ''} and team members.</li>
                                        <li><strong>Tasks:</strong> Assign, track, and complete tasks on a drag-and-drop board.</li>
                                        <li><strong>Documents:</strong> Upload, organize, and {hasLegalFeatures ? 'analyze' : 'manage'} documents. Link to {hasLegalFeatures && hasPropertyFeatures ? 'matters or properties' : isProperty ? 'properties' : 'matters'}.</li>
                                        <li><strong>Research Studio <span className="text-3xs px-1 bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 rounded">BETA</span>:</strong> AI-powered workspace for {isProperty ? 'analyzing property documents and generating reports' : 'analyzing case files, generating chronologies, and preparing legal arguments'}.</li>
                                        <li><strong>Calendar:</strong> {isProperty ? 'Track inspections, rent reviews, and meetings' : 'Track court dates, filing deadlines, and client meetings'}. Includes property events for Komplete firms.</li>
                                        <li><strong>Messaging:</strong> Unified inbox for team chat, WhatsApp/email from residents, and notices.</li>
                                        <li><strong>DraftPro:</strong> Built-in document editor with AI drafting, watermarks, and formatting tools.</li>
                                        <li><strong>Billing:</strong> Record billable time, generate invoices, and manage payments.</li>
                                    </ul>
                                </div>
                            </div>
                        </AccordionItem>

                        <AccordionItem
                            id="aloa-tips"
                            title={`Mastering ${assistantName} (AI Assistant)`}
                            isOpen={isSectionOpen('aloa-tips')}
                            onToggle={() => handleSectionToggle('aloa-tips')}
                        >
                            <div className="space-y-6">
                                <div className="flex items-start gap-4 bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-lg">
                                    <ZapIcon className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-1" />
                                    <div>
                                        <h4 className="font-bold text-emerald-800 dark:text-emerald-200">What is {assistantName}?</h4>
                                        <p className="text-emerald-700 dark:text-emerald-300 text-sm mt-1">{assistantName} is your AI-powered {isProperty ? 'assistant and portfolio manager' : 'paralegal and practice manager'}. It drafts documents, checks team schedules, takes dictation notes, and organizes your {isProperty ? 'agency' : 'firm'}'s data.</p>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="font-bold text-lg mb-2">Key Capabilities</h4>
                                    <ul className="grid sm:grid-cols-2 gap-4">
                                        <li className="p-3 border border-slate-200 dark:border-zinc-700 rounded-lg">
                                            <strong className="block mb-1 text-primary-600">Team Scheduling</strong>
                                            "Who is free next week for a meeting?"
                                        </li>
                                        <li className="p-3 border border-slate-200 dark:border-zinc-700 rounded-lg">
                                            <strong className="block mb-1 text-primary-600">Task Delegation</strong>
                                            "Create a task for John to trace the title documents."
                                        </li>
                                        <li className="p-3 border border-slate-200 dark:border-zinc-700 rounded-lg">
                                            <strong className="block mb-1 text-primary-600">Contextual Insight</strong>
                                            "What do I have to do in this matter?" (While viewing a matter)
                                        </li>
                                        <li className="p-3 border border-slate-200 dark:border-zinc-700 rounded-lg">
                                            <strong className="block mb-1 text-primary-600">Drafting</strong>
                                            {isProperty ? '"Draft a notice to the resident regarding lease renewal terms."' : '"Draft a letter to the opposing counsel for adjournment."'}
                                        </li>
                                    </ul>
                                </div>

                                <div>
                                    <h4 className="font-bold text-lg mb-2">The Integrated Note Taker (Voice Dictation)</h4>
                                    <p className="mb-2">{assistantName} includes a powerful dictation engine for note-taking directly within its chat panel.</p>
                                    <ul className="list-disc pl-5 space-y-1 text-sm text-slate-700 dark:text-zinc-300">
                                        <li><strong>Voice Dictation:</strong> Click the microphone icon to record your thoughts — speech is transcribed into text automatically.</li>
                                        <li><strong>Append, Don't Overwrite:</strong> As you speak, transcribed text is appended to your note (not replaced). Keep talking — your words build up naturally.</li>
                                        <li><strong>Quick Save:</strong> Use the "Save to Matter" feature to instantly store your typed or dictated memo into a Matter's Endorsements tab or a notebook.</li>
                                        <li><strong>Zero Layout Shift:</strong> Open {assistantName} securely over any screen, take your voice notes, and close it without losing your place in the app.</li>
                                    </ul>
                                    <p className="mt-2 text-xs text-slate-500 dark:text-zinc-400">Note: Voice dictation requires microphone permission. On the Android app, you'll see a permission dialog the first time you tap the mic. On web, your browser will prompt for mic access.</p>
                                </div>

                                <div>
                                    <h4 className="font-bold text-lg mb-2">{isProperty ? "Portfolio Brain (RAG)" : "Firm-Wide Brain (RAG)"}</h4>
                                    <p className="text-sm">{assistantName} constantly {isProperty ? "reads your portfolio documents and delivers localized answers" : "reads your firm's case files and delivers localized legal answers"}. You can search across your knowledge base simply by chatting with it, and it will cross-reference your specific uploaded documents to generate accurate results.</p>
                                </div>

                                <div>
                                    <h4 className="font-bold text-lg mb-2">On-Demand Briefings</h4>
                                    <p className="text-sm">Get an instant snapshot of your practice. Ask {assistantName} "Give me a daily briefing" to receive your urgent tasks, {isProperty ? 'upcoming inspections and deadlines' : 'upcoming court appearances'}, financial highlights, and recent notes securely packaged together.</p>
                                </div>

                                <div>
                                    <h4 className="font-bold text-lg mb-2">File Attachments in Chat</h4>
                                    <p className="text-sm">You can attach documents, images, and PDFs directly in your chat with {assistantName}. The AI will analyze the attached file and answer questions about its contents. Attachments appear as thumbnails or file chips in the chat.</p>
                                </div>
                            </div>
                        </AccordionItem>

                        <AccordionItem
                            id="notes-backlinks"
                            title="Notes & Bidirectional Backlinks"
                            isOpen={isSectionOpen('notes-backlinks')}
                            onToggle={() => handleSectionToggle('notes-backlinks')}
                        >
                            <div className="space-y-4 text-slate-600 dark:text-zinc-300">
                                <div>
                                    <h4 className="font-bold text-lg mb-2">Notes & Endorsements</h4>
                                    <p className="text-sm mb-2">Notes are free-form text entries you can create from several places:</p>
                                    <ul className="list-disc pl-5 space-y-1 text-sm">
                                        <li><strong>Notes view</strong> — standalone notes organized into notebooks</li>
                                        <li><strong>Matter Endorsements tab</strong> — notes attached to a specific matter (team discussion, case strategy, etc.)</li>
                                        <li><strong>Save to Note form</strong> — capture voice-dictated or typed notes from the AI assistant</li>
                                    </ul>
                                </div>

                                <div>
                                    <h4 className="font-bold text-lg mb-2">Bidirectional Backlinks — Linking Notes to Entities</h4>
                                    <p className="text-sm mb-2">
                                        Backlinks let you connect notes to matters, contacts, properties, and documents without leaving the note. When you mention an entity in a note using the <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 font-mono text-xs">[[Entity Name]]</code> syntax, two things happen automatically:
                                    </p>
                                    <ul className="list-disc pl-5 space-y-1 text-sm mb-3">
                                        <li>The entity name becomes a clickable link inside the note</li>
                                        <li>A <strong>"Mentioned In"</strong> panel appears on that entity's detail page, listing every note that references it</li>
                                    </ul>
                                    <p className="text-sm mb-2"><strong>How to create a backlink:</strong></p>
                                    <ol className="list-decimal pl-5 space-y-1 text-sm mb-3">
                                        <li>Open any note (in the Notes view, a Matter's Endorsements tab, or the Save to Note form)</li>
                                        <li>Type two open brackets: <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 font-mono text-xs">[[</code></li>
                                        <li>Type the name of the matter, contact, property, or document you want to link to</li>
                                        <li>Close with two closing brackets: <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 font-mono text-xs">]]</code></li>
                                    </ol>
                                    <div className="bg-slate-50 dark:bg-zinc-800 rounded-lg p-3 text-sm border border-slate-200 dark:border-zinc-700 mb-3">
                                        <p className="font-mono text-xs text-slate-500 dark:text-zinc-400 mb-1">Example in a note:</p>
                                        <p className="text-sm">Discussed the claim in [[Adegbenro v. State Bank of Nigeria]] with [[John Doe]] today. Need to review the [[Lease Agreement - Lekki Phase 1]] before the hearing.</p>
                                    </div>
                                    <p className="text-sm mb-2"><strong>Where to find the "Mentioned In" panel:</strong></p>
                                    <ul className="list-disc pl-5 space-y-1 text-sm">
                                        <li><strong>Matter detail page</strong> → Endorsements tab → scroll to the bottom</li>
                                        <li><strong>Contact detail page</strong> → bottom of the page</li>
                                        <li><strong>Property detail page</strong> → bottom of the page</li>
                                        <li><strong>Document detail page</strong> → bottom of the page</li>
                                    </ul>
                                    <p className="text-sm mt-3 text-slate-500 dark:text-zinc-400">
                                        The panel also has a <strong>?</strong> help button you can click for a quick reminder of the syntax. If no notes mention the entity yet, the panel shows an example of how to create one.
                                    </p>
                                </div>
                            </div>
                        </AccordionItem>

                        <AccordionItem
                            id="draftpro-editor"
                            title={
                                <div className="flex items-center gap-2">
                                    DraftPro Document Editor
                                    <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-3xs text-amber-700 dark:text-amber-400 font-bold uppercase tracking-wider">Beta</span>
                                </div>
                            }
                            isOpen={isSectionOpen('draftpro-editor')}
                            onToggle={() => handleSectionToggle('draftpro-editor')}
                        >
                            <div className="space-y-6">
                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-2">What is DraftPro?</h4>
                                    <p>DraftPro is PracticePro's built-in {isProperty ? 'document editor' : 'legal document editor'} with AI-powered drafting assistance. Create professional {isProperty ? 'documents' : 'legal documents'} without leaving the app — then save to a {isProperty ? 'property' : 'matter'}, print, or copy to your preferred word processor.</p>
                                </div>

                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-2">Key Features</h4>
                                    <ul className="list-disc pl-5 space-y-1 text-sm">
                                        <li><strong>Rich Text Editing:</strong> Format text, add lists, tables, and headers with the MS Word-style ribbon toolbar</li>
                                        <li><strong>AI Drafting:</strong> Use {assistantName} to generate entire documents from a prompt — text streams live onto the page</li>
                                        <li><strong>AI Redraft:</strong> Regenerate an existing document with improvement instructions. Your previous content is saved automatically and can be restored if the redraft doesn't meet your needs</li>
                                        <li><strong>Auto-Format:</strong> {!isProperty ? 'Apply Nigerian legal formatting rules (uppercase headings, numbered paragraphs) with one click' : 'Apply formatting rules with one click'}</li>
                                        <li><strong>Placeholder Guardrails:</strong> Printing is blocked until every blank placeholder is filled — so you never accidentally send an incomplete document</li>
                                        <li><strong>Smart Fill:</strong> Auto-fill all placeholders from matter/property data with one click</li>
                                        <li><strong>Template System:</strong> Start from pre-built {isProperty ? 'professional templates' : 'legal templates'} or save your own</li>
                                        <li><strong>Watermarks:</strong> Add DRAFT, CONFIDENTIAL, WITHOUT PREJUDICE, or PRIVATE & CONFIDENTIAL watermarks to every page</li>
                                        <li><strong>Page Numbers:</strong> Fully configurable — toggle on/off, choose position (center/right/left), format (Page X of Y, Page X, -X-, X only), and starting page number</li>
                                        <li><strong>Focus Mode:</strong> Press <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 font-mono text-xs">F11</code> to hide the ribbon for distraction-free drafting</li>
                                        <li><strong>Line Spacing:</strong> Single (1.0), 1.5, or Double (2.0) spacing — applies to the entire document</li>
                                        <li><strong>Zoom Presets:</strong> Choose from 50%–200% presets, or use <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 font-mono text-xs">Ctrl+=</code> / <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 font-mono text-xs">Ctrl+-</code> / <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 font-mono text-xs">Ctrl+0</code> keyboard shortcuts</li>
                                        <li><strong>True Page Pagination:</strong> A4 page sheets with real page breaks, page numbers, and letterhead support</li>
                                        <li><strong>Letterhead Designer:</strong> Design your firm's letterhead with logo, firm name, and address — appears on every page</li>
                                        <li><strong>Print Preview:</strong> Click the Preview button to see a live A4 print-ready preview with margins, typography, and page breaks before printing</li>
                                        <li><strong>DOCX Export:</strong> Download your document as a .docx file that opens in Microsoft Word or Google Docs — formatting is preserved</li>
                                        <li><strong>Auto-Save:</strong> Your work is saved automatically as you type</li>
                                        <li><strong>Export Options:</strong> Print to PDF, export as DOCX, or copy to Word/Google Docs with formatting preserved</li>
                                    </ul>
                                </div>

                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-2">Keyboard Shortcuts</h4>
                                    <div className="grid sm:grid-cols-2 gap-2 text-sm">
                                        <div className="flex items-center gap-2"><kbd className="px-2 py-1 text-xs bg-slate-100 dark:bg-zinc-800 rounded border border-slate-300 dark:border-zinc-600">Ctrl+S</kbd> Save</div>
                                        <div className="flex items-center gap-2"><kbd className="px-2 py-1 text-xs bg-slate-100 dark:bg-zinc-800 rounded border border-slate-300 dark:border-zinc-600">Ctrl+Enter</kbd> Page Break</div>
                                        <div className="flex items-center gap-2"><kbd className="px-2 py-1 text-xs bg-slate-100 dark:bg-zinc-800 rounded border border-slate-300 dark:border-zinc-600">Ctrl+=</kbd> Zoom In</div>
                                        <div className="flex items-center gap-2"><kbd className="px-2 py-1 text-xs bg-slate-100 dark:bg-zinc-800 rounded border border-slate-300 dark:border-zinc-600">Ctrl+-</kbd> Zoom Out</div>
                                        <div className="flex items-center gap-2"><kbd className="px-2 py-1 text-xs bg-slate-100 dark:bg-zinc-800 rounded border border-slate-300 dark:border-zinc-600">Ctrl+0</kbd> Reset Zoom</div>
                                        <div className="flex items-center gap-2"><kbd className="px-2 py-1 text-xs bg-slate-100 dark:bg-zinc-800 rounded border border-slate-300 dark:border-zinc-600">F11</kbd> Focus Mode</div>
                                        <div className="flex items-center gap-2"><kbd className="px-2 py-1 text-xs bg-slate-100 dark:bg-zinc-800 rounded border border-slate-300 dark:border-zinc-600">Esc</kbd> Close Modal</div>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-2">How to Use</h4>
                                    <ol className="list-decimal pl-5 space-y-2 marker:text-slate-500">
                                        <li>Click <strong>DraftPro</strong> in the Documents page to open the editor.</li>
                                        <li>Choose a template or start from scratch.</li>
                                        <li>Use the ribbon toolbar for formatting, or click <strong>Redraft</strong> in the DraftPro AI group to generate content with AI.</li>
                                        <li>Fill any placeholder blanks using <strong>Smart Fill</strong> — printing is blocked until they are all resolved.</li>
                                        <li>Add a watermark (DRAFT, CONFIDENTIAL, etc.) from the File group if needed.</li>
                                        <li>When finished, save to a {isProperty ? 'property' : 'matter'}, print to PDF, or copy and paste into your preferred word processor. Bold, italic, underline, and font formatting are preserved.</li>
                                    </ol>
                                </div>

                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-2">Copying to Word or Google Docs</h4>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Select the text you want, copy it (Ctrl+C / Cmd+C), and paste directly into Word or Google Docs. Your formatting — bold, italic, underline, font family, and font size — is carried over cleanly. No need to use "Paste Plain Text" — just paste normally.</p>
                                </div>
                            </div>
                        </AccordionItem>

                        <AccordionItem
                            id="messaging"
                            title="Messaging & Compose"
                            isOpen={isSectionOpen('messaging')}
                            onToggle={() => handleSectionToggle('messaging')}
                        >
                            <div className="space-y-6">
                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-2">Unified Messaging</h4>
                                    <p className="text-sm mb-2">The Messages page is your unified inbox for all communications:</p>
                                    <ul className="list-disc pl-5 space-y-1 text-sm">
                                        <li><strong>Conversations:</strong> Two-way chat threads with {hasLegalFeatures ? 'clients' : ''} {hasLegalFeatures && hasPropertyFeatures ? 'and ' : ''}{hasPropertyFeatures ? 'residents' : ''} via the portal</li>
                                        {hasPropertyFeatures && <li><strong>WhatsApp & Email Inbox:</strong> Inbound messages from residents via WhatsApp and email appear here for response</li>}
                                        <li><strong>Notices:</strong> Post announcements visible to {hasPropertyFeatures ? 'residents' : 'clients'} on their portal</li>
                                        <li><strong>Scheduled:</strong> View and manage scheduled/automated messages</li>
                                    </ul>
                                </div>

                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-2">Compose Modal (Bulk Messaging)</h4>
                                    <p className="text-sm mb-2">The Compose button opens a powerful messaging composer that adapts to your product:</p>
                                    <ul className="list-disc pl-5 space-y-1 text-sm">
                                        {hasLegalFeatures && <li><strong>Clients tab:</strong> Send to legal clients (hidden for pure property firms)</li>}
                                        {hasPropertyFeatures && <li><strong>Residents tab:</strong> Send to residents/tenants (hidden for pure legal firms)</li>}
                                        <li><strong>Team tab:</strong> Send to internal team members</li>
                                        <li><strong>Message Templates:</strong> {hasPropertyFeatures ? 'Rent reminders, late notices, payment receipts, lease renewals, maintenance updates' : 'Custom messages, document requests, appointment reminders'}</li>
                                        <li><strong>Channels:</strong> WhatsApp, Email, or Portal notification</li>
                                        <li><strong>Bulk Send:</strong> Each recipient gets a personalized message — use "Select All" to message everyone at once</li>
                                    </ul>
                                </div>

                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-2">Role Filter</h4>
                                    <p className="text-sm">The conversation list has role filter pills that adapt to your product:</p>
                                    <ul className="list-disc pl-5 space-y-1 text-sm">
                                        {hasLegalFeatures && <li><strong>Vega/Komplete:</strong> All + Clients (no Residents pill for pure legal firms)</li>}
                                        {hasPropertyFeatures && <li><strong>Atrium/Komplete:</strong> All + Residents (no Clients pill for pure property firms)</li>}
                                        {isUnified && <li><strong>Komplete:</strong> All three pills — Clients, Residents, and Team</li>}
                                    </ul>
                                </div>
                            </div>
                        </AccordionItem>

                        <AccordionItem
                            id="admin-guide"
                            title="Admin Guide & Settings"
                            isOpen={isSectionOpen('admin-guide')}
                            onToggle={() => handleSectionToggle('admin-guide')}
                        >
                            <div className="space-y-6">
                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-2">Firm Settings</h4>
                                    <p className="text-sm">Access via <strong>Settings</strong> in the sidebar. Key sections:</p>
                                    <ul className="list-disc pl-5 space-y-1 text-sm mt-2">
                                        <li><strong>Profile:</strong> Your personal preferences and defaults</li>
                                        <li><strong>Firm Details:</strong> Firm name, address, logo, letterhead designer, AI settings (API key)</li>
                                        <li><strong>Subscription:</strong> Plan management and billing</li>
                                        <li><strong>Security:</strong> Two-factor authentication, session management</li>
                                        <li><strong>Templates:</strong> Document templates and clause library</li>
                                        <li><strong>Portal Access:</strong> {hasLegalFeatures ? 'Client Portal' : ''} {hasLegalFeatures && hasPropertyFeatures ? 'and ' : ''}{hasPropertyFeatures ? 'Resident Portal' : ''} invites and settings</li>
                                        <li><strong>Agents:</strong> AI agent configuration</li>
                                    </ul>
                                </div>

                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-2">Inviting Team Members</h4>
                                    <ol className="list-decimal pl-5 space-y-1 text-sm">
                                        <li>Go to Settings → scroll to the Users section</li>
                                        <li>Click "Add User" — enter their name and email</li>
                                        <li>Share the invite code with them, or they'll receive an email</li>
                                        <li>They authenticate using their email and set up a password</li>
                                        <li>Assign their role: {isProperty ? 'Manager, Staff, or Portfolio Administrator' : 'Lawyer, Paralegal, or Firm Administrator'}</li>
                                    </ol>
                                </div>

                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-2">Letterhead Designer</h4>
                                    <p className="text-sm">Design your firm's letterhead in Settings → Firm Details → Letterhead. Add your logo, firm name, and address. The letterhead appears on every page when printing from DraftPro.</p>
                                </div>

                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-2">AI API Key</h4>
                                    <p className="text-sm">To use AI features (drafting, analysis, voice dictation), configure your Gemini API key in Settings → Firm Details → AI Settings. You can get a free key from Google AI Studio. The key is stored securely and used for all AI operations across the app.</p>
                                </div>
                            </div>
                        </AccordionItem>

                        <AccordionItem
                            id="research-guide"
                            title="Research Studio"
                            isOpen={isSectionOpen('research-guide')}
                            onToggle={() => handleSectionToggle('research-guide')}
                        >
                            <div className="space-y-6">
                                <div className="flex items-start gap-4 bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg">
                                    <SparklesIcon className="w-6 h-6 text-amber-600 flex-shrink-0 mt-1" />
                                    <div>
                                        <h4 className="font-bold text-amber-800 dark:text-amber-200">What is Research Studio?</h4>
                                        <p className="text-amber-700 dark:text-amber-300 text-sm mt-1">{isProperty ? 'An AI-powered workspace for analyzing property documents, generating reports, and preparing management briefs.' : 'An AI-powered workspace for analyzing case files, generating chronologies, and preparing legal arguments.'}</p>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-2">Research Notebooks</h4>
                                    <p className="text-sm">Organize your research into notebooks. Each notebook can contain sources (documents, web pages, case law), analysis, and AI-generated insights.</p>
                                </div>

                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-2">Key Features</h4>
                                    <ul className="list-disc pl-5 space-y-1 text-sm">
                                        <li><strong>Chronology Builder:</strong> Automatically generate a timeline of events from your documents</li>
                                        {!isProperty && <li><strong>Legal Matrix:</strong> Maps facts found in your documents to legal elements (IRAC format)</li>}
                                        {!isProperty && <li><strong>Discovery Gaps:</strong> Analyzes your file to identify missing evidence or logical inconsistencies</li>}
                                        <li><strong>Audio Briefing:</strong> Generates a podcast-style {isProperty ? 'audio summary of your documents' : 'audio summary of your case file'} for listening on the go</li>
                                        <li><strong>Source Management:</strong> Upload and organize source documents within each notebook</li>
                                    </ul>
                                </div>
                            </div>
                        </AccordionItem>

                        <AccordionItem
                            id="aldia-analysis"
                            title="ALDIA Document Analysis"
                            isOpen={isSectionOpen('aldia-analysis')}
                            onToggle={() => handleSectionToggle('aldia-analysis')}
                        >
                            <div className="space-y-6">
                                <div className="flex items-start gap-4 bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg">
                                    <SparklesIcon className="w-6 h-6 text-indigo-600 flex-shrink-0 mt-1" />
                                    <div>
                                        <h4 className="font-bold text-indigo-800 dark:text-indigo-200">What is ALDIA?</h4>
                                        <p className="text-indigo-700 dark:text-indigo-300 text-sm mt-1">{isProperty ? 'ALDIA (Advanced Legal Document Intelligence Agent) analyzes your property documents' : 'ALDIA (Advanced Legal Document Intelligence Agent) analyzes your legal documents'} for risk, compliance, and key metadata extraction.</p>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-2">How to Use</h4>
                                    <ol className="list-decimal pl-5 space-y-2 marker:text-slate-500">
                                        <li>Navigate to <strong>Documents</strong> and select any document.</li>
                                        <li>Click the <strong>ALDIA Analysis</strong> tab in the document detail view.</li>
                                        <li>Click <strong>Analyze Document</strong> to start the AI analysis.</li>
                                        <li>Review the executive summary, risk scores, and extracted metadata.</li>
                                    </ol>
                                </div>

                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-2">Analysis Features</h4>
                                    <ul className="list-disc pl-5 space-y-1 text-sm">
                                        <li><strong>Risk Analysis:</strong> {isProperty ? 'Commercial, compliance, and operational risk scores' : 'Legal, commercial, compliance, and operational risk scores'} (1-10)</li>
                                        <li><strong>Metadata Extraction:</strong> {isProperty ? 'Parties, dates, and key terms' : 'Parties, dates, governing law, jurisdiction'}</li>
                                        <li><strong>{isProperty ? 'Stakeholder Detection' : 'Opposing Counsel Detection'}:</strong> Automatically extracts {isProperty ? 'stakeholder' : 'opposing counsel'} contact information for quick saving</li>
                                        <li><strong>Data Protection:</strong> Identifies PII and assesses data protection compliance</li>
                                        {!isProperty && <li><strong>RPC Guardian:</strong> Ethical compliance check against professional conduct rules</li>}
                                    </ul>
                                </div>

                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-2">Save {isProperty ? 'Stakeholder' : 'Opposing Counsel'}</h4>
                                    <p>When ALDIA detects {isProperty ? 'stakeholder' : 'opposing counsel'} contact information in a document, you'll see a <strong>"Save to Contacts"</strong> button. Click it to automatically create a contact with the extracted details.</p>
                                </div>
                            </div>
                        </AccordionItem>

                        {hasLegalFeatures && <AccordionItem
                            id="litigation-tracking"
                            title="Litigation Tracking"
                            isOpen={isSectionOpen('litigation-tracking')}
                            onToggle={() => handleSectionToggle('litigation-tracking')}
                        >
                            <div className="space-y-6">
                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-2">Overview</h4>
                                    <p>Track the status of court processes throughout their lifecycle from preparation to proof of service.</p>
                                </div>

                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-2">Document Status Pipeline</h4>
                                    <ul className="space-y-2">
                                        <li className="p-3 border-l-4 border-slate-400 bg-slate-50 dark:bg-slate-800 rounded-r">
                                            <strong>1. Preparation:</strong> Document is being drafted and prepared
                                        </li>
                                        <li className="p-3 border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-900/20 rounded-r">
                                            <strong>2. Filing:</strong> Document has been filed at court
                                        </li>
                                        <li className="p-3 border-l-4 border-orange-500 bg-orange-50 dark:bg-orange-900/20 rounded-r">
                                            <strong>3. Service:</strong> Document has been served on the opposing party
                                        </li>
                                        <li className="p-3 border-l-4 border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 rounded-r">
                                            <strong>4. Proof of Service:</strong> Proof of service has been filed
                                        </li>
                                    </ul>
                                </div>

                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-2">How to Track</h4>
                                    <ol className="list-decimal pl-5 space-y-2 marker:text-slate-500">
                                        <li>Mark a document as a <strong>Court Process</strong> when creating/editing it (toggle in the document form).</li>
                                        <li>Navigate to the document detail view and select the <strong>Litigation Pipeline</strong> tab.</li>
                                        <li>Click the status buttons to update the document's progress through the pipeline.</li>
                                        <li>The visual timeline will update automatically.</li>
                                    </ol>
                                </div>

                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-2">Filing Deadlines</h4>
                                    <p className="text-sm">When you mark a document as a court process, the app automatically calculates filing deadlines based on the court's procedural rules. These appear in your Calendar and on the Dashboard.</p>
                                </div>
                            </div>
                        </AccordionItem>}

                        {hasPropertyFeatures && <AccordionItem
                            id="property-management"
                            title="Property Management"
                            isOpen={isSectionOpen('property-management')}
                            onToggle={() => handleSectionToggle('property-management')}
                        >
                            <div className="space-y-6">
                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-2">Managing Properties</h4>
                                    <p>Track properties owned by clients or linked to matters including rental properties, disputed land, and properties for sale. Each property has units (individual apartments/office spaces) that can be leased to residents.</p>
                                </div>

                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-2">Property Tracking Features</h4>
                                    <ul className="list-disc pl-5 space-y-1 text-sm">
                                        <li><strong>Rent Payment History:</strong> Track rent payments, due dates, and overdue amounts per unit</li>
                                        <li><strong>Maintenance Records:</strong> Log and track property maintenance issues with status tracking</li>
                                        <li><strong>Lease Expiry Alerts:</strong> Get notified before leases expire</li>
                                        <li><strong>Service Charge Tracking:</strong> Track service charge equivalent (SCE) costs for maintenance, security, and utilities</li>
                                        <li><strong>Event Timeline:</strong> Visual timeline of all property-related events</li>
                                        <li><strong>Minimum Vend:</strong> Track minimum electricity purchase requirements per unit</li>
                                    </ul>
                                </div>

                                <div className="space-y-1">
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-2">Property Automations</h4>
                                    <p className="mb-2 text-sm">Set up automatic notifications in <strong>Settings → Automation</strong> or via the Revenue Monitor:</p>
                                    <ul className="list-disc pl-5 space-y-1 text-sm">
                                        <li>Rent due reminders (7 days before)</li>
                                        <li>Lease expiry warnings (60 days before)</li>
                                        <li>Maintenance task auto-creation</li>
                                        <li>Rent overdue follow-ups (after grace period)</li>
                                        <li>Service charge alerts</li>
                                    </ul>
                                </div>

                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-2">Document Linking</h4>
                                    <p className="text-sm">When creating a new document, you can link it to both a matter (legal case) AND a property. For Komplete firms, both dropdowns appear. For pure Atrium firms, only the Property dropdown appears.</p>
                                </div>
                            </div>
                        </AccordionItem>}

                        {hasPropertyFeatures && <AccordionItem
                            id="revenue-engine"
                            title={
                                <div className="flex items-center gap-2">
                                    Revenue Monitor (Atrium)
                                </div>
                            }
                            isOpen={isSectionOpen('revenue-engine')}
                            onToggle={() => handleSectionToggle('revenue-engine')}
                        >
                            <div className="space-y-6">
                                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-100 dark:border-emerald-800/30">
                                    <h4 className="font-bold text-emerald-900 dark:text-emerald-100 mb-2 flex items-center gap-2 text-lg">
                                        <ShieldCheckIcon className="w-5 h-5" />
                                        The Philosophy of Atrium
                                    </h4>
                                    <p className="text-emerald-800 dark:text-emerald-200 text-sm leading-relaxed">
                                        Atrium isn't just property management; it's a <strong>Revenue Monitor</strong>. It is designed to secure landlord cash flow by treating every unit as a critical financial asset. The monitor enforces payment discipline through transparency and automated oversight.
                                    </p>
                                </div>

                                <div className="grid sm:grid-cols-2 gap-4">
                                    <div className="p-4 border border-slate-200 dark:border-zinc-700 rounded-lg">
                                        <h5 className="font-bold text-slate-900 dark:text-white mb-2">Immutable Ledger</h5>
                                        <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                                            Every rent collection and service charge payment is recorded in an immutable ledger with unique transaction hashes. This prevents record tampering and ensures audit-grade financial clarity for property owners.
                                        </p>
                                    </div>
                                    <div className="p-4 border border-slate-200 dark:border-zinc-700 rounded-lg">
                                        <h5 className="font-bold text-slate-900 dark:text-white mb-2">Defaulter Dashboard</h5>
                                        <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                                            Identify revenue at risk instantly. The dashboard highlights residents who have crossed the grace period, allowing managers to trigger recovery processes or restriction notices with one click.
                                        </p>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="font-bold text-lg text-slate-800 dark:text-white mb-3">Core Workflows</h4>
                                    <div className="space-y-3">
                                        <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-zinc-800/50 rounded-lg">
                                            <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/30 rounded flex items-center justify-center text-blue-600 dark:text-blue-400 text-2xs font-bold shrink-0">01</div>
                                            <div>
                                                <strong className="block text-sm text-slate-900 dark:text-zinc-100">Rent Synchronization</strong>
                                                <p className="text-xs text-slate-500 dark:text-zinc-400">Link resident payments to bank statements. The engine automatically reconciles deposits and marks periods as 'Paid' or 'Defaulted'.</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-zinc-800/50 rounded-lg">
                                            <div className="w-6 h-6 bg-emerald-100 dark:bg-emerald-900/30 rounded flex items-center justify-center text-emerald-600 dark:text-emerald-400 text-2xs font-bold shrink-0">02</div>
                                            <div>
                                                <strong className="block text-sm text-slate-900 dark:text-zinc-100">SCE Tracking (Service Charge Equivalent)</strong>
                                                <p className="text-xs text-slate-500 dark:text-zinc-400">Break down maintenance and utility costs into the SCE framework. This allows you to justify resident contributions based on real-time operational expenses like security and cleaning.</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-zinc-800/50 rounded-lg">
                                            <div className="w-6 h-6 bg-purple-100 dark:bg-purple-900/30 rounded flex items-center justify-center text-purple-600 dark:text-purple-400 text-2xs font-bold shrink-0">03</div>
                                            <div>
                                                <strong className="block text-sm text-slate-900 dark:text-zinc-100">Automated Bridge</strong>
                                                <p className="text-xs text-slate-500 dark:text-zinc-400">Connect the engine to WhatsApp and SMS. The Atrium Bridge sends rent reminders before due dates and escalating late notices if the grace period expires.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-4 p-4 border-l-4 border-amber-500 bg-amber-50 dark:bg-amber-900/10 rounded-r-xl">
                                    <p className="text-xs text-amber-800 dark:text-amber-200">
                                        <strong>Pro Tip:</strong> Use the 'Revenue Monitor' navigation tab to see a firm-wide view of all properties. If the shield icon turns red, you have critical defaulters requiring immediate attention.
                                    </p>
                                </div>
                            </div>
                        </AccordionItem>}

                        <AccordionItem
                            id="portals"
                            title="Client & Resident Portals"
                            isOpen={isSectionOpen('portals')}
                            onToggle={() => handleSectionToggle('portals')}
                        >
                            <div className="space-y-6">
                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-2">Self-Service Portals</h4>
                                    <p className="text-sm">PracticePro includes self-service portals for your {hasLegalFeatures ? 'clients' : ''} {hasLegalFeatures && hasPropertyFeatures ? 'and ' : ''}{hasPropertyFeatures ? 'residents' : ''} to access information and interact with your {isProperty ? 'agency' : 'firm'} without needing to call or email.</p>
                                </div>

                                {hasLegalFeatures && (
                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-2">Client Portal</h4>
                                    <ul className="list-disc pl-5 space-y-1 text-sm">
                                        <li><strong>Case Tracking:</strong> Clients can view the status of their matters</li>
                                        <li><strong>Document Access:</strong> View documents shared with them by the firm</li>
                                        <li><strong>Invoices & Billing:</strong> View and pay invoices online</li>
                                        <li><strong>Messaging:</strong> Send messages to the firm directly from the portal</li>
                                        <li><strong>Intake:</strong> New clients can complete intake forms online</li>
                                    </ul>
                                </div>
                                )}

                                {hasPropertyFeatures && (
                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-2">Resident Portal</h4>
                                    <ul className="list-disc pl-5 space-y-1 text-sm">
                                        <li><strong>Rent Status:</strong> View rent balance, payment history, and due dates</li>
                                        <li><strong>Maintenance Requests:</strong> Submit and track maintenance tickets</li>
                                        <li><strong>Notices:</strong> View notices posted by the property manager</li>
                                        <li><strong>Lease Information:</strong> View lease terms and expiry dates</li>
                                        <li><strong>Messaging:</strong> Send messages to the property manager</li>
                                    </ul>
                                </div>
                                )}

                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-2">Inviting Portal Users</h4>
                                    <ol className="list-decimal pl-5 space-y-1 text-sm">
                                        <li>Go to Settings → Portal Access</li>
                                        <li>Choose {hasLegalFeatures && hasPropertyFeatures ? 'Client Portal or Resident Portal' : hasLegalFeatures ? 'Client Portal' : 'Resident Portal'}</li>
                                        <li>Enter the person's email and select their {hasLegalFeatures ? 'matter' : 'unit'}</li>
                                        <li>They'll receive an invitation email with a link to set up their password</li>
                                        <li>Once they log in, they can access the portal at your firm's PracticePro URL</li>
                                    </ol>
                                </div>
                            </div>
                        </AccordionItem>

                        {hasLegalFeatures && <AccordionItem
                            id="trust-accounting"
                            title="Trust Accounting"
                            isOpen={isSectionOpen('trust-accounting')}
                            onToggle={() => handleSectionToggle('trust-accounting')}
                        >
                            <div className="space-y-6">
                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-2">Trust Ledger</h4>
                                    <p className="text-sm">Track client funds held in trust with a dedicated trust accounting ledger. Available as a tab within the Matter detail view (Financials section).</p>
                                </div>

                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-2">Trust Transactions</h4>
                                    <ul className="list-disc pl-5 space-y-1 text-sm">
                                        <li><strong>Deposits:</strong> Record client money received into the trust account</li>
                                        <li><strong>Withdrawals:</strong> Record disbursements from trust (e.g., paying counsel fees)</li>
                                        <li><strong>Transfers:</strong> Transfer funds from trust to operating account</li>
                                        <li><strong>Running Balance:</strong> Real-time trust balance per matter</li>
                                    </ul>
                                </div>

                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-2">Enabling Trust Accounting</h4>
                                    <p className="text-sm">Trust accounting can be toggled on/off in Settings → Firm Details. When enabled, a Trust tab appears in each matter's Financials section.</p>
                                </div>
                            </div>
                        </AccordionItem>}

                        {hasLegalFeatures && <AccordionItem
                            id="enterprise-jurisdiction"
                            title={
                                <div className="flex items-center gap-2">
                                    Enterprise Jurisdiction & Intake
                                </div>
                            }
                            isOpen={isSectionOpen('enterprise-jurisdiction')}
                            onToggle={() => handleSectionToggle('enterprise-jurisdiction')}
                        >
                            <div className="space-y-6">
                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-2">Procedural Intelligence</h4>
                                    <p>The Matter Intake Wizard is powered by a procedural intelligence engine. Entering a specific Court Jurisdiction and Legal Action combination dynamically checks statutory rules and provides hints.</p>
                                </div>

                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-2">Granular Party Representation</h4>
                                    <ul className="list-disc pl-5 space-y-1 text-sm">
                                        <li><strong>Specific Clients:</strong> When checking into a matter with multiple Claimants or Defendants, you can granularly select which specific parties your firm represents via the checkboxes.</li>
                                        <li><strong>Representative Capacity:</strong> Mark parties as suing or defending in a representative capacity (e.g. as liquidator or executor).</li>
                                    </ul>
                                </div>

                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-2">{assistantName} Hints & Checklists</h4>
                                    <p className="text-sm">During intake, {assistantName} will offer inline hints (e.g., verifying if the selected court is proper given the territory, or warning about required pre-action notices for certain parties).</p>
                                </div>

                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-2">Jurisdiction Configuration</h4>
                                    <p className="text-sm">The procedural rules engine is designed to be jurisdiction-adaptive. While it currently ships with rules for Nigerian courts, the system can be adapted to other jurisdictions by updating the procedural rules configuration. This ensures the app works across different legal systems without code changes.</p>
                                </div>
                            </div>
                        </AccordionItem>}

                        {/* ── AI Research Mode & Engine ── */}
                        <AccordionItem
                            id="ai-research-mode"
                            title={`${assistantName} Research Mode & AI Engine`}
                            isOpen={isSectionOpen('ai-research-mode')}
                            onToggle={() => handleSectionToggle('ai-research-mode')}
                        >
                            <div className="space-y-6">
                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-2">Engine Modes</h4>
                                    <p className="text-sm mb-3">{assistantName} has four operating modes. Click the mode badge in the chat header to cycle through them:</p>
                                    <ul className="space-y-2 text-sm">
                                        <li className="p-2 border-l-4 border-emerald-400 bg-emerald-50 dark:bg-emerald-900/10 rounded-r"><strong>Auto (green):</strong> {assistantName} automatically chooses the best mode for each query. Best for general use.</li>
                                        <li className="p-2 border-l-4 border-amber-400 bg-amber-50 dark:bg-amber-900/10 rounded-r"><strong>Flash (amber):</strong> Fast responses using a lighter model. Best for quick questions and simple tasks.</li>
                                        <li className="p-2 border-l-4 border-purple-400 bg-purple-50 dark:bg-purple-900/10 rounded-r"><strong>Pro (purple):</strong> Deeper analysis using the most capable model. Best for complex drafting and strategy.</li>
                                        <li className="p-2 border-l-4 border-blue-400 bg-blue-50 dark:bg-blue-900/10 rounded-r"><strong>Research (blue):</strong> Multi-step reasoning with citations, jurisdiction detection, and anti-hallucination guardrails. Best for legal research and cross-border analysis.</li>
                                    </ul>
                                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-2">Your mode preference is saved and persists across sessions.</p>
                                </div>

                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-2">Dynamic Reasoning States</h4>
                                    <p className="text-sm">In Research mode, the static "Thinking…" indicator is replaced with real-time status messages that cycle every few seconds:</p>
                                    <ul className="list-disc pl-5 space-y-1 text-sm mt-2">
                                        <li>Researching… analyzing your query in depth</li>
                                        <li>Cross-referencing legal frameworks…</li>
                                        <li>Evaluating jurisdictional implications…</li>
                                        <li>Synthesizing analysis…</li>
                                    </ul>
                                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-2">This sets expectations for the longer processing time in Research mode.</p>
                                </div>

                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-2">Live Web Querying</h4>
                                    <p className="text-sm mb-2">Paste any URL into the {assistantName} chat and the AI will:</p>
                                    <ol className="list-decimal pl-5 space-y-1 text-sm">
                                        <li>Fetch the web page content server-side</li>
                                        <li>Extract the main text (stripping scripts, ads, navigation)</li>
                                        <li>Read and analyze the content in context</li>
                                        <li>Answer your questions about the page</li>
                                    </ol>
                                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-2">If a page is behind a paywall or requires login, {assistantName} will ask you to paste the text directly.</p>
                                </div>

                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-2">Citations & Jurisdiction Guardrails</h4>
                                    <p className="text-sm mb-2">Research mode enforces strict rules:</p>
                                    <ul className="list-disc pl-5 space-y-1 text-sm">
                                        <li><strong>Jurisdiction Detection:</strong> Identifies the governing jurisdiction before answering. For cross-border matters, explicitly states which jurisdiction's frameworks are being applied.</li>
                                        <li><strong>Citation Required:</strong> Legal assertions are cited with inline references [1], [2] and a sources list at the end.</li>
                                        <li><strong>No Hallucination:</strong> If uncertain about a statute or case, {assistantName} says "I am not certain — please verify" rather than fabricating.</li>
                                        <li><strong>Anti-Laziness:</strong> When specific analysis is requested, provides detailed analysis of THAT provision — not generic overviews.</li>
                                    </ul>
                                </div>

                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-2">Citation Formatting</h4>
                                    <p className="text-sm">Citations can be formatted in multiple styles:</p>
                                    <ul className="list-disc pl-5 space-y-1 text-sm mt-1">
                                        <li><strong>Nigerian Supreme Court</strong> — default for Nigerian practice</li>
                                        <li><strong>Bluebook</strong> — US legal standard</li>
                                        <li><strong>OSCOLA</strong> — UK/Oxford standard</li>
                                        <li><strong>Plain</strong> — simple numbered references</li>
                                    </ul>
                                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-2">The citation style is auto-detected based on your jurisdiction.</p>
                                </div>
                            </div>
                        </AccordionItem>

                        {/* ── Security & 2FA ── */}
                        <AccordionItem
                            id="security-2fa"
                            title="Security & 2FA"
                            isOpen={isSectionOpen('security-2fa')}
                            onToggle={() => handleSectionToggle('security-2fa')}
                        >
                            <div className="space-y-6">
                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-2">Two-Factor Authentication (2FA)</h4>
                                    <p className="text-sm mb-2">Enable 2FA in Settings → Security for an extra verification step during login. When enabled, a warning message appears with recovery instructions.</p>
                                    <div className="p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-lg">
                                        <p className="text-xs text-amber-700 dark:text-amber-300">
                                            <strong>Locked out?</strong> If you lose access to your 2FA device, contact your firm administrator. Admins can disable 2FA for your account from Settings → Account Recovery. Consider enabling biometric login on the mobile app as a backup.
                                        </p>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-2">Admin: Disabling 2FA for Users</h4>
                                    <ol className="list-decimal pl-5 space-y-1 text-sm">
                                        <li>Go to Settings → Account Recovery</li>
                                        <li>Search for the user by email</li>
                                        <li>Click the "Disable 2FA" button (amber)</li>
                                        <li>Confirm the action</li>
                                        <li>The user can now log in with just their password</li>
                                    </ol>
                                </div>

                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-2">Biometric Login (Mobile App)</h4>
                                    <p className="text-sm">On the Android APK, enable biometric authentication (fingerprint or Face ID) in Settings → Security. This provides a convenient backup if 2FA is enabled — you can use biometrics to log in even with 2FA on.</p>
                                </div>

                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-2">Content Protection</h4>
                                    <p className="text-sm">The app uses FLAG_SECURE on Android to prevent screenshots at the OS level — same technology used by banking apps. WebView debugging is disabled in production builds.</p>
                                </div>
                            </div>
                        </AccordionItem>
                    </Accordion>

                    {/* No results → ALOA fallback offer */}
                    {noResults && (
                        <div className="mt-8 max-w-lg mx-auto">
                            <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-zinc-700 p-8 text-center">
                                <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center">
                                    <SearchIcon className="w-7 h-7 text-slate-300 dark:text-zinc-600" />
                                </div>
                                <p className="text-sm font-semibold text-slate-600 dark:text-zinc-300 mb-1">
                                    No articles found for "{searchQuery}"
                                </p>
                                <p className="text-xs text-slate-400 dark:text-zinc-500 mb-5">
                                    Try different keywords, or ask {assistantName} for personalized help.
                                </p>
                            </div>
                            <button
                                onClick={handleAskAloa}
                                disabled={isAskingAloa}
                                className="mt-4 w-full rounded-2xl p-[2px] bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 hover:from-blue-600 hover:via-indigo-600 hover:to-purple-600 transition-all disabled:opacity-60"
                            >
                                <div className="rounded-2xl bg-white dark:bg-zinc-900 px-6 py-4 flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                                        <SparklesIcon className="w-5 h-5 text-white" />
                                    </div>
                                    <div className="text-left flex-1">
                                        <p className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                            Ask {assistantName} about "{searchQuery}"
                                            <span className="text-3xs uppercase tracking-wider font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded">AI Help</span>
                                        </p>
                                        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                                            Get a personalized answer from the AI assistant — it knows every feature in PracticePro.
                                        </p>
                                    </div>
                                    <svg className="w-5 h-5 text-slate-300 dark:text-zinc-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                    </svg>
                                </div>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
export default HelpView;
