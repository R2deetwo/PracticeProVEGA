import React from 'react';
import { ChevronLeftIcon as ChevronLeft } from '../constants';

/**
 * Privacy Policy — rewritten in plain English.
 *
 * Design goals:
 *   - Short sentences (no more than 25 words where possible).
 *   - Everyday words instead of legal jargon.
 *   - Active voice. Address the reader as "you," the company as "we" or "PracticePro."
 *   - Legal terms (Data Controller, Data Processor, PII) defined inline the first time
 *     they appear.
 *   - Bullets for lists. One idea per paragraph.
 *   - Always render in light mode (see index.html — `html.dark` is set when the OS
 *     theme is dark). The `style={{ colorScheme: 'light' }}` on the root and the
 *     absence of any `dark:` Tailwind classes guarantee this.
 *
 * Structural fixes applied in this rewrite:
 *   - §3.2 cross-reference corrected from "Section 3.4" to "Section 3.5."
 *   - §4 numbering gap fixed (the old file jumped 4.7 → 4.9). 4.9 is now 4.8.
 *   - §3.6 (Visitor & Access Code Data) is now gated to Atrium only via `isProperty`.
 *   - §3.4 (Local File Linking) collapsed from five repetitive bullets to three
 *     sentences.
 *   - §5.1 AI Conversation Retention bullet uses ALOA™ for Vega and ARIA™ for
 *     Atrium (matching the `activeProduct` logic). The rest of the file keeps
 *     ALOA™ as the canonical assistant name for both products.
 *
 * All legally material disclosures are preserved: NDPA 2023, NDPR 2019,
 * the 60-day data export window, the BYOK model, "we do not sell your data,"
 * "we do not train AI on your data," the Data Controller / Data Processor
 * role split, the under-18 prohibition, the contact email, and the
 * registered address.
 */
