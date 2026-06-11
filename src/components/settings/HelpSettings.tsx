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

                        <AccordionItem title={isProperty ? "Residents' Portal Guide" : "Client Portal Guide"}>
                            <div className="space-y-6">
                                <div className="p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/50 rounded-xl">
                                    <h4 className="font-bold text-lg text-blue-800 dark:text-blue-400 flex items-center gap-2">
                                        <span className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-[10px] uppercase tracking-wider">Portal</span>
                                        {isProperty ? "Residents' Portal Overview" : 'Client Portal Overview'}
                                    </h4>
                                    <p className="text-sm text-blue-700 dark:text-blue-300 mt-2 leading-relaxed">
                                        The {isProperty ? "Residents'" : 'Client'} Portal is a secure, self-service web interface that gives your {isProperty ? 'residents' : 'clients'} controlled access to their {isProperty ? 'financial and maintenance' : 'matter and document'} information — without needing to contact your office for every update. Portals are available on <strong>Growth</strong> and <strong>Pro</strong> plans. Core tier users will see an upgrade prompt instead.
                                    </p>
                                </div>

                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white">What {isProperty ? 'Tenants' : 'Clients'} Can See</h4>
                                    {isProperty ? (
                                        <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600 dark:text-gray-400">
                                            <li><strong>SC/MV Payment Ledger:</strong> A real-time breakdown of Service Charge and Minimum Vend payments, outstanding balances, and payment history per unit.</li>
                                            <li><strong>Automated Rent Receipts:</strong> Download PDF receipts for every confirmed rent payment, branded with your portfolio's letterhead.</li>
                                            <li><strong>Maintenance Ticket System:</strong> Log maintenance issues (plumbing, electrical, structural, other) directly into your workflow. Tenants can see the status of their tickets from open to resolved.</li>
                                        </ul>
                                    ) : (
                                        <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600 dark:text-gray-400">
                                            <li><strong>Milestone Progress Tracker:</strong> A visual timeline of their matter's progress through each stage (Intake → Active → Resolution → Closed), so they always know where things stand.</li>
                                            <li><strong>Secure Document Vault:</strong> Access to all shared documents related to their matter — court filings, correspondence, contracts, and opinions. Documents are read-only and cannot be modified through the portal.</li>
                                            <li><strong>KYC Upload Portal:</strong> A secure upload area for Know-Your-Client documentation (identification, proof of address, corporate registration documents) that flows directly into your firm's matter records.</li>
                                        </ul>
                                    )}
                                </div>

                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white">How to Activate the Portal</h4>
                                    <ol className="list-decimal pl-5 space-y-2 text-sm text-gray-600 dark:text-gray-400">
                                        <li><strong>Check your plan:</strong> Portals are available on Growth and Pro plans only. If you're on Core, navigate to <code>Settings → Subscription</code> to upgrade.</li>
                                        <li><strong>Ensure {isProperty ? 'tenant' : 'client'} records exist:</strong> {isProperty ? 'Each tenant must have a profile with an email address in your Atrium system before they can access the portal.' : 'Each client must have a contact record with an email address linked to at least one active matter before they can access the portal.'}</li>
                                        <li><strong>Generate portal credentials:</strong> Navigate to the {isProperty ? 'tenant' : 'client'}'s detail page and click <strong>"Enable Portal Access"</strong>. The system will generate a unique, secure login for that {isProperty ? 'tenant' : 'client'}.</li>
                                        <li><strong>Share login details:</strong> After generating credentials, you'll see a <strong>"Share Login Details"</strong> button. This allows you to send the portal URL and their login credentials directly to the {isProperty ? 'tenant' : 'client'} via their registered email address. You can also copy the details manually to share through your preferred secure channel.</li>
                                    </ol>
                                </div>

                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white">Sharing Login Details Securely</h4>
                                    <div className="p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50 rounded-lg text-sm text-amber-800 dark:text-amber-300 mb-3">
                                        <strong>Important:</strong> {isProperty ? "Residents'" : 'Client'} portal credentials provide access to sensitive {isProperty ? 'financial and property' : 'legal and personal'} information. Always share login details through secure, encrypted channels.
                                    </div>
                                    <ul className="list-disc pl-5 space-y-2 text-sm text-gray-600 dark:text-gray-400">
                                        <li><strong>Recommended:</strong> Use the built-in "Share Login Details" feature, which sends credentials directly to the {isProperty ? 'tenant' : 'client'}'s registered email address. This avoids manual handling of sensitive credentials.</li>
                                        <li><strong>Alternative:</strong> Copy the portal URL and temporary password, then share via a secure messaging platform (e.g., encrypted email, secure WhatsApp). <strong>Never share credentials via unencrypted SMS or public channels.</strong></li>
                                        <li><strong>First login:</strong> {isProperty ? 'Tenants' : 'Clients'} will be prompted to set their own password on first login. The temporary password you share will expire after 7 days for security.</li>
                                        <li><strong>Legal consideration:</strong> {isVega && 'As a legal practitioner, you have a professional obligation to protect client data under NDPA 2023 and NBA professional standards. The client portal uses the same encryption standards (AES-256 at rest, TLS 1.3 in transit) as your main PracticePro workspace, ensuring that privileged and confidential information remains protected at all times.'}{isProperty && "The Residents' Portal uses the same encryption standards (AES-256 at rest, TLS 1.3 in transit) as your main PracticePro workspace, ensuring that financial and personal data remains protected at all times in compliance with NDPA 2023."}</li>
                                    </ul>
                                </div>

                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white">Portal URL</h4>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                        {isProperty ? 'Tenants' : 'Clients'} can access the portal at:
                                    </p>
                                    <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg font-mono text-sm text-primary-600 dark:text-primary-400 break-all">
                                        {isProperty ? 'https://practicepro.ng/portal/tenant/login' : 'https://practicepro.ng/portal/client/login'}
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                        This URL is also available in the footer of your product landing page. {isProperty ? 'Tenants' : 'Clients'} can bookmark it for direct access.
                                    </p>
                                </div>

                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white">Managing Portal Access</h4>
                                    <ul className="list-disc pl-5 space-y-2 text-sm text-gray-600 dark:text-gray-400">
                                        <li><strong>Revoking access:</strong> Navigate to the {isProperty ? 'tenant' : 'client'}'s detail page and click <strong>"Revoke Portal Access"</strong>. This immediately disables their login credentials. They will see a "Access Revoked" message when attempting to log in.</li>
                                        <li><strong>Resetting a password:</strong> If a {isProperty ? 'tenant' : 'client'} forgets their password, click <strong>"Reset Portal Password"</strong> on their detail page. A new temporary password will be generated that you can share securely.</li>
                                        <li><strong>Viewing access logs:</strong> The {isProperty ? 'tenant' : 'client'} detail page shows the last login timestamp and total number of portal sessions, helping you monitor engagement and detect unauthorized access.</li>
                                    </ul>
                                </div>

                                <div>
                                    <h4 className="font-bold text-lg text-gray-800 dark:text-white">Security & Data Protection</h4>
                                    <ul className="list-disc pl-5 space-y-2 text-sm text-gray-600 dark:text-gray-400">
                                        <li><strong>Encryption:</strong> All portal data is encrypted at rest (AES-256) and in transit (TLS 1.3), matching the security standards of the main PracticePro workspace.</li>
                                        <li><strong>Scope-limited access:</strong> {isProperty ? 'Tenants' : 'Clients'} can only see information specifically shared with them. They cannot access other {isProperty ? 'tenants\' records, portfolio-level data, or internal workflows' : 'clients\' matters, firm-level data, or internal workflows'}.</li>
                                        <li><strong>Session management:</strong> Portal sessions expire after 30 minutes of inactivity. {isProperty ? 'Tenants' : 'Clients'} must re-authenticate to continue.</li>
                                        <li><strong>Audit trail:</strong> Every portal access, document download, and action is logged with a timestamp and IP address, available in your compliance reporting module.</li>
                                        <li><strong>NDPA 2023 compliance:</strong> Portal operations comply with the Nigeria Data Protection Act 2023. {isProperty ? 'Tenants' : 'Clients'} can request data access or deletion through you as the data controller.</li>
                                    </ul>
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
