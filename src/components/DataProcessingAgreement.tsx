import React from 'react';
import { ChevronLeftIcon as ChevronLeft } from '../constants';

/**
 * Data Processing Agreement — rewritten in plain English.
 *
 * Design goals:
 *   - Short sentences (no more than 25 words where possible).
 *   - Everyday words instead of legal jargon.
 *   - Active voice. Address the reader as "you," the company as "we" or "PracticePro."
 *   - Legal terms (Data Controller, Data Processor, DPIA, SCCs) defined inline the
 *     first time they appear, in a parenthetical.
 *   - Bullets for lists. One idea per paragraph.
 *   - Always render in light mode (see index.html — `html.dark` is set when the OS
 *     theme is dark). The `style={{ colorScheme: 'light' }}` on the root and the
 *     absence of any `dark:` Tailwind classes guarantee this.
 *
 * Structural fixes applied in this rewrite:
 *   - Sticky bar title changed from `<h1>` to `<span>` (the document title block H1
 *     is the canonical one — no duplicate H1 for accessibility).
 *   - TOC item #15 renamed from "Signatures" to "Execution and Acceptance" to match
 *     the actual §15 heading (which states no manual signature is required).
 *   - Version aligned to 1.1 everywhere. The header said "Version: 1.1" and the
 *     footer said "v1.0"; the footer now reads "Version 1.1".
 *   - Added a plain-English "In short" summary box at the top, matching the
 *     CookiePolicy / PrivacyPolicy / TermsOfService sister files.
 *   - Rewrote §5.6 (Leaked Data Remediation) as a numbered list with plain verbs:
 *     Find and isolate, Fix or delete, Tell the Controller, Log it, Prevent it
 *     happening again.
 *   - Added inline glosses for ALOA™/ARIA™, RTO/RPO, ISO 27001:2022, Standard
 *     Contractual Clauses, DPIA, and the six Data Subject rights in §7.
 *
 * All legally material disclosures are preserved: NDPA 2023, NDPR 2019,
 * the Controller/Processor role split, the 24-hour breach notification to
 * Controller (so the Controller can meet its 72-hour NDPC duty under NDPA
 * Section 40), the 60-day data export window, the 30-day audit notice, the
 * 12-month liability cap with its exceptions (fraud, wilful misconduct,
 * death/personal injury), survival of confidentiality/liability/governing-law
 * clauses, governing law (Nigeria), exclusive Lagos State jurisdiction, the
 * Sub-processor list (Google Cloud Platform, Google Gemini API, Convex Inc.),
 * the 14-day Sub-processor change notice, the "no AI training on user data"
 * commitment, AES-256 at rest / TLS 1.3 in transit, multi-factor authentication,
 * 12-month audit log retention, ISO 27001:2022 alignment, Standard Contractual
 * Clauses for international transfers, the dual-role acknowledgement, Founder
 * administrative access (role-restricted, audit-logged, not for reading user
 * content), the emergency data purge right (with 24-hour post-notification),
 * the dpo@practicepro.ng contact, and the "no manual signature required"
 * auto-effect rule.
 */

