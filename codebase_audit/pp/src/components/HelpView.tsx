
import React, { useState, useRef } from 'react';
import { SearchIcon, HelpCircleIcon, ZapIcon, UserCircleIcon, OfficeBuildingIcon, SparklesIcon, ShieldCheckIcon } from '../constants';
import Accordion, { AccordionItem } from './Accordion';
import { useAloa } from '../contexts/AloaProvider';
import { useUI } from '../contexts/UIContext';

const HelpView: React.FC = () => {
    const { currentHistoryEntry } = useUI();
    const [searchQuery, setSearchQuery] = useState('');
    const [activeSection, setActiveSection] = useState<string | null>(currentHistoryEntry.context?.activeSection || 'getting-started');
    const { togglePanel } = useAloa();

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
        // Small timeout to allow state update to render before scrolling
        setTimeout(() => {
            const element = document.getElementById(sectionId);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 100);
    };

    const handleAskAloa = () => {
        togglePanel(); // Opens ALOA panel
    };

    return (
        <div className="h-full overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-zinc-900 pb-32">
            <header className="sticky top-0 z-30 glass flex-shrink-0 py-4 px-4 sm:px-6 lg:px-8 shadow-sm border-b border-slate-200 dark:border-zinc-700 flex justify-between items-center mb-10">
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
                    <div className="flex gap-3 max-w-lg mx-auto mb-6">
                        <div className="relative flex-1">
                            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input autoComplete="off" data-lpignore="true" 
                                type="text"
                                placeholder="Search for help articles..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 rounded-full border border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                            />
                        </div>
                        <button
                            onClick={handleAskAloa}
                            className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold rounded-full hover:shadow-lg transition-all flex items-center gap-2 hover:scale-105 whitespace-nowrap"
                        >
                            <SparklesIcon className="w-5 h-5" />
                            Ask ALOA
                        </button>
                    </div>
                </header>

                {/* Quick Access Cards */}
                <div className="grid md:grid-cols-3 gap-6 mb-12">
                    <button
                        onClick={() => handleCardClick('getting-started')}
                        className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-xl border border-blue-100 dark:border-blue-800/50 hover:shadow-lg transition-all text-left group hover:-translate-y-1"
                    >
                        <div className="w-12 h-12 bg-blue-100 dark:bg-blue-800 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-200 mb-4 group-hover:scale-110 transition-transform">
                            <HelpCircleIcon className="w-6 h-6" />
                        </div>
                        <h3 className="font-bold text-lg mb-2 text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">Getting Started</h3>
                        <p className="text-sm text-slate-600 dark:text-zinc-400">New to PracticePro? Learn the basics of setting up your firm and managing cases.</p>
                    </button>

                    <button
                        onClick={() => handleCardClick('aloa-tips')}
                        className="bg-emerald-50 dark:bg-emerald-900/20 p-6 rounded-xl border border-emerald-100 dark:border-emerald-800/50 hover:shadow-lg transition-all text-left group hover:-translate-y-1"
                    >
                        <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-800 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-200 mb-4 group-hover:scale-110 transition-transform">
                            <ZapIcon className="w-6 h-6" />
                        </div>
                        <h3 className="font-bold text-lg mb-2 text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400">ALOA Tips</h3>
                        <p className="text-sm text-slate-600 dark:text-zinc-400">Master your AI assistant. Learn commands for drafting, research, and analysis.</p>
                    </button>

                    <button
                        onClick={() => handleCardClick('admin-guide')}
                        className="bg-purple-50 dark:bg-purple-900/20 p-6 rounded-xl border border-purple-100 dark:border-purple-800/50 hover:shadow-lg transition-all text-left group hover:-translate-y-1"
                    >
                        <div className="w-12 h-12 bg-purple-100 dark:bg-purple-800 rounded-full flex items-center justify-center text-purple-600 dark:text-purple-200 mb-4 group-hover:scale-110 transition-transform">
                            <OfficeBuildingIcon className="w-6 h-6" />
                        </div>
                        <h3 className="font-bold text-lg mb-2 text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400">Admin Guide</h3>
                        <p className="text-sm text-slate-600 dark:text-zinc-400">Manage users, billing settings, and firm-wide configurations securely.</p>
                    </button>
                </div>

                <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 p-6 sm:p-8">
                    <Accordion>
                        <AccordionItem
                            id="getting-started"
                            title="Getting Started: The Basics"
                            isOpen={activeSection === 'getting-started'}
                            onToggle={() => setActiveSection(activeSection === 'getting-started' ? null : 'getting-started')}
                        >
                            <div className="space-y-6">
                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-2">What is PracticePro?</h4>
                                    <p>PracticePro is a Litigation System designed to help law firms manage matters, documents, tasks, billing, and team collaboration — all in one place.</p>
                                </div>

                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-2">Modules & How They Connect</h4>
                                    <ul className="list-disc pl-5 space-y-1 marker:text-primary-500">
                                        <li><strong>Dashboard:</strong> Quick view of active matters, your tasks, upcoming deadlines, and recent firm activity.</li>
                                        <li><strong>Matters:</strong> Central hub for case details. Here you can track progress, and view all related documents, tasks, and notes for a specific case.</li>
                                        <li><strong>Tasks:</strong> Assign, track, and complete legal or administrative tasks on a drag-and-drop board.</li>
                                        <li><strong>Research Studio <span className="text-[9px] px-1 bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 rounded">BETA</span>:</strong> An AI-powered workspace for analyzing case files, generating chronologies, and preparing legal arguments.</li>
                                        <li><strong>Calendar:</strong> Track court dates, filing deadlines, and client meetings. Includes automatic conflict detection.</li>
                                        <li><strong>Billing:</strong> Record billable time, generate invoices, and manage payments (Admin only in multi-user mode).</li>
                                    </ul>
                                </div>

                            </div>
                        </AccordionItem>

                        <AccordionItem
                            id="aloa-tips"
                            title="Mastering ALOA (AI Assistant)"
                            isOpen={activeSection === 'aloa-tips'}
                            onToggle={() => setActiveSection(activeSection === 'aloa-tips' ? null : 'aloa-tips')}
                        >
                            <div className="space-y-6">
                                <div className="flex items-start gap-4 bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-lg">
                                    <ZapIcon className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-1" />
                                    <div>
                                        <h4 className="font-bold text-emerald-800 dark:text-emerald-200">What is ALOA?</h4>
                                        <p className="text-emerald-700 dark:text-emerald-300 text-sm mt-1">ALOA (Advanced Legal Office Assistant) is your AI-powered paralegal and practice manager. She drafts documents, checks team schedules, takes dictation notes, and organizes your firm's data.</p>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="font-bold text-lg mb-2">Key Administrative Capabilities</h4>
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
                                            "Draft a letter to the opposing counsel for adjournment."
                                        </li>
                                    </ul>
                                </div>

                                <div>
                                    <h4 className="font-bold text-lg mb-2">The Integrated Note Taker</h4>
                                    <p className="mb-2">ALOA includes a powerful dictation engine for legal Note-Taking directly within her chat panel.</p>
                                    <ul className="list-disc pl-5 space-y-1 text-sm text-slate-700 dark:text-zinc-300">
                                        <li><strong>Voice Dictation:</strong> Click the microphone icon to record your thoughts perfectly transcribed into text.</li>
                                        <li><strong>Quick Save:</strong> Use the "Save to Matter" feature in the generated note to instantly store your typed or dictated memo safely into a Matter's Notebook.</li>
                                        <li><strong>Zero Layout Shift:</strong> Open ALOA securely over any screen, take your voice notes, and close it without losing your place in the app.</li>
                                    </ul>
                                </div>

                                <div>
                                    <h4 className="font-bold text-lg mb-2">Firm-Wide Brain (RAG)</h4>
                                    <p className="text-sm">ALOA constantly reads your firm's case files and saved notes. You can search across your knowledge base simply by chatting with her, and she will cross-reference your specific uploaded documents to generate accurate, localized legal answers.</p>
                                </div>

                                <div>
                                    <h4 className="font-bold text-lg mb-2">On-Demand Briefings</h4>
                                    <p className="text-sm">Get an instant snapshot of your practice. Ask ALOA "Give me a daily briefing" to receive your urgent tasks, upcoming court appearances, financial highlights, and recent notes securely packaged together.</p>
                                </div>
                            </div>
                        </AccordionItem>

                        <AccordionItem
                            id="admin-guide"
                            title="Admin Guide & Settings"
                            isOpen={activeSection === 'admin-guide'}
                            onToggle={() => setActiveSection(activeSection === 'admin-guide' ? null : 'admin-guide')}
                        >
                            <div className="space-y-6">
                                <p className="italic text-slate-500">This section is relevant for users with the 'Admin' role.</p>

                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-2">User Management</h4>
                                    <p className="mb-2">Go to <strong>Settings {'>'} User Management</strong> to invite team members.</p>
                                    <ul className="list-disc pl-5 space-y-1 text-sm">
                                        <li><strong>Legal Professional:</strong> Full access to matters, billing, and documents. Can track CPD hours.</li>
                                        <li><strong>Paralegal:</strong> Can manage tasks and documents but has restricted access to firm settings and sensitive billing actions.</li>
                                        <li><strong>Admin:</strong> Full control over firm settings, users, and billing.</li>
                                    </ul>
                                </div>

                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-2">Firm Branding</h4>
                                    <p className="mb-2">Go to <strong>Settings {'>'} Firm Details</strong> to customize:</p>
                                    <ul className="list-disc pl-5 space-y-1 text-sm">
                                        <li><strong>Logo:</strong> Appears on the navigation bar and client portal.</li>
                                        <li><strong>Letterhead:</strong> Upload your official letterhead image. This will be used as the background for all generated PDFs (Invoices, Receipts).</li>
                                        <li><strong>Digital Stamp:</strong> Used for digitally signing documents within the app.</li>
                                    </ul>
                                </div>

                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-2">Custom Workflows</h4>
                                    <p>You can standardize how your firm handles cases by creating Workflows in <strong>Settings {'>'} Templates</strong>. Define custom stages (e.g., "Search", "Drafting", "Execution") for different practice areas like Real Estate or Litigation.</p>
                                </div>
                            </div>
                        </AccordionItem>

                        <AccordionItem
                            id="research-guide"
                            title={
                                <div className="flex items-center gap-2">
                                    Using the Research Studio
                                    <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-[9px] text-amber-700 dark:text-amber-400 font-bold uppercase tracking-wider">Beta</span>
                                </div>
                            }
                            isOpen={activeSection === 'research-guide'}
                            onToggle={() => setActiveSection(activeSection === 'research-guide' ? null : 'research-guide')}
                        >
                            <div className="space-y-6">
                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-2 flex items-center gap-2">
                                        Overview
                                        <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-[9px] text-amber-700 dark:text-amber-400 font-bold uppercase tracking-wider">Beta</span>
                                    </h4>
                                    <p>The Research Studio is designed to be your digital war room. It allows you to upload case files (PDFs, Word docs) and use AI to extract insights.</p>
                                </div>
                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-2">Tools available in the Studio</h4>
                                    <ul className="list-disc pl-5 space-y-1 text-sm">
                                        <li><strong>Chronology Builder:</strong> Automatically extracts dates and events from all uploaded documents to create a case timeline.</li>
                                        <li><strong>Legal Matrix:</strong> Maps facts found in your documents to legal elements (IRAC format).</li>
                                        <li><strong>Discovery Gaps:</strong> Analyzes your file to identify missing evidence or logical inconsistencies.</li>
                                        <li><strong>Audio Briefing:</strong> Generates a podcast-style audio summary of your case file for listening on the go.</li>
                                    </ul>
                                </div>
                            </div>
                        </AccordionItem>

                        <AccordionItem
                            id="aldia-analysis"
                            title="ALDIA Document Analysis"
                            isOpen={activeSection === 'aldia-analysis'}
                            onToggle={() => setActiveSection(activeSection === 'aldia-analysis' ? null : 'aldia-analysis')}
                        >
                            <div className="space-y-6">
                                <div className="flex items-start gap-4 bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg">
                                    <SparklesIcon className="w-6 h-6 text-indigo-600 flex-shrink-0 mt-1" />
                                    <div>
                                        <h4 className="font-bold text-indigo-800 dark:text-indigo-200">What is ALDIA?</h4>
                                        <p className="text-indigo-700 dark:text-indigo-300 text-sm mt-1">ALDIA (Advanced Legal Document Intelligence Agent) is an AI agent that analyzes your legal documents for risk, compliance, and key metadata extraction.</p>
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
                                        <li><strong>Risk Analysis:</strong> Legal, commercial, compliance, and operational risk scores (1-10)</li>
                                        <li><strong>Metadata Extraction:</strong> Parties, dates, governing law, jurisdiction</li>
                                        <li><strong>Opposing Counsel Detection:</strong> Automatically extracts contact information for quick saving</li>
                                        <li><strong>Data Protection:</strong> Identifies PII and assesses NDPA compliance</li>
                                        <li><strong>RPC Guardian:</strong> Ethical compliance check against Nigerian legal rules</li>
                                    </ul>
                                </div>

                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-2">Save Opposing Counsel</h4>
                                    <p>When ALDIA detects opposing counsel contact information in a document, you'll see a <strong>"Save to Contacts"</strong> button. Click it to automatically create a contact with the extracted details.</p>
                                </div>
                            </div>
                        </AccordionItem>

                        <AccordionItem
                            id="litigation-tracking"
                            title="Litigation Tracking"
                            isOpen={activeSection === 'litigation-tracking'}
                            onToggle={() => setActiveSection(activeSection === 'litigation-tracking' ? null : 'litigation-tracking')}
                        >
                            <div className="space-y-6">
                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-2">Overview</h4>
                                    <p>Track the status of court processes throughout their lifecycle from drafting to acknowledgment.</p>
                                </div>

                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-2">Document Status Pipeline</h4>
                                    <ul className="space-y-2">
                                        <li className="p-3 border-l-4 border-slate-400 bg-slate-50 dark:bg-slate-800 rounded-r">
                                            <strong>Draft:</strong> Document is being prepared
                                        </li>
                                        <li className="p-3 border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-900/20 rounded-r">
                                            <strong>Filed:</strong> Submitted to court
                                        </li>
                                        <li className="p-3 border-l-4 border-orange-500 bg-orange-50 dark:bg-orange-900/20 rounded-r">
                                            <strong>Served:</strong> Delivered to opposing party
                                        </li>
                                        <li className="p-3 border-l-4 border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 rounded-r">
                                            <strong>Acknowledged:</strong> Response received
                                        </li>
                                    </ul>
                                </div>

                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-2">How to Track</h4>
                                    <ol className="list-decimal pl-5 space-y-2 marker:text-slate-500">
                                        <li>Mark a document as a <strong>Court Process</strong> when creating/editing it.</li>
                                        <li>Navigate to the document detail view and select the <strong>Litigation Pipeline</strong> tab.</li>
                                        <li>Click the status buttons to update the document's progress.</li>
                                        <li>The visual timeline will update automatically.</li>
                                    </ol>
                                </div>
                            </div>
                        </AccordionItem>

                        <AccordionItem
                            id="property-management"
                            title="Property Management"
                            isOpen={activeSection === 'property-management'}
                            onToggle={() => setActiveSection(activeSection === 'property-management' ? null : 'property-management')}
                        >
                            <div className="space-y-6">
                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-2">Managing Properties</h4>
                                    <p>Track properties owned by clients or linked to matters including rental properties, disputed land, and properties for sale.</p>
                                </div>

                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-2">Property Tracking Features</h4>
                                    <ul className="list-disc pl-5 space-y-1 text-sm">
                                        <li><strong>Rent Payment History:</strong> Track rent payments, due dates, and overdue amounts</li>
                                        <li><strong>Maintenance Records:</strong> Log and track property maintenance issues</li>
                                        <li><strong>Lease Expiry Alerts:</strong> Get notified before leases expire</li>
                                        <li><strong>Event Timeline:</strong> Visual timeline of all property-related events</li>
                                    </ul>
                                </div>

                                <div className="space-y-1">
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-2">Property Automations</h4>
                                    <p className="mb-2">Set up automatic notifications in <strong>Settings → Automation</strong>:</p>
                                    <ul className="list-disc pl-5 space-y-1 text-sm">
                                        <li>Rent due reminders (7 days before)</li>
                                        <li>Lease expiry warnings (60 days before)</li>
                                        <li>Maintenance task auto-creation</li>
                                        <li>Rent overdue follow-ups</li>
                                    </ul>
                                </div>
                            </div>
                        </AccordionItem>

                        <AccordionItem
                            id="revenue-engine"
                            title={
                                <div className="flex items-center gap-2">
                                    Revenue Monitor (Atrium)
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-[9px] text-emerald-700 dark:text-emerald-400 font-bold uppercase tracking-wider">High Fidelity</span>
                                </div>
                            }
                            isOpen={activeSection === 'revenue-engine'}
                            onToggle={() => setActiveSection(activeSection === 'revenue-engine' ? null : 'revenue-engine')}
                        >
                            <div className="space-y-6">
                                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800/30">
                                    <h4 className="font-bold text-emerald-900 dark:text-emerald-100 mb-2 flex items-center gap-2 text-lg">
                                        <ShieldCheckIcon className="w-5 h-5" />
                                        The Philosophy of Atrium
                                    </h4>
                                    <p className="text-emerald-800 dark:text-emerald-200 text-sm leading-relaxed">
                                        Atrium isn't just property management; it's a **Revenue Monitor**. It is designed to secure landlord cash flow by treating every unit as a critical financial asset. The monitor enforces payment discipline through transparency and automated oversight.
                                    </p>
                                </div>

                                <div className="grid sm:grid-cols-2 gap-4">
                                    <div className="p-4 border border-slate-200 dark:border-zinc-700 rounded-xl">
                                        <h5 className="font-bold text-slate-900 dark:text-white mb-2">Immutable Ledger</h5>
                                        <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                                            Every rent collection and service charge payment is recorded in an immutable ledger with unique transaction hashes. This prevents record tampering and ensures audit-grade financial clarity for property owners.
                                        </p>
                                    </div>
                                    <div className="p-4 border border-slate-200 dark:border-zinc-700 rounded-xl">
                                        <h5 className="font-bold text-slate-900 dark:text-white mb-2">Defaulter Dashboard</h5>
                                        <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                                            Identify revenue at risk instantly. The dashboard highlights tenants who have crossed the 14-day grace period, allowing managers to trigger recovery processes or restriction notices with one click.
                                        </p>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="font-bold text-lg text-slate-800 dark:text-white mb-3">Core Workflows</h4>
                                    <div className="space-y-3">
                                        <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-zinc-800/50 rounded-lg">
                                            <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/30 rounded flex items-center justify-center text-blue-600 dark:text-blue-400 text-[10px] font-bold shrink-0">01</div>
                                            <div>
                                                <strong className="block text-sm text-slate-900 dark:text-zinc-100">Rent Synchronization</strong>
                                                <p className="text-xs text-slate-500 dark:text-zinc-400">Link tenant payments to bank statements. The engine automatically reconciles deposits and marks periods as 'Paid' or 'Defaulted'.</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-zinc-800/50 rounded-lg">
                                            <div className="w-6 h-6 bg-emerald-100 dark:bg-emerald-900/30 rounded flex items-center justify-center text-emerald-600 dark:text-emerald-400 text-[10px] font-bold shrink-0">02</div>
                                            <div>
                                                <strong className="block text-sm text-slate-900 dark:text-zinc-100">SCE Tracking (Service Charge Equivalent)</strong>
                                                <p className="text-xs text-slate-500 dark:text-zinc-400">Break down maintenance and utility costs into the SCE framework. This allows you to justify tenant contributions based on real-time operational expenses like security and cleaning.</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-zinc-800/50 rounded-lg">
                                            <div className="w-6 h-6 bg-purple-100 dark:bg-purple-900/30 rounded flex items-center justify-center text-purple-600 dark:text-purple-400 text-[10px] font-bold shrink-0">03</div>
                                            <div>
                                                <strong className="block text-sm text-slate-900 dark:text-zinc-100">Automated Bridge</strong>
                                                <p className="text-xs text-slate-500 dark:text-zinc-400">Connect the engine to WhatsApp and SMS. The Atrium Bridge sends rent reminders 7 days before due dates and escalating late notices if the grace period expires.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-4 p-4 border-l-4 border-amber-500 bg-amber-50 dark:bg-amber-900/10 rounded-r-xl">
                                    <p className="text-xs text-amber-800 dark:text-amber-200">
                                        <strong>Pro Tip:</strong> Use the 'Revenue Monitor' navigation tab to see a firm-wide view of all properties. If the shield icon turns red, you have critical defaults requiring immediate attention.
                                    </p>
                                </div>
                            </div>
                        </AccordionItem>

                        <AccordionItem
                            id="draftpro-editor"
                            title={
                                <div className="flex items-center gap-2">
                                    DraftPro Document Editor
                                    <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-[9px] text-amber-700 dark:text-amber-400 font-bold uppercase tracking-wider">Beta</span>
                                </div>
                            }
                            isOpen={activeSection === 'draftpro-editor'}
                            onToggle={() => setActiveSection(activeSection === 'draftpro-editor' ? null : 'draftpro-editor')}
                        >
                            <div className="space-y-6">
                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-2">What is DraftPro?</h4>
                                    <p>DraftPro is PracticePro's built-in legal document editor with AI-powered drafting assistance. Create professional legal documents without leaving the app.</p>
                                </div>

                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-2">Key Features</h4>
                                    <ul className="list-disc pl-5 space-y-1 text-sm">
                                        <li><strong>Rich Text Editing:</strong> Format text, add lists, tables, and headers</li>
                                        <li><strong>AI Drafting:</strong> Use ALOA to generate document sections</li>
                                        <li><strong>Template System:</strong> Start from pre-built legal templates</li>
                                        <li><strong>Auto-Save:</strong> Your work is saved automatically</li>
                                        <li><strong>Export Options:</strong> Save to matters, PDF export, or copy to clipboard</li>
                                    </ul>
                                </div>

                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-2">How to Use</h4>
                                    <ol className="list-decimal pl-5 space-y-2 marker:text-slate-500">
                                        <li>Click <strong>Draft</strong> in the navigation to open DraftPro.</li>
                                        <li>Choose a template or start from scratch.</li>
                                        <li>Use the toolbar for formatting or click "Ask ALOA" to generate content.</li>
                                        <li>When finished, save to a matter or export as PDF.</li>
                                    </ol>
                                </div>
                            </div>
                        </AccordionItem>
                        <AccordionItem
                            id="enterprise-jurisdiction"
                            title={
                                <div className="flex items-center gap-2">
                                    Enterprise Jurisdiction & Intake
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-[9px] text-emerald-700 dark:text-emerald-400 font-bold uppercase tracking-wider">New</span>
                                </div>
                            }
                            isOpen={activeSection === 'enterprise-jurisdiction'}
                            onToggle={() => setActiveSection(activeSection === 'enterprise-jurisdiction' ? null : 'enterprise-jurisdiction')}
                        >
                            <div className="space-y-6">
                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-2">Procedural Intelligence</h4>
                                    <p>The Matter Intake Wizard is powered by an enterprise procedural intelligence engine. Entering a specific Court Jurisdiction and Legal Action combination dynamically checks statutory rules.</p>
                                </div>

                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-2">Granular Party Representation</h4>
                                    <ul className="list-disc pl-5 space-y-1 text-sm">
                                        <li><strong>Specific Clients:</strong> When checking into a matter with multiple Claimants or Defendants, you can now granularly select which specific parties your firm represents via the checkboxes.</li>
                                        <li><strong>Representative Capacity:</strong> Mark parties as suing or defending in a representative capacity (e.g. as liquidator or executor).</li>
                                    </ul>
                                </div>

                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-2">ALOA Hints & Checklists</h4>
                                    <p className="text-sm">During intake, ALOA will offer inline hints (e.g., verifying if the State High Court is proper given the selected territory, or warning about required pre-action notices for certain parties).</p>
                                </div>
                            </div>
                        </AccordionItem>
                    </Accordion>
                </div>
            </div>
        </div>
    );
};
export default HelpView;
