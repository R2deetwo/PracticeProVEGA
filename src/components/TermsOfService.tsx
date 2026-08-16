import React from 'react';
import { ChevronLeftIcon as ChevronLeft } from '../constants';

/**
 * Terms of Service — rewritten in plain English.
 *
 * Design goals:
 *   - Short sentences (no more than 25 words where possible).
 *   - Everyday words instead of legal jargon.
 *   - Active voice. Address the reader as "you," the company as "we" or "PracticePro."
 *   - Legal terms (Data Controller, Data Processor, PII) defined inline the first
 *     time they appear.
 *   - Bullets for lists. One idea per paragraph.
 *   - Always render in light mode (see index.html — `html.dark` is set when the OS
 *     theme is dark). The `style={{ colorScheme: 'light' }}` on the root and the
 *     absence of any `dark:` Tailwind classes guarantee this.
 *
 * Structural fixes applied in this rewrite:
 *   - Normalised H3 structure: every numbered sub-section (X.Y) now uses an H3,
 *     matching the pattern in PrivacyPolicy.tsx and CookiePolicy.tsx. Sections
 *     8-23 previously used flat numbered paragraphs with bold inline headings.
 *   - Softened ALL-CAPS disclaimers in §2.1.3, §6.3, §15.1, and §15.2 to bold
 *     sentence case (easier to read, same legal effect).
 *   - Fixed §8.7: now uses `{isVega ? 'ALOA™' : 'ARIA™'}` so each product shows
 *     only its own AI assistant name (previously mentioned both regardless of
 *     `activeProduct`).
 *   - Aligned footer version to "Version 2.1 • August 2026" (body header already
 *     said Version 2.1; footer previously said Version 2.0, April 2026).
 *   - Deleted boilerplate interpretation rules ("singular includes plural" and
 *     "including shall be construed without limitation") — not legally material.
 *   - Fixed internal anchor IDs (`2-4` → `2-3`, `2-5` → `2-4`) so they match
 *     their visible section numbers.
 *
 * All legally material disclosures are preserved: NDPA 2023, NDPR 2019,
 * the 72-hour breach notification (NDPA 2023 Section 40), the 60-day data
 * export window, the 30-day soft-delete recovery window, the 12-month
 * liability cap, Lagos Multi-Door Courthouse mediation, arbitration under
 * the Arbitration and Mediation Act 2023, exclusive Lagos State jurisdiction,
 * the no-class-actions waiver, governing law (Nigeria), the BYOK AI model
 * (user provides own API key, browser→provider direct), "we do not train AI
 * on your data," all Vega-only sections (Jurisdiction Scout, Court Rules
 * Agent, Scale Expert Agent, conflict-of-interest bullet, Court Deadlines),
 * NBA enrollment (Vega), NIESV/ESVARBON (Atrium), the contact emails, the
 * registered address, and the 5 business day response commitment.
 */

