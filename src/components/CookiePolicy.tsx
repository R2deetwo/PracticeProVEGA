import React from 'react';
import { ChevronLeftIcon as ChevronLeft } from '../constants';

const CookiePolicy: React.FC<{ onBack: () => void }> = ({ onBack }) => (
    <div className="w-full h-full bg-white dark:bg-zinc-900 flex flex-col overflow-hidden animate-fade-in font-sans">

        <div className="sticky top-0 z-50 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-b border-slate-200 dark:border-zinc-800 px-4 h-16 flex items-center justify-between">
            <button
                onClick={onBack}
                className="flex items-center gap-2 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors font-medium text-sm"
            >
                <ChevronLeft className="w-5 h-5" />
                Back
            </button>
            <h1 className="font-bold text-slate-900 dark:text-white">Cookie Policy</h1>
            <div className="w-16" />
        </div>

        <div className="flex-1 overflow-y-auto scroll-smooth custom-scrollbar">
            <div className="max-w-4xl mx-auto px-6 sm:px-12 py-12 lg:py-20">

                <div className="mb-16">
                    <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-6">Cookie Policy</h1>
                    <p className="text-sm font-semibold text-slate-600 dark:text-zinc-400 mb-2 tracking-tight">PRACTICEPRO LEGAL TECHNOLOGIES LIMITED</p>
                    <div className="flex flex-col text-xs text-slate-500 dark:text-zinc-500 italic">
                        <span>Last Updated: May 2026</span>
                    </div>
                </div>

                <div className="prose prose-slate dark:prose-invert max-w-none
                    prose-p:leading-[1.8] prose-p:mb-12
                    prose-h2:mt-16 prose-h2:mb-8 prose-h2:text-3xl prose-h2:font-bold prose-h2:border-b-2 prose-h2:pb-4 prose-h2:border-slate-200 dark:prose-h2:border-zinc-800
                    prose-h3:mt-12 prose-h3:mb-6 prose-h3:text-xl prose-h3:font-bold
                    prose-ul:mb-10 prose-ul:space-y-4
                    prose-li:leading-relaxed">

                    <hr className="my-10" />

                    <p>
                        PracticePro Legal Technologies Limited ("we", "us", or "our") uses cookies and similar tracking
                        technologies on the Vega platform to ensure high-fidelity UI performance, verify active user
                        sessions, and maintain secure database routing states. This Cookie Policy explains what cookies
                        are, how we use them, and your rights to manage their behaviour.
                    </p>

                    <h2>1. What Are Cookies?</h2>
                    <p>
                        Cookies are small text files downloaded to your browser or device when you interact with our
                        platform. They allow us to recognise your device, maintain security contexts, and preserve your
                        application dashboard preferences across browser sessions. Cookies are not executable programs
                        and cannot carry viruses or install malware on your device.
                    </p>

                    <h2>2. How We Use Cookies</h2>
                    <p>
                        We categorise our tracking usage into three explicit execution tiers:
                    </p>

                    <h3>2.1 Essential / Strictly Necessary Cookies</h3>
                    <p>
                        These are vital to power the secure core engine of Vega. They handle JWT authentication
                        validation, route verification tokens, and preserve state continuity across internal database
                        calls (for example, maintaining workspace context when navigating between Matters and Contacts).
                        The platform cannot function without these cookies. You cannot opt out of essential cookies
                        while using the platform.
                    </p>

                    <h3>2.2 Performance &amp; Analytics Cookies</h3>
                    <p>
                        These anonymous trackers monitor performance thresholds, database response lag times, and
                        tracking artefacts. They help us identify visual layout anomalies or broken viewport states
                        across different devices. All data collected under this category is aggregated and anonymised
                        before analysis. We use this data solely to improve platform reliability and user experience.
                    </p>

                    <h3>2.3 Functional Preference Cookies</h3>
                    <p>
                        These cookies record your UI workspace custom state choices, such as persisting sidebar toggles,
                        table density parameters, or your theme configuration (for example, Platinum UI dark-mode vs.
                        light-mode layout setups). Blocking these cookies will not prevent you from accessing the
                        platform but may cause certain display preferences to reset on each visit.
                    </p>

                    <h2>3. Specific Telemetry and Session State Keys Utilised</h2>
                    <p>
                        Our platform explicitly monitors local file parameters to preserve system configuration
                        continuity:
                    </p>
                    <ul>
                        <li>
                            <strong><code>__session</code> / Auth Tokens:</strong> Verifies active user profile claims
                            and restricts data exposure strictly to authenticated team boundaries. These are
                            session-scoped and expire automatically on browser close or after a defined inactivity
                            period.
                        </li>
                        <li>
                            <strong><code>ui-state-preference</code>:</strong> Tracks workspace configuration options
                            to eliminate loading layout flickers on page navigation. This value is stored in
                            localStorage and is not transmitted to our servers.
                        </li>
                    </ul>

                    <h2>4. Third-Party Cookies</h2>
                    <p>
                        The Vega platform does not currently serve third-party advertising cookies. Where we integrate
                        third-party services (such as Google AI APIs for the ARIA™ engine), those services may set
                        their own cookies governed by their respective privacy policies. We recommend reviewing the
                        privacy documentation of any third-party service you interact with through our platform.
                    </p>

                    <h2>5. Managing and Controlling Cookie Preferences</h2>
                    <p>
                        You possess the absolute legal right to accept or decline non-essential tracking cookies. You
                        can configure your internet browser to refuse or erase cookies globally via its built-in
                        privacy settings. Below are links to cookie management instructions for major browsers:
                    </p>
                    <ul>
                        <li>Google Chrome — Settings &gt; Privacy and Security &gt; Cookies</li>
                        <li>Mozilla Firefox — Options &gt; Privacy &amp; Security &gt; Cookies and Site Data</li>
                        <li>Apple Safari — Preferences &gt; Privacy &gt; Manage Website Data</li>
                        <li>Microsoft Edge — Settings &gt; Privacy, Search and Services &gt; Cookies</li>
                    </ul>
                    <p>
                        Please note that blocking or scrubbing essential tokens will instantly terminate your active
                        session context and suspend your ability to run database mutations or access secure case file
                        paths inside the application.
                    </p>

                    <h2>6. Cookie Retention Periods</h2>
                    <p>
                        Session cookies are deleted automatically when you close your browser. Persistent preference
                        cookies are retained for a maximum of 12 months from the date of last interaction. You may
                        clear all stored cookies at any time through your browser settings without affecting your
                        account data stored on our servers.
                    </p>

                    <h2>7. Changes to This Policy</h2>
                    <p>
                        We may update this Cookie Policy periodically to reflect changes in our technology stack,
                        regulatory requirements, or platform capabilities. Material changes will be communicated
                        via an in-platform notification. Continued use of the Vega platform after such notice
                        constitutes your acceptance of the updated policy.
                    </p>

                    <h2>8. Contact &amp; Data Compliance</h2>
                    <p>
                        For detailed legal enquiries regarding our tracking mechanics or to exercise your data rights
                        under applicable Nigerian data protection legislation (NDPA 2023), please contact our data
                        compliance desk at:
                    </p>
                    <p>
                        <strong>PracticePro Legal Technologies Limited</strong><br />
                        Data Compliance Desk<br />
                        Email: <a href="mailto:compliance@practicepro.esq">compliance@practicepro.esq</a>
                    </p>

                    <hr className="my-10" />
                    <p className="text-xs text-slate-400 dark:text-zinc-600 italic">
                        This Cookie Policy is issued by PracticePro Legal Technologies Limited and applies exclusively
                        to the Vega Legal Operations OS and Atrium Property OS platforms operated under the
                        PracticePro brand. Last reviewed: May 2026.
                    </p>
                </div>
            </div>
        </div>
    </div>
);

export default CookiePolicy;
