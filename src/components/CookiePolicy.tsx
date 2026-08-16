import React from 'react';
import { ChevronLeftIcon as ChevronLeft } from '../constants';
import { useProduct } from '../contexts/ProductContext';

/**
 * Cookie Policy — rewritten in plain English.
 *
 * Design goals:
 *   - Apply the Plain English doctrine: short sentences, everyday words,
 *     active voice, no jargon, no legalese.
 *   - Replace technical terms ("JWT authentication validation", "telemetry",
 *     "execution tiers", "database routing states") with plain explanations.
 *   - Add a quick-reference table at the top so visitors can scan every
 *     cookie we use in one glance (name, purpose, type, how long it stays).
 *   - Keep the existing header / footer / styling pattern used by the other
 *     legal pages (PrivacyPolicy, TermsOfService, etc.) so the family of
 *     documents looks consistent.
 *   - Always render in light mode (see index.html — `html.dark` is set when
 *     the OS theme is dark). The `style={{ colorScheme: 'light' }}` on the
 *     root and the absence of any `dark:` Tailwind classes guarantee this.
 */

const CookiePolicy: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { isProperty } = useProduct();
    const productLabel = isProperty ? 'Atrium' : 'Vega';
    return (
    <div className="w-full h-full bg-white flex flex-col overflow-hidden animate-fade-in font-sans" style={{ colorScheme: 'light' }} data-public-page>

        <div className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 h-16 flex items-center justify-between">
            <button
                onClick={onBack}
                className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors font-medium text-sm"
            >
                <ChevronLeft className="w-5 h-5" />
                Back
            </button>
            <h1 className="font-bold text-slate-900">Cookie Policy</h1>
            <div className="w-16" />
        </div>

        <div className="flex-1 overflow-y-auto scroll-smooth custom-scrollbar">
            <div className="max-w-4xl mx-auto px-6 sm:px-12 py-12 lg:py-20">

                {/* Document header */}
                <div className="mb-12">
                    <h1 className="text-4xl font-bold text-slate-900 mb-4">Cookie Policy</h1>
                    <p className="text-sm font-semibold text-slate-600 mb-2 tracking-tight">PRACTICEPRO SYSTEMS LIMITED</p>
                    <div className="flex flex-col text-xs text-slate-500 italic">
                        <span>Last updated: August 2026</span>
                    </div>
                </div>

                {/* Plain-English summary box — gives the reader the gist in 3 sentences */}
                <div className="mb-12 p-5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 leading-relaxed">
                    <strong className="text-slate-900">In short:</strong> We use a small number of cookies
                    and similar technologies to keep you logged in, remember your preferences, and
                    understand how the platform is used. Cookies are small text files stored on your
                    device. You can control or delete them at any time through your browser settings.
                </div>

                <div className="prose prose-slate max-w-none
                    prose-p:leading-[1.8] prose-p:mb-8
                    prose-h2:mt-12 prose-h2:mb-6 prose-h2:text-2xl prose-h2:font-bold prose-h2:border-b prose-h2:pb-3 prose-h2:border-slate-200
                    prose-h3:mt-10 prose-h3:mb-4 prose-h3:text-lg prose-h3:font-bold
                    prose-ul:mb-8 prose-ul:space-y-3
                    prose-li:leading-relaxed">

                    <h2>1. What cookies are</h2>
                    <p>
                        A cookie is a small text file that a website asks your browser to store on your
                        device. They are widely used across the web to make websites work efficiently
                        and to give you a better experience.
                    </p>
                    <p>
                        Cookies cannot run programs, carry viruses, or install malware on your device.
                        They simply store pieces of information — such as your login state or your
                        preference for dark or light mode — so the website can remember you the next
                        time you load a page.
                    </p>

                    <h2>2. The cookies we use</h2>
                    <p>
                        We group the cookies and similar technologies on {productLabel} into three
                        simple categories:
                    </p>

                    <h3>2.1 Strictly necessary cookies</h3>
                    <p>
                        These are required for {productLabel} to work at all. They keep you signed in
                        as you move from page to page, and they protect your account from being
                        accessed by someone else. You cannot turn these off while using the platform —
                        if you do, you will be logged out and will not be able to use most features.
                    </p>

                    <h3>2.2 Preference cookies</h3>
                    <p>
                        These remember choices you make, such as whether the sidebar is open or closed,
                        whether you prefer compact or comfortable spacing in lists, and whether you
                        have chosen dark or light mode. They are stored on your device and are not
                        sent to our servers. If you turn them off, {productLabel} will still work, but
                        your preferences will reset each time you visit.
                    </p>

                    <h3>2.3 Analytics cookies</h3>
                    <p>
                        These help us understand how the platform is used — for example, which pages
                        load slowly, which features are most popular, and where visitors get stuck.
                        The information is grouped and anonymised before we look at it, so it cannot
                        be tied back to you as an individual. We use it only to improve reliability
                        and fix problems.
                    </p>

                    <h2>3. Cookies we set, at a glance</h2>
                    <p>
                        The table below lists every type of cookie {productLabel} uses, what it does,
                        how long it stays, and whether you can turn it off.
                    </p>

                    {/* Plain-English quick-reference table — replaces the previous
                        jargon-heavy bullet list (e.g. "Verifies active user profile
                        claims and restricts data exposure strictly to authenticated
                        team boundaries"). */}
                    <div className="not-prose my-8 overflow-x-auto rounded-lg border border-slate-200">
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr className="bg-slate-50">
                                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wide border-b border-slate-200">Name</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wide border-b border-slate-200">What it does</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wide border-b border-slate-200">Type</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wide border-b border-slate-200">How long</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="bg-white">
                                    <td className="px-4 py-3 text-slate-900 font-mono text-xs border-b border-slate-100 align-top">session token</td>
                                    <td className="px-4 py-3 text-slate-600 border-b border-slate-100 align-top">Keeps you signed in as you move between pages.</td>
                                    <td className="px-4 py-3 text-slate-600 border-b border-slate-100 align-top"><span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-50 text-red-700 text-2xs font-bold uppercase tracking-wider">Required</span></td>
                                    <td className="px-4 py-3 text-slate-600 border-b border-slate-100 align-top">Deleted when you close your browser.</td>
                                </tr>
                                <tr className="bg-slate-50/40">
                                    <td className="px-4 py-3 text-slate-900 font-mono text-xs border-b border-slate-100 align-top">ui-state-preference</td>
                                    <td className="px-4 py-3 text-slate-600 border-b border-slate-100 align-top">Remembers your layout choices (sidebar, theme, list density).</td>
                                    <td className="px-4 py-3 text-slate-600 border-b border-slate-100 align-top"><span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-2xs font-bold uppercase tracking-wider">Preference</span></td>
                                    <td className="px-4 py-3 text-slate-600 border-b border-slate-100 align-top">Stored on your device. Stays until you clear it.</td>
                                </tr>
                                <tr className="bg-white">
                                    <td className="px-4 py-3 text-slate-900 font-mono text-xs border-b border-slate-100 align-top">cookie_consent</td>
                                    <td className="px-4 py-3 text-slate-600 border-b border-slate-100 align-top">Remembers that you have seen and acknowledged this cookie notice.</td>
                                    <td className="px-4 py-3 text-slate-600 border-b border-slate-100 align-top"><span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-50 text-red-700 text-2xs font-bold uppercase tracking-wider">Required</span></td>
                                    <td className="px-4 py-3 text-slate-600 border-b border-slate-100 align-top">Up to 12 months.</td>
                                </tr>
                                <tr className="bg-slate-50/40">
                                    <td className="px-4 py-3 text-slate-900 font-mono text-xs align-top">analytics_id</td>
                                    <td className="px-4 py-3 text-slate-600 align-top">Anonymised identifier used to group page views for reliability reporting.</td>
                                    <td className="px-4 py-3 text-slate-600 align-top"><span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-2xs font-bold uppercase tracking-wider">Analytics</span></td>
                                    <td className="px-4 py-3 text-slate-600 align-top">Up to 12 months.</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <h2>4. Third-party cookies</h2>
                    <p>
                        We do not show advertising cookies on {productLabel}. Where we use a
                        third-party service — for example, the AI provider that powers our drafting
                        and research features, or the payment provider that processes your
                        subscription — those services may set their own cookies. They are governed by
                        their own privacy policies, which we encourage you to read.
                    </p>

                    <h2>5. How to control cookies</h2>
                    <p>
                        You are in control. Most browsers let you accept, block, or delete cookies
                        through their privacy settings. Here is where to find these settings in the
                        most popular browsers:
                    </p>
                    <ul>
                        <li><strong>Google Chrome</strong> — Settings &gt; Privacy and security &gt; Cookies</li>
                        <li><strong>Mozilla Firefox</strong> — Options &gt; Privacy &amp; Security &gt; Cookies and Site Data</li>
                        <li><strong>Apple Safari</strong> — Preferences &gt; Privacy &gt; Manage Website Data</li>
                        <li><strong>Microsoft Edge</strong> — Settings &gt; Privacy, search and services &gt; Cookies</li>
                    </ul>
                    <p>
                        Please note: if you block strictly necessary cookies, you will not be able to
                        stay signed in, and you will not be able to access your{' '}
                        {isProperty ? 'property records' : 'case files'} or run any action that
                        requires an account.
                    </p>

                    <h2>6. How long we keep cookies</h2>
                    <p>
                        Session cookies are deleted as soon as you close your browser. Preference and
                        analytics cookies stay on your device for up to 12 months from your last
                        visit. You can clear them at any time through your browser settings — this
                        does not affect any data stored safely on our servers.
                    </p>

                    <h2>7. Changes to this policy</h2>
                    <p>
                        We may update this Cookie Policy from time to time — for example, when we add
                        new features, change how cookies work, or respond to changes in Nigerian data
                        protection law. When we make significant changes, we will notify you inside
                        the platform. If you keep using {productLabel} after the notice, we will
                        treat that as acceptance of the updated policy.
                    </p>

                    <h2>8. Contact us</h2>
                    <p>
                        If you have any questions about this policy or want to exercise your rights
                        under the Nigeria Data Protection Act 2023 — for example, to ask what data we
                        hold about you, or to request that we delete it — please contact our data
                        compliance team:
                    </p>
                    <p>
                        <strong>PracticePro Systems Limited</strong><br />
                        Data Compliance Desk<br />
                        Email: <a href="mailto:compliance@practicepro.esq" className="text-primary-600 hover:text-primary-700 underline">compliance@practicepro.esq</a>
                    </p>

                    <p className="text-xs text-slate-400 italic mt-12 pt-6 border-t border-slate-100">
                        This Cookie Policy is issued by PracticePro Systems Limited and applies to the
                        Vega and Atrium platforms operated under the PracticePro brand. Last reviewed:
                        August 2026.
                    </p>
                </div>
            </div>
        </div>
    </div>
    );
};

export default CookiePolicy;