export const DataProcessingAgreement: React.FC<{ onBack: () => void; activeProduct?: 'vega' | 'atrium' }> = ({ onBack, activeProduct = 'vega' }) => {
    const isVega = activeProduct === 'vega';
    const isProperty = !isVega;
    return (
        <div className="w-full h-full bg-white flex flex-col overflow-hidden font-sans" style={{ colorScheme: 'light' }} data-public-page>
            <div className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 h-16 flex items-center justify-between">
                <button onClick={onBack} className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors font-medium text-sm">
                    <ChevronLeft className="w-5 h-5" />
                    Back
                </button>
                {/* Sticky-bar title is a <span>, not an <h1>, so the document
                    title block below is the single canonical H1. */}
                <span className="font-bold text-slate-900">Data Processing Agreement</span>
                <div className="w-16" />
            </div>

            <div className="flex-1 overflow-y-auto scroll-smooth custom-scrollbar">
                <div className="max-w-4xl mx-auto px-6 sm:px-12 py-12 lg:py-20">

                    <div className="mb-16">
                        <h1 className="text-4xl font-bold text-slate-900 mb-4">Data Processing Agreement</h1>
                        <p className="text-sm font-semibold text-slate-600 mb-2 uppercase tracking-tight">PracticePro Systems Limited</p>
                        <div className="flex flex-col text-xs text-slate-500 italic mb-6">
                            <span>Effective Date: August 11, 2026</span>
                            <span>Version: 1.1</span>
                        </div>
                        <div className="p-5 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 leading-relaxed">
                            <strong>Important:</strong> This Data Processing Agreement ("DPA") explains how PracticePro
                            Systems Limited ("Processor" or "we") handles personal data on behalf of the{' '}
                            {isVega ? 'law firm or legal practitioner' : 'property manager or real estate agency'}{" "}
                            ("Controller" or "you") that has accepted the PracticePro Terms of Service. This DPA is part
                            of the main Service Agreement.
                        </div>
                    </div>

                    {/* Plain-English summary box — gives the reader the gist in 3-4 sentences */}
                    <div className="mb-12 p-5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 leading-relaxed">
                        <strong className="text-slate-900">In short:</strong> A Data Processing Agreement (DPA) explains
                        how we, PracticePro, handle personal data on your behalf. You are the Controller (you decide why
                        and how personal data is used); we are the Processor (we handle it for you under your
                        instructions). This DPA is part of your main Service Agreement with PracticePro, and it starts
                        automatically the moment you register an account. It applies to all {isVega ? 'client' : 'tenant'}{' '}
                        data you store on the Platform.
                    </div>

                    <div className="prose prose-slate max-w-none prose-p:leading-[1.8] prose-p:mb-8 prose-h2:mt-16 prose-h2:mb-6 prose-h2:text-2xl prose-h2:font-bold prose-h2:border-b-2 prose-h2:pb-3 prose-h2:border-slate-200 prose-h3:mt-10 prose-h3:mb-4 prose-h3:text-lg prose-h3:font-bold prose-ul:mb-8 prose-ul:space-y-3 prose-li:leading-relaxed">

                        {/* TOC */}
                        <div className="bg-slate-50 border border-slate-200 p-6 rounded-lg mb-12">
                            <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Table of Contents</p>
                            <ol className="list-decimal pl-5 space-y-1.5 text-sm text-slate-700">
                                {['Definitions','Scope and Duration','Roles of the Parties','Controller Obligations','Processor Obligations','Sub-Processors','Data Subject Rights','Security Measures','Personal Data Breaches','International Data Transfers','Audit Rights','Liability','Termination and Data Return','Governing Law','Execution and Acceptance'].map((item, i) => (
                                    <li key={i}>{item}</li>
                                ))}
                            </ol>
                        </div>

                        {/* 1 */}
                        <section className="mb-14">
                            <h2>1. Definitions</h2>
                            <p>In this Agreement, the terms below mean:</p>
                            <ul className="list-disc pl-6 space-y-3">
                                <li><strong>"Controller"</strong> — the {isVega ? 'law firm or legal practitioner' : 'property manager or real estate agency'} that decides why and how personal data is used, and has signed the Service Agreement with us.</li>
                                <li><strong>"Processor"</strong> — PracticePro Systems Limited, which handles personal data on behalf of the Controller.</li>
                                <li><strong>"Personal Data"</strong> — any information about an identified or identifiable natural person, handled through the Services.</li>
                                <li><strong>"Processing"</strong> — anything done with Personal Data, such as collecting, storing, using, sharing, or deleting it.</li>
                                <li><strong>"Data Subject"</strong> — the natural person the Personal Data is about.</li>
                                <li><strong>"NDPA"</strong> — the Nigerian Data Protection Act 2023 and its regulations.</li>
                                <li><strong>"NDPR"</strong> — the Nigeria Data Protection Regulation 2019.</li>
                                <li><strong>"Sub-Processor"</strong> — any third party we engage to handle Personal Data on the Controller's behalf.</li>
                                <li><strong>"Services"</strong> — the PracticePro {isVega ? 'VEGA legal practice management platform' : 'ATRIUM property management platform'} and its AI services.</li>
                                <li><strong>{isVega ? '"Privileged Data"' : '"Confidential Data"'}</strong> — information protected by {isVega ? 'legal professional privilege or attorney-client confidentiality' : 'commercial confidentiality'} under Nigerian law.</li>
                            </ul>
                        </section>

                        {/* 2 */}
                        <section className="mb-14">
                            <h2>2. Scope and Duration</h2>
                            <h3>2.1 Subject Matter</h3>
                            <p>This DPA covers all Personal Data we handle to provide the Services. That includes {isVega ? 'client data, matter information' : 'tenant data, property information'}, documents, time entries, financial records, and communications you enter or create on the Platform.</p>
                            <h3>2.2 Nature of Processing</h3>
                            <p>We handle Personal Data only as needed to provide the Services. That includes hosting, storage, AI-powered analysis through our AI assistants (ALOA™ for Vega, ARIA™ for Atrium), billing, and technical support.</p>
                            <h3>2.3 Duration</h3>
                            <p>This DPA stays in effect for the duration of the Service Agreement. It ends automatically when the Services end, subject to the data return and deletion rules in Section 13.</p>
                        </section>

                        {/* 3 */}
                        <section className="mb-14">
                            <h2>3. Roles of the Parties</h2>
                            <h3>3.1 Controller Role</h3>
                            <p>The Controller controls all {isVega ? 'client Personal Data, case information' : 'tenant Personal Data, property information'}, and {isProperty ? 'property documents' : 'legal documents'} entered into the Platform. The Controller decides why and how that data is used.</p>
                            <h3>3.2 Processor Role</h3>
                            <p>We act only as a Data Processor for {isVega ? 'client' : 'tenant'} data. We may act as a Data Controller for our own operational data, such as billing and account management.</p>
                            <h3>3.3 Dual Role Acknowledgement</h3>
                            <p>Both parties agree that this dual-role structure follows the NDPA 2023. Each party must independently meet the data-protection duties that apply to its role.</p>
                        </section>

                        {/* 4 */}
                        <section className="mb-14">
                            <h2>4. Controller Obligations</h2>
                            <p>The Controller confirms that:</p>
                            <ul className="list-disc pl-6 space-y-3">
                                <li>It has all permissions required under the NDPA to transfer Personal Data to us for handling under this DPA.</li>
                                <li>It will use the Services in line with all applicable data-protection laws, including the NDPA and NDPR.</li>
                                <li>It will promptly tell us about any legal changes that could affect how we handle Personal Data.</li>
                                <li>It is responsible for the accuracy and legality of the Personal Data submitted to the Platform.</li>
                                <li>It will keep adequate privacy notices and policies that tell Data Subjects about the handling described in this DPA.</li>
                            </ul>
                        </section>

                        {/* 5 */}
                        <section className="mb-14">
                            <h2>5. Processor Obligations</h2>
                            <h3>5.1 Handling Instructions</h3>
                            <p>We will handle Personal Data only on the Controller's documented instructions, as set out in this DPA and the Service Agreement. We will tell the Controller immediately if an instruction would break data-protection law.</p>
                            <h3>5.2 Confidentiality</h3>
                            <p>We make sure everyone authorised to handle Personal Data is bound by confidentiality duties and has had suitable data-protection training.</p>
                            <h3>5.3 {isVega ? 'Privileged' : 'Confidential'} Information</h3>
                            <p>We understand that {isVega ? 'Privileged Data' : 'Confidential Data'} handled through the Platform is highly sensitive. We put extra access controls in place so that {isVega ? 'Privileged Data' : 'Confidential Data'} is not seen by our staff, except where strictly needed to give technical support, and only with the Controller's prior written consent.</p>
                            <h3>5.4 No Secondary Use</h3>
                            <p>We will not use Personal Data or {isVega ? 'Privileged Data' : 'Confidential Data'} for any purpose other than providing the Services. {isVega ? 'Client' : 'Tenant'} data is not used to train AI models or for any commercial purpose beyond this DPA.</p>
                            <h3>5.5 Assistance</h3>
                            <p>We will give reasonable help to the Controller with:</p>
                            <ul className="list-disc pl-6 space-y-3">
                                <li>Data Subject rights requests (see Section 7)</li>
                                <li>Security duties</li>
                                <li>Breach notification duties</li>
                                <li>Data protection impact assessments (DPIAs — reviews we do when a new use of data could be high-risk to people's privacy)</li>
                            </ul>
                            <h3>5.6 Leaked Data Remediation</h3>
                            <p>If Personal Data has leaked outside where it should be stored, we will:</p>
                            <ol className="list-decimal pl-6 space-y-3">
                                <li><strong>Find and isolate</strong> the leaked data within 24 hours of discovery.</li>
                                <li><strong>Fix or delete</strong> the affected records so they can't be accessed again.</li>
                                <li><strong>Tell the Controller</strong> what happened, what data was affected, and what we did.</li>
                                <li><strong>Log it</strong> in the security audit trail.</li>
                                <li><strong>Prevent it happening again</strong> by putting stronger controls in place.</li>
                            </ol>
                            <p>We may carry out an emergency deletion of data without the Controller's prior approval, when the leak still poses a privacy risk. We will tell the Controller after the fact within 24 hours.</p>
                            <h3>5.7 Founder Administrative Access</h3>
                            <p>PracticePro's founder team has emergency administrative access through a separate admin app. They use it for incident response, security investigations, and platform health checks. This access is limited to founder accounts, and every use is logged in the security audit trail. It is for operational and security purposes only — not for reading user content, AI conversations, or feedback submissions (except where leaked data remediation requires it).</p>
                        </section>

                        {/* 6 */}
                        <section className="mb-14">
                            <h2>6. Sub-Processors</h2>
                            <h3>6.1 Authorised Sub-Processors</h3>
                            <p>The Controller gives general permission for us to engage Sub-Processors. The current list is:</p>
                            <div className="overflow-x-auto my-6 rounded-lg border border-slate-200">
                                <table className="w-full text-sm border-collapse">
                                    <thead className="bg-slate-100">
                                        <tr>
                                            {['Sub-Processor','Location','Purpose'].map(h => (
                                                <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wide border-b border-slate-200">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[
                                            ['Google Cloud Platform','USA / Multi-region','Cloud hosting, database, and storage infrastructure'],
                                            ['Google Gemini API','USA','AI language model processing (ALOA™ for Vega, ARIA™ for Atrium)'],
                                            ['Convex Inc.','USA','Real-time database and backend infrastructure'],
                                        ].map(([sp, loc, purpose], i) => (
                                            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                                <td className="px-4 py-3 font-medium text-slate-800 border-b border-slate-100">{sp}</td>
                                                <td className="px-4 py-3 text-slate-600 border-b border-slate-100">{loc}</td>
                                                <td className="px-4 py-3 text-slate-600 border-b border-slate-100">{purpose}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <h3>6.2 Sub-Processor Changes</h3>
                            <p>We will give the Controller at least 14 days' written notice before adding or replacing any Sub-Processor. The Controller may object within that period on reasonable data-protection grounds.</p>
                            <h3>6.3 Sub-Processor Obligations</h3>
                            <p>We will require each Sub-Processor to follow the same data-protection rules as in this DPA, and we are responsible if a Sub-Processor fails to meet them.</p>
                        </section>

                        {/* 7 */}
                        <section className="mb-14">
                            <h2>7. Data Subject Rights</h2>
                            <p>Where we legally can, we will promptly tell the Controller about any Data Subject rights request we receive directly. We will not respond to such requests without the Controller's written permission, unless required by law.</p>
                            <p>We will help the Controller respond to Data Subject rights requests within the timeframes the NDPA requires. Data Subject rights are:</p>
                            <ul className="list-disc pl-6 space-y-3">
                                <li><strong>Access</strong> — to ask what data we hold about them</li>
                                <li><strong>Rectification</strong> — to correct wrong data</li>
                                <li><strong>Erasure</strong> — to delete their data</li>
                                <li><strong>Restriction</strong> — to limit how we use it</li>
                                <li><strong>Portability</strong> — to get their data in a movable format</li>
                                <li><strong>Objection</strong> — to stop us using it</li>
                            </ul>
                        </section>

                        {/* 8 */}
                        <section className="mb-14">
                            <h2>8. Security Measures</h2>
                            <p>We will put in place and maintain suitable technical and organisational measures to protect Personal Data against accidental or unlawful destruction, loss, alteration, unauthorised disclosure, or access. These measures include:</p>
                            <ul className="list-disc pl-6 space-y-3">
                                <li><strong>Encryption:</strong> AES-256 encryption at rest and TLS 1.3 in transit for all Personal Data.</li>
                                <li><strong>Access control:</strong> role-based access, multi-factor authentication options, and people only get the access they actually need.</li>
                                <li><strong>Audit logging:</strong> full audit trails of all access to and changes of Personal Data, kept for at least 12 months.</li>
                                <li><strong>Vulnerability management:</strong> regular security assessments, penetration testing, and patch cycles.</li>
                                <li><strong>Business continuity:</strong> automated encrypted backups with recovery time and recovery point objectives (how quickly we restore service and how much data we can lose).</li>
                                <li><strong>ISO 27001 alignment:</strong> security practices aligned with the ISO 27001:2022 information security management framework — an international standard for keeping information secure.</li>
                            </ul>
                        </section>

                        {/* 9 */}
                        <section className="mb-14">
                            <h2>9. Personal Data Breaches</h2>
                            <h3>9.1 Notification</h3>
                            <p>If a Personal Data Breach happens, we will tell the Controller <strong>within 24 hours</strong> of becoming aware of it. This timing lets the Controller meet its 72-hour notification duty to the Nigeria Data Protection Commission (NDPC) under Section 40 of the NDPA.</p>
                            <h3>9.2 Breach Information</h3>
                            <p>The notice will include, where we have it: the nature of the breach, the categories and approximate number of Data Subjects and records affected, likely consequences, and the measures taken or planned to address it.</p>
                            <h3>9.3 Assistance</h3>
                            <p>We will fully cooperate with the Controller and give all reasonable help in investigating and fixing any Personal Data Breach.</p>
                        </section>

                        {/* 10 */}
                        <section className="mb-14">
                            <h2>10. International Data Transfers</h2>
                            <p>When we transfer Personal Data outside Nigeria (including to Sub-Processors in the USA or elsewhere), we will make sure proper safeguards are in place, as required by the NDPA. That includes Standard Contractual Clauses (SCCs — pre-approved contract terms that the law accepts for moving data across borders) or equivalent measures. The receiving entity must provide a level of data protection equivalent to that required by Nigerian law.</p>
                        </section>

                        {/* 11 */}
                        <section className="mb-14">
                            <h2>11. Audit Rights</h2>
                            <p>The Controller may audit, or commission an audit of, our data-handling activities and security measures — by giving at least 30 days' written notice, at the Controller's expense. We will fully cooperate with any such audit.</p>
                            <p>We may also meet this duty by giving the Controller up-to-date third-party audit reports, certifications, or compliance attestations relevant to the Services.</p>
                        </section>

                        {/* 12 */}
                        <section className="mb-14">
                            <h2>12. Liability</h2>
                            <p>Each party is responsible for damage caused by data handling that breaks the NDPA or this DPA, unless it can show it was not at fault.</p>
                            <p>The total liability of each party under this DPA will not exceed the fees the Controller paid us in the 12 months before the incident. This cap does not apply to fraud, wilful misconduct, or death or personal injury.</p>
                        </section>

                        {/* 13 */}
                        <section className="mb-14">
                            <h2>13. Termination and Data Return</h2>
                            <h3>13.1 Return of Data</h3>
                            <p>When the Service Agreement ends or expires, we will make all Personal Data available to the Controller for export within <strong>60 days</strong>, in a standard, machine-readable format. The Platform's built-in Data Export feature (Settings → Data &amp; Export) can be used for this.</p>
                            <h3>13.2 Deletion</h3>
                            <p>After the export period, we will securely delete all Personal Data from our systems and those of our Sub-Processors, unless retention is required by law. We will give written confirmation of deletion on request.</p>
                            <h3>13.3 Survival</h3>
                            <p>The confidentiality, liability, and governing law clauses continue after this DPA ends.</p>
                        </section>

                        {/* 14 */}
                        <section className="mb-14">
                            <h2>14. Governing Law</h2>
                            <p>This DPA is governed by the laws of the Federal Republic of Nigeria. Any dispute about this DPA will be handled by the courts of Lagos State, Nigeria.</p>
                        </section>

                        {/* 15 — Execution and Acceptance */}
                        <section className="mb-14">
                            <h2>15. Execution and Acceptance</h2>
                            <p>This Agreement starts automatically when the Controller accepts the PracticePro Terms of Service, registers an account, or first processes Personal Data on the Platform. <strong>No manual signature is required.</strong></p>
                            <div className="mt-8 p-6 bg-primary-50/50 border border-primary-100 rounded-lg flex items-start gap-4">
                                <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                                    <svg className="w-4 h-4 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-900 mb-1">Acknowledgement of Terms</h4>
                                    <p className="text-sm text-slate-600 leading-relaxed">
                                        By continuing to use PracticePro {isVega ? 'VEGA' : 'ATRIUM'} and storing {isVega ? 'client' : 'tenant'} data on our servers, you confirm that you have read, understood, and agreed to the data-handling terms in this DPA. This creates a binding legal contract under the NDPA 2023.
                                    </p>
                                </div>
                            </div>
                            <p className="mt-6">For any questions about this DPA, contact our Data Protection Officer at <a href="mailto:dpo@practicepro.ng" className="text-primary-600 no-underline hover:underline">dpo@practicepro.ng</a>.</p>
                        </section>

                    </div>

                    <div className="h-32 pt-20 border-t border-slate-100 mt-20 text-center">
                        <p className="text-2xs text-slate-400 font-bold uppercase tracking-widest">
                            PracticePro {isVega ? 'VEGA' : 'ATRIUM'} · Data Processing Agreement Version 1.1 · © 2026 PracticePro Systems Limited
                        </p>
                    </div>
                    <div className="h-20 sm:h-0" />
                </div>
            </div>
        </div>
    );
};

export default DataProcessingAgreement;