export const PrivacyPolicy: React.FC<{ onBack: () => void; activeProduct?: 'vega' | 'atrium' }> = ({ onBack, activeProduct = 'vega' }) => {
    const isVega = activeProduct === 'vega';
    const isProperty = !isVega;
    return (
        <div className="w-full h-full bg-white flex flex-col overflow-hidden animate-fade-in font-sans" style={{ colorScheme: 'light' }} data-public-page>

            {/* Standard Header */}
            <div className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 h-16 flex items-center justify-between">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors font-medium text-sm"
                >
                    <ChevronLeft className="w-5 h-5" />
                    Back
                </button>
                <h1 className="font-bold text-slate-900">Privacy Policy</h1>
                <div className="w-16" /> {/* Spacer */}
            </div>

            {/* Scrollable Document Container */}
            <div className="flex-1 overflow-y-auto scroll-smooth custom-scrollbar">
                <div className="max-w-4xl mx-auto px-6 sm:px-12 py-12 lg:py-20">

                    {/* Document Head */}
                    <div className="mb-16">
                        <h1 className="text-4xl font-bold text-slate-900 mb-6">Privacy Policy</h1>
                        <p className="text-sm font-semibold text-slate-600 mb-2 tracking-tight">PRACTICEPRO SYSTEMS LIMITED</p>
                        <div className="flex flex-col text-xs text-slate-500 italic">
                            <span>Effective Date: August 11, 2026</span>
                            <span>Last Updated: August 11, 2026</span>
                            <span>Version: 2.0</span>
                        </div>
                    </div>

                    {/* Plain-English summary box — gives the reader the gist in a few sentences */}
                    <div className="mb-12 p-5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 leading-relaxed">
                        <strong className="text-slate-900">In short:</strong> We collect only what we need to run
                        PracticePro, bill you, and power the AI features you turn on. You are the Data Controller
                        (you decide how data is used) for the {isVega ? 'client' : 'tenant'} data you enter.
                        PracticePro is your Data Processor (we handle it on your behalf). We do not sell your
                        data, and we do not use it to train AI models.
                    </div>

                    {/* Standard Document Content with explicit spacing */}
                    <div className="prose prose-slate max-w-none
                        prose-p:leading-[1.8] prose-p:mb-12
                        prose-h2:mt-16 prose-h2:mb-8 prose-h2:text-3xl prose-h2:font-bold prose-h2:border-b-2 prose-h2:pb-4 prose-h2:border-slate-200
                        prose-h3:mt-12 prose-h3:mb-6 prose-h3:text-xl prose-h3:font-bold
                        prose-ul:mb-10 prose-ul:space-y-4
                        prose-li:leading-relaxed">

                        <hr className="my-10" />

                        <h2>TABLE OF CONTENTS</h2>
                        <div className="bg-slate-50 border border-slate-200 p-6 rounded-lg mb-10">
                            <ol className="list-decimal pl-5 space-y-2">
                                <li><a href="#introduction">Introduction</a></li>
                                <li><a href="#who-we-are">Who We Are</a></li>
                                <li><a href="#information-collection">Information We Collect</a></li>
                                <li><a href="#usage">How We Use Your Information</a></li>
                                <li><a href="#ai-processing-detail">AI Processing and Third-Party Providers</a></li>
                                <li><a href="#security">Data Security</a></li>
                                <li><a href="#retention">Data Retention</a></li>
                                <li><a href="#rights-detail">Your Rights Under NDPR and NDPA</a></li>
                                <li><a href="#children">Children's Privacy</a></li>
                                <li><a href="#roles">Data Controllers vs. Data Processors</a></li>
                                <li><a href="#changes">Changes to This Policy</a></li>
                                <li><a href="#contact">Contact Us</a></li>
                            </ol>
                        </div>

                        <hr className="my-10" />

                        <section id="introduction" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8">1. Introduction</h2>
                            <div className="space-y-12">
                                <p>
                                    Welcome to PracticePro (also known as {isVega ? '"PracticePro VEGA"' : '"PracticePro ATRIUM"'}),
                                    a cloud-based {isVega ? 'Litigation System' : 'Property OS'} built for Nigerian{' '}
                                    {isVega ? 'lawyers and law firms' : 'property managers and real estate agencies'}.
                                    PracticePro Systems Limited (we call ourselves "PracticePro," "we," "us," or "our")
                                    protects your personal data. We follow the <strong>Nigeria Data Protection Act 2023 (NDPA)</strong>,
                                    the <strong>Nigeria Data Protection Regulation 2019 (NDPR)</strong>, and other
                                    Nigerian data protection laws.
                                </p>
                                <p>
                                    This policy explains how we collect, use, share, store, and protect your personal
                                    data when you use PracticePro, including{' '}
                                    {isProperty ? 'our AI-powered property assistant ALOA™' : 'our AI-powered legal assistant ALOA™'}.
                                    By using PracticePro, you agree to the practices described here.
                                </p>
                                <p>
                                    <strong>Important:</strong> PracticePro handles sensitive personal data and
                                    confidential {isVega ? 'client' : 'tenant'} information on behalf of{' '}
                                    {isVega ? 'legal practitioners' : 'property managers'}. You (the{' '}
                                    {isVega ? 'lawyer or law firm' : 'manager or firm'} using PracticePro) are the
                                    Data Controller for your {isVega ? 'clients\'' : 'tenants\''} data — you
                                    decide how it is used. PracticePro is your Data Processor, and we handle that
                                    data only on your behalf to provide the service.
                                </p>
                            </div>
                        </section>

                        <section id="who-we-are" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8">2. Who We Are</h2>
                            <div className="space-y-12">
                                <p>
                                    <strong>Company Name:</strong> PracticePro Systems Limited<br />
                                    <strong>Registered Address:</strong> No. 6 Sulaiman Adekanbi Street, Igbo-Efon, Lekki-Epe Expressway, Lagos State<br />
                                    <strong>Email:</strong> <a href="mailto:dpo@practicepro.ng" className="text-primary-600 no-underline hover:underline">dpo@practicepro.ng</a><br />
                                    <strong>Data Protection Officer (DPO):</strong> <a href="mailto:dpo@practicepro.ng" className="text-primary-600 no-underline hover:underline">dpo@practicepro.ng</a>
                                </p>
                                <p>
                                    For your account, billing, and platform usage, PracticePro is the Data
                                    Controller. For {isVega ? 'client' : 'tenant'} data you enter into PracticePro,
                                    the {isVega ? 'lawyer or law firm' : 'manager or firm'} is the Data Controller,
                                    and PracticePro is the Data Processor.
                                </p>
                            </div>
                        </section>

                        <section id="information-collection" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8">3. Information We Collect</h2>
                            <div className="space-y-12">
                                <p>We collect these categories of personal data:</p>

                                <div className="space-y-8">
                                    <h3 className="text-xl font-bold">3.1 Information You Provide</h3>
                                    <ul className="list-disc pl-8 space-y-6">
                                        <li><strong>Account registration:</strong> Full name, email address, phone number, firm name, {isVega ? 'Nigerian Bar Association (NBA) enrollment number, practice areas, jurisdiction' : 'estate agency registration (e.g., NIESV/ESVARBON), service areas'}, and password.</li>
                                        <li><strong>Billing and payment:</strong> Billing address, payment method details (handled securely by third-party payment processors), transaction history, and invoices.</li>
                                        <li><strong>Profile:</strong> Professional designation, firm logo, and letterhead.</li>
                                        <li><strong>{isVega ? 'Client and Matter' : 'Tenant and Property'} data:</strong> Information about your {isVega ? 'clients and legal matters — names, contact details, case facts, court information, deadlines' : 'tenants and properties — names, contact details, lease agreements, rent schedules, maintenance records'}, financial records, time entries, expenses, and related files. You enter this data, and we process it on your behalf.</li>
                                        <li><strong>Documents and files:</strong> {isVega ? 'Legal documents, contracts, pleadings, correspondence' : 'Lease agreements, tenancy notices, property title documents, inspection reports'}, and other files you upload, create, or link to PracticePro — including files analyzed by our AI services.</li>
                                        <li><strong>Communications:</strong> Messages sent through PracticePro, support tickets, feedback, and other messages to us or through Platform features.</li>
                                    </ul>
                                </div>

                                <div className="space-y-8">
                                    <h3 className="text-xl font-bold">3.2 Information Collected Automatically</h3>
                                    <ul className="list-disc pl-8 space-y-6">
                                        <li><strong>Usage data:</strong> How you access and use PracticePro — features used, actions taken, how often, how long, search queries, and patterns.</li>
                                        <li><strong>Device and technical data:</strong> IP address, device type, operating system, browser type and version, unique device identifiers, network information, and general location (city/state level, based on IP).</li>
                                        <li><strong>Log data:</strong> Server logs with date and time of access, pages viewed, features used, response times, error reports, and other system activity.</li>
                                        <li><strong>Cookies and similar technologies:</strong> We use cookies, invisible trackers, and similar tools to learn about your browsing. See Section 3.5 for details.</li>
                                    </ul>
                                </div>

                                <div className="space-y-8">
                                    <h3 className="text-xl font-bold">3.3 Information from Third-Party Sources</h3>
                                    <ul className="list-disc pl-8 space-y-6">
                                        <li><strong>Log-in services:</strong> If you sign in using a third-party service (e.g., Google Workspace), we receive basic profile details like name and email, as allowed by your privacy settings with that service.</li>
                                        <li><strong>Payment processors:</strong> Transaction confirmation and payment status from providers like Paystack or Flutterwave.</li>
                                        <li><strong>Integration partners:</strong> If you connect third-party apps (e.g., Google Drive, calendar systems), we receive the data needed to provide the integration, as authorized by you.</li>
                                    </ul>
                                </div>

                                <div className="space-y-8">
                                    <h3 className="text-xl font-bold">3.4 Local File Linking</h3>
                                    <p>
                                        PracticePro lets you link local folders or files from your computer for
                                        easier access. We do not upload your entire hard drive — only the files
                                        you specifically select, import, or ask PracticePro to process. You stay
                                        in full control of which local files PracticePro can access.
                                    </p>
                                </div>

                                <div className="space-y-8">
                                    <h3 className="text-xl font-bold">3.5 Cookies and Tracking Technologies</h3>
                                    <p>We use these types of cookies and tracking tools:</p>
                                    <ul className="list-disc pl-8 space-y-6">
                                        <li><strong>Essential cookies:</strong> Required for PracticePro to work — including login, security, and session management. These cannot be turned off.</li>
                                        <li><strong>Functional cookies:</strong> Remember your preferences, settings, and choices.</li>
                                        <li><strong>Analytics cookies:</strong> Help us understand how PracticePro is used, find performance issues, and improve our services.</li>
                                        <li><strong>Marketing cookies:</strong> Used to show relevant ads and measure campaign results (only with your consent).</li>
                                    </ul>
                                    <p>
                                        You can manage cookie preferences in your browser settings. Turning off
                                        essential cookies may break PracticePro features.
                                    </p>
                                </div>

                                {isProperty && (
                                    <div className="space-y-8">
                                        <h3 className="text-xl font-bold">3.6 Visitor & Access Code Data</h3>
                                        <p>
                                            When you use the Visitor Management System, we collect: (a) visitor
                                            name and phone number, given by the resident when generating an access
                                            code; (b) the resident's name, unit number, and property address,
                                            used to verify the visitor at the gatehouse; and (c) access code
                                            details — when it was made, when it expires, check-in and check-out
                                            times, and whether it was cancelled.
                                        </p>
                                        <p>
                                            This data is scoped to your property and unit. Other residents
                                            cannot see your access codes, and you cannot see theirs. The
                                            gatekeeper sees only the minimum needed for entry. Codes expire
                                            automatically (default: 6 hours) and are kept in an audit log for
                                            security reviews.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </section>

                        <section id="usage" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">4. How We Use Your Information</h2>
                            <div className="space-y-12">
                                <p>
                                    We use your personal data for these purposes, based on the legal reasons
                                    allowed by the NDPA 2023:
                                </p>

                                <div className="space-y-8">
                                    <h3 className="text-xl font-bold">4.1 To Provide and Maintain PracticePro</h3>
                                    <ul className="list-disc pl-8 space-y-6">
                                        <li>Create and manage user accounts</li>
                                        <li>Provide features including {isVega ? 'matter management' : 'property management'}, document storage, calendaring, billing, and tasks</li>
                                        <li>Sync data across your devices, including offline</li>
                                        <li>Provide customer support</li>
                                    </ul>
                                </div>

                                <div className="space-y-8">
                                    <h3 className="text-xl font-bold">4.2 To Provide AI-Powered Services</h3>
                                    <ul className="list-disc pl-8 space-y-6">
                                        <li>{isProperty ? 'Process documents and property information through ALOA™ for analysis, drafting, and insights' : 'Process documents and case information through ALOA™ for legal research, drafting, and analysis'}</li>
                                        <li>Generate summaries, risk assessments, and document drafts</li>
                                        {isVega && <li>Calculate filing deadlines from Nigerian court rules</li>}
                                        <li>Pull key details from uploaded documents</li>
                                        <li>Offer smart suggestions based on your {isVega ? 'matter' : 'property'} data</li>
                                        <li>Enable voice-based interaction and natural language processing</li>
                                    </ul>
                                    <p>
                                        <strong>Note:</strong> When you use AI features, you agree that we will
                                        send your data (including case facts and document content) to our AI
                                        service providers.
                                    </p>
                                </div>

                                <div className="space-y-8">
                                    <h3 className="text-xl font-bold">4.3 To Process Payments</h3>
                                    <ul className="list-disc pl-8 space-y-6">
                                        <li>Process subscription payments and invoices</li>
                                        <li>Manage billing accounts and payment methods</li>
                                        <li>Verify payment details and prevent fraud</li>
                                        <li>Generate receipts and financial records</li>
                                        <li>Calculate and collect applicable taxes (VAT)</li>
                                    </ul>
                                </div>

                                <div className="space-y-8">
                                    <h3 className="text-xl font-bold">4.4 To Improve PracticePro</h3>
                                    <ul className="list-disc pl-8 space-y-6">
                                        <li>Study how features are used, using grouped, anonymized data</li>
                                        <li>Find and fix bugs, and improve existing features</li>
                                        <li>Build and test new features</li>
                                        <li>Monitor and improve AI model performance</li>
                                    </ul>
                                </div>

                                <div className="space-y-8">
                                    <h3 className="text-xl font-bold">4.5 For Security and Fraud Prevention</h3>
                                    <ul className="list-disc pl-8 space-y-6">
                                        <li>Detect, prevent, and respond to security incidents, fraud, and policy violations</li>
                                        <li>Verify user identity and stop account abuse</li>
                                        <li>Watch for suspicious activity and keep records of activity</li>
                                        <li>Protect PracticePro, our users, and third parties</li>
                                    </ul>
                                </div>

                                <div className="space-y-8">
                                    <h3 className="text-xl font-bold">4.6 To Communicate With You</h3>
                                    <ul className="list-disc pl-8 space-y-6">
                                        <li>Send service-related announcements and important updates</li>
                                        <li>Provide customer support and respond to inquiries</li>
                                        <li>Notify you about account activity, new features, and maintenance</li>
                                        <li>Request feedback and run user surveys</li>
                                        <li>Send marketing messages (only with your consent — opt out anytime)</li>
                                        <li><strong>Automated multi-channel alerts:</strong> When tasks are assigned or reminders trigger, PracticePro may send in-app, email, or WhatsApp alerts. External contacts ({isVega ? 'clients' : 'residents'}) get email by default and WhatsApp only if they opt in. Internal staff get in-app alerts only. Change notification settings, including turning off WhatsApp, anytime in Settings.</li>
                                        <li><strong>Task notices:</strong> When a task is assigned to you, PracticePro uses your name, email, and (if needed) phone number to send assignment notices and reminders. We need this to deliver the service your firm signed up for.</li>
                                    </ul>
                                </div>

                                <div className="space-y-8">
                                    <h3 className="text-xl font-bold">4.7 To Comply with Legal Obligations</h3>
                                    <ul className="list-disc pl-8 space-y-6">
                                        <li>Follow applicable laws, regulations, court orders, and subpoenas</li>
                                        <li>Cooperate with law enforcement and regulators when legally required</li>
                                        <li>Keep records required by tax, accounting, and corporate laws</li>
                                        <li>Enforce our Terms of Service and other agreements</li>
                                    </ul>
                                </div>

                                <div className="space-y-8">
                                    <h3 className="text-xl font-bold">4.8 To Process User Feedback</h3>
                                    <p>
                                        When you send feedback through the in-app form, we process your name,
                                        email, feedback type, title, and message. Feedback is stored securely
                                        and visible to PracticePro's founder team through the admin app. You
                                        get an auto-reply right after submitting. Do not include sensitive
                                        personal data in feedback.
                                    </p>
                                </div>
                            </div>
                        </section>

                        <section id="ai-processing-detail" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">5. AI Processing and Third-Party Providers</h2>
                            <div className="space-y-12">
                                <div className="space-y-8">
                                    <h3 className="text-xl font-bold">5.1 ALOA™ AI Processing</h3>
                                    <p>
                                        ALOA™ is {isProperty ? 'our AI-powered property assistant that provides document analysis, portfolio insights, and drafting' : 'our AI-powered legal assistant that provides document analysis, legal research, and drafting'}. PracticePro uses a <strong>Bring Your Own Key (BYOK)</strong> model — meaning you use your own AI account (called Bring Your Own Key, or BYOK). Here is how it works:
                                    </p>
                                    <ul className="list-disc pl-8 space-y-6">
                                        <li><strong>Your own API key:</strong> To use ALOA™, you provide your own Google Gemini or OpenAI API key in the AI Settings panel. The key is stored in your browser and used to log in directly with the AI provider you choose.</li>
                                        <li><strong>Direct browser-to-provider transfer:</strong> When you submit a query, upload a document, or request AI content, your data goes straight from your browser to the AI provider (Google or OpenAI). PracticePro does not intercept, store, or route your AI queries.</li>
                                        <li><strong>You are the Data Controller for AI inputs:</strong> Because you supply your own API key and your data goes directly to the AI provider, you (not PracticePro) are the Data Controller for what you submit. Your use of the AI provider follows their Terms and Privacy Policy. We do not process your AI data on anyone else's behalf.</li>
                                        <li><strong>PracticePro does not train models on your data:</strong> We never use your AI inputs or outputs to train any models. Whether the AI provider uses your data for training is governed by your agreement with them. Review their terms and configure data retention in your provider account.</li>
                                        <li><strong>Privacy Shield Agent:</strong> Before sending data to AI, our Privacy Shield Agent finds and flags personal information (also called PII), so you can redact sensitive details first.</li>
                                        <li><strong>API key security:</strong> Your API key is stored in your browser's local storage and sent only to the AI provider's log-in service, never to PracticePro's servers. Keep your browser and device secured (password lock, screen lock).</li>
                                        <li><strong>AI conversation history:</strong> When you chat with {isVega ? 'ALOA™' : 'ARIA™'}, your conversations are saved and only visible within your firm. This lets you review past chats and helps the AI keep context. Conversations are visible to the user who created them and to firm administrators. PracticePro's founder team does NOT have read access — conversations are kept separate from the admin and feedback systems.</li>
                                    </ul>
                                </div>

                                <div className="space-y-8">
                                    <h3 className="text-xl font-bold">5.2 Other Third-Party Service Providers</h3>
                                    <p>
                                        We work with carefully chosen third-party providers to help deliver
                                        PracticePro. They process personal data only on our behalf and under
                                        strict contract terms. We do not sell your data.
                                    </p>

                                    <div className="space-y-6 pl-4 border-l-2 border-slate-100">
                                        <div className="space-y-4">
                                            <h4 className="font-bold">5.2.1 Cloud Hosting and Infrastructure</h4>
                                            <ul className="list-disc pl-8 space-y-2">
                                                <li><strong>Provider:</strong> Google Cloud Platform</li>
                                                <li><strong>Purpose:</strong> Hosting PracticePro, storing data, providing computing resources</li>
                                                <li><strong>Security:</strong> Strong infrastructure security, encryption, and compliance certifications (see cloud.google.com/security/compliance)</li>
                                            </ul>
                                        </div>

                                        <div className="space-y-4">
                                            <h4 className="font-bold">5.2.2 Payment Processors</h4>
                                            <ul className="list-disc pl-8 space-y-2">
                                                <li><strong>Providers:</strong> Paystack, Flutterwave, or other authorized Nigerian payment gateways</li>
                                                <li><strong>Purpose:</strong> Processing subscription payments and managing payment methods</li>
                                                <li><strong>Note:</strong> We do not store full credit card numbers or sensitive payment credentials</li>
                                            </ul>
                                        </div>

                                        <div className="space-y-4">
                                            <h4 className="font-bold">5.2.3 Analytics and Performance Monitoring</h4>
                                            <ul className="list-disc pl-8 space-y-2">
                                                <li><strong>Providers:</strong> Google Analytics, error tracking services, performance monitoring tools</li>
                                                <li><strong>Purpose:</strong> Understanding usage, finding issues, improving performance</li>
                                                <li><strong>Note:</strong> We anonymize personal data in analytics where possible</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-8">
                                    <h3 className="text-xl font-bold">5.3 Data Protection Safeguards for Third Parties</h3>
                                    <p>
                                        All third-party providers must, by contract, process data only as we
                                        instruct, use appropriate technical measures, keep data confidential,
                                        and sign contracts that meet Nigerian data protection requirements.
                                    </p>
                                </div>

                                <div className="space-y-8">
                                    <h3 className="text-xl font-bold">5.4 International Data Transfers</h3>
                                    <p>
                                        Some providers process data outside Nigeria. When data crosses borders,
                                        we protect it with contracts that meet the NDPA's protection standards.
                                    </p>
                                </div>
                            </div>
                        </section>

                        <section id="security" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">6. Data Security</h2>
                            <div className="space-y-12">
                                <p>
                                    We use technical and organizational measures to protect your personal data:
                                    encryption at rest and in transit, access controls, regular backups, network
                                    monitoring, and incident response procedures. If a breach affects your
                                    personal data, we will notify you without undue delay, following the NDPA's
                                    72-hour breach notification principle.
                                </p>
                            </div>
                        </section>

                        <section id="retention" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">7. Data Retention</h2>
                            <div className="space-y-12">
                                <p>
                                    We keep personal data only as long as needed for the purpose it was
                                    collected. Your account data is kept while your account is active. If you
                                    close your account, you can export your data within 60 days. After that, it
                                    is permanently deleted from our servers, except for records we are legally
                                    required to keep.
                                </p>
                            </div>
                        </section>

                        <section id="rights-detail" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">8. Your Rights Under NDPR and NDPA</h2>
                            <div className="space-y-12">
                                <p>
                                    Under Nigerian data protection law, you can access, see, correct,
                                    delete, limit, move, or stop us using your personal data. You can also
                                    withdraw consent and make a complaint to the Nigeria Data Protection
                                    Commission (NDPC). To use any of these rights, contact our Data Protection
                                    Officer at dpo@practicepro.ng.
                                </p>
                            </div>
                        </section>

                        <section id="children" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">9. Children's Privacy</h2>
                            <div className="space-y-12">
                                <p>
                                    PracticePro is intended for {isVega ? 'legal' : 'real estate'} professionals
                                    and people over 18. We do not knowingly collect personal data from anyone
                                    under 18.
                                </p>
                            </div>
                        </section>

                        <section id="roles" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">10. Data Controllers vs. Data Processors</h2>
                            <div className="space-y-12">
                                <div className="space-y-8">
                                    <h3 className="text-xl font-bold transition-colors">10.1 PracticePro as Data Controller</h3>
                                    <p>
                                        PracticePro is the Data Controller when handling information about your
                                        account, subscription, and general platform use. This includes how you
                                        interact with our billing systems and platform features.
                                    </p>
                                </div>

                                <div className="space-y-8">
                                    <h3 className="text-xl font-bold transition-colors">10.2 PracticePro as Data Processor</h3>
                                    <p>
                                        For all {isVega ? 'client data, matter specifics' : 'tenant data, property specifics'}, uploaded files, and ALOA™ queries you enter, the {isVega ? 'legal practitioner or law firm' : 'property manager or agency'} is the Data Controller. PracticePro only handles this data on your behalf, to provide the service.
                                    </p>
                                </div>
                            </div>
                        </section>

                        <section id="changes" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">11. Changes to This Policy</h2>
                            <div className="space-y-12">
                                <p>
                                    We may update this Privacy Policy from time to time. When we make material
                                    changes, we will notify you by email or in-app alert before they take
                                    effect. If you keep using PracticePro after the date above, we'll take
                                    that as your agreement to the changes.
                                </p>
                            </div>
                        </section>

                        <section id="contact" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">12. Contact Us</h2>
                            <div className="space-y-12">
                                <p>
                                    If you have questions, concerns, or requests about this Privacy Policy or
                                    how we handle data, contact us at:
                                </p>
                                <div className="space-y-6">
                                    <p>
                                        <strong>PracticePro Systems Limited</strong><br />
                                        <strong>Data Protection Officer:</strong> <a href="mailto:dpo@practicepro.ng" className="text-primary-600 hover:underline">dpo@practicepro.ng</a><br />
                                        <strong>General Inquiries:</strong> <a href="mailto:dpo@practicepro.ng" className="text-primary-600 hover:underline">dpo@practicepro.ng</a>
                                    </p>
                                </div>
                            </div>
                        </section>

                    </div>

                    {/* Footer Spacer for Mobile Clearances */}
                    <div className="h-32 pt-20 border-t border-slate-100 mt-20 text-center">
                        <p className="text-2xs text-slate-400 font-bold uppercase tracking-widest">
                            PracticePro {isVega ? 'VEGA • Nigerian Litigation System' : 'ATRIUM • Property OS'}
                        </p>
                    </div>

                    {/* Explicit bottom padding to clear mobile nav UI */}
                    <div className="h-20 sm:h-0" />
                </div>
            </div>
        </div>
    );
};

export default PrivacyPolicy;
