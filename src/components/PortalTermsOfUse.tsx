import React from 'react';
import { ChevronLeftIcon as ChevronLeft } from '../constants';

export const PortalTermsOfUse: React.FC<{ onBack: () => void; activeProduct?: 'vega' | 'atrium' }> = ({ onBack, activeProduct = 'vega' }) => {
    const isVega = activeProduct === 'vega';
    const productName = isVega ? 'VEGA' : 'ATRIUM';
    const portalLabel = isVega ? 'Client Portal' : "Residents' Portal";
    const providerLabel = isVega ? 'legal service provider' : 'property manager';
    const firmLabel = isVega ? 'law firm' : 'property management firm';

    return (
        <div className="w-full h-full bg-white dark:bg-zinc-900 flex flex-col overflow-hidden animate-fade-in font-sans">
            {/* Standard Header */}
            <div className="sticky top-0 z-50 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-b border-slate-200 dark:border-zinc-800 px-4 h-16 flex items-center justify-between">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors font-medium text-sm"
                >
                    <ChevronLeft className="w-5 h-5" />
                    Back
                </button>
                <h1 className="font-bold text-slate-900 dark:text-white">Portal Terms of Use</h1>
                <div className="w-16" /> {/* Spacer */}
            </div>

            {/* Scrollable Document Container */}
            <div className="flex-1 overflow-y-auto scroll-smooth custom-scrollbar">
                <div className="max-w-4xl mx-auto px-6 sm:px-12 py-12 lg:py-20">
                    <div className="mb-16">
                        <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-6">PORTAL TERMS OF USE</h1>
                        <p className="text-sm font-semibold text-slate-600 dark:text-zinc-400 mb-2 tracking-tight">PracticePro Technologies Limited</p>
                        <div className="flex flex-col text-xs text-slate-500 dark:text-zinc-500 italic">
                            <span>Effective Date: January 1, 2026</span>
                            <span>Last Updated: April 10, 2026</span>
                            <span>Version: 1.0</span>
                        </div>
                    </div>

                    <div className="prose prose-slate dark:prose-invert max-w-none
                        prose-p:leading-[1.8] prose-p:mb-12
                        prose-h2:mt-16 prose-h2:mb-8 prose-h2:text-3xl prose-h2:font-bold prose-h2:border-b-2 prose-h2:pb-4 prose-h2:border-slate-200 dark:prose-h2:border-zinc-800
                        prose-h3:mt-12 prose-h3:mb-6 prose-h3:text-xl prose-h3:font-bold
                        prose-ul:mb-10 prose-ul:space-y-4
                        prose-li:leading-relaxed prose-a:text-primary-600 prose-a:no-underline hover:prose-a:underline
                        prose-strong:text-slate-900 dark:prose-strong:text-white">

                        <hr className="my-10" />

                        <h2>TABLE OF CONTENTS</h2>
                        <div className="bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-800 p-6 rounded-lg mb-10">
                            <ol className="list-decimal pl-5 space-y-2">
                                <li><a href="#portal-section-1">Purpose and Scope</a></li>
                                <li><a href="#portal-section-2">User Responsibilities</a></li>
                                <li><a href="#portal-section-3">Privacy and Data Protection</a></li>
                                <li><a href="#portal-section-4">Communication Through the Portal</a></li>
                                <li><a href="#portal-section-5">Payment Submissions and Proof of Payment</a></li>
                                <li><a href="#portal-section-6">Maintenance Requests and Service Charges</a></li>
                                <li><a href="#portal-section-7">Intellectual Property Restrictions</a></li>
                                <li><a href="#portal-section-8">Limitation of Liability</a></li>
                                <li><a href="#portal-section-9">Termination of Portal Access</a></li>
                                <li><a href="#portal-section-10">Governing Law</a></li>
                                <li><a href="#portal-section-11">Contact Information</a></li>
                            </ol>
                        </div>

                        <hr className="my-10" />

                        {/* Preamble */}
                        <p className="text-lg leading-relaxed text-slate-700 dark:text-zinc-300">
                            These Portal Terms of Use ("Portal Terms") govern your access to and use of the PracticePro {portalLabel} (the "Portal"), provided by PracticePro Technologies Limited ("PracticePro," "we," "us," or "our"). By accepting an invitation to the Portal, creating an account, or accessing the Portal in any capacity, you ("you," "your," or "User") acknowledge that you have read, understood, and agree to be bound by these Portal Terms, together with the <a href="#portal-section-3">PracticePro Terms and Conditions of Service</a> and the <a href="#portal-section-3">Privacy Policy</a>, which are incorporated herein by reference.
                        </p>

                        <section id="portal-section-1" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">1. PURPOSE AND SCOPE</h2>
                            <div className="space-y-12">
                                <p>1.1 <strong>Portal Purpose:</strong> The PracticePro {portalLabel} is a secure, web-based interface that allows you to interact with your {providerLabel} through the PracticePro {productName} platform. The Portal enables you to view {isVega ? 'case and matter information, communicate with your legal team, review invoices, and submit documents' : 'property and tenancy information, communicate with your property manager, submit maintenance requests, make payments, and view service charge statements'}.</p>
                                <p>1.2 <strong>Scope of Access:</strong> Your Portal access is limited to the features and data that your {providerLabel} has expressly enabled for your account. PracticePro does not determine what information is shared through the Portal; all data displayed is provided and controlled by your {firmLabel}.</p>
                                <p>1.3 <strong>No Independent Service:</strong> The Portal is not a standalone service. It is an extension of the PracticePro {productName} platform used by your {firmLabel}. These Portal Terms supplement, but do not replace, the PracticePro Terms and Conditions of Service.</p>
                                <p>1.4 <strong>Eligibility:</strong> You may only use the Portal if you have received a valid invitation from a registered PracticePro {productName} user and have completed the account setup process, including acceptance of these Portal Terms.</p>
                            </div>
                        </section>

                        <section id="portal-section-2" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">2. USER RESPONSIBILITIES</h2>
                            <div className="space-y-12">
                                <p>2.1 <strong>Accurate Information:</strong> You represent and warrant that all information you provide through the Portal, including but not limited to your name, contact details, {isVega ? 'case-related information' : 'tenancy details'}, and payment information, is accurate, complete, and current. You must promptly update any information that becomes inaccurate.</p>
                                <p>2.2 <strong>Account Security:</strong> You are solely responsible for maintaining the confidentiality of your Portal login credentials. You must not share your password, access token, or any other authentication mechanism with any third party. You agree to notify your {providerLabel} or PracticePro immediately upon becoming aware of any unauthorized access to or use of your Portal account.</p>
                                <p>2.3 <strong>Prohibited Conduct:</strong> You must not use the Portal to:
                                    </p><ul>
                                        <li>Upload, transmit, or distribute any content that is unlawful, defamatory, harassing, fraudulent, or otherwise objectionable;</li>
                                        <li>Attempt to gain unauthorized access to any portion of the Portal, other user accounts, or the underlying PracticePro platform;</li>
                                        <li>Interfere with or disrupt the integrity, security, or performance of the Portal or the PracticePro platform;</li>
                                        <li>Use any automated means (including bots, scrapers, or scripts) to access or extract data from the Portal;</li>
                                        <li>Reverse-engineer, decompile, or disassemble any component of the Portal or the PracticePro platform;</li>
                                        <li>Impersonate any person or entity, or misrepresent your affiliation with any person or entity.</li>
                                    </ul>
                                <p>2.4 <strong>Compliance with Laws:</strong> You agree to comply with all applicable laws, regulations, and professional rules of conduct when using the Portal, including but not limited to the Nigeria Data Protection Act 2023 (NDPA 2023) and any rules prescribed by the {isVega ? 'Nigerian Bar Association' : 'relevant property regulatory authorities'}.</p>
                            </div>
                        </section>

                        <section id="portal-section-3" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">3. PRIVACY AND DATA PROTECTION</h2>
                            <div className="space-y-12">
                                <p>3.1 <strong>Data Processing:</strong> PracticePro processes your personal data in accordance with the Nigeria Data Protection Act 2023 (NDPA 2023) and the PracticePro Privacy Policy, which is incorporated herein by reference. Your {firmLabel} acts as the data controller for the personal data shared through the Portal, and PracticePro acts as the data processor.</p>
                                <p>3.2 <strong>Data You Provide:</strong> When you use the Portal, you may provide personal data such as your name, email address, phone number, {isVega ? 'case-related documents' : 'tenancy and property information'}, and payment details. You consent to the processing of this data for the purposes of providing the Portal services.</p>
                                <p>3.3 <strong>Data Security:</strong> PracticePro employs industry-standard security measures to protect your data, including AES-256 encryption at rest, TLS 1.3 for data in transit, and PBKDF2 password hashing. However, no system is completely secure, and PracticePro does not guarantee absolute security.</p>
                                <p>3.4 <strong>Data Retention:</strong> Your data will be retained for as long as your Portal account is active and for a reasonable period thereafter as required by law or as necessary for the purposes set out in these Portal Terms. Upon request, your {firmLabel} or PracticePro will delete your personal data in accordance with the NDPA 2023.</p>
                                <p>3.5 <strong>Your Rights:</strong> Under the NDPA 2023, you have the right to access, rectify, erase, and restrict the processing of your personal data, as well as the right to data portability. To exercise these rights, please contact your {providerLabel} or PracticePro at the contact details provided in Section 11.</p>
                            </div>
                        </section>

                        <section id="portal-section-4" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">4. COMMUNICATION THROUGH THE PORTAL</h2>
                            <div className="space-y-12">
                                <p>4.1 <strong>Logged Communications:</strong> All messages, comments, and communications sent through the Portal are logged and stored by PracticePro for security, audit, and compliance purposes. You should have no expectation of private or confidential communication through the Portal messaging features.</p>
                                <p>4.2 <strong>Not End-to-End Encrypted:</strong> Portal communications are secured in transit using TLS encryption, but they are not end-to-end encrypted. You should not use the Portal to transmit highly sensitive or privileged information without first consulting your {providerLabel}.</p>
                                <p>4.3 <strong>{isVega ? 'Attorney-Client' : 'Professional'} Communication:</strong> {isVega ? 'While communications through the Portal may relate to legal matters, Portal messaging does not constitute a secure attorney-client communication channel. For privileged or confidential communications, please use the methods directed by your legal service provider.' : 'While communications through the Portal may relate to tenancy and property matters, Portal messaging is intended for routine correspondence only. For urgent or legally sensitive matters, please contact your property manager directly through the appropriate channels.'}</p>
                                <p>4.4 <strong>Notification Delivery:</strong> PracticePro may send you notifications via email, SMS, or WhatsApp in connection with your Portal account. You acknowledge that these notification channels are not controlled by PracticePro and delivery is not guaranteed.</p>
                            </div>
                        </section>

                        <section id="portal-section-5" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">5. PAYMENT SUBMISSIONS AND PROOF OF PAYMENT</h2>
                            <div className="space-y-12">
                                <p>5.1 <strong>Payment Information:</strong> The Portal may display {isVega ? 'invoice and billing information' : 'rent, service charge, and levy information'} provided by your {firmLabel}. All payment amounts and due dates displayed are determined by your {firmLabel}, not PracticePro.</p>
                                <p>5.2 <strong>Proof of Payment:</strong> If you submit proof of payment through the Portal, you warrant that the proof of payment is genuine, accurate, and relates to the {isVega ? 'invoice' : 'obligation'} for which it is submitted. Submitting false or misleading proof of payment constitutes a material breach of these Portal Terms and may constitute a criminal offence under applicable law.</p>
                                <p>5.3 <strong>Payment Confirmation:</strong> Submission of proof of payment through the Portal does not constitute payment confirmation or acceptance. Your {firmLabel} reserves the right to verify all payments independently before issuing a receipt or confirmation.</p>
                                <p>5.4 <strong>Payment Disputes:</strong> Any dispute regarding payment amounts, due dates, or receipts must be directed to your {firmLabel}. PracticePro has no involvement in the determination of payment terms, amounts, or the resolution of payment disputes.</p>
                            </div>
                        </section>

                        <section id="portal-section-6" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">6. MAINTENANCE REQUESTS AND SERVICE CHARGES</h2>
                            <div className="space-y-12">
                                <p>6.1 <strong>Maintenance Requests:</strong> {isVega ? 'This section applies to Residents\' Portal users only. If you have been granted access to the Client Portal, this section does not apply to your use of the Portal.' : 'You may submit maintenance requests through the Portal. All requests are logged with timestamps and are forwarded to your property manager for review and action.'}</p>
                                {!isVega && (
                                    <>
                                        <p>6.2 <strong>Accuracy of Requests:</strong> You agree to provide accurate and complete information when submitting maintenance requests, including a clear description of the issue, the affected area, and any relevant photographs. Deliberate or repeated submission of false or frivolous maintenance requests may result in restriction or termination of your Portal access.</p>
                                        <p>6.3 <strong>Response Times:</strong> PracticePro does not guarantee any specific response time for maintenance requests. Response times are determined by your property manager and are subject to the terms of your tenancy agreement.</p>
                                        <p>6.4 <strong>Service Charges:</strong> Service charge statements displayed on the Portal are provided for informational purposes. The accuracy and completeness of service charge information is the responsibility of your property manager. PracticePro shall not be liable for any errors or omissions in service charge data displayed on the Portal.</p>
                                        <p>6.5 <strong>Access for Repairs:</strong> By submitting a maintenance request, you may be consenting to reasonable access to your unit for the purpose of carrying out repairs, subject to applicable tenancy laws and the terms of your tenancy agreement.</p>
                                    </>
                                )}
                                {isVega && (
                                    <>
                                        <p>6.2 <strong>Document Submissions:</strong> You may submit documents through the Portal at the request of your legal service provider. You warrant that all submitted documents are authentic and complete to the best of your knowledge.</p>
                                        <p>6.3 <strong>File Requirements:</strong> Documents submitted through the Portal must comply with any file size, format, or content restrictions displayed at the point of upload. PracticePro reserves the right to reject or remove files that violate these restrictions or that contain malicious content.</p>
                                    </>
                                )}
                            </div>
                        </section>

                        <section id="portal-section-7" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">7. INTELLECTUAL PROPERTY RESTRICTIONS</h2>
                            <div className="space-y-12">
                                <p>7.1 <strong>Platform Ownership:</strong> The PracticePro platform, including the Portal, all software, source code, user interfaces, graphics, logos, and documentation, is the exclusive property of PracticePro Technologies Limited and is protected by applicable intellectual property laws, including the Copyright Act (Cap C28, Laws of the Federation of Nigeria, 2004) and the Patents and Designs Act (Cap P2, LFN 2004).</p>
                                <p>7.2 <strong>Limited License:</strong> Subject to your compliance with these Portal Terms, PracticePro grants you a limited, non-exclusive, non-transferable, revocable license to access and use the Portal solely for its intended purposes. This license does not include the right to:</p>
                                <ul>
                                    <li>Modify, adapt, or create derivative works based on the Portal;</li>
                                    <li>Download, copy, or redistribute any portion of the Portal source code or underlying technology;</li>
                                    <li>Use the PracticePro name, logo, or trademarks without prior written consent;</li>
                                    <li>Remove, alter, or obscure any proprietary notices on the Portal.</li>
                                </ul>
                                <p>7.3 <strong>User Content:</strong> You retain ownership of any content you submit through the Portal. By submitting content, you grant PracticePro and your {firmLabel} a non-exclusive, royalty-free license to use, store, and process that content for the purposes of providing the Portal services.</p>
                                <p>7.4 <strong>Feedback:</strong> If you provide suggestions, feedback, or ideas regarding the Portal or PracticePro platform, you agree that PracticePro may use such feedback without restriction and without any obligation of attribution or compensation.</p>
                            </div>
                        </section>

                        <section id="portal-section-8" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">8. LIMITATION OF LIABILITY</h2>
                            <div className="space-y-12">
                                <p>8.1 <strong>No Liability for Portal Content:</strong> PracticePro does not control, verify, or endorse the content displayed on the Portal, including but not limited to {isVega ? 'case information, legal advice, billing data, or documents' : 'property information, tenancy terms, maintenance schedules, or service charge calculations'}. All such content is provided by your {firmLabel}, and PracticePro shall not be liable for any inaccuracies, errors, or omissions in such content.</p>
                                <p>8.2 <strong>Service Availability:</strong> While PracticePro endeavours to provide uninterrupted access to the Portal, the Portal is provided on an "as is" and "as available" basis. PracticePro does not guarantee that the Portal will be available at all times, free from errors, or compatible with all devices and browsers.</p>
                                <p>8.3 <strong>Limitation of Damages:</strong> To the maximum extent permitted by applicable law, PracticePro shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising out of or in connection with your use of or inability to use the Portal, including but not limited to loss of profits, data, goodwill, or business opportunities, regardless of the cause of action or the theory of liability.</p>
                                <p>8.4 <strong>Maximum Liability:</strong> In no event shall PracticePro's total aggregate liability under these Portal Terms exceed the amount of fees paid by your {firmLabel} to PracticePro in the twelve (12) months preceding the event giving rise to the liability, or one hundred thousand Naira (₦100,000), whichever is greater.</p>
                                <p>8.5 <strong>Third-Party Services:</strong> The Portal may contain links to or integrations with third-party services (e.g., payment gateways). PracticePro does not endorse and is not responsible for the availability, accuracy, or practices of any third-party services.</p>
                            </div>
                        </section>

                        <section id="portal-section-9" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">9. TERMINATION OF PORTAL ACCESS</h2>
                            <div className="space-y-12">
                                <p>9.1 <strong>Termination by Your {firmLabel}:</strong> Your {providerLabel} may revoke your Portal access at any time, with or without cause, by deactivating your account or cancelling your invitation. Upon termination, your ability to access the Portal will cease immediately.</p>
                                <p>9.2 <strong>Termination by PracticePro:</strong> PracticePro reserves the right to suspend or terminate your Portal access if you breach these Portal Terms, engage in prohibited conduct as described in Section 2.3, or if required by law or legal process.</p>
                                <p>9.3 <strong>Effect of Termination:</strong> Upon termination of your Portal access:
                                    </p><ul>
                                        <li>You must immediately cease all use of the Portal;</li>
                                        <li>Your login credentials will be deactivated;</li>
                                        <li>Your personal data will be handled in accordance with Section 3 and the PracticePro Privacy Policy;</li>
                                        <li>Any pending {isVega ? 'document submissions or communications' : 'maintenance requests or payments'} will be at the discretion of your {firmLabel}.</li>
                                    </ul>
                                <p>9.4 <strong>Survival:</strong> The provisions of Sections 3, 7, 8, 9.3, and 10 shall survive the termination of your Portal access.</p>
                            </div>
                        </section>

                        <section id="portal-section-10" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">10. GOVERNING LAW</h2>
                            <div className="space-y-12">
                                <p>10.1 <strong>Governing Law:</strong> These Portal Terms shall be governed by and construed in accordance with the laws of the Federal Republic of Nigeria.</p>
                                <p>10.2 <strong>Jurisdiction:</strong> Any dispute arising out of or in connection with these Portal Terms shall be subject to the exclusive jurisdiction of the courts of Lagos State, Nigeria, without regard to its conflict of law principles.</p>
                                <p>10.3 <strong>Dispute Resolution:</strong> Any disputes under these Portal Terms shall be resolved in accordance with the dispute resolution procedures set out in Section 19 of the PracticePro Terms and Conditions of Service.</p>
                                <p>10.4 <strong>Severability:</strong> If any provision of these Portal Terms is found to be unenforceable by a court of competent jurisdiction, the remaining provisions shall continue in full force and effect.</p>
                            </div>
                        </section>

                        <section id="portal-section-11" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">11. CONTACT INFORMATION</h2>
                            <div className="space-y-12">
                                <p>For any questions, complaints, or notices relating to these Portal Terms, please contact us at:</p>
                                <div className="pl-4 border-l-2 border-slate-100 dark:border-zinc-800 space-y-3">
                                    <p><strong>Company:</strong> PracticePro Technologies Limited</p>
                                    <p><strong>Address:</strong> No. 6 Sulaiman Adekanbi Street, Igbo-Efon, Lekki-Epe Expressway, Lagos State, Nigeria</p>
                                    <p><strong>General Enquiries:</strong> <a href="mailto:practiceprovega@gmail.com">practiceprovega@gmail.com</a></p>
                                    <p><strong>Data Protection / Privacy:</strong> <a href="mailto:practiceproindex@gmail.com">practiceproindex@gmail.com</a></p>
                                </div>
                                <p>We aim to respond to all formal notices and complaints within five (5) business days.</p>
                            </div>
                        </section>

                    </div>

                    {/* Footer */}
                    <div className="h-32 pt-20 border-t border-slate-100 dark:border-zinc-800 mt-20 text-center">
                        <p className="text-2xs text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-widest">
                            PracticePro {isVega ? 'VEGA • Professional Operations System' : 'ATRIUM • Property OS'} • Portal Terms of Use • Version 1.0 • April 2026
                        </p>
                    </div>
                    <div className="h-20 sm:h-0" />
                </div>
            </div>
        </div>
    );
};

export default PortalTermsOfUse;
