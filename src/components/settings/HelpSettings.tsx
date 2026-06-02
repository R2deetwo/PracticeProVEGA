import React from 'react';
import Accordion, { AccordionItem } from '../Accordion';
import { useOnboarding } from '../../contexts/OnboardingProvider';
import { useUI } from '../../contexts/UIContext';
import { useProduct } from '../../contexts/ProductContext';

const SettingsCard: React.FC<{ title: string; children: React.ReactNode; id?: string, className?: string }> = ({ title, children, id, className }) => (
    <div id={id} className={`relative overflow-hidden bg-white dark:bg-[#1f2937] border border-gray-200 dark:border-gray-700 rounded-xl shadow-md p-6 ${className || ''}`}>
        <div className="relative z-10">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">{title}</h3>
            {children}
        </div>
    </div>
);


export const HelpSettings: React.FC = () => {
    const { resetTour } = useOnboarding();
    const { addToast } = useUI();
    const { isProperty, isVega } = useProduct();

    const handleRestartTour = () => {
        resetTour();
        addToast("App tour has been reset and will restart now.", { type: 'success' });
    };

    return (
        <SettingsCard title="Help & Support" id="help-and-support">
            <div className="space-y-6">
                <div>
                    <h4 className="font-semibold text-lg">Application Tour</h4>
                    <p className="text-gray-600 dark:text-gray-300 mt-2">
                        Need a refresher on the app's features? You can restart the introductory tour at any time.
                    </p>
                    <button
                        onClick={handleRestartTour}
                        className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700"
                    >
                        Restart Tour
                    </button>
                </div>

                <div>
                    <h4 className="font-semibold text-lg mt-6">Frequently Asked Questions</h4>
                    <Accordion>
                        <AccordionItem title="Whole-App Overview" defaultOpen={false}>
                            <div className="space-y-6">
                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white">What is this Platform?</h4>
                                    <p>{isVega ? 'Vega' : 'Atrium'} is a {isProperty ? 'Property Management System' : 'Professional Operations System'} designed to help {isProperty ? 'property managers and real estate firms' : 'teams'} manage {isProperty ? 'properties' : 'matters'}, documents, tasks, {isProperty ? 'financials' : 'billing'}, and team collaboration — all in one place.</p>
                                </div>

                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white">How the App Works – End-to-End Flow</h4>
                                    <ol className="list-decimal pl-5 space-y-2">
                                        <li><strong>{isProperty ? 'Portfolio' : 'Firm'} Setup:</strong> An <strong>Admin</strong> navigates to <code>Settings</code> and adds {isProperty ? 'portfolio' : 'firm'} details (name, address, logo) for letterheads and invoices. Users ({isProperty ? 'Managers, Staff' : 'Lawyers, Paralegals'}) are invited and assigned roles. {isProperty ? 'Operation' : 'Practice area'} workflows are configured for different {isProperty ? 'property' : 'matter'} types (e.g., {isProperty ? 'Residential Lease, Commercial Sale' : 'Civil Litigation, Company Incorporation'}).</li>
                                        <li><strong>{isProperty ? 'Property' : 'Matter'} Creation & Intake:</strong> A new {isProperty ? 'property record' : 'case/matter'} is dynamically opened via the {isProperty ? 'Intake Wizard' : 'Enterprise Matter Intake Wizard'}{!isProperty && ', providing real-time AI validation for Nigerian Court rules, catching party conflicts or informal joinders automatically'}.</li>
                                        <li><strong>Task Assignment:</strong> Tasks (e.g., {isProperty ? '“Conduct Inspection”' : '“Draft Statement of Claim”'}) are created and assigned to the relevant team members. Depending on your {isProperty ? 'portfolio\'s' : 'firm\'s'} structure, an <strong>Admin</strong> might assign work to a <strong>{isProperty ? 'Manager' : 'Lawyer'}</strong>, who can then delegate sub-tasks to a <strong>{isProperty ? 'Staff' : 'Paralegal'}</strong>.</li>
                                        <li><strong>Document Management:</strong> All {isProperty ? 'related' : 'case'} documents are uploaded and organized by {isProperty ? 'property' : 'matter'}. Version control ensures the latest draft is always available.</li>
                                        <li><strong>Scheduling & Calendar:</strong> {isProperty ? 'Inspections, rent reviews, and meetings' : 'Hearings, filing deadlines, and client meetings'} are added to the shared calendar. Reminders help avoid missed {isProperty ? 'deadlines' : 'court dates'}.</li>
                                        <li><strong>{isProperty ? 'Financials' : 'Billing'} & Payments:</strong> {isProperty ? 'Rent collections' : 'Time entries'} and expenses are recorded. {isProperty ? 'Receipts' : 'Invoices'} are generated and sent to {isProperty ? 'tenants' : 'clients'}. Payment status is tracked.</li>
                                        <li><strong>Closing a {isProperty ? 'Record' : 'Matter'}:</strong> Once completed, the {isProperty ? 'property record' : 'matter\'s stage'} is updated to “Close”. Files are archived for future reference.</li>
                                    </ol>
                                </div>

                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white">Modules & How They Connect</h4>
                                    <ul className="list-disc pl-5 space-y-1">
                                        <li><strong>Dashboard:</strong> Quick view of active {isProperty ? 'properties' : 'matters'}, your tasks, upcoming deadlines, and recent {isProperty ? 'activity' : 'firm activity'}.</li>
                                        <li><strong>{isProperty ? 'Properties' : 'Matters'}:</strong> Central hub for {isProperty ? 'property' : 'case'} details. Here you can track progress, and view all related documents, tasks, and notes for a specific {isProperty ? 'property' : 'case'}.</li>
                                        <li><strong>Tasks:</strong> Assign, track, and complete {isProperty ? 'operational' : 'legal'} or administrative tasks on a drag-and-drop board.</li>
                                        <li><strong>Documents:</strong> Upload, categorize, and manage all {isProperty ? 'property' : 'project'} files in a central repository, automatically organized by {isProperty ? 'owner' : 'client'} and {isProperty ? 'property' : 'matter'}.</li>
                                        <li><strong>Calendar:</strong> Track {isProperty ? 'inspections' : 'court dates'}, {isProperty ? 'lease expiries' : 'filing deadlines'}, and meetings. Includes automatic conflict detection.</li>
                                        <li><strong>{isProperty ? 'Financials' : 'Billing'}:</strong> Record {isProperty ? 'rent' : 'billable time'}, generate {isProperty ? 'receipts' : 'invoices'}, and manage payments (Admin only in multi-user mode).</li>
                                        <li><strong>Reporting:</strong> A multi-tabbed dashboard for deep analytics on your {isProperty ? 'portfolio\'s' : 'firm\'s'} financial, operational, and compliance health.</li>
                                        <li><strong>Messaging:</strong> Secure team communication linked to specific {isProperty ? 'properties' : 'matters'} (multi-user mode only).</li>
                                        <li><strong>Contacts:</strong> Store {isProperty ? 'tenant, owner' : 'client, opposing counsel'}, and vendor contact details.</li>
                                        <li><strong>Settings:</strong> Customize {isProperty ? 'portfolio' : 'firm'} workflows, templates, and user roles (Admin only).</li>
                                    </ul>
                                </div>
                            </div>
                        </AccordionItem>

                        <AccordionItem title="Understanding the Reporting & Analytics Module">
                            <div className="space-y-6">
                                <div>
                                    <h4 className="font-bold text-lg">Overview</h4>
                                    <p>This module is your team's central hub for data-driven insights. It consolidates financial, operational, and compliance data into easy-to-understand dashboards.</p>
                                </div>
                                <div>
                                    <h4 className="font-bold text-lg">Financial Reports</h4>
                                    <p>Track your team's revenue with the Client Billing Summary. Filter by date ranges to see total amounts billed, collected, and outstanding. This tab also includes a <strong>Tax Intelligence</strong> section to provide estimated VAT liability based on your professional fees. <br /><em>Note: This is for guidance only and is not a substitute for professional tax advice.</em></p>
                                </div>
                                <div>
                                    <h4 className="font-bold text-lg">Business Intelligence</h4>
                                    <p>This powerful, consolidated tab gives you a multi-faceted view of your team's health. Use the toggles to switch between:</p>
                                    <ul className="list-disc pl-5 mt-2">
                                        <li><strong>Case Analytics:</strong> An operational dashboard to monitor the status of all matters and identify stale cases needing attention.</li>
                                        <li><strong>Client Analytics:</strong> A complete overview of your client portfolio, helping you identify top clients and manage receivables.</li>
                                    </ul>
                                </div>
                                <div>
                                    <h4 className="font-bold text-lg">Compliance Reports</h4>
                                    <p>Stay on top of your professional obligations. This report provides a summary of your <strong>Trust Account</strong> balances, flagging any overdrawn accounts. It also helps lawyers track their <strong>Professional Standards</strong>, including the status of their Annual Practicing Fees and progress towards their mandatory CPD hours. (CPD hours can be updated in <code>Settings → My Profile</code>).</p>
                                </div>
                            </div>
                        </AccordionItem>

                        <AccordionItem title="Using ALOA (AI Assistant)">
                            <div className="space-y-6">
                                <div>
                                    <h4 className="font-bold text-lg">What is ALOA?</h4>
                                    <p>ALOA is your AI-powered assistant, designed to help you with tasks, provide insights, and streamline your workflow. You can interact with it by typing or using your voice via the microphone icon.</p>
                                </div>
                                <div>
                                    <h4 className="font-bold text-lg">Knowledge Base & RAG</h4>
                                    <p>ALOA uses **Retrieval Augmented Generation (RAG)** to answer questions based directly on your firm's documents. When you ask about a case, ALOA scans related files to provide accurate, evidence-based answers with citations.</p>
                                </div>
                                <div>
                                    <h4 className="font-bold text-lg">Actionable Insights</h4>
                                    <p>ALOA doesn't just talk; it acts. Responses often include smart buttons to **View Tasks**, **Open Matters**, or **Draft Replies** based on the current context of your conversation.</p>
                                </div>
                                <div>
                                    <h4 className="font-bold text-lg">On-Demand Briefings</h4>
                                    <p>You can ask ALOA for a summary of your day at any time. Simply say "Give me a briefing" to see a snapshot of your overdue tasks, upcoming court dates, and pending invoices.</p>
                                </div>
                            </div>
                        </AccordionItem>

                        <AccordionItem title="Admin Guide">
                            <div className="space-y-6">
                                <div>
                                    <h4 className="font-bold text-lg">Managing {isProperty ? 'Portfolio' : 'Firm'} Details & Branding</h4>
                                    <p>Go to <code>Settings &gt; {isProperty ? 'Portfolio Details' : 'Firm Details'}</code> to customize your logo, letterhead, and digital stamp. These are used to brand all generated document PDFs, invoices, and the {isProperty ? 'tenant' : 'client'} portal.</p>
                                </div>
                                <div>
                                    <h4 className="font-bold text-lg">Team Member Roles & Onboarding</h4>
                                    <p>Admins can invite new users and assign roles ({isProperty ? 'Manager, Staff' : 'Lawyer, Paralegal'}, etc.). Each role has specific permissions. You can also monitor team performance via the Reporting module.</p>
                                </div>
                                <div>
                                    <h4 className="font-bold text-lg">Configuring {isProperty ? 'Operational' : 'Practice Area'} Workflows</h4>
                                    <p>Standardize your {isProperty ? 'operations' : 'firm\'s processes'} by creating custom stages for different {isProperty ? 'property' : 'matter'} types in <code>Settings &gt; Templates</code>. This ensures consistency across all cases.</p>
                                </div>
                            </div>
                        </AccordionItem>

                        <AccordionItem title={isProperty ? "Manager Guide" : "Lawyer Guide"}>
                            <div className="space-y-6">
                                <div>
                                    <h4 className="font-bold text-lg">Intake & Lifecycle Management</h4>
                                    <p>{isProperty ? 'Experience intelligent property onboarding through the Intake Wizard. ALOA safeguards data entry and seamlessly bridges you into the Drafting Lab to auto-populate agreements.' : 'Experience intelligent onboarding through the Enterprise Intake Wizard. ALOA safeguards data entry according to Nigerian procedural rules, and seamlessly bridges you into the Drafting Lab to auto-populate Writs and agreements.'}</p>
                                </div>
                                <div>
                                    <h4 className="font-bold text-lg">{isProperty ? 'Leasing & Maintenance' : 'Procedural Drafting Lab & Research'}</h4>
                                    <p>{isProperty ? 'Transition directly from property intake to the Drafting Lab for high-speed, precise lease execution, supported by maintenance tracking.' : 'Transition directly from matter intake to the Procedural Drafting Lab for high-speed, precise template execution, supported by the Research Studio.'}</p>
                                </div>
                                <div>
                                    <h4 className="font-bold text-lg">{isProperty ? 'Document Management' : 'Document Intelligence (ALDIA)'}</h4>
                                    <p>{isProperty ? 'Let ALOA organize your property documents, tenancy agreements, and title deeds in a central, searchable repository.' : 'Let ALDIA scan your documents for risks, Governing Law, and extracted metadata to save you hours of manual review.'}</p>
                                </div>
                            </div>
                        </AccordionItem>

                        <AccordionItem title={isProperty ? "Staff Guide" : "Paralegal Guide"} defaultOpen={false}>
                            <div className="space-y-6">
                                <div>
                                    <h4 className="font-bold text-lg">Task Management & Delegation</h4>
                                    <p>Stay on top of deadlines with the Kanban Task Board. Receive assignments from {isProperty ? 'managers' : 'lawyers'} and update progress in real-time.</p>
                                </div>
                                {isProperty ? (
                                    <div>
                                        <h4 className="font-bold text-lg">Facility Management</h4>
                                        <p>Track maintenance requests, vendor quotes, and completion status across the entire portfolio.</p>
                                    </div>
                                ) : (
                                    <div>
                                        <h4 className="font-bold text-lg">Court Process Filing</h4>
                                        <p>Use the Litigation Pipeline to track the status of court documents from "Draft" to "Acknowledged", ensuring no filing deadline is missed.</p>
                                    </div>
                                )}
                                <div>
                                    <h4 className="font-bold text-lg">{isProperty ? 'Tenant & Payment Tracking' : 'Property & Maintenance Tracking'}</h4>
                                    <p>{isProperty ? 'Manage tenant records, track rent payments, lease expiries, and issue receipts efficiently.' : 'Manage real estate portfolios for clients, tracking rent payments, lease expiries, and maintenance requests efficiently.'}</p>
                                </div>
                            </div>
                        </AccordionItem>

                        <AccordionItem title="Beta Features & Feedback" defaultOpen={false}>
                            <div className="space-y-6">
                                <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50 rounded-xl">
                                    <h4 className="font-bold text-lg text-amber-800 dark:text-amber-400 flex items-center gap-2">
                                        <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-[10px] uppercase tracking-wider">Beta</span>
                                        What is a Beta Feature?
                                    </h4>
                                    <p className="text-sm text-amber-700 dark:text-amber-300 mt-2 leading-relaxed">
                                        Features marked as <strong>Beta</strong> (like DraftPro and Research Studio) are still being actively refined. While they are fully functional and safe for professional use, you may encounter minor UI polish issues or experimental tools. Your feedback helps us transition these features to General Availability.
                                    </p>
                                </div>
                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white">Active Beta Tools:</h4>
                                    <ul className="list-disc pl-5 space-y-2 text-sm text-gray-600 dark:text-gray-400 mt-2">
                                        <li><strong>DraftPro:</strong> AI-augmented legal word processor for high-speed drafting.</li>
                                        <li><strong>Research Studio:</strong> Advanced deep-dive analysis and chronology building tool.</li>
                                        <li><strong>ALOA Voice:</strong> Real-time voice interaction with your legal assistant.</li>
                                    </ul>
                                </div>
                                <div>
                                    <h4 className="font-bold text-sm text-gray-800 dark:text-white">How to Provide Feedback</h4>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                        Use the <strong>"Send Feedback"</strong> button found in the bottom right of the Settings screen to report any issues or suggest improvements for Beta features.
                                    </p>
                                </div>
                            </div>
                        </AccordionItem>
                    </Accordion>
                </div>
            </div>
        </SettingsCard>
    );
};
