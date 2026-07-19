import React from 'react';
import { ChevronLeftIcon as ChevronLeft } from '../constants';

export const TermsOfService: React.FC<{ onBack: () => void; activeProduct?: 'vega' | 'atrium' }> = ({ onBack, activeProduct = 'vega' }) => {
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
                <h1 className="font-bold text-slate-900 dark:text-white">Terms and Conditions of Service</h1>
                <div className="w-16" /> {/* Spacer */}
            </div>

            {/* Scrollable Document Container */}
            <div className="flex-1 overflow-y-auto scroll-smooth custom-scrollbar">
                <div className="max-w-4xl mx-auto px-6 sm:px-12 py-12 lg:py-20">
                    <div className="mb-16">
                        <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-6">TERMS AND CONDITIONS OF SERVICE</h1>
                        <p className="text-sm font-semibold text-slate-600 dark:text-zinc-400 mb-2 tracking-tight">PracticePro Legal Technologies Limited</p>
                        <div className="flex flex-col text-xs text-slate-500 dark:text-zinc-500 italic">
                            <span>Effective Date: January 1, 2026</span>
                            <span>Last Updated: April 10, 2026</span>
                            <span>Version: 2.0</span>
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
                                <li><a href="#section-1">Definitions and Interpretation</a></li>
                                <li><a href="#section-2">Agreement to Terms</a></li>
                                <li><a href="#section-3">Platform Services and Description</a></li>
                                <li><a href="#section-4">User Registration and Eligibility</a></li>
                                <li><a href="#section-5">Artificial Intelligence Services</a></li>
                                <li><a href="#section-6">AI Risk Disclaimers and Professional Responsibility</a></li>
                                <li><a href="#section-7">Intellectual Property Rights</a></li>
                                <li><a href="#section-8">Data Protection and Privacy (NDPA 2023)</a></li>
                                <li><a href="#section-9">Cookie Policy and Consent</a></li>
                                <li><a href="#section-10">Password Security and Account Access</a></li>
                                <li><a href="#section-11">Data Retention and Deletion</a></li>
                                <li><a href="#section-12">Subscription Fees and Payment Terms</a></li>
                                <li><a href="#section-13">Acceptable Use and Prohibited Conduct</a></li>
                                <li><a href="#section-14">Service Availability and Modifications</a></li>
                                <li><a href="#section-15">Warranties and Disclaimers</a></li>
                                <li><a href="#section-16">Limitation of Liability</a></li>
                                <li><a href="#section-17">Indemnification</a></li>
                                <li><a href="#section-18">Term and Termination</a></li>
                                <li><a href="#section-19">Dispute Resolution</a></li>
                                <li><a href="#section-20">Governing Law and Jurisdiction</a></li>
                                <li><a href="#section-21">General Provisions</a></li>
                                <li><a href="#section-22">Contact Information</a></li>
                                <li><a href="#section-23">Portal Terms of Use</a></li>
                            </ol>
                        </div>

                        <hr className="my-10" />

                        <section id="section-1" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">1. DEFINITIONS AND INTERPRETATION</h2>
                            <div className="space-y-16">
                                <div id="1-1" className="space-y-8">
                                    <h3 className="text-xl font-bold">1.1 Definitions</h3>
                                    <p>In these Terms and Conditions, the following terms shall have the meanings set forth below:</p>
                                    <div className="space-y-8 pl-4 border-l-2 border-slate-100 dark:border-zinc-800">
                                        {isVega && <p><strong>"ALOA"</strong> or <strong>"ALOA™"</strong> means Advanced Legal Office Assistant, the artificial intelligence agent powered by Google's Gemini API that provides conversational interfaces, research assistance, document drafting, voice control, and proactive intelligence features within the Platform.</p>}
                                        {isProperty && <p><strong>"ARIA"</strong> or <strong>"ARIA™"</strong> means Asset & Revenue Intelligence Assistant, the artificial intelligence agent embedded within Atrium OS that monitors rent collection, resident compliance, and portfolio revenue performance.</p>}
                                        <p><strong>"AI Agents"</strong> means collectively, ALOA™/ARIA™ (as applicable), Jurisdiction Scout, ALDIA, DraftPro, Court Rules Agent, Privacy Shield Agent, and Scale Expert Agent, all of which constitute the artificial intelligence-powered components of the Platform.</p>
                                        <p><strong>"ALDIA"</strong> means Advanced Legal Document Intelligence Agent, which provides automated document summarization, risk analysis, metadata extraction, and clause identification services.</p>
                                        <p><strong>"Agreement"</strong> means these Terms and Conditions, together with all schedules, exhibits, and documents incorporated by reference, including the Privacy Policy.</p>
                                        <p><strong>"Company," "we," "us," "our"</strong> means PracticePro Legal Technologies Limited, a company operating under the laws of the Federal Republic of Nigeria with its registered office at No. 6 Sulaiman Adekanbi Street, Igbo-Efon, Lekki-Epe Expressway, Lagos State, Nigeria.</p>
                                        <p><strong>"Content"</strong> means all data, text, software, photographs, graphics, video, messages, tags, or other materials, whether publicly posted or privately transmitted, uploaded to or transmitted through the Platform by Users.</p>
                                        {isVega && <p><strong>"Court Rules Agent"</strong> means the AI component that calculates statutory filing deadlines based on Nigerian Civil Procedure Rules and automatically generates tasks for calculated deadlines.</p>}
                                        <p><strong>"DraftPro"</strong> means the AI-powered document drafting assistant that generates legal documents based on templates, user inputs, and matter-specific data.</p>
                                        {isVega && <p><strong>"Jurisdiction Scout"</strong> means the AI component that identifies appropriate courts, jurisdictions, and applicable legal frameworks for matters.</p>}
                                        <p><strong>"NDPA"</strong> means the Nigeria Data Protection Act 2023 (Act No. 5 of 2023) and all regulations, guidelines, and directives issued thereunder by the Nigeria Data Protection Commission.</p>
                                        <p><strong>"Personal Data"</strong> has the meaning ascribed to it in Section 65 of the NDPA 2023, being any information relating to an identified or identifiable natural person.</p>
                                        <p><strong>"Platform"</strong> means the {isVega ? 'VEGA professional operations system' : 'ATRIUM property management system'}, including all web applications, APIs, and related services made available by the Company.</p>
                                        <p><strong>"Privacy Shield Agent"</strong> means the AI component designed to identify, flag, and facilitate redaction of Personally Identifiable Information (PII) from documents before processing through other AI Services.</p>
                                        {isVega ? (
                                            <>
                                                <p><strong>"RPC"</strong> means the Rules of Professional Conduct in the Legal Profession, 2023, as may be amended from time to time.</p>
                                                <p><strong>"Scale Expert Agent"</strong> means the AI component that calculates professional fees based on the Legal Practitioners (Remuneration for Legal Documentation and Other Land Matters) Order 2023.</p>
                                            </>
                                        ) : (
                                            <>
                                                <p><strong>"NIESV"</strong> means the Nigerian Institution of Estate Surveyors and Valuers.</p>
                                                <p><strong>"Tenancy Law"</strong> means the Tenancy Law of Lagos State 2011 and other applicable state tenancy laws in Nigeria.</p>
                                            </>
                                        )}
                                        <p><strong>"Subscription"</strong> means your contractual arrangement with the Company for access to the Platform under a specified pricing tier.</p>
                                        <p><strong>"User," "you," "your"</strong> means any individual, {isVega ? 'law firm, legal department' : 'property manager, real estate agency'}, or other entity that registers for, accesses, or uses the Platform.</p>
                                        <p><strong>"User Data"</strong> means all data, information, documents, and content submitted, uploaded, or created by or on behalf of Users through the Platform.</p>
                                    </div>
                                </div>

                                <div id="1-2" className="space-y-8">
                                    <h3 className="text-xl font-bold">1.2 Interpretation</h3>
                                    <div className="space-y-8">
                                        <p>1.2.1 In this Agreement, unless the context otherwise requires:</p>
                                        <div className="space-y-8 pl-4">
                                            <p>(a) <strong>Headings and Titles:</strong> Section headings are inserted for convenience only and shall not affect the construction of this Agreement.</p>
                                            <p>(b) <strong>Singular and Plural:</strong> Words importing the singular include the plural and vice versa.</p>
                                            <p>(c) <strong>Including:</strong> The words "include," "includes," "including," shall be construed without limitation.</p>
                                            <p>(d) <strong>Statutory References:</strong> References to any statute include all amendments, extensions, or re-enactments.</p>
                                            <p>(e) <strong>Writing:</strong> References to "writing" include emails and electronic communications.</p>
                                            <p>(f) <strong>Business Days:</strong> "Business day" means any day other than Saturday, Sunday, or a public holiday in Nigeria.</p>
                                            <p>(g) <strong>Currency:</strong> All monetary amounts are in Nigerian Naira (₦) unless otherwise specified.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section id="section-2" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">2. AGREEMENT TO TERMS</h2>
                            <div className="space-y-16">
                                <div id="2-1" className="space-y-8">
                                    <h3 className="text-xl font-bold">2.1 Binding Contract</h3>
                                    <p>2.1.1 These Terms and Conditions constitute a legally binding contract between you and PracticePro Legal Technologies Limited governing your access to and use of the Platform.</p>
                                    <p>2.1.2 By creating an account, accessing the Platform, or using any Platform services, you acknowledge that you have read, understood, and agree to be legally bound by this Agreement.</p>
                                    <p>2.1.3 <strong>IF YOU DO NOT AGREE TO BE BOUND BY THIS AGREEMENT, YOU MUST NOT ACCESS OR USE THE PLATFORM.</strong></p>
                                </div>

                                <div id="2-2" className="space-y-8">
                                    <h3 className="text-xl font-bold">2.2 Capacity and Authority</h3>
                                    <p>2.2.1 You represent and warrant that you have the legal capacity to enter into binding contracts under Nigerian law and are at least eighteen (18) years of age.</p>
                                    <p>2.2.2 <strong>Professional Status:</strong> {isVega ? 'If you represent yourself as a legal practitioner, you warrant that you are duly enrolled and licensed to practice law in Nigeria and are in good standing with the Nigerian Bar Association.' : 'If you represent yourself as a property manager or real estate agent, you warrant that you have all necessary licenses and authority to manage the properties listed on the Platform.'}</p>
                                </div>

                                <div id="2-4" className="space-y-8">
                                    <h3 className="text-xl font-bold">2.3 Amendments and Modifications</h3>
                                    <p>2.3.1 <strong>Right to Modify:</strong> The Company reserves the right to modify, amend, or update this Agreement at any time in its sole discretion.</p>
                                    <p>2.3.2 <strong>Material Changes:</strong> For changes that materially affect your rights, we will provide at least thirty (30) days' advance notice by email or prominent notice on the Platform.</p>
                                    <p>2.3.3 <strong>Effective Date:</strong> Amendments become effective on the date specified in the notice or, if no date is specified, thirty (30) days after notice is provided.</p>
                                </div>

                                <div id="2-5" className="space-y-8">
                                    <h3 className="text-xl font-bold">2.4 Additional Terms and Policies</h3>
                                    <p>2.4.1 <strong>Incorporated Documents:</strong> The Privacy Policy, Cookie Policy, and Data Processing Agreement are incorporated into this Agreement by reference and form part of the binding contract between you and the Company.</p>
                                </div>
                            </div>
                        </section>

                        <section id="section-3" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">3. PLATFORM SERVICES AND DESCRIPTION</h2>
                            <div className="space-y-16">
                                <div id="3-1" className="space-y-8">
                                    <h3 className="text-xl font-bold">3.1 Platform Overview</h3>
                                    <p>The Company provides a comprehensive, cloud-based {isVega ? 'professional operations platform designed specifically for Nigerian teams' : 'property management platform designed specifically for the Nigerian real estate sector'}. The Platform integrates traditional {isVega ? 'operational' : 'property'} management functionalities with advanced artificial intelligence capabilities.</p>
                                </div>

                                <div id="3-2" className="space-y-8">
                                    <h3 className="text-xl font-bold">3.2 Core Functionalities</h3>
                                    <p>3.2.1 <strong>{isVega ? 'Matter and Case Management' : 'Property and Tenant Management'}:</strong> Centralized repository for all {isVega ? 'matters, cases, and client information' : 'properties, units, and tenant information'} with customizable workflows and status tracking.</p>
                                    <p>3.2.2 <strong>Document Management:</strong> Secure cloud storage for all {isVega ? 'case files' : 'lease agreements'} and documents with version control and document history tracking.</p>
                                    <p>3.2.3 <strong>Task and Workflow Management:</strong> Task creation, assignment, and tracking with priority levels and deadline management.</p>
                                    <p>3.2.4 <strong>Calendar and Scheduling:</strong> Integrated calendar for all firm events and deadlines {isVega && 'with automatic calculation based on Nigerian court rules'}.</p>
                                    <p>3.2.5 <strong>Financial Management:</strong> Invoicing, {isVega ? 'time-entry billing, expense tracking, and fee schedule automation' : 'rent collection, receipt generation, and expense tracking'}.</p>
                                    <p>3.2.6 <strong>{isVega ? 'Client' : 'Tenant'} Communications:</strong> Secure messaging and portal features for updates and collaboration.</p>
                                </div>

                                <div id="3-3" className="space-y-8">
                                    <h3 className="text-xl font-bold">3.3 Subscription Tiers</h3>
                                    <p>The Platform is offered in multiple subscription tiers (Free, Standard, Professional, and Enterprise), each providing different levels of functionality, capacity, and support. The specific features available at each tier are detailed on the Platform's pricing page and may be updated from time to time.</p>
                                </div>
                            </div>
                        </section>

                        <section id="section-4" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">4. USER REGISTRATION AND ELIGIBILITY</h2>
                            <div className="space-y-16">
                                <div id="4-1" className="space-y-8">
                                    <h3 className="text-xl font-bold">4.1 Eligibility Criteria</h3>
                                    <p>The Platform is designed exclusively for use by {isVega ? 'legal practitioners, law firms, corporate legal departments, and educational institutions' : 'property managers, real estate agencies, landlords, and property management companies'}. You must be at least eighteen (18) years of age to create an account.</p>
                                </div>

                                <div id="4-2" className="space-y-8">
                                    <h3 className="text-xl font-bold">4.2 Account Registration</h3>
                                    <p>4.2.1 To access the Platform, you must create an account by providing accurate, current, and complete personal, professional, and billing information. You agree to maintain and promptly update your information to keep it accurate.</p>
                                    <p>4.2.2 <strong>Email Verification:</strong> All accounts require email verification before access is granted. You are responsible for ensuring your provided email address is valid and accessible.</p>
                                    <p>4.2.3 <strong>One Account Per Person:</strong> Each individual may only maintain one active account. Creating multiple accounts to circumvent restrictions constitutes a material breach of this Agreement.</p>
                                    <p>4.2.4 <strong>Account Responsibility:</strong> You are fully responsible for all activity that occurs under your account and for maintaining the confidentiality of your login credentials. You must notify us immediately upon becoming aware of any unauthorized use of your account.</p>
                                </div>

                                <div id="4-3" className="space-y-8">
                                    <h3 className="text-xl font-bold">4.3 Explicit Consent at Registration</h3>
                                    <p>4.3.1 During registration, you will be required to provide two separate, explicit, and affirmative consent actions:</p>
                                    <div className="space-y-4 pl-4 border-l-2 border-slate-100 dark:border-zinc-800">
                                        <p>(a) Agreement to these Terms and Conditions of Service; and</p>
                                        <p>(b) Agreement to the Privacy Policy, which governs the collection, processing, and retention of your personal data.</p>
                                    </div>
                                    <p>4.3.2 These consents are recorded with a timestamp and stored in our database for regulatory accountability as required by NDPA 2023.</p>
                                </div>
                            </div>
                        </section>

                        <section id="section-5" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">5. ARTIFICIAL INTELLIGENCE SERVICES</h2>
                            <div className="space-y-16">
                                <div id="5-1" className="space-y-8">
                                    <p>Provides conversational AI assistance, research, document drafting, voice control, and proactive intelligence. ARIA™ processes matter context and team data to provide personalized assistance.</p>
                                </div>
                                <div id="5-2" className="space-y-8">
                                    <h3 className="text-xl font-bold">5.2 ALDIA — Document Intelligence Agent</h3>
                                    <p>Provides automated document summarization, risk analysis, metadata extraction, and clause identification. Documents submitted to ALDIA are transmitted to Google's Gemini API for processing.</p>
                                </div>
                                <div id="5-3" className="space-y-8">
                                    <h3 className="text-xl font-bold">5.3 DraftPro — Document Drafting Assistant</h3>
                                    <p>AI-powered document generation based on templates, user inputs, and matter-specific data. All drafts require professional review before use in legal proceedings.</p>
                                </div>
                                {isVega && (
                                    <>
                                        <div id="5-4" className="space-y-8">
                                            <h3 className="text-xl font-bold">5.4 Jurisdiction Scout</h3>
                                            <p>Identifies appropriate courts, jurisdictions, and applicable legal frameworks. Output is advisory only and does not constitute legal advice. Practitioners must independently verify all jurisdictional determinations.</p>
                                        </div>
                                        <div id="5-5" className="space-y-8">
                                            <h3 className="text-xl font-bold">5.5 Court Rules Agent</h3>
                                            <p>Calculates statutory filing deadlines based on Nigerian Civil Procedure Rules and court-specific variations, automatically generating reminders and tasks. Due to the jurisdictional complexity of Nigerian procedure, all calculated deadlines require independent verification by qualified practitioners.</p>
                                        </div>
                                    </>
                                )}
                                <div id="5-6" className="space-y-8">
                                    <h3 className="text-xl font-bold">5.{isVega ? '6' : '4'} Privacy Shield Agent</h3>
                                    <p>Identifies and manages Personally Identifiable Information (PII) before processing, offering options for manual or automated redaction to comply with NDPA 2023 data minimization requirements.</p>
                                </div>
                                {isVega && (
                                    <div id="5-7" className="space-y-8">
                                        <h3 className="text-xl font-bold">5.7 Scale Expert Agent</h3>
                                        <p>Calculates professional fees based on official Nigerian fee schedules, including the Remuneration for Legal Documentation and Other Land Matters Order 2023. Output is for reference only.</p>
                                    </div>
                                )}
                                <div id="5-8" className="space-y-8">
                                    <h3 className="text-xl font-bold">5.{isVega ? '8' : '5'} AI Consent Requirement</h3>
                                    <p>5.8.1 Prior to first use of any AI Agent, you will be presented with a granular AI Processing Consent modal, which clearly discloses: (a) what data is transmitted to the AI processor (Google Gemini API); (b) the data minimization measures in place; (c) confirmation that your data is not used for AI model training; and (d) your right to decline and disable AI features.</p>
                                    <p>5.8.2 Your consent decision is recorded with a timestamp to your user profile in our database for audit trail purposes under NDPA 2023 Section 25.</p>
                                    <p>5.8.3 You may withdraw AI processing consent at any time via the AI Settings panel in your account settings. Withdrawal of consent will disable all AI Agent features for your account.</p>
                                </div>
                            </div>
                        </section>

                        <section id="section-6" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">6. AI RISK DISCLAIMERS AND PROFESSIONAL RESPONSIBILITY</h2>
                            <div className="space-y-16">
                                <div id="6-1" className="space-y-8">
                                    <h3 className="text-xl font-bold">6.1 Nature and Limitations of AI Technology</h3>
                                    <p>6.1.1 <strong>Inherent Limitations:</strong> You acknowledge that AI technology operates probabilistically and may generate "hallucinations"—fabricated information presented as fact. AI Agents may produce inaccurate, incomplete, or legally incorrect outputs.</p>
                                    <p>6.1.2 <strong>Not Legal Advice:</strong> No output from any AI Agent on the Platform constitutes {isProperty ? 'professional' : 'legal'} advice. All outputs are tools to assist qualified {isProperty ? 'professionals' : 'legal professionals'} and do not replace professional {isProperty ? '' : 'legal '}judgment.</p>
                                    <p>6.1.3 <strong>Professional Judgment:</strong> AI lacks true comprehension and contextual understanding. All outputs must be reviewed, verified, and approved by qualified professionals before reliance or use in any professional proceeding.</p>
                                </div>

                                <div id="6-2" className="space-y-8">
                                    <h3 className="text-xl font-bold">6.2 Mandatory Oversight and Verification</h3>
                                    <p>6.2.1 <strong>Absolute Requirement:</strong> You MUST exercise independent professional oversight over all AI-generated content. Before relying on any output, you must independently verify {isProperty ? 'all information and regulatory requirements' : 'all case citations, legal principles'}, calculated deadlines, and fee computations.</p>
                                    <p>6.2.2 <strong>{isVega ? 'RPC' : 'Professional'} Compliance:</strong> The use of AI tools does not diminish your professional obligations. You remain personally responsible for all work product submitted to {isVega ? 'courts, clients, and opposing parties' : 'tenants, landlords, and regulatory bodies'}.</p>
                                    {isVega && <p>6.2.3 <strong>Court Deadlines:</strong> Never rely solely on Court Rules Agent calculations for filing deadlines without independent verification. Missing a limitation period or filing deadline due to AI error does not excuse negligence under Nigerian professional liability standards.</p>}
                                </div>

                                <div id="6-3" className="space-y-8">
                                    <h3 className="text-xl font-bold">6.3 No Warranty on AI Outputs</h3>
                                    <p>THE COMPANY MAKES NO WARRANTIES, EXPRESS OR IMPLIED, REGARDING THE ACCURACY, COMPLETENESS, RELIABILITY, OR FITNESS FOR PURPOSE OF ANY AI AGENT OUTPUT. YOUR USE OF AI OUTPUTS IS ENTIRELY AT YOUR OWN PROFESSIONAL RISK.</p>
                                </div>
                            </div>
                        </section>

                        <section id="section-7" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">7. INTELLECTUAL PROPERTY RIGHTS</h2>
                            <div className="space-y-12">
                                <div id="7-1" className="space-y-8">
                                    <h3 className="text-xl font-bold">7.1 Ownership of Platform</h3>
                                    <p>7.1.1 The Platform, including all software, code, algorithms, AI models, user interface designs, trademarks, and documentation, remains the exclusive intellectual property of PracticePro Legal Technologies Limited. Nothing in this Agreement transfers any intellectual property rights to you.</p>
                                    <p>7.1.2 <strong>Restricted License:</strong> Subject to your compliance with this Agreement, we grant you a limited, non-exclusive, non-transferable, revocable license to access and use the Platform solely for your legitimate professional purposes.</p>
                                </div>
                                <div id="7-2" className="space-y-8">
                                    <h3 className="text-xl font-bold">7.2 User Data Ownership</h3>
                                    <p>7.2.1 You retain full ownership of all User Data you submit to the Platform. We do not claim any proprietary interest in your client matters, documents, or firm data.</p>
                                    <p>7.2.2 <strong>Limited License to Operate:</strong> You grant us a limited, royalty-free license to store, process, and transmit your User Data solely to the extent necessary to provide the Platform services to you, in accordance with our Privacy Policy.</p>
                                    <p>7.2.3 <strong>AI Exclusion:</strong> Your User Data is never used to train, fine-tune, or improve any AI foundation model, including the underlying Google Gemini models. Data transmitted to AI processors is subject to their applicable data processing agreements.</p>
                                </div>
                                <div id="7-3" className="space-y-8">
                                    <h3 className="text-xl font-bold">7.3 Prohibited Actions</h3>
                                    <p>You may not: (a) copy, modify, or create derivative works of the Platform; (b) reverse engineer or decompile any part of the Platform; (c) use any automated tools to scrape, extract, or harvest data from the Platform; (d) use the Platform's trademarks without prior written consent.</p>
                                </div>
                            </div>
                        </section>

                        <section id="section-8" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">8. DATA PROTECTION AND PRIVACY (NDPA 2023)</h2>
                            <div className="space-y-12">
                                <p>8.1 <strong>Applicable Law:</strong> Both parties agree to comply fully with the Nigeria Data Protection Act 2023 (NDPA), the Nigeria Data Protection Regulation 2019 (NDPR), and all subsidiary legislation issued by the Nigeria Data Protection Commission (NDPC).</p>
                                <p>8.2 <strong>Roles:</strong> With respect to your firm's client data entered into the Platform, you (the law firm) are the Data Controller, and the Company is a Data Processor acting solely on your documented instructions. With respect to your account and billing data, the Company is the Data Controller.</p>
                                <p>8.3 <strong>Technical and Organisational Measures:</strong> We implement appropriate technical and organizational security measures to protect personal data against unauthorized access, accidental loss, destruction, or disclosure. These include PBKDF2-SHA512 password hashing (100,000 iterations), firm-level data isolation, encrypted transmission (TLS), and role-based access control.</p>
                                <p>8.4 <strong>Data Subject Rights:</strong> Under the NDPA 2023, your clients (as data subjects) have rights to access, rectification, erasure, portability, and objection. As Data Controller, you are responsible for receiving and responding to data subject requests from your clients. The Platform provides tools to support your compliance with these obligations.</p>
                                <p>8.5 <strong>Data Portability:</strong> You may export a copy of your firm's data at any time using the Export Archive function in the Data Management settings. Exports are provided in structured, machine-readable JSON format.</p>
                                <p>8.6 <strong>Breach Notification:</strong> We will notify you of any confirmed personal data breach affecting your firm's data within 72 hours of becoming aware of it, as required by NDPA 2023 Section 40, to enable you to fulfill your obligations to the NDPC and affected data subjects.</p>
                                <p>8.7 <strong>Third-Party Processors:</strong> We use the following sub-processors to deliver the service: (a) Convex, Inc. (database and serverless infrastructure); (b) Google LLC (Gemini AI API for AI Agents); (c) Resend, Inc. (transactional email delivery). Each is bound by appropriate data processing agreements prohibiting use of your data for their own purposes.</p>
                                <p>8.8 <strong>Privacy Policy:</strong> Full details of our data processing practices are set out in our Privacy Policy, which is incorporated into this Agreement by reference.</p>
                            </div>
                        </section>

                        <section id="section-9" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">9. COOKIE POLICY AND CONSENT</h2>
                            <div className="space-y-12">
                                <p>9.1 <strong>What Are Cookies:</strong> Cookies are small data files stored on your device when you use the Platform. We use cookies and similar tracking technologies to enable essential functionality, improve performance, and understand usage patterns.</p>
                                <p>9.2 <strong>Cookie Categories:</strong></p>
                                <div className="space-y-4 pl-4 border-l-2 border-slate-100 dark:border-zinc-800">
                                    <p>(a) <strong>Essential Cookies:</strong> Required for core Platform functionality including session management, authentication, and security. These cannot be disabled without rendering the Platform non-functional.</p>
                                    <p>(b) <strong>Functional Cookies:</strong> Store your preferences such as display theme, language, and notification settings to enhance your experience.</p>
                                    <p>(c) <strong>Analytics Cookies:</strong> Collect anonymized data about Platform usage to help us understand how the Platform is used and where improvements can be made. These are only set with your explicit consent.</p>
                                    <p>(d) <strong>Marketing Cookies:</strong> Used to track and measure the effectiveness of our marketing communications. These are only set with your explicit consent and may be declined without affecting Platform functionality.</p>
                                </div>
                                <p>9.3 <strong>Consent Mechanism:</strong> On your first visit to the Platform, you will be presented with a cookie consent notice. You may accept all cookies, accept only essential cookies, or manage your preferences granularly. Essential cookies do not require your consent as they are strictly necessary for Platform operation.</p>
                                <p>9.4 <strong>Withdrawing Consent:</strong> You may withdraw your cookie consent or change your preferences at any time via your browser settings or the cookie preference centre in your account settings. Withdrawing consent for analytics or marketing cookies will not affect your ability to use the Platform.</p>
                                <p>9.5 <strong>Third-Party Cookies:</strong> Certain Platform features may integrate third-party services that set their own cookies. We are not responsible for third-party cookie policies.</p>
                            </div>
                        </section>

                        <section id="section-10" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">10. PASSWORD SECURITY AND ACCOUNT ACCESS</h2>
                            <div className="space-y-12">
                                <p>10.1 <strong>Password Requirements:</strong> To protect the confidentiality of sensitive legal data on the Platform, all user passwords must meet the following minimum complexity requirements: (a) at least eight (8) characters in length; (b) at least one uppercase letter; (c) at least one lowercase letter; (d) at least one numerical digit; and (e) at least one special character. These requirements are technically enforced at registration and password reset.</p>
                                <p>10.2 <strong>Password Hashing:</strong> Passwords are never stored in plaintext. All passwords are irreversibly hashed using PBKDF2-SHA512 with 100,000 iterations and a per-user salt before being stored in the database. This means that even in the event of an unauthorized database disclosure, your plaintext password cannot be recovered.</p>
                                <p>10.3 <strong>Re-Authentication for Destructive Actions:</strong> Certain high-risk actions — including permanent account deletion — require identity re-verification. You will be required to re-enter your password before such actions can proceed, regardless of your current session status. This control is in place to prevent unauthorized irreversible data loss.</p>
                                <p>10.4 <strong>Session Security:</strong> The Platform implements an automatic idle session lock after a configurable period of inactivity. Upon lock, you must re-authenticate to resume access. The default lock timeout is 15 minutes.</p>
                                <p>10.5 <strong>Your Security Obligations:</strong> You are responsible for (a) not sharing your password with any other person; (b) logging out of the Platform when using shared or public devices; (c) notifying us immediately if you suspect unauthorized access to your account at practiceprovega@gmail.com.</p>
                            </div>
                        </section>

                        <section id="section-11" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">11. DATA RETENTION AND DELETION</h2>
                            <div className="space-y-12">
                                <p>11.1 <strong>Active Account Data:</strong> We retain User Data for as long as your account is active and for the period necessary to provide the Services to you.</p>
                                <p>11.2 <strong>Soft Delete and Archive Bin:</strong> When you delete a matter, contact, document, or other item, it is moved to a 30-day archive bin rather than being permanently destroyed. This provides a recovery window in the event of accidental deletion.</p>
                                <p>11.3 <strong>Automated Purge Policy:</strong> Archive bin records are automatically and permanently purged 30 days after they are moved to the bin. This automated purge runs daily and is designed to comply with the data minimization and storage limitation principles of NDPA 2023 Section 38, informed by ISO/IEC 27701 guidelines.</p>
                                <p>11.4 <strong>Account Termination and Post-Termination Retention:</strong> Upon account termination, you will have a 60-day window to export your firm's data. After this period, we will securely delete your User Data from our systems in accordance with our data retention policy.</p>
                                <p>11.5 <strong>Right to Erasure (Right to Be Forgotten):</strong> Under NDPA 2023 Section 35, you have the right to request deletion of your personal data. Account deletion can be initiated via Settings &gt; Data Management &gt; Delete Account. If you are the sole administrator of a firm, deleting your account will also trigger deletion of the firm record and all associated data.</p>
                                <p>11.6 <strong>Exceptions:</strong> Certain data may be retained beyond the above periods where required by applicable Nigerian law, for the resolution of disputes, or for fraud prevention purposes.</p>
                            </div>
                        </section>

                        <section id="section-12" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">12. SUBSCRIPTION FEES AND PAYMENT TERMS</h2>
                            <div className="space-y-12">
                                <p>12.1 <strong>Fees:</strong> You agree to pay fees for your selected subscription tier as specified on our pricing page. Subscription fees are payable in Nigerian Naira (₦) and are exclusive of applicable taxes.</p>
                                <p>12.2 <strong>Automatic Renewal:</strong> Subscriptions automatically renew at the end of each billing period unless cancelled before the renewal date. You will be notified of forthcoming renewals.</p>
                                <p>12.3 <strong>Non-Refundable:</strong> Subscription fees are non-refundable except in circumstances where the Company has materially failed to deliver the subscribed services or as otherwise required by the Federal Competition and Consumer Protection Act 2018.</p>
                                <p>12.4 <strong>Price Changes:</strong> We will give you at least thirty (30) days' notice of any changes to subscription pricing. Continued use of the Platform after a price change takes effect constitutes your acceptance of the new price.</p>
                                <p>12.5 <strong>Downgrade and Cancellation:</strong> You may downgrade or cancel your subscription at any time via the Billing & Plans settings. Downgrade or cancellation takes effect at the end of the current billing period. You will retain access to paid features until that date.</p>
                            </div>
                        </section>

                        <section id="section-13" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">13. ACCEPTABLE USE AND PROHIBITED CONDUCT</h2>
                            <div className="space-y-12">
                                <p>13.1 <strong>Permitted Use:</strong> The Platform may only be used for lawful {isProperty ? 'property management' : 'legal practice management'} purposes consistent with the Rules of Professional Conduct and applicable Nigerian law.</p>
                                <p>13.2 <strong>Prohibited Conduct:</strong> You may not:</p>
                                <ul className="list-disc pl-8 space-y-4">
                                    <li>Use the Platform for any illegal, fraudulent, or unauthorized purpose;</li>
                                    <li>Attempt to bypass, undermine, or circumvent any security controls or access restrictions;</li>
                                    <li>Reverse-engineer, decompile, disassemble, or otherwise attempt to derive the source code of the Platform;</li>
                                    <li>Introduce malware, viruses, or any harmful code into the Platform;</li>
                                    <li>Use automated bots or scripts to access, scrape, or harvest data from the Platform;</li>
                                    <li>Share login credentials with unauthorized individuals or allow concurrent use of a single account by multiple people;</li>
                                    {isVega && <li>Use the Platform to process data for clients or matters where you have a conflict of interest without proper disclosure and consent;</li>}
                                    <li>Misrepresent your professional qualifications when using the Platform;</li>
                                    <li>Use AI Agents to generate {isVega ? 'legal advice to be provided to clients' : 'agreements or notices'} without appropriate professional review and oversight.</li>
                                </ul>
                                <p>13.3 <strong>Consequences:</strong> Violation of this section may result in immediate suspension or termination of your account and may attract civil or criminal liability under Nigerian law.</p>
                            </div>
                        </section>

                        <section id="section-14" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">14. SERVICE AVAILABILITY AND MODIFICATIONS</h2>
                            <div className="space-y-12">
                                <p>14.1 <strong>Availability Target:</strong> We strive to maintain high Platform availability. However, we do not guarantee uninterrupted access. Scheduled maintenance periods and circumstances beyond our reasonable control (including acts of God, force majeure events, third-party infrastructure failures, and cyberattacks) may cause temporary unavailability.</p>
                                <p>14.2 <strong>Planned Maintenance:</strong> We will endeavour to schedule planned maintenance during off-peak hours and to give advance notice where practicable.</p>
                                <p>14.3 <strong>Modifications:</strong> We reserve the right to modify, add, or remove Platform features at any time to improve functionality, security, or regulatory compliance. We will provide reasonable notice of significant feature removals that may affect existing workflows.</p>
                                <p>14.4 <strong>Beta Features:</strong> Features designated as "Beta" or "Preview" are provided on an as-is basis and may be unstable. Beta features may be modified or discontinued without notice.</p>
                            </div>
                        </section>

                        <section id="section-15" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">15. WARRANTIES AND DISCLAIMERS</h2>
                            <div className="space-y-12">
                                <p>15.1 <strong>"AS IS" Provision:</strong> THE PLATFORM AND ALL SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, OR ACCURACY.</p>
                                <p>15.2 <strong>AI Output Disclaimer:</strong> THE COMPANY EXPRESSLY DISCLAIMS ALL WARRANTIES IN RESPECT OF AI AGENT OUTPUTS. {isProperty ? 'AI-GENERATED DRAFTS' : 'AI-GENERATED LEGAL DRAFTS'}, DEADLINE CALCULATIONS, JURISDICTION RECOMMENDATIONS, AND FEE ASSESSMENTS ARE PROVIDED FOR INFORMATIONAL ASSISTANCE ONLY AND DO NOT CONSTITUTE {isProperty ? 'PROFESSIONAL' : 'LEGAL'} ADVICE.</p>
                                <p>15.3 <strong>Professional Reliance:</strong> The Platform is a tool to assist {isProperty ? 'property management' : 'legal practice'}. It is not a substitute for professional {isProperty ? '' : 'legal '}training, experience, or judgment. The Company makes no representation that use of the Platform will lead to favourable legal outcomes.</p>
                            </div>
                        </section>

                        <section id="section-16" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">16. LIMITATION OF LIABILITY</h2>
                            <div className="space-y-12">
                                <p>16.1 <strong>Liability Cap:</strong> To the maximum extent permitted by applicable Nigerian law, our total aggregate liability to you for all claims arising out of or related to this Agreement — whether in contract, tort, breach of statutory duty, or otherwise — shall not exceed the total subscription fees paid by you in the twelve (12) months immediately preceding the event giving rise to the claim.</p>
                                <p>16.2 <strong>Excluded Losses:</strong> In no event shall the Company be liable for: (a) loss of profits, revenue, or business; (b) loss of or corruption of data; (c) loss of goodwill or reputation; (d) indirect, consequential, incidental, punitive, or special damages of any kind, whether or not the Company has been advised of the possibility of such damages.</p>
                                <p>16.3 <strong>AI-Specific Exclusion:</strong> The Company shall not be liable for any professional negligence claim, disciplinary action, court order, adverse judgment, or other loss arising from a legal practitioner's reliance on AI Agent outputs without independent verification and professional review.</p>
                                <p>16.4 <strong>Consumer Rights:</strong> Nothing in this Agreement shall exclude or limit any rights you may have under the Federal Competition and Consumer Protection Act 2018 or other mandatory provisions of Nigerian consumer protection law that cannot lawfully be excluded.</p>
                            </div>
                        </section>

                        <section id="section-17" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">17. INDEMNIFICATION</h2>
                            <div className="space-y-12">
                                <p>17.1 <strong>Your Indemnity:</strong> You agree to indemnify, defend, and hold harmless the Company and its officers, directors, employees, and agents from and against any and all claims, damages, losses, liabilities, costs, and expenses (including reasonable legal fees) arising out of or related to:</p>
                                <ul className="list-disc pl-8 space-y-4">
                                    <li>Your breach of any provision of this Agreement;</li>
                                    <li>Your use or misuse of the Platform;</li>
                                    <li>Your reliance on AI Agent outputs without appropriate professional oversight;</li>
                                    <li>Your violation of any applicable law, regulation, or professional conduct rule;</li>
                                    <li>Any claim by a third party arising from your use of the Platform in connection with their matter or data.</li>
                                </ul>
                            </div>
                        </section>

                        <section id="section-18" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">18. TERM AND TERMINATION</h2>
                            <div className="space-y-12">
                                <p>18.1 <strong>Term:</strong> This Agreement commences on the date you create an account and continues until terminated in accordance with this Section.</p>
                                <p>18.2 <strong>Termination by You:</strong> You may terminate this Agreement at any time by deleting your account via Settings &gt; Data Management &gt; Delete Account. Termination takes effect immediately upon account deletion.</p>
                                <p>18.3 <strong>Termination by the Company:</strong> We may terminate or suspend your access immediately and without prior notice where: (a) you materially breach this Agreement; (b) you fail to pay applicable subscription fees after a 14-day grace period; (c) we are required to do so by law; or (d) your conduct poses a security or reputational risk to the Platform or other users.</p>
                                <p>18.4 <strong>Effect of Termination:</strong> Upon termination, your right to access the Platform ceases immediately. Data export and deletion procedures as described in Section 11 apply. Sections 7, 8, 15, 16, 17, 19, and 20 shall survive termination of this Agreement.</p>
                            </div>
                        </section>

                        <section id="section-19" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">19. DISPUTE RESOLUTION</h2>
                            <div className="space-y-12">
                                <p>19.1 <strong>Good Faith Negotiation:</strong> In the event of any dispute, claim, or controversy arising out of or relating to this Agreement, the parties shall first attempt to resolve the matter through good faith negotiation. A party wishing to invoke this process must provide written notice to the other specifying the nature of the dispute in reasonable detail. The parties shall negotiate for a period of not less than thirty (30) days.</p>
                                <p>19.2 <strong>Mediation:</strong> If the dispute is not resolved through negotiation within thirty (30) days, either party may refer the matter to mediation under the Rules of the Lagos Multi-Door Courthouse (LMDC) or such other mutually agreed mediation institution. The costs of mediation shall be shared equally.</p>
                                <p>19.3 <strong>Arbitration:</strong> If mediation fails to produce a settlement within sixty (60) days of the appointment of a mediator, the dispute shall be referred to and finally resolved by arbitration in Lagos, Nigeria, under the Arbitration and Mediation Act 2023. The arbitral tribunal shall consist of a sole arbitrator agreed upon by the parties, or failing agreement, appointed in accordance with the Act.</p>
                                <p>19.4 <strong>No Class Actions:</strong> All disputes shall be resolved on an individual basis. You waive any right to participate in a class action or representative proceeding.</p>
                            </div>
                        </section>

                        <section id="section-20" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">20. GOVERNING LAW AND JURISDICTION</h2>
                            <div className="space-y-12">
                                <p>20.1 <strong>Governing Law:</strong> This Agreement and all matters arising out of or in connection with it shall be governed by and construed in accordance with the laws of the Federal Republic of Nigeria.</p>
                                <p>20.2 <strong>Jurisdiction:</strong> Without prejudice to the dispute resolution procedures in Section 19, each party submits to the exclusive jurisdiction of the courts of Lagos State for the purpose of enforcing any arbitral award or seeking urgent injunctive relief.</p>
                                <p>20.3 <strong>NBA Compliance:</strong> Nothing in this Agreement shall be construed as overriding or superseding the Rules of Professional Conduct for Legal Practitioners 2023 or any directive issued by the Nigerian Bar Association.</p>
                            </div>
                        </section>

                        <section id="section-21" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">21. GENERAL PROVISIONS</h2>
                            <div className="space-y-12">
                                <p>21.1 <strong>Entire Agreement:</strong> These Terms, together with the Privacy Policy and Cookie Policy, constitute the entire agreement between you and the Company and supersede all prior negotiations, representations, or agreements relating to the Platform.</p>
                                <p>21.2 <strong>Severability:</strong> If any provision of this Agreement is found to be unenforceable by a court of competent jurisdiction, the remaining provisions shall continue in full force and effect. The unenforceable provision shall be modified to the minimum extent necessary to make it enforceable.</p>
                                <p>21.3 <strong>No Waiver:</strong> Failure or delay by either party to exercise any right or remedy under this Agreement shall not constitute a waiver of that right or remedy.</p>
                                <p>21.4 <strong>Assignment:</strong> You may not assign or transfer any rights or obligations under this Agreement without the prior written consent of the Company. The Company may assign this Agreement in connection with a merger, acquisition, or sale of all or substantially all of its assets.</p>
                                <p>21.5 <strong>Force Majeure:</strong> The Company shall not be liable for any delay or failure in performance resulting from causes beyond its reasonable control, including acts of God, government actions, internet service disruptions, cyberattacks, or other force majeure events.</p>
                                <p>21.6 <strong>Language:</strong> This Agreement is drawn up in the English language. In the event of any conflict between this English version and any translation, the English version shall prevail.</p>
                            </div>
                        </section>

                        <section id="section-22" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">22. CONTACT INFORMATION</h2>
                            <div className="space-y-12">
                                <p>For any questions, complaints, or notices relating to this Agreement, please contact us at:</p>
                                <div className="pl-4 border-l-2 border-slate-100 dark:border-zinc-800 space-y-3">
                                    <p><strong>Company:</strong> PracticePro Legal Technologies Limited</p>
                                    <p><strong>Address:</strong> No. 6 Sulaiman Adekanbi Street, Igbo-Efon, Lekki-Epe Expressway, Lagos State, Nigeria</p>
                                    <p><strong>General Enquiries:</strong> <a href="mailto:practiceprovega@gmail.com">practiceprovega@gmail.com</a></p>
                                    <p><strong>Data Protection / Privacy:</strong> <a href="mailto:practiceproindex@gmail.com">practiceproindex@gmail.com</a></p>
                                </div>
                                <p>We aim to respond to all formal notices and complaints within five (5) business days.</p>
                            </div>
                        </section>

                        <section id="section-23" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">23. PORTAL TERMS OF USE</h2>
                            <div className="space-y-12">
                                <p>23.1 <strong>Incorporation by Reference:</strong> The PracticePro Portal Terms of Use ("Portal Terms") are incorporated into and form an integral part of this Agreement. The Portal Terms apply to all users who access the PracticePro Client Portal or Residents' Portal (collectively, the "Portal"). A copy of the Portal Terms is available upon request and is presented to each User during the Portal account setup process.</p>
                                <p>23.2 <strong>Binding Effect:</strong> By accepting an invitation to the Portal, creating a Portal account, or accessing the Portal in any capacity, you agree to be bound by the Portal Terms in addition to these Terms and Conditions of Service. In the event of a conflict between these Terms and the Portal Terms, the Portal Terms shall prevail with respect to Portal-specific matters.</p>
                                <p>23.3 <strong>Scope of Portal Terms:</strong> The Portal Terms govern, among other things:</p>
                                <ul>
                                    <li>The purpose and scope of Portal access;</li>
                                    <li>User responsibilities, including the obligation to provide accurate information and refrain from misuse;</li>
                                    <li>Privacy and data protection obligations in accordance with the NDPA 2023;</li>
                                    <li>Communication through the Portal, including the acknowledgment that messages are logged and not private;</li>
                                    <li>Payment submissions and proof of payment requirements;</li>
                                    <li>Maintenance requests and service charge information (for Residents' Portal users);</li>
                                    <li>Intellectual property restrictions;</li>
                                    <li>Limitation of liability specific to Portal use;</li>
                                    <li>Termination of Portal access; and</li>
                                    <li>Governing law and dispute resolution.</li>
                                </ul>
                                <p>23.4 <strong>Amendment of Portal Terms:</strong> PracticePro reserves the right to amend the Portal Terms at any time in accordance with Section 14 of this Agreement. Continued use of the Portal after any such amendment constitutes your acceptance of the revised Portal Terms.</p>
                                <p>23.5 <strong>Portal Access as a Privilege:</strong> Access to the Portal is granted at the discretion of the User's {isVega ? 'legal service provider' : 'property manager'} and PracticePro. Portal access may be suspended or terminated in accordance with the Portal Terms and Section 18 of this Agreement.</p>
                            </div>
                        </section>

                    </div>

                    {/* Footer */}
                    <div className="h-32 pt-20 border-t border-slate-100 dark:border-zinc-800 mt-20 text-center">
                        <p className="text-2xs text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-widest">
                            PracticePro {isVega ? 'VEGA • Professional Operations System' : 'ATRIUM • Property OS'} • Version 2.0 • April 2026
                        </p>
                    </div>
                    <div className="h-20 sm:h-0" />
                </div>
            </div>
        </div>
    );
};

export default TermsOfService;
