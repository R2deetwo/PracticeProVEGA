import React from 'react';
import { ChevronLeftIcon as ChevronLeft } from '../constants';

export const PrivacyPolicy: React.FC<{ onBack: () => void; activeProduct?: 'vega' | 'atrium' }> = ({ onBack, activeProduct = 'vega' }) => {
    const isVega = activeProduct === 'vega';
    const isProperty = !isVega;
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
                <h1 className="font-bold text-slate-900 dark:text-white">Privacy Policy</h1>
                <div className="w-16" /> {/* Spacer */}
            </div>

            {/* Scrollable Document Container */}
            <div className="flex-1 overflow-y-auto scroll-smooth custom-scrollbar">
                <div className="max-w-4xl mx-auto px-6 sm:px-12 py-12 lg:py-20">

                    {/* Document Head */}
                    <div className="mb-16">
                        <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-6">Privacy Policy</h1>
                        <p className="text-sm font-semibold text-slate-600 dark:text-zinc-400 mb-2 tracking-tight">PRACTICEPRO SYSTEMS LIMITED</p>
                        <div className="flex flex-col text-xs text-slate-500 dark:text-zinc-500 italic">
                            <span>Effective Date: July 19, 2026</span>
                            <span>Last Updated: February 24, 2026</span>
                        </div>
                    </div>

                    {/* Standard Document Content with explicit spacing */}
                    <div className="prose prose-slate dark:prose-invert max-w-none 
                        prose-p:leading-[1.8] prose-p:mb-12
                        prose-h2:mt-16 prose-h2:mb-8 prose-h2:text-3xl prose-h2:font-bold prose-h2:border-b-2 prose-h2:pb-4 prose-h2:border-slate-200 dark:prose-h2:border-zinc-800
                        prose-h3:mt-12 prose-h3:mb-6 prose-h3:text-xl prose-h3:font-bold
                        prose-ul:mb-10 prose-ul:space-y-4
                        prose-li:leading-relaxed">

                        <hr className="my-10" />

                        <h2>TABLE OF CONTENTS</h2>
                        <div className="bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-800 p-6 rounded-lg mb-10">
                            <ol className="list-decimal pl-5 space-y-2">
                                <li><a href="#introduction">Introduction</a></li>
                                <li><a href="#who-we-are">Who We Are (Data Controller Information)</a></li>
                                <li><a href="#information-collection">Information We Collect</a></li>
                                <li><a href="#usage">How We Use Your Information</a></li>
                                <li><a href="#ai-processing-detail">AI Processing and Third-Party Service Providers</a></li>
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
                                    Welcome to PracticePro (also known as {isVega ? '"PracticePro VEGA"' : '"PracticePro ATRIUM"'}), a comprehensive cloud-based {isVega ? 'Litigation System' : 'Property OS'} designed specifically for Nigerian {isVega ? 'lawyers and law firms' : 'property managers and real estate agencies'}. PracticePro Systems Limited ("PracticePro," "we," "us," or "our") is committed to protecting the privacy and security of your personal data in accordance with the <strong>Nigeria Data Protection Act 2023 (NDPA)</strong>, the <strong>Nigeria Data Protection Regulation 2019 (NDPR)</strong>, and all applicable Nigerian data protection laws and regulations.
                                </p>
                                <p>
                                    This Privacy Policy explains how we collect, use, disclose, store, and protect personal data when you use our Platform, including {isProperty ? 'our AI-powered property assistant ARIA™' : 'our AI-powered legal assistant ARIA™'}. By using PracticePro, you consent to the data practices described in this Privacy Policy.
                                </p>
                                <p>
                                    <strong>Important Note:</strong> As a {isVega ? 'Litigation System' : 'Property Management System'}, PracticePro processes sensitive personal data and confidential {isVega ? 'client' : 'tenant'} information on behalf of {isVega ? 'legal practitioners' : 'property managers'}. Users ({isVega ? 'lawyers and law firms' : 'property managers and real estate firms'}) are Data Controllers for their {isVega ? 'clients\'' : 'tenants\''} data, while PracticePro acts as a Data Processor. This Privacy Policy governs our data processing practices and your rights as a data subject.
                                </p>
                            </div>
                        </section>

                        <section id="who-we-are" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8">2. Who We Are (Data Controller Information)</h2>
                            <div className="space-y-12">
                                <p>
                                    <strong>Company Name:</strong> PracticePro Systems Limited<br />
                                    <strong>Registered Address:</strong> No. 6 Sulaiman Adekanbi Street, Igbo-Efon, Lekki-Epe Expressway. Lagos State<br />
                                    <strong>Email:</strong> <a href="mailto:dpo@practicepro.ng" className="text-primary-600 no-underline hover:underline">dpo@practicepro.ng</a><br />
                                    <strong>Data Protection Officer (DPO):</strong> <a href="mailto:dpo@practicepro.ng" className="text-primary-600 no-underline hover:underline">dpo@practicepro.ng</a>
                                </p>
                                <p>
                                    For matters related to User account information, billing, and platform usage, PracticePro is the Data Controller. For {isVega ? 'client' : 'tenant'} data entered into the Platform by {isVega ? 'legal practitioners' : 'property managers'}, the individual {isVega ? 'lawyer or law firm' : 'manager or firm'} is the Data Controller, and PracticePro is the Data Processor.
                                </p>
                            </div>
                        </section>

                        <section id="information-collection" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8">3. Information We Collect</h2>
                            <div className="space-y-12">
                                <p>We collect and process the following categories of personal data:</p>

                                <div className="space-y-8">
                                    <h3 className="text-xl font-bold">3.1 Information You Provide Directly</h3>
                                    <ul className="list-disc pl-8 space-y-6">
                                        <li><strong>Account Registration Information:</strong> Full name, email address, phone number, firm name, {isVega ? 'Nigerian Bar Association (NBA) enrollment number, practice areas, jurisdiction information,' : 'estate agency registration (e.g., NIESV/ESVARBON), service areas,'} and password.</li>
                                        <li><strong>Billing and Payment Information:</strong> Billing address, payment method details (processed securely through third-party payment processors), transaction history, and invoices.</li>
                                        <li><strong>Profile Information:</strong> Professional designation, firm logo, letterhead, practice preferences, and communication preferences.</li>
                                        <li><strong>{isVega ? 'Client and Matter' : 'Tenant and Property'} Data:</strong> Information about your {isVega ? 'clients and legal matters including names, contact details, case facts, court information, deadlines' : 'tenants and properties including names, contact details, lease agreements, rent schedules, maintenance records'}, financial records, time entries, expenses, and related documentation. This data is entered by you and is processed on your behalf.</li>
                                        <li><strong>Documents and Files:</strong> {isVega ? 'Legal documents, contracts, pleadings, correspondence,' : 'Lease agreements, tenancy notices, property title documents, inspection reports,'} and other files you upload, create, or link to the Platform, including documents analyzed by our AI services.</li>
                                        <li><strong>Communications:</strong> Messages sent through the Platform, support tickets, feedback, and any other communications with us or through Platform features.</li>
                                    </ul>
                                </div>

                                <div className="space-y-8">
                                    <h3 className="text-xl font-bold">3.2 Information Collected Automatically</h3>
                                    <ul className="list-disc pl-8 space-y-6">
                                        <li><strong>Usage Data:</strong> Information about how you access and use the Platform, including features used, actions taken, frequency and duration of use, search queries, and interaction patterns.</li>
                                        <li><strong>Device and Technical Information:</strong> IP address, device type, operating system, browser type and version, unique device identifiers, network information, and general location data (city/state level based on IP address).</li>
                                        <li><strong>Log Data:</strong> Server logs that include date and time of access, pages viewed, features accessed, response times, error reports, and other system activity.</li>
                                        <li><strong>Cookies and Similar Technologies:</strong> We use cookies, web beacons, and similar tracking technologies to collect information about your browsing activities. See Section 3.4 for details.</li>
                                    </ul>
                                </div>

                                <div className="space-y-8">
                                    <h3 className="text-xl font-bold">3.3 Information from Third-Party Sources</h3>
                                    <ul className="list-disc pl-8 space-y-6">
                                        <li><strong>Authentication Services:</strong> If you register or log in using third-party services (e.g., Google Workspace), we receive basic profile information such as name and email address as permitted by your privacy settings with that service.</li>
                                        <li><strong>Payment Processors:</strong> Transaction confirmation and payment status information from payment service providers like Paystack or Flutterwave.</li>
                                        <li><strong>Integration Partners:</strong> If you connect third-party applications (e.g., Google Drive, calendar systems), we receive data necessary to provide integrated functionality as authorized by you.</li>
                                    </ul>
                                </div>

                                <div className="space-y-8">
                                    <h3 className="text-xl font-bold">3.4 Local File Linking and Aggregation</h3>
                                    <p><strong>Important Clarification:</strong> PracticePro includes features that allow you to link local folders or files from your desktop or device to the Platform for easier access and organization. When you use these features:</p>
                                    <ul className="list-disc pl-8 space-y-6">
                                        <li>We do not automatically upload your entire hard drive. Files are uploaded only when you specifically select, import, or instruct the Platform to process them.</li>
                                        <li>Only files you specifically select, import, or instruct the Platform to process are uploaded or analyzed.</li>
                                        <li>File linking features require your explicit permission and configuration.</li>
                                        <li>You maintain full control over which local files are accessed by PracticePro.</li>
                                        <li>We process only the files you explicitly direct us to process through features like document upload, AI analysis, or matter attachment.</li>
                                    </ul>
                                </div>

                                <div className="space-y-8">
                                    <h3 className="text-xl font-bold">3.5 Cookies and Tracking Technologies</h3>
                                    <p>We use the following types of cookies and tracking technologies:</p>
                                    <ul className="list-disc pl-8 space-y-6">
                                        <li><strong>Essential Cookies:</strong> Required for Platform functionality, including authentication, security, and session management. These cannot be disabled.</li>
                                        <li><strong>Functional Cookies:</strong> Remember your preferences, settings, and choices to enhance your experience.</li>
                                        <li><strong>Analytics Cookies:</strong> Help us understand how the Platform is used, identify performance issues, and improve our services. We may use services like Google Analytics.</li>
                                        <li><strong>Marketing Cookies:</strong> Used to deliver relevant advertisements and measure campaign effectiveness (only with your consent).</li>
                                    </ul>
                                    <p>You can manage your cookie preferences through your browser settings. However, disabling essential cookies may affect Platform functionality.</p>
                                </div>
                            </div>
                        </section>

                        <section id="usage" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">4. How We Use Your Information</h2>
                            <div className="space-y-12">
                                <p>We process your personal data for the following purposes, based on the lawful bases specified under the NDPA 2023:</p>

                                <div className="space-y-8">
                                    <h3 className="text-xl font-bold">4.1 To Provide and Maintain the Platform (Contractual Necessity)</h3>
                                    <ul className="list-disc pl-8 space-y-6">
                                        <li>Create, maintain, and authenticate user accounts</li>
                                        <li>Provide access to Platform features including {isVega ? 'matter management' : 'property management'}, document storage, calendaring, billing, and task management</li>
                                        <li>Process and fulfill your requests for Platform services</li>
                                        <li>Synchronize data across devices and maintain data consistency</li>
                                        <li>Enable offline functionality and data synchronization</li>
                                        <li>Provide customer support and respond to inquiries</li>
                                    </ul>
                                </div>

                                <div className="space-y-8">
                                    <h3 className="text-xl font-bold">4.2 To Provide AI-Powered Services (Consent)</h3>
                                    <ul className="list-disc pl-8 space-y-6">
                                        <li>{isProperty ? 'Process documents and property information through ARIA™ for analysis, document drafting, and insights' : 'Process documents and case information through ARIA™ for legal research, document drafting, and analysis'}</li>
                                        <li>Generate automated summaries, risk assessments, and legal document drafts</li>
                                        {isVega && <li>Calculate filing deadlines based on Nigerian court rules</li>}
                                        <li>Extract metadata and key information from uploaded documents</li>
                                        <li>Provide intelligent suggestions and proactive insights based on matter data</li>
                                        <li>Enable voice-based interaction and natural language processing</li>
                                    </ul>
                                    <p><strong>Important:</strong> When you use AI features, you explicitly consent to the processing of data (including case facts and document content) through our AI service providers.</p>
                                </div>

                                <div className="space-y-8">
                                    <h3 className="text-xl font-bold">4.3 To Process Payments (Contractual Necessity)</h3>
                                    <ul className="list-disc pl-8 space-y-6">
                                        <li>Process subscription payments and invoices</li>
                                        <li>Manage billing accounts and payment methods</li>
                                        <li>Verify payment information and prevent fraud</li>
                                        <li>Generate receipts and financial records</li>
                                        <li>Calculate and collect applicable taxes (VAT)</li>
                                    </ul>
                                </div>

                                <div className="space-y-8">
                                    <h3 className="text-xl font-bold">4.4 To Improve and Optimize the Platform (Legitimate Interests)</h3>
                                    <ul className="list-disc pl-8 space-y-6">
                                        <li>Analyze usage patterns to understand how features are used</li>
                                        <li>Identify and fix technical issues, bugs, and performance problems</li>
                                        <li>Develop new features and enhance existing functionality</li>
                                        <li>Conduct research and analytics using aggregate, anonymized data</li>
                                        <li>Test new features and conduct quality assurance</li>
                                        <li>Monitor and improve AI model performance and accuracy</li>
                                    </ul>
                                </div>

                                <div className="space-y-8">
                                    <h3 className="text-xl font-bold">4.5 For Security and Fraud Prevention (Legitimate Interests)</h3>
                                    <ul className="list-disc pl-8 space-y-6">
                                        <li>Detect, prevent, and respond to security incidents and threats</li>
                                        <li>Investigate and prevent fraud, unauthorized access, and policy violations</li>
                                        <li>Verify user identity and prevent account abuse</li>
                                        <li>Monitor for suspicious activity and potential security breaches</li>
                                        <li>Maintain audit trails and access logs for security purposes</li>
                                        <li>Protect the rights, property, and safety of PracticePro, our users, and third parties</li>
                                    </ul>
                                </div>

                                <div className="space-y-8">
                                    <h3 className="text-xl font-bold">4.6 To Communicate With You</h3>
                                    <ul className="list-disc pl-8 space-y-6">
                                        <li>Send service-related announcements and important Platform updates</li>
                                        <li>Provide customer support and respond to inquiries</li>
                                        <li>Send notifications about account activity, new features, and system maintenance</li>
                                        <li>Request feedback and conduct user surveys</li>
                                        <li>Send marketing communications (only with your consent, and you may opt out at any time)</li>
                                    </ul>
                                </div>

                                <div className="space-y-8">
                                    <h3 className="text-xl font-bold">4.7 To Comply with Legal Obligations</h3>
                                    <ul className="list-disc pl-8 space-y-6">
                                        <li>Comply with applicable laws, regulations, and regulatory requests</li>
                                        <li>Respond to court orders, subpoenas, and legal process</li>
                                        <li>Cooperate with law enforcement and regulatory authorities when legally required</li>
                                        <li>Maintain records as required by tax, accounting, and corporate laws</li>
                                        <li>Enforce our Terms of Service and other agreements</li>
                                    </ul>
                                </div>
                            </div>
                        </section>

                        <section id="ai-processing-detail" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">5. AI Processing and Third-Party Service Providers</h2>
                            <div className="space-y-12">
                                <div className="space-y-8">
                                    <h3 className="text-xl font-bold">5.1 ARIA™ AI Processing</h3>
                                    <p>ARIA™ is {isProperty ? 'our AI-powered property assistant that provides document analysis, portfolio insights, and drafting capabilities' : 'our AI-powered legal assistant that provides document analysis, legal research, and drafting capabilities'}. When you use ARIA™ features, your data (including {isProperty ? 'property data' : 'case facts'}, document content, and queries) is processed as follows:</p>
                                    <ul className="list-disc pl-8 space-y-6">
                                        <li><strong>AI Service Provider:</strong> We use Google's Gemini API (via Google Cloud Vertex AI) to power ARIA™'s natural language processing and generation capabilities.</li>
                                        <li><strong>Data Transmission:</strong> When you submit a query, upload a document for analysis, or request AI-generated content, that data is securely transmitted to Google's API for processing.</li>
                                        <li><strong>Processing Purpose:</strong> The data is processed solely to generate the requested output and is returned to you through the Platform.</li>
                                        <li><strong>No Model Training:</strong> Under our agreements with Google, your data is not used to train Google's public AI models. We have configured our API usage and contractual arrangements to prohibit the use of your data for model training purposes.</li>
                                        <li><strong>Transient Processing:</strong> AI processing is transient—data is processed in real-time and not permanently stored by the AI provider beyond what is necessary for service delivery.</li>
                                        <li><strong>Privacy Shield Agent:</strong> Before processing data through AI, our Privacy Shield Agent identifies and flags Personally Identifiable Information (PII), giving you the option to redact sensitive information before submission.</li>
                                    </ul>
                                </div>

                                <div className="space-y-8">
                                    <h3 className="text-xl font-bold">5.2 Other Third-Party Service Providers</h3>
                                    <p>We engage carefully selected third-party service providers to help us deliver the Platform. These providers process personal data only on our behalf and under strict contractual obligations. We do not sell your data to third parties.</p>

                                    <div className="space-y-6 pl-4 border-l-2 border-slate-100 dark:border-zinc-800">
                                        <div className="space-y-4">
                                            <h4 className="font-bold">5.2.1 Cloud Hosting and Infrastructure</h4>
                                            <ul className="list-disc pl-8 space-y-2">
                                                <li><strong>Provider:</strong> Google Cloud Platform</li>
                                                <li><strong>Purpose:</strong> Hosting the Platform, storing data, providing computing resources</li>
                                                <li><strong>Security:</strong> Google Cloud provides robust infrastructure security, encryption, and maintains its own compliance certifications (see cloud.google.com/security/compliance for details)</li>
                                            </ul>
                                        </div>

                                        <div className="space-y-4">
                                            <h4 className="font-bold">5.2.2 Payment Processors</h4>
                                            <ul className="list-disc pl-8 space-y-2">
                                                <li><strong>Providers:</strong> Paystack, Flutterwave, or other authorized Nigerian payment gateways</li>
                                                <li><strong>Purpose:</strong> Processing subscription payments, managing payment methods, transaction processing</li>
                                                <li><strong>Note:</strong> We do not store complete credit card numbers or sensitive payment credentials on our servers</li>
                                            </ul>
                                        </div>

                                        <div className="space-y-4">
                                            <h4 className="font-bold">5.2.3 Analytics and Performance Monitoring</h4>
                                            <ul className="list-disc pl-8 space-y-2">
                                                <li><strong>Providers:</strong> Google Analytics, error tracking services, performance monitoring tools</li>
                                                <li><strong>Purpose:</strong> Understanding usage patterns, identifying technical issues, improving Platform performance</li>
                                                <li><strong>Note:</strong> We configure analytics tools to anonymize personal data where possible</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-8">
                                    <h3 className="text-xl font-bold">5.3 Data Protection Safeguards for Third Parties</h3>
                                    <p>All third-party service providers are contractually required to process data only as instructed by us, implement appropriate technical measures, maintain confidentiality, and operate under data processing agreements that address applicable data protection requirements.</p>
                                </div>

                                <div className="space-y-8">
                                    <h3 className="text-xl font-bold">5.4 International Data Transfers</h3>
                                    <p>Some of our service providers may process data outside Nigeria. When data is transferred internationally, we take steps to ensure adequate protection through appropriate contractual safeguards and by requiring service providers to maintain adequate levels of data protection as required by the NDPA.</p>
                                </div>
                            </div>
                        </section>

                        <section id="security" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">6. Data Security</h2>
                            <div className="space-y-12">
                                <p>
                                    We implement technical and organizational security measures to protect your personal data, including data encryption at rest and in transit, access controls, regular backups, network monitoring, and security incident response procedures.
                                </p>
                            </div>
                        </section>

                        <section id="retention" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">7. Data Retention</h2>
                            <div className="space-y-12">
                                <p>
                                    We retain personal data only for as long as necessary to fulfill the purposes for which it was collected. User account data is maintained for the duration of your active account. Upon termination, data can be exported natively within 60 days, after which it is permanently deleted from our servers, subject to limited retention required for tax and legal obligations.
                                </p>
                            </div>
                        </section>

                        <section id="rights-detail" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">8. Your Rights Under NDPR and NDPA</h2>
                            <div className="space-y-12">
                                <p>
                                    Under the Nigerian data protection framework, you have the right to access, rectify, or request erasure of your data. You may object to or restrict processing, request your data in a portable format, and withdraw consent. You also have the right to lodge a complaint with the Nigeria Data Protection Commission (NDPC). To exercise these rights, please contact our Data Protection Officer at dpo@practicepro.ng.
                                </p>
                            </div>
                        </section>

                        <section id="children" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">9. Children's Privacy</h2>
                            <div className="space-y-12">
                                <p>
                                    PracticePro is intended solely for {isVega ? 'legal' : 'real estate'} professionals and individuals over the age of 18. We do not knowingly collect personal data from anyone under the age of 18.
                                </p>
                            </div>
                        </section>

                        <section id="roles" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">10. Data Controllers vs. Data Processors</h2>
                            <div className="space-y-12">
                                <div className="space-y-8">
                                    <h3 className="text-xl font-bold transition-colors">10.1 PracticePro as Data Controller</h3>
                                    <p>
                                        PracticePro acts as the Data Controller when processing information about your account, subscription, and general Platform usage. This encompasses how you interact with our billing systems and platform functionality.
                                    </p>
                                </div>

                                <div className="space-y-8">
                                    <h3 className="text-xl font-bold transition-colors">10.2 PracticePro as Data Processor</h3>
                                    <p>
                                        For all {isVega ? 'client data, matter specifics' : 'tenant data, property specifics'}, uploaded files, and ARIA™ queries that you input into the Platform, the {isVega ? 'legal practitioner or law firm' : 'property manager or agency'} is the Data Controller. PracticePro acts as your Data Processor, handling this information only under your instruction and strictly for the provision of the Platform's services.
                                    </p>
                                </div>
                            </div>
                        </section>

                        <section id="changes" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">11. Changes to This Policy</h2>
                            <div className="space-y-12">
                                <p>
                                    We may update this Privacy Policy from time to time. When we make material changes, we will notify you via email or through an application alert prior to the changes taking effect. Your continued use of the Platform after the effective date constitutes your acceptance of the updated Policy.
                                </p>
                            </div>
                        </section>

                        <section id="contact" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">12. Contact Us</h2>
                            <div className="space-y-12">
                                <p>
                                    If you have any questions, concerns, or requests regarding this Privacy Policy or our data processing practices, please contact us at:
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
                    <div className="h-32 pt-20 border-t border-slate-100 dark:border-zinc-800 mt-20 text-center">
                        <p className="text-2xs text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-widest">
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
