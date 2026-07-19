import React from 'react';
import { ChevronLeftIcon as ChevronLeft } from '../constants';

export const DataProcessingAgreement: React.FC<{ onBack: () => void; activeProduct?: 'vega' | 'atrium' }> = ({ onBack, activeProduct = 'vega' }) => {
    const isVega = activeProduct === 'vega';
    const isProperty = !isVega;
    return (
        <div className="w-full h-full bg-white dark:bg-zinc-900 flex flex-col overflow-hidden font-sans">
            <div className="sticky top-0 z-50 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-b border-slate-200 dark:border-zinc-800 px-4 h-16 flex items-center justify-between">
                <button onClick={onBack} className="flex items-center gap-2 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors font-medium text-sm">
                    <ChevronLeft className="w-5 h-5" />
                    Back
                </button>
                <h1 className="font-bold text-slate-900 dark:text-white">Data Processing Agreement</h1>
                <div className="w-16" />
            </div>

            <div className="flex-1 overflow-y-auto scroll-smooth custom-scrollbar">
                <div className="max-w-4xl mx-auto px-6 sm:px-12 py-12 lg:py-20">

                    <div className="mb-16">
                        <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">Data Processing Agreement</h1>
                        <p className="text-sm font-semibold text-slate-600 dark:text-zinc-400 mb-2 uppercase tracking-tight">PracticePro Legal Technologies Limited</p>
                        <div className="flex flex-col text-xs text-slate-500 dark:text-zinc-500 italic mb-6">
                            <span>Effective Date: July 19, 2026</span>
                            <span>Version: 1.0</span>
                        </div>
                        <div className="p-5 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/40 rounded-xl text-sm text-amber-800 dark:text-amber-300 leading-relaxed">
                            <strong>Important:</strong> This Data Processing Agreement ("DPA") governs the processing of personal data by PracticePro Legal Technologies Limited ("Processor") on behalf of the {isVega ? 'law firm or legal practitioner' : 'property manager or real estate agency'} ("Controller") that has agreed to the PracticePro Terms of Service. This DPA is incorporated by reference into and forms part of the main Service Agreement.
                        </div>
                    </div>

                    <div className="prose prose-slate dark:prose-invert max-w-none prose-p:leading-[1.8] prose-p:mb-8 prose-h2:mt-16 prose-h2:mb-6 prose-h2:text-2xl prose-h2:font-bold prose-h2:border-b-2 prose-h2:pb-3 prose-h2:border-slate-200 dark:prose-h2:border-zinc-800 prose-h3:mt-10 prose-h3:mb-4 prose-h3:text-lg prose-h3:font-bold prose-ul:mb-8 prose-ul:space-y-3 prose-li:leading-relaxed">

                        {/* TOC */}
                        <div className="bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700 p-6 rounded-xl mb-12">
                            <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Table of Contents</p>
                            <ol className="list-decimal pl-5 space-y-1.5 text-sm text-slate-700 dark:text-zinc-300">
                                {['Definitions','Scope and Duration','Roles of the Parties','Controller Obligations','Processor Obligations','Sub-Processors','Data Subject Rights','Security Measures','Personal Data Breaches','Data Transfers','Audit Rights','Liability','Termination and Data Return','Governing Law','Signatures'].map((item, i) => (
                                    <li key={i}>{item}</li>
                                ))}
                            </ol>
                        </div>

                        {/* 1 */}
                        <section className="mb-14">
                            <h2>1. Definitions</h2>
                            <p>In this Agreement, the following terms shall have the meanings given below:</p>
                            <ul className="list-disc pl-6 space-y-3">
                                <li><strong>"Controller"</strong> means the {isVega ? 'law firm or legal practitioner' : 'property manager or real estate agency'} that determines the purposes and means of processing personal data and has entered into the Service Agreement with the Processor.</li>
                                <li><strong>"Processor"</strong> means PracticePro Legal Technologies Limited, which processes personal data on behalf of the Controller.</li>
                                <li><strong>"Personal Data"</strong> means any information relating to an identified or identifiable natural person processed in connection with the Services.</li>
                                <li><strong>"Processing"</strong> means any operation or set of operations performed on Personal Data, including collection, recording, storage, use, disclosure, or deletion.</li>
                                <li><strong>"Data Subject"</strong> means the natural person to whom the Personal Data relates.</li>
                                <li><strong>"NDPA"</strong> means the Nigerian Data Protection Act 2023 and any regulations made thereunder.</li>
                                <li><strong>"NDPR"</strong> means the Nigeria Data Protection Regulation 2019.</li>
                                <li><strong>"Sub-Processor"</strong> means any third party engaged by the Processor to process Personal Data on behalf of the Controller.</li>
                                <li><strong>"Services"</strong> means the PracticePro {isVega ? 'VEGA legal practice management platform' : 'ATRIUM property management platform'} and associated AI services.</li>
                                <li><strong>{isVega ? '"Privileged Data"' : '"Confidential Data"'}</strong> means information protected by {isVega ? 'legal professional privilege or attorney-client confidentiality' : 'commercial confidentiality'} under Nigerian law.</li>
                            </ul>
                        </section>

                        {/* 2 */}
                        <section className="mb-14">
                            <h2>2. Scope and Duration</h2>
                            <h3>2.1 Subject Matter</h3>
                            <p>This DPA applies to all Personal Data processed by the Processor in connection with the provision of the Services to the Controller, including {isVega ? 'client data, matter information' : 'tenant data, property information'}, documents, time entries, financial records, and communications entered into or generated through the Platform.</p>
                            <h3>2.2 Nature of Processing</h3>
                            <p>The Processor shall process Personal Data only to the extent necessary to provide the Services, including hosting, storage, AI-powered analysis (via ARIA®), billing, and technical support.</p>
                            <h3>2.3 Duration</h3>
                            <p>This DPA shall remain in force for the duration of the Service Agreement and shall terminate automatically upon the conclusion of all Services, subject to the data return and deletion obligations in Clause 13.</p>
                        </section>

                        {/* 3 */}
                        <section className="mb-14">
                            <h2>3. Roles of the Parties</h2>
                            <h3>3.1 Controller Role</h3>
                            <p>The Controller is the Data Controller in respect of all {isVega ? 'client Personal Data, case information' : 'tenant Personal Data, property information'}, and {isProperty ? 'property documents' : 'legal documents'} entered into the Platform. The Controller determines the purposes and means of processing such data.</p>
                            <h3>3.2 Processor Role</h3>
                            <p>The Processor acts solely as a Data Processor in respect of {isVega ? 'client' : 'tenant'} data. The Processor may act as a Data Controller for its own operational data (e.g., billing and account management).</p>
                            <h3>3.3 Dual Role Acknowledgement</h3>
                            <p>Both parties acknowledge and agree that this dual-role structure is consistent with the NDPA 2023 and that each party shall independently ensure compliance with applicable data protection obligations relevant to its role.</p>
                        </section>

                        {/* 4 */}
                        <section className="mb-14">
                            <h2>4. Controller Obligations</h2>
                            <p>The Controller represents, warrants, and undertakes that:</p>
                            <ul className="list-disc pl-6 space-y-3">
                                <li>It has obtained all necessary consents, authorisations, and legal bases required under the NDPA to transfer Personal Data to the Processor for processing under this DPA.</li>
                                <li>It shall ensure that its use of the Services complies with all applicable data protection laws, including the NDPA and NDPR.</li>
                                <li>It shall promptly inform the Processor of any changes to applicable legal requirements that may affect the Processor's processing activities.</li>
                                <li>It is responsible for the accuracy, quality, and legality of Personal Data submitted to the Platform.</li>
                                <li>It shall have in place adequate privacy notices and policies that inform Data Subjects of the processing activities described in this DPA.</li>
                            </ul>
                        </section>

                        {/* 5 */}
                        <section className="mb-14">
                            <h2>5. Processor Obligations</h2>
                            <h3>5.1 Processing Instructions</h3>
                            <p>The Processor shall process Personal Data only on documented instructions from the Controller as set out in this DPA and the Service Agreement. The Processor shall immediately inform the Controller if any instruction infringes applicable data protection law.</p>
                            <h3>5.2 Confidentiality</h3>
                            <p>The Processor shall ensure that all personnel authorised to process Personal Data are subject to binding confidentiality obligations and have received appropriate data protection training.</p>
                            <h3>5.3 {isVega ? 'Privileged' : 'Confidential'} Information</h3>
                            <p>The Processor acknowledges the heightened sensitivity of {isVega ? 'Privileged Data' : 'Confidential Data'} processed through the Platform. The Processor shall implement additional access controls to ensure that {isVega ? 'Privileged Data' : 'Confidential Data'} is not accessed by Processor personnel except where strictly necessary to provide technical support, and only with the Controller's prior written consent.</p>
                            <h3>5.4 No Secondary Use</h3>
                            <p>The Processor shall not use Personal Data or {isVega ? 'Privileged Data' : 'Confidential Data'} for any purpose other than the provision of the Services. {isVega ? 'Client' : 'Tenant'} data shall not be used to train AI models or for any commercial purpose beyond the scope of this DPA.</p>
                            <h3>5.5 Assistance</h3>
                            <p>The Processor shall provide reasonable assistance to the Controller in ensuring compliance with Data Subject rights requests, security obligations, breach notification duties, and data protection impact assessments.</p>
                        </section>

                        {/* 6 */}
                        <section className="mb-14">
                            <h2>6. Sub-Processors</h2>
                            <h3>6.1 Authorised Sub-Processors</h3>
                            <p>The Controller grants general authorisation for the Processor to engage Sub-Processors. The current list of authorised Sub-Processors includes:</p>
                            <div className="overflow-x-auto my-6 rounded-xl border border-slate-200 dark:border-zinc-700">
                                <table className="w-full text-sm border-collapse">
                                    <thead className="bg-slate-100 dark:bg-zinc-800">
                                        <tr>
                                            {['Sub-Processor','Location','Purpose'].map(h => (
                                                <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-700 dark:text-zinc-200 uppercase tracking-wide border-b border-slate-200 dark:border-zinc-700">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[
                                            ['Google Cloud Platform','USA / Multi-region','Cloud hosting, database, and storage infrastructure'],
                                            ['Google Gemini API','USA','AI language model processing (ARIA® engine)'],
                                            ['Convex Inc.','USA','Real-time database and backend infrastructure'],
                                            
                                        ].map(([sp, loc, purpose], i) => (
                                            <tr key={i} className={i % 2 === 0 ? 'bg-white dark:bg-zinc-900' : 'bg-slate-50 dark:bg-zinc-800/50'}>
                                                <td className="px-4 py-3 font-medium text-slate-800 dark:text-zinc-200 border-b border-slate-100 dark:border-zinc-800">{sp}</td>
                                                <td className="px-4 py-3 text-slate-600 dark:text-zinc-400 border-b border-slate-100 dark:border-zinc-800">{loc}</td>
                                                <td className="px-4 py-3 text-slate-600 dark:text-zinc-400 border-b border-slate-100 dark:border-zinc-800">{purpose}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <h3>6.2 Sub-Processor Changes</h3>
                            <p>The Processor shall give the Controller at least 14 days' written notice before adding or replacing any Sub-Processor. The Controller may object to such changes within that period on reasonable data protection grounds.</p>
                            <h3>6.3 Sub-Processor Obligations</h3>
                            <p>The Processor shall impose data protection obligations on each Sub-Processor equivalent to those set out in this DPA and shall remain fully liable to the Controller for the performance of Sub-Processors' obligations.</p>
                        </section>

                        {/* 7 */}
                        <section className="mb-14">
                            <h2>7. Data Subject Rights</h2>
                            <p>The Processor shall, to the extent legally permissible and technically feasible, promptly notify the Controller of any Data Subject rights request received directly by the Processor. The Processor shall not respond to such requests without the Controller's written authorisation, unless required to do so by law.</p>
                            <p>The Processor shall assist the Controller in responding to Data Subject rights requests within the timelines required by the NDPA, including requests for access, rectification, erasure, restriction, portability, and objection to processing.</p>
                        </section>

                        {/* 8 */}
                        <section className="mb-14">
                            <h2>8. Security Measures</h2>
                            <p>The Processor shall implement and maintain appropriate technical and organisational security measures to protect Personal Data against accidental or unlawful destruction, loss, alteration, unauthorised disclosure, or access. These measures include:</p>
                            <ul className="list-disc pl-6 space-y-3">
                                <li><strong>Encryption:</strong> AES-256 encryption at rest and TLS 1.3 in transit for all Personal Data.</li>
                                <li><strong>Access Control:</strong> Role-based access controls, multi-factor authentication options, and principle of least privilege across all systems.</li>
                                <li><strong>Audit Logging:</strong> Comprehensive audit trails of all access to and modifications of Personal Data, retained for a minimum of 12 months.</li>
                                <li><strong>Vulnerability Management:</strong> Regular security assessments, penetration testing, and patch management cycles.</li>
                                <li><strong>Business Continuity:</strong> Automated encrypted backups with defined Recovery Time Objectives (RTO) and Recovery Point Objectives (RPO).</li>
                                <li><strong>ISO 27001 Alignment:</strong> Security practices aligned with the ISO 27001:2022 information security management framework.</li>
                            </ul>
                        </section>

                        {/* 9 */}
                        <section className="mb-14">
                            <h2>9. Personal Data Breaches</h2>
                            <h3>9.1 Notification</h3>
                            <p>In the event of a Personal Data Breach, the Processor shall notify the Controller without undue delay and in any event within <strong>24 hours</strong> of becoming aware of the breach. This timeline is designed to allow the Controller to meet its 72-hour notification obligation to the Nigeria Data Protection Commission (NDPC) under Section 40 of the NDPA.</p>
                            <h3>9.2 Breach Information</h3>
                            <p>The breach notification shall include, to the extent available: the nature of the breach, categories and approximate number of Data Subjects and records affected, likely consequences, and measures taken or proposed to address the breach.</p>
                            <h3>9.3 Assistance</h3>
                            <p>The Processor shall cooperate fully with the Controller and provide all reasonable assistance in investigating, containing, and remediating any Personal Data Breach.</p>
                        </section>

                        {/* 10 */}
                        <section className="mb-14">
                            <h2>10. International Data Transfers</h2>
                            <p>Where the Processor transfers Personal Data outside Nigeria (including to Sub-Processors located in the USA or other jurisdictions), the Processor shall ensure that appropriate safeguards are in place as required by the NDPA, including Standard Contractual Clauses or equivalent mechanisms, and that the receiving entity provides a level of data protection substantially equivalent to that required by Nigerian law.</p>
                        </section>

                        {/* 11 */}
                        <section className="mb-14">
                            <h2>11. Audit Rights</h2>
                            <p>The Controller shall have the right, upon giving at least 30 days' written notice, to conduct or commission audits of the Processor's data processing activities and security measures relevant to this DPA, at the Controller's expense. The Processor shall cooperate fully with any such audit.</p>
                            <p>The Processor may satisfy this obligation by providing the Controller with up-to-date third-party audit reports, certifications, or compliance attestations relevant to the Services.</p>
                        </section>

                        {/* 12 */}
                        <section className="mb-14">
                            <h2>12. Liability</h2>
                            <p>Each party shall be liable for damages caused by processing that infringes the NDPA or this DPA where it is at fault. The Processor shall not be liable where it can demonstrate that it is not at fault for the event giving rise to the damage.</p>
                            <p>The aggregate liability of each party under this DPA shall not exceed the total fees paid by the Controller to the Processor in the 12 months preceding the event giving rise to the claim, except in cases of fraud, wilful misconduct, or death/personal injury.</p>
                        </section>

                        {/* 13 */}
                        <section className="mb-14">
                            <h2>13. Termination and Data Return</h2>
                            <h3>13.1 Return of Data</h3>
                            <p>Upon termination or expiry of the Service Agreement, the Processor shall make all Personal Data available to the Controller for export within <strong>60 days</strong> in a standard, machine-readable format. The Platform's native Data Export feature (Settings → Data & Export) may be used for this purpose.</p>
                            <h3>13.2 Deletion</h3>
                            <p>Following the export period, the Processor shall securely delete all Personal Data from its systems and those of its Sub-Processors, unless retention is required by applicable law. The Processor shall provide written confirmation of deletion upon request.</p>
                            <h3>13.3 Survival</h3>
                            <p>Clauses relating to confidentiality, liability, and governing law shall survive termination of this DPA.</p>
                        </section>

                        {/* 14 */}
                        <section className="mb-14">
                            <h2>14. Governing Law</h2>
                            <p>This DPA shall be governed by and construed in accordance with the laws of the Federal Republic of Nigeria. Any dispute arising out of or in connection with this DPA shall be subject to the exclusive jurisdiction of the courts of Lagos State, Nigeria.</p>
                        </section>

                        {/* 15 — Execution and Acceptance */}
                        <section className="mb-14">
                            <h2>15. Execution and Acceptance</h2>
                            <p>This Agreement is entered into and takes effect automatically upon the Controller's acceptance of the PracticePro Terms of Service, registration of an account, or the first instance of processing Personal Data on the Platform. <strong>No manual signature is required.</strong></p>
                            <div className="mt-8 p-6 bg-primary-50/50 dark:bg-primary-900/10 border border-primary-100 dark:border-primary-900/30 rounded-xl flex items-start gap-4">
                                <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center shrink-0">
                                    <svg className="w-4 h-4 text-primary-600 dark:text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-900 dark:text-white mb-1">Acknowledgement of Terms</h4>
                                    <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
                                        By continuing to use PracticePro {isVega ? 'VEGA' : 'ATRIUM'} and storing {isVega ? 'client' : 'tenant'} data on our servers, you acknowledge that you have read, understood, and agreed to the data processing terms outlined in this DPA, establishing a binding legal contract under the NDPA 2023.
                                    </p>
                                </div>
                            </div>
                        </section>

                    </div>

                    <div className="h-32 pt-20 border-t border-slate-100 dark:border-zinc-800 mt-20 text-center">
                        <p className="text-2xs text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-widest">
                            PracticePro {isVega ? 'VEGA' : 'ATRIUM'} · Data Processing Agreement v1.0 · © 2026 PracticePro Legal Technologies Limited
                        </p>
                    </div>
                    <div className="h-20 sm:h-0" />
                </div>
            </div>
        </div>
    );
};

export default DataProcessingAgreement;