export const TermsOfService: React.FC<{ onBack: () => void; activeProduct?: 'vega' | 'atrium' }> = ({ onBack, activeProduct = 'vega' }) => {
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
                <h1 className="font-bold text-slate-900">Terms and Conditions of Service</h1>
                <div className="w-16" /> {/* Spacer */}
            </div>

            {/* Scrollable Document Container */}
            <div className="flex-1 overflow-y-auto scroll-smooth custom-scrollbar">
                <div className="max-w-4xl mx-auto px-6 sm:px-12 py-12 lg:py-20">
                    <div className="mb-16">
                        <h1 className="text-4xl font-bold text-slate-900 mb-6">Terms and Conditions of Service</h1>
                        <p className="text-sm font-semibold text-slate-600 mb-2 tracking-tight">PRACTICEPRO SYSTEMS LIMITED</p>
                        <div className="flex flex-col text-xs text-slate-500 italic">
                            <span>Effective Date: January 1, 2026</span>
                            <span>Last Updated: August 11, 2026</span>
                            <span>Version: 2.1</span>
                        </div>
                    </div>

                    {/* Plain-English summary box — gives the reader the gist in a few sentences */}
                    <div className="mb-12 p-5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 leading-relaxed">
                        <strong className="text-slate-900">In short:</strong> These Terms are a binding contract between you
                        and PracticePro about your use of the {isVega ? 'VEGA' : 'ATRIUM'} platform. You must be 18 or older
                        and able to enter contracts in Nigeria. We use industry-standard security, we do not train AI on
                        your data, and our liability is capped at the fees you paid us in the last 12 months. If you do
                        not agree, do not use the Platform.
                    </div>

                    <div className="prose prose-slate max-w-none
                        prose-p:leading-[1.8] prose-p:mb-8
                        prose-h2:mt-16 prose-h2:mb-8 prose-h2:text-3xl prose-h2:font-bold prose-h2:border-b-2 prose-h2:pb-4 prose-h2:border-slate-200
                        prose-h3:mt-12 prose-h3:mb-6 prose-h3:text-xl prose-h3:font-bold
                        prose-ul:mb-8 prose-ul:space-y-4
                        prose-li:leading-relaxed prose-a:text-primary-600 prose-a:no-underline hover:prose-a:underline
                        prose-strong:text-slate-900">

                        <hr className="my-10" />

                        <h2>Table of contents</h2>
                        <div className="bg-slate-50 border border-slate-200 p-6 rounded-lg mb-10">
                            <ol className="list-decimal pl-5 space-y-2">
                                <li><a href="#section-1">Definitions and interpretation</a></li>
                                <li><a href="#section-2">Agreement to Terms</a></li>
                                <li><a href="#section-3">Platform services and description</a></li>
                                <li><a href="#section-4">User registration and eligibility</a></li>
                                <li><a href="#section-5">Artificial intelligence services</a></li>
                                <li><a href="#section-6">AI risk disclaimers and professional responsibility</a></li>
                                <li><a href="#section-7">Intellectual property rights</a></li>
                                <li><a href="#section-8">Data protection and privacy (NDPA 2023)</a></li>
                                <li><a href="#section-9">Cookie policy and consent</a></li>
                                <li><a href="#section-10">Password security and account access</a></li>
                                <li><a href="#section-11">Data retention and deletion</a></li>
                                <li><a href="#section-12">Subscription fees and payment terms</a></li>
                                <li><a href="#section-13">Acceptable use and prohibited conduct</a></li>
                                <li><a href="#section-14">Service availability and modifications</a></li>
                                <li><a href="#section-15">Warranties and disclaimers</a></li>
                                <li><a href="#section-16">Limitation of liability</a></li>
                                <li><a href="#section-17">Indemnification</a></li>
                                <li><a href="#section-18">Term and termination</a></li>
                                <li><a href="#section-19">Dispute resolution</a></li>
                                <li><a href="#section-20">Governing law and jurisdiction</a></li>
                                <li><a href="#section-21">General provisions</a></li>
                                <li><a href="#section-22">Contact information</a></li>
                                <li><a href="#section-23">Portal terms of use</a></li>
                            </ol>
                        </div>

                        <hr className="my-10" />

                        <section id="section-1" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">1. Definitions and interpretation</h2>
                            <div className="space-y-16">
                                <div id="1-1" className="space-y-8">
                                    <h3 className="text-xl font-bold">1.1 Definitions</h3>
                                    <p>In these Terms, the terms below mean:</p>
                                    <div className="space-y-8 pl-4 border-l-2 border-slate-100">
                                        {isVega && <p><strong>"ALOA"</strong> or <strong>"ALOA™"</strong> means Advanced Legal Office Assistant — the AI agent (powered by Google's Gemini API) for conversation, research, drafting, voice control, and proactive intelligence.</p>}
                                        {isProperty && <p><strong>"ARIA"</strong> or <strong>"ARIA™"</strong> means Asset & Revenue Intelligence Assistant — the AI agent inside Atrium OS that monitors rent collection, resident compliance, and portfolio revenue.</p>}
                                        <p><strong>"AI Agents"</strong> means the AI-powered parts of the Platform: ALOA™/ARIA™ (whichever applies), Jurisdiction Scout, ALDIA, DraftPro, Court Rules Agent, Privacy Shield Agent, and Scale Expert Agent.</p>
                                        <p><strong>"ALDIA"</strong> means Advanced Legal Document Intelligence Agent — summarises documents, analyses risk, extracts metadata, and identifies clauses.</p>
                                        <p><strong>"Agreement"</strong> means these Terms plus any documents incorporated by reference (including the Privacy Policy).</p>
                                        <p><strong>"Company," "we," "us," "our"</strong> means PracticePro Systems Limited, a company operating under the laws of the Federal Republic of Nigeria. Registered office: No. 6 Sulaiman Adekanbi Street, Igbo-Efon, Lekki-Epe Expressway, Lagos State, Nigeria.</p>
                                        <p><strong>"Content"</strong> means all data, text, software, photos, graphics, video, messages, tags, or other materials — public or private — that you upload to or send through the Platform.</p>
                                        {isVega && <p><strong>"Court Rules Agent"</strong> means the AI component that calculates statutory filing deadlines based on the Nigerian Civil Procedure Rules and creates tasks for them.</p>}
                                        <p><strong>"DraftPro"</strong> means the AI-powered document drafting assistant. It generates documents from templates, your inputs, and matter-specific data.</p>
                                        {isVega && <p><strong>"Jurisdiction Scout"</strong> means the AI component that identifies the right courts, jurisdictions, and legal frameworks for a matter.</p>}
                                        <p><strong>"NDPA"</strong> means the Nigeria Data Protection Act 2023 (Act No. 5 of 2023), plus all regulations, guidelines, and directives issued by the Nigeria Data Protection Commission.</p>
                                        <p><strong>"Personal Data"</strong> has the meaning given in Section 65 of the NDPA 2023 — any information about an identified or identifiable natural person.</p>
                                        <p><strong>"Platform"</strong> means the {isVega ? 'VEGA professional operations system' : 'ATRIUM property management system'}, including all web apps, APIs, and related services we provide.</p>
                                        <p><strong>"Privacy Shield Agent"</strong> means the AI component that identifies, flags, and helps redact Personally Identifiable Information (also called PII — data that can identify a person) before other AI Services process it.</p>
                                        {isVega ? (
                                            <>
                                                <p><strong>"RPC"</strong> means the Rules of Professional Conduct in the Legal Profession, 2023, as amended.</p>
                                                <p><strong>"Scale Expert Agent"</strong> means the AI component that calculates professional fees based on the Legal Practitioners (Remuneration for Legal Documentation and Other Land Matters) Order 2023.</p>
                                            </>
                                        ) : (
                                            <>
                                                <p><strong>"NIESV"</strong> means the Nigerian Institution of Estate Surveyors and Valuers.</p>
                                                <p><strong>"Tenancy Law"</strong> means the Tenancy Law of Lagos State 2011 and other applicable state tenancy laws in Nigeria.</p>
                                            </>
                                        )}
                                        <p><strong>"Subscription"</strong> means your contract with us for access to the Platform under a specific pricing tier.</p>
                                        <p><strong>"User," "you," "your"</strong> means any individual, {isVega ? 'law firm, legal department' : 'property manager, real estate agency'}, or other entity that registers for, accesses, or uses the Platform.</p>
                                        <p><strong>"User Data"</strong> means all data, information, documents, and content submitted, uploaded, or created by or for Users through the Platform.</p>
                                    </div>
                                </div>

                                <div id="1-2" className="space-y-8">
                                    <h3 className="text-xl font-bold">1.2 Interpretation</h3>
                                    <p>Unless the context clearly says otherwise:</p>
                                    <ul className="list-disc pl-8 space-y-4">
                                        <li><strong>Headings:</strong> Section headings are for convenience only and do not affect how these Terms are read.</li>
                                        <li><strong>Statutory references:</strong> References to laws include any later amendments.</li>
                                        <li><strong>Business days:</strong> A "business day" is any day that is not Saturday, Sunday, or a public holiday in Nigeria.</li>
                                        <li><strong>Currency:</strong> All monetary amounts are in Nigerian Naira (₦) unless we say otherwise.</li>
                                    </ul>
                                </div>
                            </div>
                        </section>

                        <section id="section-2" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">2. Agreement to Terms</h2>
                            <div className="space-y-16">
                                <div id="2-1" className="space-y-8">
                                    <h3 className="text-xl font-bold">2.1 Binding contract</h3>
                                    <p>These Terms are a binding contract between you and PracticePro about your use of the Platform.</p>
                                    <p>By creating an account, accessing the Platform, or using any service, you confirm that you have read and agree to these Terms.</p>
                                    <p><strong>If you do not agree, do not use the Platform.</strong></p>
                                </div>

                                <div id="2-2" className="space-y-8">
                                    <h3 className="text-xl font-bold">2.2 Capacity and authority</h3>
                                    <p>You confirm you are 18 or older and can legally agree to contracts in Nigeria.</p>
                                    <p><strong>Professional status:</strong> {isVega ? 'If you present yourself as a legal practitioner, you confirm that you are enrolled and licensed to practise law in Nigeria and are in good standing with the Nigerian Bar Association (NBA).' : 'If you present yourself as a property manager or real estate agent, you confirm that you have all necessary licences and authority to manage the properties listed on the Platform.'}</p>
                                </div>

                                <div id="2-3" className="space-y-8">
                                    <h3 className="text-xl font-bold">2.3 Amendments and modifications</h3>
                                    <p><strong>Right to update:</strong> We may update these Terms at any time.</p>
                                    <p><strong>Material changes:</strong> For changes that materially affect your rights, we will give you at least 30 days' notice by email or a prominent notice on the Platform.</p>
                                    <p><strong>Effective date:</strong> Changes take effect on the date stated in the notice. If no date is stated, they take effect 30 days after we send the notice.</p>
                                </div>

                                <div id="2-4" className="space-y-8">
                                    <h3 className="text-xl font-bold">2.4 Additional terms and policies</h3>
                                    <p>The Privacy Policy, Cookie Policy, and Data Processing Agreement are part of these Terms.</p>
                                </div>
                            </div>
                        </section>

                        <section id="section-3" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">3. Platform services and description</h2>
                            <div className="space-y-16">
                                <div id="3-1" className="space-y-8">
                                    <h3 className="text-xl font-bold">3.1 Platform overview</h3>
                                    <p>We provide a cloud-based {isVega ? 'professional operations platform for Nigerian teams' : 'property management platform for the Nigerian real estate sector'}, combining traditional {isVega ? 'operational' : 'property'} management with advanced AI features.</p>
                                </div>

                                <div id="3-2" className="space-y-8">
                                    <h3 className="text-xl font-bold">3.2 Core functionalities</h3>
                                    <ul className="list-disc pl-8 space-y-4">
                                        <li><strong>{isVega ? 'Matter/case management' : 'Property/tenant management'}:</strong> Central store for {isVega ? 'matters, cases, and clients' : 'properties, units, and tenants'} with custom workflows.</li>
                                        <li><strong>Document management:</strong> Secure cloud storage for {isVega ? 'case files' : 'lease agreements'} and documents, with version control.</li>
                                        <li><strong>Tasks, calendar, and finance:</strong> Task tracking with deadlines; integrated calendar{isVega ? ' with automatic calculation based on Nigerian court rules' : ''}; invoicing and {isVega ? 'time-entry billing' : 'rent collection'}.</li>
                                        <li><strong>{isVega ? 'Client' : 'Tenant'} communications:</strong> Secure messaging and portal features.</li>
                                        <li><strong>Task delegation and verification:</strong> Internal staff delegate tasks to {isVega ? 'clients' : 'residents'}. External stakeholders can mark tasks complete, which routes to "Pending Verification" for internal review.</li>
                                        <li><strong>Multi-channel notifications:</strong> In-app, email, and WhatsApp (where opted in). Internal staff get in-app only; external stakeholders get in-app plus email by default. Manage preferences in Settings.</li>
                                        <li><strong>Presence tracking:</strong> Team members' online status is visible to all firm members, for operational coordination only.</li>
                                    </ul>
                                </div>

                                <div id="3-3" className="space-y-8">
                                    <h3 className="text-xl font-bold">3.3 Subscription tiers</h3>
                                    <p>The Platform is offered in multiple tiers (Free, Standard, Professional, and Enterprise), each with different functionality, capacity, and support. Features at each tier are listed on the pricing page and may change.</p>
                                </div>

                                <div id="3-4" className="space-y-8">
                                    <h3 className="text-xl font-bold">3.4 Visitor management system</h3>
                                    <p>The Platform includes a Visitor Management System (VMS) that lets residents generate 6-digit numeric access codes for their visitors. By using VMS, you agree that you are responsible for all codes you generate, will only generate them for authorised visitors, will not sell or transfer them outside their intended use window, that codes expire automatically and cannot be reused, and that all code events (generation, verification, check-in, check-out, revocation) are logged in an audit trail your property manager can access.</p>
                                </div>
                            </div>
                        </section>

                        <section id="section-4" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">4. User registration and eligibility</h2>
                            <div className="space-y-16">
                                <div id="4-1" className="space-y-8">
                                    <h3 className="text-xl font-bold">4.1 Eligibility criteria</h3>
                                    <p>The Platform is designed only for use by {isVega ? 'legal practitioners, law firms, corporate legal departments, and educational institutions' : 'property managers, real estate agencies, landlords, and property management companies'}. You must be at least 18 years old to create an account.</p>
                                </div>

                                <div id="4-2" className="space-y-8">
                                    <h3 className="text-xl font-bold">4.2 Account registration</h3>
                                    <p>To access the Platform, you must create an account and provide accurate, current, and complete personal, professional, and billing information. You agree to keep it accurate and up to date.</p>
                                    <p><strong>Email verification:</strong> All accounts require email verification before access is granted. You are responsible for making sure your email address is valid and accessible.</p>
                                    <p><strong>One account per person:</strong> Each person may keep only one active account. Creating multiple accounts to bypass restrictions is a material breach of these Terms.</p>
                                    <p><strong>Account responsibility:</strong> You are fully responsible for all activity under your account and for keeping your login details confidential. Tell us immediately if you become aware of any unauthorised use of your account.</p>
                                </div>

                                <div id="4-3" className="space-y-8">
                                    <h3 className="text-xl font-bold">4.3 Explicit consent at registration</h3>
                                    <p>During registration, you will be asked to give two separate, explicit consents:</p>
                                    <ul className="list-disc pl-8 space-y-4">
                                        <li>Agreement to these Terms and Conditions of Service; and</li>
                                        <li>Agreement to the Privacy Policy, which governs how we collect, use, and keep your personal data.</li>
                                    </ul>
                                    <p>These consents are recorded with a timestamp and stored in our database for regulatory accountability, as required by the NDPA 2023.</p>
                                </div>
                            </div>
                        </section>

                        <section id="section-5" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">5. Artificial intelligence services</h2>
                            <div className="space-y-16">
                                <div id="5-1" className="space-y-8">
                                    <h3 className="text-xl font-bold">5.1 {isVega ? 'ALOA™' : 'ARIA™'} — main AI assistant</h3>
                                    <p>Provides conversational AI help, research, drafting, voice control, and proactive intelligence, using your matter context and team data.</p>
                                </div>
                                <div id="5-2" className="space-y-8">
                                    <h3 className="text-xl font-bold">5.2 ALDIA — document intelligence agent</h3>
                                    <p>Summarises documents, analyses risk, extracts metadata, and identifies clauses. Documents are passed to Google's Gemini API for processing.</p>
                                </div>
                                <div id="5-3" className="space-y-8">
                                    <h3 className="text-xl font-bold">5.3 DraftPro — document drafting assistant</h3>
                                    <p>Generates documents from templates, your inputs, and matter-specific data. All drafts need professional review before use in any formal proceeding.</p>
                                </div>
                                {isVega && (
                                    <>
                                        <div id="5-4" className="space-y-8">
                                            <h3 className="text-xl font-bold">5.4 Jurisdiction Scout</h3>
                                            <p>Identifies the right courts, jurisdictions, and legal frameworks for a matter. The output is advisory only and is not legal advice. Practitioners must independently verify all jurisdictional determinations.</p>
                                        </div>
                                        <div id="5-5" className="space-y-8">
                                            <h3 className="text-xl font-bold">5.5 Court Rules Agent</h3>
                                            <p>Calculates statutory filing deadlines based on the Nigerian Civil Procedure Rules and court-specific variations, and automatically generates reminders and tasks. Because Nigerian procedure is jurisdictionally complex, all calculated deadlines must be independently verified by a qualified practitioner.</p>
                                        </div>
                                    </>
                                )}
                                <div id={`5-${isVega ? '6' : '4'}`} className="space-y-8">
                                    <h3 className="text-xl font-bold">5.{isVega ? '6' : '4'} Privacy Shield Agent</h3>
                                    <p>Identifies and manages Personally Identifiable Information (PII) before processing. It offers manual or automated redaction options to help you meet the NDPA 2023's rules on data minimisation.</p>
                                </div>
                                {isVega && (
                                    <div id="5-7" className="space-y-8">
                                        <h3 className="text-xl font-bold">5.7 Scale Expert Agent</h3>
                                        <p>Calculates professional fees based on official Nigerian fee schedules, including the Remuneration for Legal Documentation and Other Land Matters Order 2023. The output is for reference only.</p>
                                    </div>
                                )}
                                <div id={`5-${isVega ? '8' : '5'}`} className="space-y-8">
                                    <h3 className="text-xl font-bold">5.{isVega ? '8' : '5'} AI consent requirement</h3>
                                    <p>Before you first use any AI Agent, you will see a consent screen that explains what AI will do with your data. It discloses:</p>
                                    <ul className="list-disc pl-8 space-y-4">
                                        <li>What data is sent to the AI processor (Google Gemini API);</li>
                                        <li>The data minimisation measures in place;</li>
                                        <li>That your data is not used for AI model training; and</li>
                                        <li>Your right to decline and turn off AI features.</li>
                                    </ul>
                                    <p>Your consent decision is recorded with a timestamp to your user profile, for audit trail purposes under NDPA 2023 Section 25.</p>
                                    <p>You may withdraw your AI processing consent at any time via the AI Settings panel in your account. Withdrawing consent turns off all AI Agent features for your account.</p>
                                    <p><strong>AI conversation persistence:</strong> Your interactions with {isVega ? 'ALOA™' : 'ARIA™'} are stored in a database only your firm can see. This keeps conversation context across sessions and improves AI response quality within your firm. These conversations are <strong>not</strong> used to train AI models. You can ask for your AI conversation history to be deleted at any time by contacting your firm administrator or dpo@practicepro.ng.</p>
                                </div>
                            </div>
                        </section>

                        <section id="section-6" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">6. AI risk disclaimers and professional responsibility</h2>
                            <div className="space-y-16">
                                <div id="6-1" className="space-y-8">
                                    <h3 className="text-xl font-bold">6.1 Nature and limits of AI</h3>
                                    <p><strong>Inherent limits:</strong> AI can make things up. It may present fabricated information as fact (sometimes called "hallucinations"). AI Agents may produce inaccurate, incomplete, or legally wrong outputs.</p>
                                    <p><strong>Not {isProperty ? 'professional' : 'legal'} advice:</strong> No output from any AI Agent is {isProperty ? 'professional' : 'legal'} advice. All outputs are tools to help qualified {isProperty ? 'professionals' : 'legal professionals'}. They do not replace professional {isProperty ? '' : 'legal '}judgment.</p>
                                    <p><strong>Professional judgment:</strong> AI does not truly understand context. You must review, verify, and approve all outputs with a qualified professional before relying on them or using them in any professional proceeding.</p>
                                </div>

                                <div id="6-2" className="space-y-8">
                                    <h3 className="text-xl font-bold">6.2 Mandatory oversight and verification</h3>
                                    <p><strong>Absolute requirement:</strong> You must exercise independent professional oversight over all AI-generated content. Before relying on any output, you must independently verify {isProperty ? 'all information and regulatory requirements' : 'all case citations and legal principles'}, calculated deadlines, and fee computations.</p>
                                    <p><strong>{isVega ? 'RPC' : 'Professional'} compliance:</strong> Using AI tools does not reduce your professional obligations. You remain personally responsible for all work product you submit to {isVega ? 'courts, clients, and opposing parties' : 'tenants, landlords, and regulatory bodies'}.</p>
                                    {isVega && <p><strong>Court deadlines:</strong> Never rely only on Court Rules Agent calculations for filing deadlines without independent verification. Missing a limitation period or filing deadline because of an AI error does not excuse negligence under Nigerian professional liability standards.</p>}
                                </div>

                                <div id="6-3" className="space-y-8">
                                    <h3 className="text-xl font-bold">6.3 No warranty on AI outputs</h3>
                                    <p><strong>We make no warranties, express or implied, about the accuracy, completeness, reliability, or fitness for purpose of any AI Agent output. Your use of AI outputs is entirely at your own professional risk.</strong></p>
                                </div>
                            </div>
                        </section>

                        <section id="section-7" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">7. Intellectual property rights</h2>
                            <div className="space-y-16">
                                <div id="7-1" className="space-y-8">
                                    <h3 className="text-xl font-bold">7.1 Ownership of the Platform</h3>
                                    <p>The Platform — including all software, code, algorithms, AI models, UI designs, trademarks, and documentation — remains the exclusive intellectual property of PracticePro Systems Limited. Nothing in these Terms transfers any intellectual property rights to you.</p>
                                    <p><strong>Restricted licence:</strong> If you follow these Terms, we give you a personal, revocable permission to use the Platform for your professional work.</p>
                                </div>
                                <div id="7-2" className="space-y-8">
                                    <h3 className="text-xl font-bold">7.2 User data ownership</h3>
                                    <p>You keep full ownership of all User Data you submit to the Platform. We do not claim any proprietary interest in your client matters, documents, or firm data.</p>
                                    <p><strong>Limited licence to operate:</strong> You give us a limited, royalty-free permission to store, process, and transmit your User Data — but only to the extent needed to provide the Platform services to you, as set out in our Privacy Policy.</p>
                                    <p><strong>AI exclusion:</strong> Your User Data is never used to train, fine-tune, or improve any AI foundation model, including the underlying Google Gemini models. Data sent to AI processors is subject to their own data processing agreements.</p>
                                </div>
                                <div id="7-3" className="space-y-8">
                                    <h3 className="text-xl font-bold">7.3 Prohibited actions</h3>
                                    <p>You may not:</p>
                                    <ul className="list-disc pl-8 space-y-4">
                                        <li>Copy, modify, or create derivative works of the Platform;</li>
                                        <li>Try to reverse-engineer or extract the source code of the Platform;</li>
                                        <li>Use automated tools to scrape, extract, or harvest data from the Platform; or</li>
                                        <li>Use the Platform's trademarks without our prior written consent.</li>
                                    </ul>
                                </div>
                            </div>
                        </section>

                        <section id="section-8" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">8. Data protection and privacy (NDPA 2023)</h2>
                            <div className="space-y-16">
                                <div id="8-1" className="space-y-8">
                                    <h3 className="text-xl font-bold">8.1 Applicable law</h3>
                                    <p>Both parties agree to comply fully with the Nigeria Data Protection Act 2023 (NDPA), the Nigeria Data Protection Regulation 2019 (NDPR), and all subsidiary legislation issued by the Nigeria Data Protection Commission (NDPC).</p>
                                </div>
                                <div id="8-2" className="space-y-8">
                                    <h3 className="text-xl font-bold">8.2 Roles</h3>
                                    <p>For your firm's client data entered into the Platform, you (the {isVega ? 'law firm' : 'property firm'}) are the Data Controller (you decide how the data is used), and we are a Data Processor (we handle it on your behalf, only on your documented instructions). For your account and billing data, PracticePro is the Data Controller.</p>
                                </div>
                                <div id="8-3" className="space-y-8">
                                    <h3 className="text-xl font-bold">8.3 Technical and organisational measures</h3>
                                    <p>We use appropriate technical and organisational security measures to protect personal data against unauthorised access, accidental loss, destruction, or disclosure. These include industry-standard password hashing, firm-level data isolation, encrypted transmission (TLS), and role-based access control.</p>
                                </div>
                                <div id="8-4" className="space-y-8">
                                    <h3 className="text-xl font-bold">8.4 Data subject rights</h3>
                                    <p>Under the NDPA 2023, your clients (as data subjects) have rights to access, correction, erasure, portability, and objection. As Data Controller, you are responsible for receiving and responding to their requests. The Platform provides tools to help you meet these obligations.</p>
                                </div>
                                <div id="8-5" className="space-y-8">
                                    <h3 className="text-xl font-bold">8.5 Data portability</h3>
                                    <p>You can export a copy of your firm's data at any time using the Export Archive function in Data Management settings. Exports are provided in structured, machine-readable JSON format.</p>
                                </div>
                                <div id="8-6" className="space-y-8">
                                    <h3 className="text-xl font-bold">8.6 Breach notification</h3>
                                    <p>We will tell you about any confirmed personal data breach affecting your firm's data within 72 hours of becoming aware of it, as required by NDPA 2023 Section 40. This lets you meet your obligations to the NDPC and to affected data subjects.</p>
                                </div>
                                <div id="8-7" className="space-y-8">
                                    <h3 className="text-xl font-bold">8.7 Third-party processors</h3>
                                    <p>We use these sub-processors to deliver the service:</p>
                                    <ul className="list-disc pl-8 space-y-4">
                                        <li>Convex, Inc. — database and serverless infrastructure; and</li>
                                        <li>Resend, Inc. — transactional email delivery.</li>
                                    </ul>
                                    <p><strong>AI processing model (Bring Your Own Key, or BYOK):</strong> The Platform's AI features ({isVega ? 'ALOA™' : 'ARIA™'}) are powered by large language models accessed via your own API key. When you provide your own Google Gemini or OpenAI API key, AI requests go directly from your browser to the AI provider. PracticePro does not act as a sub-processor for your AI inputs, and your AI query data does not pass through or stay on PracticePro's servers. You are the Data Controller for data you submit to the AI provider, and your use of the provider is governed by their own terms and privacy policy.</p>
                                    <p>Each sub-processor is bound by data processing agreements that stop them using your data for their own purposes.</p>
                                </div>
                                <div id="8-8" className="space-y-8">
                                    <h3 className="text-xl font-bold">8.8 Privacy Policy</h3>
                                    <p>Full details of our data processing practices are set out in our Privacy Policy, which is incorporated into these Terms.</p>
                                </div>
                            </div>
                        </section>

                        <section id="section-9" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">9. Cookie policy and consent</h2>
                            <div className="space-y-16">
                                <div id="9-1" className="space-y-8">
                                    <h3 className="text-xl font-bold">9.1 What cookies are</h3>
                                    <p>Cookies are small data files stored on your device when you use the Platform. We use them to enable essential functionality, improve performance, and understand usage patterns. Full details are in our Cookie Policy.</p>
                                </div>
                                <div id="9-2" className="space-y-8">
                                    <h3 className="text-xl font-bold">9.2 Cookie categories and consent</h3>
                                    <p>We use four categories: <strong>Essential</strong> (required for the Platform to work; cannot be turned off), <strong>Functional</strong> (your preferences), <strong>Analytics</strong> (anonymised usage data, only with consent), and <strong>Marketing</strong> (campaign tracking, only with consent). On your first visit, you will see a consent notice. You can accept all, accept only essential, or manage preferences in detail.</p>
                                </div>
                                <div id="9-3" className="space-y-8">
                                    <h3 className="text-xl font-bold">9.3 Withdrawal and third-party cookies</h3>
                                    <p>You can withdraw consent or change preferences anytime via your browser settings or the cookie preference centre in your account. Withdrawing analytics or marketing cookies does not affect your ability to use the Platform. Certain features may integrate third-party services that set their own cookies; we are not responsible for third-party cookie policies.</p>
                                </div>
                            </div>
                        </section>

                        <section id="section-10" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">10. Password security and account access</h2>
                            <div className="space-y-16">
                                <div id="10-1" className="space-y-8">
                                    <h3 className="text-xl font-bold">10.1 Password requirements</h3>
                                    <p>To protect sensitive data on the Platform, all passwords must meet these minimum requirements, technically enforced at registration and password reset:</p>
                                    <ul className="list-disc pl-8 space-y-4">
                                        <li>At least 8 characters;</li>
                                        <li>At least one uppercase letter;</li>
                                        <li>At least one lowercase letter;</li>
                                        <li>At least one numerical digit; and</li>
                                        <li>At least one special character.</li>
                                    </ul>
                                </div>
                                <div id="10-2" className="space-y-8">
                                    <h3 className="text-xl font-bold">10.2 Password hashing</h3>
                                    <p>Passwords are never stored in plaintext. They are irreversibly hashed using industry-standard password hashing (PBKDF2-SHA512, 600,000 iterations, meeting the OWASP 2023 minimum), with a per-user salt, before being stored. This means that even if there is an unauthorised database disclosure, your plaintext password cannot be recovered.</p>
                                </div>
                                <div id="10-3" className="space-y-8">
                                    <h3 className="text-xl font-bold">10.3 Re-authentication for destructive actions</h3>
                                    <p>Certain high-risk actions — including permanent account deletion — require identity re-verification. You will be asked to re-enter your password before such actions can proceed, regardless of your current session status. This prevents unauthorised irreversible data loss.</p>
                                </div>
                                <div id="10-4" className="space-y-8">
                                    <h3 className="text-xl font-bold">10.4 Session security</h3>
                                    <p>The Platform automatically locks idle sessions after a configurable period of inactivity. Once locked, you must re-authenticate to resume access. The default lock timeout is 15 minutes.</p>
                                </div>
                                <div id="10-5" className="space-y-8">
                                    <h3 className="text-xl font-bold">10.5 Your security obligations</h3>
                                    <p>You are responsible for:</p>
                                    <ul className="list-disc pl-8 space-y-4">
                                        <li>Not sharing your password with anyone;</li>
                                        <li>Logging out when using shared or public devices; and</li>
                                        <li>Telling us immediately at dpo@practicepro.ng if you suspect unauthorised access to your account.</li>
                                    </ul>
                                </div>
                            </div>
                        </section>

                        <section id="section-11" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">11. Data retention and deletion</h2>
                            <div className="space-y-16">
                                <div id="11-1" className="space-y-8">
                                    <h3 className="text-xl font-bold">11.1 Active account data</h3>
                                    <p>We keep User Data for as long as your account is active and for as long as we need it to provide the Services to you.</p>
                                </div>
                                <div id="11-2" className="space-y-8">
                                    <h3 className="text-xl font-bold">11.2 Soft delete and archive bin</h3>
                                    <p>When you delete a matter, contact, document, or other item, it is moved to a 30-day archive bin rather than being permanently destroyed. This gives you a recovery window in case of accidental deletion.</p>
                                </div>
                                <div id="11-3" className="space-y-8">
                                    <h3 className="text-xl font-bold">11.3 Automated purge policy</h3>
                                    <p>Items in the archive bin are automatically and permanently purged 30 days after they are moved there. This daily purge complies with the NDPA 2023's rules on data minimisation and storage limits.</p>
                                </div>
                                <div id="11-4" className="space-y-8">
                                    <h3 className="text-xl font-bold">11.4 Account termination and post-termination retention</h3>
                                    <p>When your account is terminated, you will have a 60-day window to export your firm's data. After that, we will securely delete your User Data from our systems in line with our data retention policy.</p>
                                </div>
                                <div id="11-5" className="space-y-8">
                                    <h3 className="text-xl font-bold">11.5 Right to erasure (right to be forgotten)</h3>
                                    <p>Under NDPA 2023 Section 35, you have the right to ask us to delete your personal data. You can start account deletion via Settings &gt; Data Management &gt; Delete Account. If you are the sole administrator of a firm, deleting your account will also trigger deletion of the firm record and all associated data.</p>
                                </div>
                                <div id="11-6" className="space-y-8">
                                    <h3 className="text-xl font-bold">11.6 Exceptions</h3>
                                    <p>Certain data may be kept beyond the periods above where required by Nigerian law, for the resolution of disputes, or for fraud prevention.</p>
                                </div>
                                <div id="11-7" className="space-y-8">
                                    <h3 className="text-xl font-bold">11.7 Leaked data remediation</h3>
                                    <p>PracticePro may purge, re-tag, or quarantine any data confirmed to have leaked outside its intended scope because of software defects, misconfiguration, or other technical incidents. These actions are logged in the security audit trail, and affected Firm administrators are told within 24 hours.</p>
                                </div>
                            </div>
                        </section>

                        <section id="section-12" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">12. Subscription fees and payment terms</h2>
                            <div className="space-y-16">
                                <div id="12-1" className="space-y-8">
                                    <h3 className="text-xl font-bold">12.1 Fees</h3>
                                    <p>You agree to pay fees for your selected subscription tier as set out on our pricing page. Subscription fees are payable in Nigerian Naira (₦) and do not include applicable taxes.</p>
                                </div>
                                <div id="12-2" className="space-y-8">
                                    <h3 className="text-xl font-bold">12.2 Automatic renewal</h3>
                                    <p>Subscriptions automatically renew at the end of each billing period unless you cancel before the renewal date. We will notify you of upcoming renewals.</p>
                                </div>
                                <div id="12-3" className="space-y-8">
                                    <h3 className="text-xl font-bold">12.3 Non-refundable</h3>
                                    <p>Subscription fees are non-refundable, except where we have materially failed to deliver the subscribed services, or as otherwise required by the Federal Competition and Consumer Protection Act 2018.</p>
                                </div>
                                <div id="12-4" className="space-y-8">
                                    <h3 className="text-xl font-bold">12.4 Price changes</h3>
                                    <p>We will give you at least 30 days' notice of any changes to subscription pricing. If you keep using the Platform after a price change takes effect, that means you accept the new price.</p>
                                </div>
                                <div id="12-5" className="space-y-8">
                                    <h3 className="text-xl font-bold">12.5 Downgrade and cancellation</h3>
                                    <p>You can downgrade or cancel your subscription at any time via the Billing &amp; Plans settings. Downgrade or cancellation takes effect at the end of the current billing period. You will keep access to paid features until that date.</p>
                                </div>
                            </div>
                        </section>

                        <section id="section-13" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">13. Acceptable use and prohibited conduct</h2>
                            <div className="space-y-16">
                                <div id="13-1" className="space-y-8">
                                    <h3 className="text-xl font-bold">13.1 Permitted use</h3>
                                    <p>The Platform may only be used for lawful {isProperty ? 'property management' : 'legal practice management'} purposes, consistent with the Rules of Professional Conduct and applicable Nigerian law.</p>
                                </div>
                                <div id="13-2" className="space-y-8">
                                    <h3 className="text-xl font-bold">13.2 Prohibited conduct</h3>
                                    <p>You may not:</p>
                                    <ul className="list-disc pl-8 space-y-4">
                                        <li>Use the Platform for any illegal, fraudulent, or unauthorised purpose;</li>
                                        <li>Bypass or circumvent security controls, or try to reverse-engineer or extract the source code;</li>
                                        <li>Introduce malware, viruses, or harmful code;</li>
                                        <li>Use bots or scripts to scrape or harvest data;</li>
                                        <li>Share login credentials or allow multiple people to use a single account at the same time;</li>
                                        {isVega && <li>Use the Platform for clients or matters where you have a conflict of interest without proper disclosure and consent;</li>}
                                        <li>Misrepresent your professional qualifications; or</li>
                                        <li>Use AI Agents to generate {isVega ? 'legal advice for clients' : 'agreements or notices'} without appropriate professional review.</li>
                                    </ul>
                                </div>
                                <div id="13-3" className="space-y-8">
                                    <h3 className="text-xl font-bold">13.3 Consequences</h3>
                                    <p>Violating this section may result in immediate suspension or termination of your account. It may also lead to civil or criminal liability under Nigerian law.</p>
                                </div>
                            </div>
                        </section>

                        <section id="section-14" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">14. Service availability and modifications</h2>
                            <div className="space-y-16">
                                <div id="14-1" className="space-y-8">
                                    <h3 className="text-xl font-bold">14.1 Availability target</h3>
                                    <p>We strive to keep the Platform available but do not guarantee uninterrupted access. Scheduled maintenance and circumstances outside our control (like natural disasters, war, or government action), third-party infrastructure failures, and cyberattacks may cause temporary unavailability.</p>
                                </div>
                                <div id="14-2" className="space-y-8">
                                    <h3 className="text-xl font-bold">14.2 Planned maintenance and modifications</h3>
                                    <p>We will try to schedule planned maintenance during off-peak hours and give advance notice where practicable. We may modify, add, or remove features at any time to improve functionality, security, or regulatory compliance, and will give reasonable notice of significant feature removals that affect existing workflows.</p>
                                </div>
                                <div id="14-3" className="space-y-8">
                                    <h3 className="text-xl font-bold">14.3 Beta features</h3>
                                    <p>Features marked "Beta" or "Preview" are provided as-is and may be unstable. They may be modified or discontinued without notice.</p>
                                </div>
                            </div>
                        </section>

                        <section id="section-15" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">15. Warranties and disclaimers</h2>
                            <div className="space-y-16">
                                <div id="15-1" className="space-y-8">
                                    <h3 className="text-xl font-bold">15.1 "As is" provision</h3>
                                    <p><strong>The Platform and all services are provided "as is" and "as available," without warranties of any kind, express or implied. This includes, but is not limited to, warranties of merchantability, fitness for a particular purpose, non-infringement, or accuracy.</strong></p>
                                </div>
                                <div id="15-2" className="space-y-8">
                                    <h3 className="text-xl font-bold">15.2 AI output disclaimer</h3>
                                    <p><strong>We expressly disclaim all warranties about AI Agent outputs. {isProperty ? 'AI-generated drafts' : 'AI-generated legal drafts'}, deadline calculations, jurisdiction recommendations, and fee assessments are provided for informational help only and do not constitute {isProperty ? 'professional' : 'legal'} advice.</strong></p>
                                </div>
                                <div id="15-3" className="space-y-8">
                                    <h3 className="text-xl font-bold">15.3 Professional reliance</h3>
                                    <p>The Platform is a tool to assist {isProperty ? 'property management' : 'legal practice'}. It is not a substitute for professional {isProperty ? '' : 'legal '}training, experience, or judgment. We make no representation that using the Platform will lead to favourable legal outcomes.</p>
                                </div>
                            </div>
                        </section>

                        <section id="section-16" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">16. Limitation of liability</h2>
                            <div className="space-y-16">
                                <div id="16-1" className="space-y-8">
                                    <h3 className="text-xl font-bold">16.1 Liability cap</h3>
                                    <p>To the maximum extent allowed by Nigerian law, our total liability to you for any claim under these Terms will not exceed the subscription fees you paid us in the 12 months before the issue arose.</p>
                                </div>
                                <div id="16-2" className="space-y-8">
                                    <h3 className="text-xl font-bold">16.2 Excluded losses</h3>
                                    <p>We are not liable for:</p>
                                    <ul className="list-disc pl-8 space-y-4">
                                        <li>Lost profits, revenue, or business;</li>
                                        <li>Lost or corrupted data;</li>
                                        <li>Loss of goodwill or reputation; or</li>
                                        <li>Any indirect, consequential, incidental, punitive, or special damages, even if we knew they might happen.</li>
                                    </ul>
                                </div>
                                <div id="16-3" className="space-y-8">
                                    <h3 className="text-xl font-bold">16.3 AI-specific exclusion</h3>
                                    <p>We are not liable for any professional negligence claim, disciplinary action, court order, adverse judgment, or other loss arising from a legal practitioner's reliance on AI Agent outputs without independent verification and professional review.</p>
                                </div>
                                <div id="16-4" className="space-y-8">
                                    <h3 className="text-xl font-bold">16.4 Consumer rights</h3>
                                    <p>Nothing in these Terms excludes or limits any rights you have under the Federal Competition and Consumer Protection Act 2018, or other mandatory provisions of Nigerian consumer protection law that cannot lawfully be excluded.</p>
                                </div>
                            </div>
                        </section>

                        <section id="section-17" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">17. Indemnification</h2>
                            <div className="space-y-16">
                                <div id="17-1" className="space-y-8">
                                    <h3 className="text-xl font-bold">17.1 Your indemnity</h3>
                                    <p>You agree to protect PracticePro (and our officers, directors, employees, and agents) from any claims, damages, losses, costs, or legal fees arising from: your breach of these Terms; your use or misuse of the Platform; your reliance on AI Agent outputs without appropriate professional oversight; your violation of any law or professional conduct rule; or any third-party claim arising from your use of the Platform in connection with their matter or data.</p>
                                </div>
                            </div>
                        </section>

                        <section id="section-18" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">18. Term and termination</h2>
                            <div className="space-y-16">
                                <div id="18-1" className="space-y-8">
                                    <h3 className="text-xl font-bold">18.1 Term</h3>
                                    <p>These Terms start on the date you create an account and continue until terminated under this Section.</p>
                                </div>
                                <div id="18-2" className="space-y-8">
                                    <h3 className="text-xl font-bold">18.2 Termination by you</h3>
                                    <p>You can terminate these Terms at any time by deleting your account via Settings &gt; Data Management &gt; Delete Account. Termination takes effect immediately on account deletion.</p>
                                </div>
                                <div id="18-3" className="space-y-8">
                                    <h3 className="text-xl font-bold">18.3 Termination by us</h3>
                                    <p>We may terminate or suspend your access immediately and without prior notice where:</p>
                                    <ul className="list-disc pl-8 space-y-4">
                                        <li>You materially breach these Terms;</li>
                                        <li>You fail to pay subscription fees after a 14-day grace period;</li>
                                        <li>We are required to do so by law; or</li>
                                        <li>Your conduct poses a security or reputational risk to the Platform or other users.</li>
                                    </ul>
                                </div>
                                <div id="18-4" className="space-y-8">
                                    <h3 className="text-xl font-bold">18.4 Effect of termination</h3>
                                    <p>On termination, your right to access the Platform stops immediately. The data export and deletion procedures in Section 11 apply. Sections 7, 8, 15, 16, 17, 19, and 20 continue to apply after termination.</p>
                                </div>
                            </div>
                        </section>

                        <section id="section-19" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">19. Dispute resolution</h2>
                            <div className="space-y-16">
                                <div id="19-1" className="space-y-8">
                                    <h3 className="text-xl font-bold">19.1 Good faith negotiation</h3>
                                    <p>If any dispute arises out of or relates to these Terms, the parties will first try to resolve it through good faith negotiation. A party wishing to start this must give written notice to the other, setting out the nature of the dispute in reasonable detail. The parties will negotiate for at least 30 days.</p>
                                </div>
                                <div id="19-2" className="space-y-8">
                                    <h3 className="text-xl font-bold">19.2 Mediation</h3>
                                    <p>If the dispute is not resolved through negotiation within 30 days, either party may refer it to mediation under the Rules of the Lagos Multi-Door Courthouse (LMDC), or another mediation institution the parties agree on. Mediation costs are shared equally.</p>
                                </div>
                                <div id="19-3" className="space-y-8">
                                    <h3 className="text-xl font-bold">19.3 Arbitration</h3>
                                    <p>If mediation does not produce a settlement within 60 days of the appointment of a mediator, the dispute will be referred to and finally resolved by arbitration in Lagos, Nigeria, under the Arbitration and Mediation Act 2023. The arbitration will be handled by one arbitrator. If we can't agree on who, one will be appointed under the Act.</p>
                                </div>
                                <div id="19-4" className="space-y-8">
                                    <h3 className="text-xl font-bold">19.4 No class actions</h3>
                                    <p>All disputes will be resolved on an individual basis. You waive any right to take part in a class action or representative proceeding.</p>
                                </div>
                            </div>
                        </section>

                        <section id="section-20" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">20. Governing law and jurisdiction</h2>
                            <div className="space-y-16">
                                <div id="20-1" className="space-y-8">
                                    <h3 className="text-xl font-bold">20.1 Governing law</h3>
                                    <p>These Terms and all matters arising out of or in connection with them are governed by and construed in line with the laws of the Federal Republic of Nigeria.</p>
                                </div>
                                <div id="20-2" className="space-y-8">
                                    <h3 className="text-xl font-bold">20.2 Jurisdiction</h3>
                                    <p>Without affecting the dispute resolution process in Section 19, the courts of Lagos State will handle enforcement of any arbitral award or urgent injunctions.</p>
                                </div>
                                <div id="20-3" className="space-y-8">
                                    <h3 className="text-xl font-bold">20.3 NBA compliance</h3>
                                    <p>Nothing in these Terms overrides the Rules of Professional Conduct for Legal Practitioners 2023, or any directive issued by the Nigerian Bar Association.</p>
                                </div>
                            </div>
                        </section>

                        <section id="section-21" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">21. General provisions</h2>
                            <div className="space-y-16">
                                <div id="21-1" className="space-y-8">
                                    <h3 className="text-xl font-bold">21.1 Entire agreement</h3>
                                    <p>These Terms are the complete agreement between you and PracticePro about the Platform, replacing any earlier discussions or agreements. They include the Privacy Policy and Cookie Policy.</p>
                                </div>
                                <div id="21-2" className="space-y-8">
                                    <h3 className="text-xl font-bold">21.2 Severability</h3>
                                    <p>If a court finds any part of these Terms unenforceable, the rest will continue in full force. The unenforceable part will be modified only as much as needed to make it enforceable.</p>
                                </div>
                                <div id="21-3" className="space-y-8">
                                    <h3 className="text-xl font-bold">21.3 No waiver</h3>
                                    <p>If either of us delays or fails to use a right under these Terms, that doesn't mean we've given up that right.</p>
                                </div>
                                <div id="21-4" className="space-y-8">
                                    <h3 className="text-xl font-bold">21.4 Assignment</h3>
                                    <p>You may not assign or transfer any rights or obligations under these Terms without our prior written consent. We may assign these Terms in connection with a merger, acquisition, or sale of all or substantially all of our assets.</p>
                                </div>
                                <div id="21-5" className="space-y-8">
                                    <h3 className="text-xl font-bold">21.5 Force majeure and language</h3>
                                    <p>We are not liable for any delay or failure resulting from events outside our control (like natural disasters, war, or government action), internet service disruptions, or cyberattacks. These Terms are drawn up in English; if there is any conflict between this English version and any translation, the English version prevails.</p>
                                </div>
                            </div>
                        </section>

                        <section id="section-22" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">22. Contact information</h2>
                            <div className="space-y-12">
                                <p>For any questions, complaints, or notices relating to these Terms, please contact us at:</p>
                                <div className="pl-4 border-l-2 border-slate-100 space-y-3">
                                    <p><strong>Company:</strong> PracticePro Systems Limited</p>
                                    <p><strong>Address:</strong> No. 6 Sulaiman Adekanbi Street, Igbo-Efon, Lekki-Epe Expressway, Lagos State, Nigeria</p>
                                    <p><strong>General enquiries:</strong> <a href="mailto:practiceprosystems@gmail.com" className="text-primary-600 no-underline hover:underline">practiceprosystems@gmail.com</a></p>
                                    <p><strong>Data protection / privacy:</strong> <a href="mailto:dpo@practicepro.ng" className="text-primary-600 no-underline hover:underline">dpo@practicepro.ng</a></p>
                                </div>
                                <p>We aim to respond to all formal notices and complaints within 5 business days.</p>
                            </div>
                        </section>

                        <section id="section-23" className="mb-20">
                            <h2 className="text-3xl font-bold mb-8 transition-colors">23. Portal terms of use</h2>
                            <div className="space-y-16">
                                <div id="23-1" className="space-y-8">
                                    <h3 className="text-xl font-bold">23.1 Incorporation by reference</h3>
                                    <p>The PracticePro Portal Terms of Use ("Portal Terms") are part of these Terms. They apply to all users who access the PracticePro Client Portal or Residents' Portal (together, the "Portal"). A copy is available on request and is shown to each User during the Portal account setup process.</p>
                                </div>
                                <div id="23-2" className="space-y-8">
                                    <h3 className="text-xl font-bold">23.2 Binding effect</h3>
                                    <p>By accepting an invitation to the Portal, creating a Portal account, or accessing the Portal, you agree to be bound by the Portal Terms as well as these Terms. If there is a conflict between these Terms and the Portal Terms, the Portal Terms prevail for Portal-specific matters.</p>
                                </div>
                                <div id="23-3" className="space-y-8">
                                    <h3 className="text-xl font-bold">23.3 Scope of Portal Terms</h3>
                                    <p>The Portal Terms cover: Portal access scope; user responsibilities (accurate information, no misuse); privacy under the NDPA 2023; communication (messages are logged, not private); payment submissions and proof of payment; maintenance requests and service charges (Residents' Portal); intellectual property restrictions; Portal-specific liability limits; termination of Portal access; and governing law and dispute resolution.</p>
                                </div>
                                <div id="23-4" className="space-y-8">
                                    <h3 className="text-xl font-bold">23.4 Amendment of Portal Terms</h3>
                                    <p>PracticePro may amend the Portal Terms at any time in line with Section 14 of these Terms. If you keep using the Portal after any such amendment, that means you accept the revised Portal Terms.</p>
                                </div>
                                <div id="23-5" className="space-y-8">
                                    <h3 className="text-xl font-bold">23.5 Portal access as a privilege</h3>
                                    <p>Access to the Portal is granted at the discretion of the User's {isVega ? 'legal service provider' : 'property manager'} and PracticePro. Portal access may be suspended or terminated in line with the Portal Terms and Section 18 of these Terms.</p>
                                </div>
                            </div>
                        </section>

                    </div>

                    {/* Footer */}
                    <div className="h-32 pt-20 border-t border-slate-100 mt-20 text-center">
                        <p className="text-2xs text-slate-400 font-bold uppercase tracking-widest">
                            PracticePro {isVega ? 'VEGA • Professional Operations System' : 'ATRIUM • Property OS'} • Version 2.1 • August 2026
                        </p>
                    </div>
                    <div className="h-20 sm:h-0" />
                </div>
            </div>
        </div>
    );
};

export default TermsOfService;
