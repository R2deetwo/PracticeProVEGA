import React from 'react';
import { ChevronLeftIcon as ChevronLeft } from '../constants';

const UsagePolicy: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    return (
    <div className="w-full h-full bg-white dark:bg-zinc-900 flex flex-col overflow-hidden animate-fade-in font-sans">

        <div className="sticky top-0 z-50 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-b border-slate-200 dark:border-zinc-800 px-4 h-16 flex items-center justify-between">
            <button
                onClick={onBack}
                className="flex items-center gap-2 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors font-medium text-sm"
            >
                <ChevronLeft className="w-5 h-5" />
                Back
            </button>
            <h1 className="font-bold text-slate-900 dark:text-white">Usage Policy</h1>
            <div className="w-16" />
        </div>

        <div className="flex-1 overflow-y-auto scroll-smooth custom-scrollbar">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-12 py-10 lg:py-20">

                <div className="mb-12 lg:mb-16">
                    <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-4 lg:mb-6">Usage Policy</h1>
                    <p className="text-sm font-semibold text-slate-600 dark:text-zinc-400 mb-2 tracking-tight">PRACTICEPRO SYSTEMS LIMITED</p>
                    <div className="flex flex-col text-xs text-slate-500 dark:text-zinc-500 italic">
                        <span>Last Updated: July 2026</span>
                    </div>
                </div>

                <div className="prose prose-slate dark:prose-invert max-w-none
                    prose-p:leading-[1.8] prose-p:mb-8
                    prose-h2:mt-12 prose-h2:mb-6 prose-h2:text-2xl prose-h2:font-bold prose-h2:border-b-2 prose-h2:pb-3 prose-h2:border-slate-200 dark:prose-h2:border-zinc-800
                    prose-h3:mt-8 prose-h3:mb-4 prose-h3:text-lg prose-h3:font-bold
                    prose-ul:mb-6 prose-ul:space-y-2
                    prose-li:leading-relaxed">

                    <hr className="my-8" />

                    <p>
                        This Usage Policy governs the acceptable use of the PracticePro platform, including the Vega (Legal Practice Management), Atrium (Property Management), and Komplete (unified) products, together with all associated services, websites, portals, and documentation (collectively, the "Platform"). This Platform is operated by PracticePro Systems Limited ("PracticePro," "we," "us," or "our"). By accessing or using the Platform, you ("User" or "you") agree to comply with this Usage Policy. This policy is incorporated by reference into the PracticePro Terms of Service and forms part of your agreement with us.
                    </p>

                    <h2>1. Acceptable Use</h2>
                    <p>
                        You agree to use the Platform only for lawful purposes and in accordance with this Usage Policy. You are granted a limited, non-exclusive, non-transferable, revocable license to access and use the Platform solely for your professional practice management activities, subject to your active subscription and compliance with all applicable laws and regulations.
                    </p>

                    <h3>1.1 Permitted Uses</h3>
                    <ul>
                        <li>Managing matters, cases, properties, tenants, residents, contacts, documents, and financial records within your firm or organization.</li>
                        <li>Using the DraftPro editor, ALOA AI Copilot, and other integrated tools for drafting, research, and document generation related to your professional practice.</li>
                        <li>Communicating with clients, residents, team members, and other authorized contacts through the Platform's messaging and notification features.</li>
                        <li>Generating invoices, receipts, and financial reports for your firm's operations.</li>
                        <li>Providing portal access to your clients and residents for document sharing, payment tracking, and communication.</li>
                        <li>Using the Platform in compliance with all applicable Nigerian laws, including the Nigeria Data Protection Act 2023 (NDPA), the Companies and Allied Matters Act (CAMA) 2020, and all relevant professional conduct rules.</li>
                    </ul>

                    <h3>1.2 Prohibited Uses</h3>
                    <p>You agree NOT to:</p>
                    <ul>
                        <li>Use the Platform for any illegal, fraudulent, or unauthorized purpose, including but not limited to money laundering, terrorism financing, or corruption in violation of the Economic and Financial Crimes Commission (Establishment) Act 2004 or the Corrupt Practices and Other Related Offences Act 2000.</li>
                        <li>Upload, store, or transmit content that infringes the intellectual property rights, privacy rights, or confidentiality rights of any third party.</li>
                        <li>Attempt to gain unauthorized access to any part of the Platform, other accounts, computer systems, or networks connected to the Platform through hacking, password mining, or any other means.</li>
                        <li>Interfere with or disrupt the Platform's servers, networks, or security systems, including distributing viruses, malware, or other malicious code.</li>
                        <li>Use the Platform to send unsolicited communications, spam, or promotional content without the recipient's consent.</li>
                        <li>Share your account credentials, API keys, or access tokens with unauthorized third parties or permit concurrent use of a single seat by multiple users.</li>
                        <li>Reverse engineer, decompile, disassemble, or otherwise attempt to derive the source code of the Platform, except as expressly permitted by applicable law.</li>
                        <li>Use the ALOA AI Copilot or any AI-powered feature to generate content that constitutes legal advice for unrepresented parties, or to practice law without proper qualification and licensing under the Legal Practitioners Act.</li>
                        <li>Scrape, crawl, or use automated tools to extract data from the Platform without our express written consent.</li>
                        <li>Use the Platform to store or process data that is subject to export controls or sanctions under Nigerian law without proper authorization.</li>
                        <li>Resell, sublicense, or redistribute access to the Platform without our written consent.</li>
                        <li>Use the Platform in a manner that could damage, disable, overburden, or impair any PracticePro server or interfere with any other party's use of the Platform.</li>
                    </ul>

                    <h2>2. Account Responsibilities</h2>

                    <h3>2.1 Account Security</h3>
                    <p>
                        You are responsible for maintaining the confidentiality and security of your account credentials, including passwords, two-factor authentication codes, and biometric authentication data. You must immediately notify PracticePro of any unauthorized use of your account or any other security breach. You are liable for all activities that occur under your account, whether authorized or unauthorized, except where such activities result from PracticePro's own negligence or willful misconduct.
                    </p>

                    <h3>2.2 User Information</h3>
                    <p>
                        You agree to provide accurate, current, and complete information when creating your account and to update such information to keep it accurate. You must be at least 18 years of age and legally capable of entering into binding contracts to use the Platform. If you are using the Platform on behalf of a firm or organization, you represent that you have the authority to bind that entity to these terms.
                    </p>

                    <h3>2.3 Multi-Factor Authentication</h3>
                    <p>
                        PracticePro may require multi-factor authentication (MFA) for certain account actions, including initial login, password changes, and access to sensitive features. You agree to comply with all MFA requirements and to keep your MFA devices and recovery codes secure.
                    </p>

                    <h2>3. Content and Data</h2>

                    <h3>3.1 User Content</h3>
                    <p>
                        You retain all ownership rights to content you upload, create, or store on the Platform ("User Content"), including legal documents, matter files, property records, tenant information, and communications. PracticePro does not claim ownership of your User Content. You grant PracticePro a limited, non-exclusive license to host, store, process, and display your User Content solely as necessary to provide the Platform's services to you.
                    </p>

                    <h3>3.2 Content Standards</h3>
                    <p>You represent and warrant that your User Content:</p>
                    <ul>
                        <li>Does not violate any applicable law, regulation, or third-party right.</li>
                        <li>Does not contain defamatory, obscene, hateful, or discriminatory material.</li>
                        <li>Does not infringe the intellectual property rights, privacy rights, or confidentiality obligations of any third party.</li>
                        <li>Is accurate and not misleading where it represents factual information.</li>
                        <li>Complies with all professional conduct rules applicable to your profession, including the Rules of Professional Conduct for Legal Practitioners in Nigeria if you are a legal practitioner.</li>
                    </ul>

                    <h3>3.3 Data Retention</h3>
                    <p>
                        PracticePro retains User Content for the duration of your active subscription. Upon subscription termination, PracticePro will provide a 30-day grace period during which you may export your User Content. After this period, PracticePro will permanently delete your User Content from production systems, with backup copies retained for an additional 90 days for disaster recovery purposes before final deletion.
                    </p>

                    <h3>3.4 Data Subject Rights</h3>
                    <p>
                        As a data controller for your clients' and residents' personal data, you are responsible for responding to data subject requests under the NDPA 2023, including requests for access, rectification, erasure, and data portability. PracticePro, as your data processor, will assist you in fulfilling these requests where technically feasible. Contact our Data Protection Officer at dpo@practicepro.ng for assistance.
                    </p>

                    <h2>4. AI-Powered Features</h2>

                    <h3>4.1 ALOA AI Copilot</h3>
                    <p>
                        The ALOA AI Copilot uses third-party AI models (including Google Gemini) to assist with legal research, document drafting, case analysis, and matter insights. AI-generated outputs are tools to assist your professional judgment — they are not a substitute for legal advice or professional review. You are solely responsible for reviewing, verifying, and approving all AI-generated content before relying on it or sharing it with clients.
                    </p>

                    <h3>4.2 AI Usage Restrictions</h3>
                    <p>You agree NOT to:</p>
                    <ul>
                        <li>Use ALOA or any AI feature to generate content that constitutes unauthorized legal practice or advice to unrepresented parties.</li>
                        <li>Input confidential or privileged information into AI features without proper safeguards, as such information may be processed by third-party AI providers.</li>
                        <li>Use AI features to generate discriminatory, defamatory, or misleading content.</li>
                        <li>Attempt to reverse-engineer, extract, or replicate the AI models underlying the Platform.</li>
                        <li>Use AI features in a manner that violates the third-party AI provider's terms of service or acceptable use policies.</li>
                    </ul>

                    <h3>4.3 AI Output Disclaimer</h3>
                    <p>
                        AI-generated content may contain errors, inaccuracies, or outdated information. PracticePro does not guarantee the accuracy, completeness, or reliability of AI-generated outputs. You must independently verify all AI-generated content against primary sources before relying on it for professional purposes.
                    </p>

                    <h2>5. Portal Access</h2>

                    <h3>5.1 Client Portal</h3>
                    <p>
                        Firms using the Platform may invite their clients to access the Client Portal for matter tracking, document sharing, and communication. The firm is responsible for managing client portal invitations, access levels, and revocation. The firm is the data controller for all client data shared through the portal, and PracticePro is the data processor.
                    </p>

                    <h3>5.2 Residents' Portal</h3>
                    <p>
                        Property managers using Atrium may invite their residents to access the Residents' Portal for service charge tracking, payment ledgers, maintenance ticket submission, and document access. The property manager is responsible for managing resident invitations, access levels, and revocation, and is the data controller for all resident data.
                    </p>

                    <h3>5.3 Portal User Conduct</h3>
                    <p>
                        Portal users (clients and residents) must use the portals only for their intended purposes and must not attempt to access other users' data, manipulate payment records, or use the portal for any unlawful purpose. Portal access may be revoked at any time by the inviting firm or property manager.
                    </p>

                    <h2>6. Communication and Notifications</h2>

                    <h3>6.1 WhatsApp and SMS Notifications</h3>
                    <p>
                        The Platform may send notifications via WhatsApp Business API and SMS gateways, including rent reminders, demand notices, <strong>court date reminders</strong>, and matter updates. <strong>Court date reminders</strong> (available on the Pro plan) are sent automatically 7, 3, and 1 day(s) before each scheduled hearing to the assigned lawyer(s) on the matter. Client-facing court reminders are disabled by default — lawyers must explicitly opt in per matter if they want clients to receive hearing notifications. Message volumes are subject to your subscription tier's monthly limits (Core: 100, Growth: 500, Pro: unlimited). Monthly quotas reset on the 1st of each month. You are responsible for ensuring that your clients and residents have consented to receiving such communications under the NDPA 2023 before enabling notifications on their behalf.
                    </p>

                    <h3>6.2 Email Communications</h3>
                    <p>
                        PracticePro may send you operational emails, including security alerts, billing notices, and product updates. You may opt out of marketing emails at any time, but operational emails cannot be disabled as they are necessary for the service's functioning.
                    </p>

                    <h2>7. Payment and Billing</h2>

                    <h3>7.1 Subscription Fees</h3>
                    <p>
                        Subscription fees are billed in Nigerian Naira (NGN) according to your selected tier and billing cycle. Vega offers monthly or annual billing; Atrium is billed annually only. Komplete offers monthly or annual billing. Fees are payable in advance and are non-refundable except as expressly provided in our refund policy or required by law.
                    </p>

                    <h3>7.2 Service Charge Equivalent (SCE)</h3>
                    <p>
                        For Atrium subscriptions, the Service Charge Equivalent (SCE) represents the annual subscription cost divided across the property manager's tenant base, shown as a per-tenant monthly amount. SCE is a framing tool to help property managers itemize the technology cost on service charge invoices — it is not an additional fee charged by Atrium, and Atrium does not collect SCE directly from residents.
                    </p>

                    <h3>7.3 Payment Methods</h3>
                    <p>
                        Subscription payments are processed via bank transfer to PracticePro's designated Nigerian bank account. Invoice details, including account numbers and payment references, are displayed on each invoice.
                    </p>
                    <p>
                        <strong>Client invoice payments (Paystack readiness):</strong> The Platform includes a payment provider abstraction layer designed to support online card payments via Paystack. This feature is currently <strong>dormant</strong> — it will only be activated when PracticePro configures Paystack credentials and sets the <code>PAYSTACK_ENABLED</code> flag. Until then, all client invoice payments are processed manually (the firm verifies bank transfers and marks invoices as paid). When Paystack is activated, clients will see a "Pay Online" button on their invoices, and payment confirmations will be processed automatically via Paystack webhooks — no manual verification required. The firm retains the ability to mark invoices as paid manually at any time.
                    </p>

                    <h3>7.4 Tier Limits</h3>
                    <p>
                        Each subscription tier has capacity limits, including maximum users, active matters, managed units, tenants, WhatsApp notification volumes, and storage. Exceeding these limits requires upgrading to a higher tier. PracticePro may contact you when you approach your tier's limits.
                    </p>

                    <h2>8. Intellectual Property</h2>

                    <h3>8.1 Platform Ownership</h3>
                    <p>
                        The Platform, including all software, source code, user interfaces, designs, trademarks, documentation, and underlying technology, is the exclusive property of PracticePro Systems Limited and is protected by Nigerian and international intellectual property laws, including the Copyright Act (Cap C28, Laws of the Federation of Nigeria, 2004) and the Patents and Designs Act (Cap P2, LFN 2004).
                    </p>

                    <h3>8.2 Trademarks</h3>
                    <p>
                        "PracticePro," "Vega," "Atrium," "Komplete," "DraftPro," "ALOA," "ARIA," and related logos are trademarks of PracticePro Systems Limited. You may not use these trademarks without our express written consent, except to identify the Platform when referring to it accurately.
                    </p>

                    <h3>8.3 Feedback</h3>
                    <p>
                        If you provide feedback, suggestions, or ideas about the Platform ("Feedback"), you grant PracticePro a perpetual, irrevocable, worldwide, royalty-free license to use, modify, and incorporate such Feedback into the Platform without any obligation to you.
                    </p>

                    <h2>9. Service Availability</h2>

                    <h3>9.1 Uptime Commitment</h3>
                    <p>
                        PracticePro targets 99.9% uptime for the Platform, excluding scheduled maintenance windows. We will use commercially reasonable efforts to provide advance notice of scheduled maintenance via email or in-app notifications.
                    </p>

                    <h3>9.2 Service Exclusions</h3>
                    <p>
                        The uptime commitment does not apply to outages caused by: (a) factors outside our reasonable control, including internet connectivity issues, power outages, or third-party service failures; (b) your misuse of the Platform; (c) scheduled maintenance; or (d) force majeure events, including natural disasters, war, terrorism, or government action.
                    </p>

                    <h3>9.3 Support</h3>
                    <p>
                        PracticePro provides support via email at practiceprovega@gmail.com. Response times depend on your subscription tier and the severity of the issue. Critical issues affecting platform access are prioritized.
                    </p>

                    <h2>10. Termination and Suspension</h2>

                    <h3>10.1 Termination by You</h3>
                    <p>
                        You may terminate your subscription at any time by contacting PracticePro. Termination takes effect at the end of your current billing cycle. No refunds are provided for partial billing periods except as required by law.
                    </p>

                    <h3>10.2 Termination by PracticePro</h3>
                    <p>
                        PracticePro may suspend or terminate your account if: (a) you breach this Usage Policy or the Terms of Service; (b) you fail to pay subscription fees when due; (c) your account is inactive for more than 12 months; or (d) we are required to do so by law or regulatory authority. We will provide reasonable notice and an opportunity to cure non-payment breaches, except in cases of serious violations.
                    </p>

                    <h3>10.3 Effect of Termination</h3>
                    <p>
                        Upon termination, your access to the Platform ceases immediately. You have 30 days to export your User Content, after which it will be permanently deleted. PracticePro retains the right to retain certain records as required by law, including billing records and audit logs.
                    </p>

                    <h2>11. Disclaimers and Limitations</h2>

                    <h3>11.1 No Legal Advice</h3>
                    <p>
                        The Platform is a practice management tool — it does not constitute legal advice and does not create an attorney-client relationship between PracticePro and any user or end-user. Legal practitioners using the Platform remain solely responsible for the legal advice and services they provide to their clients.
                    </p>

                    <h3>11.2 Service Warranty</h3>
                    <p>
                        The Platform is provided "as is" and "as available," without warranties of any kind, whether express or implied, including merchantability, fitness for a particular purpose, or non-infringement. PracticePro does not warrant that the Platform will be error-free, uninterrupted, or secure.
                    </p>

                    <h3>11.3 Limitation of Liability</h3>
                    <p>
                        To the maximum extent permitted by law, PracticePro's total liability for any claim arising from or related to the Platform shall not exceed the amount you paid to PracticePro in the 12 months preceding the claim. PracticePro shall not be liable for indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or business opportunities.
                    </p>

                    <h2>12. Compliance and Reporting</h2>

                    <h3>12.1 NDPA 2023 Compliance</h3>
                    <p>
                        PracticePro complies with the Nigeria Data Protection Act 2023 and the Nigeria Data Protection Regulation 2019 as a data processor. We have appointed a Data Protection Officer (DPO) who can be contacted at dpo@practicepro.ng. Our data processing practices are detailed in the Data Processing Agreement (DPA) and Privacy Policy.
                    </p>

                    <h3>12.2 Law Enforcement Requests</h3>
                    <p>
                        PracticePro will cooperate with law enforcement requests that are properly issued in accordance with Nigerian law, including court orders and subpoenas. We will notify you of such requests unless prohibited by law.
                    </p>

                    <h3>12.3 Reporting Violations</h3>
                    <p>
                        To report violations of this Usage Policy, security vulnerabilities, or suspected unauthorized access, contact us at practiceprovega@gmail.com. We investigate all reports and take appropriate action, including account suspension and legal action where warranted.
                    </p>

                    <h2>13. Modifications to This Policy</h2>
                    <p>
                        PracticePro may modify this Usage Policy at any time. Material changes will be notified via email and in-app notification at least 30 days before taking effect. Continued use of the Platform after the effective date constitutes acceptance of the modified policy.
                    </p>

                    <h2>14. Governing Law and Dispute Resolution</h2>
                    <p>
                        This Usage Policy is governed by the laws of the Federal Republic of Nigeria. Any dispute arising from or related to this policy shall first be attempted to be resolved through good-faith negotiation. If unresolved within 30 days, the dispute shall be submitted to mediation in Lagos, Nigeria. If mediation fails, the dispute shall be resolved by the courts of Lagos State, Nigeria.
                    </p>

                    <h2>15. Contact Information</h2>
                    <p>
                        For questions about this Usage Policy, contact:
                    </p>
                    <p>
                        <strong>PracticePro Systems Limited</strong><br />
                        No. 6 Sulaiman Adekanbi Street, Igbo-Efon, Lekki-Epe Expressway, Lagos State, Nigeria<br />
                        Email: <a href="mailto:practiceprovega@gmail.com" className="text-primary-600 dark:text-primary-400 underline">practiceprovega@gmail.com</a><br />
                        Data Protection Officer: <a href="mailto:dpo@practicepro.ng" className="text-primary-600 dark:text-primary-400 underline">dpo@practicepro.ng</a>
                    </p>

                </div>
            </div>
        </div>
    </div>
    );
};

export default UsagePolicy;
