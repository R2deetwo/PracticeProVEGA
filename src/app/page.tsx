'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  ChevronRight,
  Shield,
  Scale,
  FileText,
  Building2,
  Bot,
  Users,
  CreditCard,
  BarChart3,
  Check,
  ArrowRight,
  Star,
  Zap,
  Lock,
  Globe,
  Menu,
  X,
  Sparkles,
  LayoutGrid,
  Receipt,
  CalendarClock,
  DoorOpen,
  MessageSquare,
  ChevronDown,
  Play,
  Phone,
  Mail,
  MapPin,
} from 'lucide-react'

/* ────────────────────────────── NAV ────────────────────────────── */

function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const links = [
    { label: 'Features', href: '/features' },
    { label: 'VEGA', href: '#vega' },
    { label: 'Atrium', href: '#atrium' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'Testimonials', href: '#testimonials' },
  ]

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/80 backdrop-blur-xl border-b border-slate-200/60 shadow-sm'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-18">
          {/* Logo */}
          <a href="#" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md group-hover:shadow-emerald-200 transition-shadow">
              <Scale className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="text-lg font-bold text-slate-900 tracking-tight">
              Practice<span className="gradient-text">Pro</span>
            </span>
          </a>

          {/* Desktop links */}
          <div className="hidden lg:flex items-center gap-1">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="px-3.5 py-2 text-sm font-medium text-slate-600 hover:text-emerald-700 rounded-lg hover:bg-emerald-50/60 transition-colors"
              >
                {l.label}
              </a>
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden lg:flex items-center gap-3">
            <a
              href="#pricing"
              className="text-sm font-medium text-slate-600 hover:text-emerald-700 transition-colors"
            >
              Sign in
            </a>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-200 hover:shadow-emerald-300 transition-all rounded-lg px-5">
              Get Started Free
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>

          {/* Mobile toggle */}
          <button
            className="lg:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="lg:hidden bg-white border-t border-slate-100 shadow-lg">
          <div className="px-4 py-3 space-y-1">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 rounded-lg transition-colors"
              >
                {l.label}
              </a>
            ))}
            <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
              <Button
                variant="outline"
                className="w-full justify-center rounded-lg"
              >
                Sign in
              </Button>
              <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg">
                Get Started Free
              </Button>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}

/* ────────────────────────────── HERO ────────────────────────────── */

function Hero() {
  return (
    <section className="relative min-h-screen flex items-center hero-gradient overflow-hidden">
      {/* Subtle dot pattern */}
      <div className="absolute inset-0 dot-pattern opacity-40" />

      {/* Floating decorative elements */}
      <div className="absolute top-32 left-[8%] w-64 h-64 bg-emerald-200/20 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-24 right-[10%] w-80 h-80 bg-teal-200/15 rounded-full blur-3xl animate-float-delayed" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-20 lg:pt-36 lg:pb-28">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-50 border border-emerald-200/60 rounded-full mb-8">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-xs font-semibold text-emerald-700 tracking-wide uppercase">
              Built for Nigerian Legal & Property Practice
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-extrabold text-slate-900 leading-[1.08] tracking-tight mb-6">
            Draft Smarter.
            <br />
            Manage{' '}
            <span className="gradient-text">Properties</span>
            <br />
            Effortlessly.
          </h1>

          {/* Sub-headline */}
          <p className="text-lg sm:text-xl text-slate-500 max-w-2xl mx-auto mb-10 leading-relaxed">
            PracticePro brings you <strong className="text-slate-700">VEGA</strong> — AI-powered
            document drafting — and <strong className="text-slate-700">Atrium</strong> — seamless
            property management. Designed for Nigerian legal practitioners and property managers, compliant with NDPA 2023.
          </p>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Button
              size="lg"
              className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-200 hover:shadow-emerald-300 transition-all rounded-xl px-8 h-13 text-base font-semibold"
            >
              Start Free — No Card Required
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="rounded-xl px-8 h-13 text-base font-medium border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50"
            >
              <Play className="w-4 h-4 mr-2 text-emerald-600" />
              Watch Demo
            </Button>
          </div>

          {/* Stats row */}
          <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-12 text-center">
            {[
              { value: '₦ Naira', label: 'Native Billing' },
              { value: 'Print-Ready', label: 'Document Formatting' },
              { value: '99.9%', label: 'Platform Uptime' },
              { value: 'NDPA 2023', label: 'Data Compliant' },
            ].map((s) => (
              <div key={s.label} className="flex flex-col">
                <span className="text-2xl sm:text-3xl font-bold text-slate-900">{s.value}</span>
                <span className="text-xs sm:text-sm text-slate-400 font-medium mt-0.5">{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Product Preview Card */}
        <div className="mt-16 lg:mt-20 max-w-5xl mx-auto">
          <div className="relative rounded-2xl border border-slate-200/60 bg-white shadow-2xl shadow-slate-200/40 overflow-hidden">
            {/* Browser chrome */}
            <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border-b border-slate-200/60">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400/80" />
                <div className="w-3 h-3 rounded-full bg-amber-400/80" />
                <div className="w-3 h-3 rounded-full bg-emerald-400/80" />
              </div>
              <div className="flex-1 flex justify-center">
                <div className="px-4 py-1 bg-white rounded-md border border-slate-200 text-xs text-slate-400 font-mono">
                  practicepro.ng/dashboard
                </div>
              </div>
            </div>
            {/* App screenshot mockup */}
            <div className="relative h-72 sm:h-96 bg-gradient-to-br from-slate-50 to-emerald-50/30">
              {/* Sidebar mockup */}
              <div className="absolute left-0 top-0 bottom-0 w-48 sm:w-56 bg-white border-r border-slate-100 p-4 hidden sm:block">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                    <Scale className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="text-sm font-bold text-slate-800">PracticePro</span>
                </div>
                {['Dashboard', 'Documents', 'Matters', 'Properties', 'Tenants', 'Payments', 'Reports'].map(
                  (item, i) => (
                    <div
                      key={item}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm mb-0.5 ${
                        i === 0
                          ? 'bg-emerald-50 text-emerald-700 font-medium'
                          : 'text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded ${i === 0 ? 'bg-emerald-200' : 'bg-slate-200'}`} />
                      {item}
                    </div>
                  )
                )}
              </div>
              {/* Main area mockup */}
              <div className="sm:ml-56 p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <div className="h-5 w-32 bg-slate-200 rounded mb-2" />
                    <div className="h-3 w-48 bg-slate-100 rounded" />
                  </div>
                  <div className="h-9 w-28 bg-emerald-500 rounded-lg" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                  {[
                    { label: 'Active Matters', val: '47', color: 'emerald' },
                    { label: 'Documents', val: '312', color: 'teal' },
                    { label: 'Properties', val: '18', color: 'amber' },
                    { label: 'Revenue', val: '₦24.5M', color: 'emerald' },
                  ].map((card) => (
                    <div key={card.label} className="bg-white rounded-xl p-3 border border-slate-100 shadow-sm">
                      <div className="text-xs text-slate-400 mb-1">{card.label}</div>
                      <div className="text-lg font-bold text-slate-800">{card.val}</div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm h-32">
                    <div className="h-3 w-20 bg-slate-200 rounded mb-3" />
                    <div className="flex items-end gap-1 h-16">
                      {[40, 65, 50, 80, 55, 90, 70].map((h, i) => (
                        <div
                          key={i}
                          className="flex-1 bg-emerald-400/70 rounded-t"
                          style={{ height: `${h}%` }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm h-32">
                    <div className="h-3 w-24 bg-slate-200 rounded mb-3" />
                    <div className="space-y-2">
                      {['Rent collected', 'Pending invoices', 'Overdue'].map((row, i) => (
                        <div key={row} className="flex items-center gap-2">
                          <div className="h-2 flex-1 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                i === 0 ? 'bg-emerald-400 w-4/5' : i === 1 ? 'bg-amber-400 w-2/5' : 'bg-red-400 w-1/6'
                              }`}
                            />
                          </div>
                          <div className="h-2 w-8 bg-slate-100 rounded" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ────────────────────────────── TRUST BAR ────────────────────────────── */

function TrustBar() {
  const badges = [
    { icon: Shield, label: 'NDPA 2023 Compliant' },
    { icon: Scale, label: 'Regulatory Standards Aligned' },
    { icon: Globe, label: 'African Data Centers' },
    { icon: Zap, label: '99.9% Uptime SLA' },
  ]

  return (
    <section className="py-12 bg-slate-50/60 border-y border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-center text-xs font-medium text-slate-400 uppercase tracking-widest mb-6">
          Built for Nigerian legal &amp; property practice
        </p>
        <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10">
          {badges.map((b) => (
            <div key={b.label} className="flex items-center gap-2 text-slate-500 font-semibold text-sm sm:text-base">
              <b.icon className="w-4 h-4 text-emerald-600" />
              {b.label}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ────────────────────────────── FEATURES OVERVIEW ────────────────────────────── */

function FeaturesOverview() {
  const features = [
    {
      icon: Bot,
      title: 'AI Assistant',
      description:
        'Ask ARIA to draft, review, or format any Nigerian legal or property document. From originating processes to conveyances, ARIA understands Nigerian practice.',
      color: 'emerald',
    },
    {
      icon: FileText,
      title: 'True Document Pagination',
      description:
        'Professional documents with real page breaks, proper formatting, and NDPA-compliant metadata. Print or export exactly as it appears on screen.',
      color: 'teal',
    },
    {
      icon: Building2,
      title: 'Property Management',
      description:
        'Track tenants, collect rent in Naira, manage leases, and generate compliance reports. Atrium handles the complexity so you can focus on practice.',
      color: 'amber',
    },
    {
      icon: DoorOpen,
      title: 'Client & Tenant Portals',
      description:
        'Give clients real-time matter milestones and document vaults. Tenants get SC/MV ledgers, automated receipts, and maintenance ticket logging — all self-service.',
      color: 'emerald',
    },
    {
      icon: Users,
      title: 'Matter Management',
      description:
        'Organize cases by jurisdiction, court, and matter type. Link documents, parties, and deadlines in one unified workspace.',
      color: 'teal',
    },
    {
      icon: BarChart3,
      title: 'Revenue & Analytics',
      description:
        'Real-time dashboards for billable hours, payment tracking, and practice performance. Know your numbers without spreadsheets.',
      color: 'amber',
    },
  ]

  const colorMap: Record<string, { bg: string; icon: string; border: string }> = {
    emerald: {
      bg: 'bg-emerald-50',
      icon: 'text-emerald-600',
      border: 'border-emerald-100',
    },
    teal: {
      bg: 'bg-teal-50',
      icon: 'text-teal-600',
      border: 'border-teal-100',
    },
    amber: {
      bg: 'bg-amber-50',
      icon: 'text-amber-600',
      border: 'border-amber-100',
    },
  }

  return (
    <section id="features" className="py-24 lg:py-32 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <Badge variant="secondary" className="mb-4 bg-emerald-50 text-emerald-700 border-emerald-200/60 font-medium">
            Everything You Need
          </Badge>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight mb-5">
            One platform. <span className="gradient-text">Two powerful products.</span>
          </h2>
          <p className="text-lg text-slate-500 leading-relaxed">
            PracticePro combines document drafting and property management in a single,
            seamless platform purpose-built for Nigerian professionals.
          </p>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => {
            const colors = colorMap[f.color]
            return (
              <Card
                key={f.title}
                className={`card-hover border ${colors.border} bg-white rounded-xl`}
              >
                <CardContent className="p-6">
                  <div
                    className={`w-11 h-11 rounded-xl ${colors.bg} ${colors.icon} flex items-center justify-center mb-4 feature-icon-glow`}
                  >
                    <f.icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">{f.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{f.description}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/* ────────────────────────────── VEGA SECTION ────────────────────────────── */

function VegaSection() {
  const capabilities = [
    {
      icon: FileText,
      title: 'DraftPro Editor',
      desc: 'Rich-text editor with true A4 pagination, Nigerian professional fonts, and compliant formatting. What you see is what prints.',
    },
    {
      icon: Bot,
      title: 'AI Copilot',
      desc: 'AI-powered drafting assistant that understands Nigerian professional terminology, regulatory compliance, and document structures. Just ask.',
    },
    {
      icon: LayoutGrid,
      title: 'Auto-Format Rules',
      desc: 'One-click formatting for originating processes, affidavits, written addresses, and conveyances. Nigerian professional standards, automated.',
    },
    {
      icon: Users,
      title: 'Party Grouping',
      desc: 'Structured claimant and respondent listings with bracketed numbering. Format parties exactly as courts and regulators require.',
    },
    {
      icon: Sparkles,
      title: 'Smart Placeholders',
      desc: 'Fill-in-the-blank fields for variable content — court and registry names, party details, dates. Complete documents in minutes, not hours.',
    },
    {
      icon: Lock,
      title: 'Matter Vault',
      desc: 'Every document linked to its matter. Version history, access controls, and secure storage. Your evidence trail, protected.',
    },
  ]

  return (
    <section id="vega" className="py-24 lg:py-32 bg-gradient-to-b from-white via-emerald-50/20 to-white relative overflow-hidden">
      {/* Decorative */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-100/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left — Content */}
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 border border-emerald-200/60 rounded-full mb-6">
              <Scale className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">VEGA</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight mb-5">
              Document Drafting,{' '}
              <span className="gradient-text">Reimagined</span>
            </h2>
            <p className="text-lg text-slate-500 leading-relaxed mb-10">
              VEGA is your AI-powered drafting workspace. From originating processes to complex
              conveyances, draft professional documents that meet Nigerian formatting standards
              — with an AI assistant that actually understands your practice.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {capabilities.slice(0, 4).map((c) => (
                <div key={c.title} className="flex gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0 mt-0.5">
                    <c.icon className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-800 mb-0.5">{c.title}</h4>
                    <p className="text-xs text-slate-500 leading-relaxed">{c.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 flex items-center gap-4">
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-200 rounded-xl px-6">
                Try VEGA Free
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <a
                href="#pricing"
                className="text-sm font-medium text-emerald-700 hover:text-emerald-800 transition-colors"
              >
                View pricing →
              </a>
            </div>
          </div>

          {/* Right — Editor Mockup */}
          <div className="relative">
            <div className="rounded-2xl border border-slate-200/60 bg-white shadow-2xl shadow-emerald-100/30 overflow-hidden">
              {/* Toolbar mockup */}
              <div className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-50 border-b border-slate-200/60 overflow-hidden">
                {['B', 'I', 'U', 'S', '∥', '≡', '☰', '₦'].map((t, i) => (
                  <div
                    key={i}
                    className={`w-7 h-7 rounded text-xs font-bold flex items-center justify-center ${
                      i === 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-white border border-slate-200 text-slate-500'
                    }`}
                  >
                    {t}
                  </div>
                ))}
                <div className="ml-auto w-7 h-7 rounded bg-violet-100 flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5 text-violet-600" />
                </div>
              </div>

              {/* Document mockup */}
              <div className="p-6 bg-slate-100/50">
                <div className="bg-white shadow-lg rounded-lg p-8 max-w-sm mx-auto" style={{ minHeight: '380px' }}>
                  {/* Letterhead */}
                  <div className="text-center mb-6 pb-4 border-b border-slate-100">
                    <div className="h-4 w-48 bg-emerald-100 rounded mx-auto mb-1" />
                    <div className="h-2.5 w-36 bg-slate-100 rounded mx-auto" />
                  </div>
                  {/* Suit title */}
                  <div className="text-center mb-4">
                    <div className="h-3 w-56 bg-slate-800 rounded mx-auto mb-2" />
                    <div className="h-3 w-44 bg-slate-700 rounded mx-auto mb-2" />
                    <div className="h-2 w-32 bg-slate-200 rounded mx-auto" />
                  </div>
                  {/* Body lines */}
                  <div className="space-y-2 mt-6">
                    {[0.9, 1, 0.7, 1, 0.5, 0.85, 1, 0.6, 0.9, 0.4].map((w, i) => (
                      <div
                        key={i}
                        className="h-2 rounded"
                        style={{
                          width: `${w * 100}%`,
                          backgroundColor: i === 4 ? '#d1fae5' : i === 5 ? '#fef3c7' : '#f1f5f9',
                        }}
                      />
                    ))}
                  </div>
                  {/* Page number */}
                  <div className="mt-8 text-center">
                    <div className="h-2 w-12 bg-slate-200 rounded mx-auto" />
                  </div>
                </div>
              </div>
            </div>

            {/* Floating ARIA panel */}
            <div className="absolute -right-3 sm:-right-6 bottom-6 w-56 bg-white rounded-xl border border-violet-200/60 shadow-xl shadow-violet-100/20 p-3.5 animate-float-delayed">
              <div className="flex items-center gap-2 mb-2.5">
                <div className="w-6 h-6 rounded-lg bg-violet-100 flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5 text-violet-600" />
                </div>
                <span className="text-xs font-bold text-violet-700">ARIA</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                "I've formatted this as an originating process per Lagos State High Court rules. Shall I add the verification affidavit?"
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ────────────────────────────── ATRIUM SECTION ────────────────────────────── */

function AtriumSection() {
  const features = [
    {
      icon: Building2,
      title: 'Property Portfolio',
      desc: 'Manage all your properties — residential, commercial, and mixed-use — from a single dashboard. Upload photos, track occupancy, and organize by location.',
    },
    {
      icon: DoorOpen,
      title: 'Tenant Management',
      desc: 'Complete tenant profiles with KYC fields, lease agreements, and communication history. Manage tenant lifecycles from application to departure.',
    },
    {
      icon: CreditCard,
      title: 'Rent Collection',
      desc: 'Collect rent in Naira with payment reminders, receipt generation, and payment tracking. Generate invoices and track status at a glance.',
    },
    {
      icon: Receipt,
      title: 'Expense Tracking',
      desc: 'Log maintenance costs, service charges, and utility bills. Track income vs. expenses with cash flow visualizations per property.',
    },
    {
      icon: CalendarClock,
      title: 'Lease Management',
      desc: 'Lease expiry alerts and calendar integration. Send renewal notices and rent review communications. Never miss a critical date again.',
    },
    {
      icon: MessageSquare,
      title: 'Tenant Communication',
      desc: 'WhatsApp and email messaging for notices and announcements. Keep everything documented and time-stamped with automation logs.',
    },
    {
      icon: DoorOpen,
      title: 'Tenant Portal',
      desc: 'Self-service portal for tenants — view SC/MV payment status, download rent receipts, and log maintenance tickets directly into your workflow. Available on Growth and Pro plans.',
    },
  ]

  return (
    <section id="atrium" className="py-24 lg:py-32 bg-gradient-to-b from-white via-amber-50/20 to-white relative overflow-hidden">
      {/* Decorative */}
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-amber-100/30 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left — Dashboard Mockup */}
          <div className="order-2 lg:order-1">
            <div className="rounded-2xl border border-slate-200/60 bg-white shadow-2xl shadow-amber-100/20 overflow-hidden">
              {/* Dashboard header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-bold text-slate-800">Atrium</span>
                  <span className="text-xs text-slate-400 ml-2">Property Manager</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-6 w-16 bg-amber-100 rounded text-[10px] font-medium text-amber-700 flex items-center justify-center">
                    ₦ Naira
                  </div>
                </div>
              </div>

              <div className="p-5">
                {/* Stats row */}
                <div className="grid grid-cols-3 gap-3 mb-5">
                  {[
                    { label: 'Occupancy', value: '94%', sub: '+2.3%', color: 'emerald' },
                    { label: 'Revenue', value: '₦8.4M', sub: 'this month', color: 'amber' },
                    { label: 'Overdue', value: '3', sub: 'tenants', color: 'red' },
                  ].map((s) => (
                    <div key={s.label} className="bg-slate-50 rounded-xl p-3 text-center">
                      <div className="text-[10px] text-slate-400 mb-0.5">{s.label}</div>
                      <div className="text-lg font-bold text-slate-800">{s.value}</div>
                      <div className={`text-[10px] ${s.color === 'emerald' ? 'text-emerald-600' : s.color === 'amber' ? 'text-amber-600' : 'text-red-500'}`}>
                        {s.sub}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Property list */}
                <div className="space-y-2.5">
                  {[
                    { name: '14A Admiralty Way', type: 'Commercial', status: 'Occupied', rent: '₦2.5M/yr' },
                    { name: '27 Opebi Road', type: 'Residential', status: 'Occupied', rent: '₦1.8M/yr' },
                    { name: 'Suite 403, City Mall', type: 'Commercial', status: 'Vacant', rent: '₦3.2M/yr' },
                  ].map((p) => (
                    <div key={p.name} className="flex items-center gap-3 bg-white rounded-lg p-3 border border-slate-100">
                      <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                        <Building2 className="w-4 h-4 text-amber-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-slate-800 truncate">{p.name}</div>
                        <div className="text-[10px] text-slate-400">{p.type} · {p.rent}</div>
                      </div>
                      <Badge
                        variant={p.status === 'Occupied' ? 'default' : 'secondary'}
                        className={`text-[10px] px-2 py-0.5 ${
                          p.status === 'Occupied'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {p.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right — Content */}
          <div className="order-1 lg:order-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 border border-amber-200/60 rounded-full mb-6">
              <Building2 className="w-3.5 h-3.5 text-amber-600" />
              <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">ATRIUM</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight mb-5">
              Property Management,{' '}
              <span className="bg-gradient-to-r from-amber-500 to-amber-600 bg-clip-text text-transparent">
                Simplified
              </span>
            </h2>
            <p className="text-lg text-slate-500 leading-relaxed mb-10">
              Atrium takes the complexity out of property management. Track tenants, collect rent,
              manage leases, and stay compliant — all in Naira, all in one place. Whether you manage
              5 units or 500, Atrium scales with you.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {features.slice(0, 4).map((f) => (
                <div key={f.title} className="flex gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center shrink-0 mt-0.5">
                    <f.icon className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-800 mb-0.5">{f.title}</h4>
                    <p className="text-xs text-slate-500 leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 flex items-center gap-4">
              <Button className="bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-200 rounded-xl px-6">
                Try Atrium Free
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <a
                href="#pricing"
                className="text-sm font-medium text-amber-700 hover:text-amber-800 transition-colors"
              >
                View pricing →
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ────────────────────────────── PRICING ────────────────────────────── */

function PricingSection() {
  const plans = [
    {
      name: 'Core',
      price: 'Free',
      period: '',
      description: 'For solo practitioners getting started',
      features: [
        '1 User Account',
        '10 Active Matters',
        '1 GB Digital Case File Storage',
        'Billing & ledger record-keeping',
        'Client Portal — Not Included',
      ],
      cta: 'Get Started',
      popular: false,
      style: 'bg-white border-slate-200',
      btnStyle: 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50',
    },
    {
      name: 'Growth',
      price: '₦45,000',
      period: '/month',
      description: 'For growing practices',
      features: [
        'Up to 5 Users',
        'Unlimited Active Matters',
        '20 GB Digital Case File Storage',
        'Client Portal — milestones, document vault, KYC uploads',
        'AI Copilot (Standard)',
      ],
      cta: 'Start Growth Trial',
      popular: false,
      style: 'bg-white border-slate-200',
      btnStyle: 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50',
    },
    {
      name: 'Pro',
      price: '₦80,000',
      period: '/month',
      description: 'For established practices and firms',
      features: [
        'Unlimited Users',
        'Unlimited Active Matters',
        '100 GB Digital Case File Storage',
        'Uncapped Client Portal — milestones, document vault, KYC',
        'AI Copilot (Uncapped Priority)',
      ],
      cta: 'Start Pro Trial',
      popular: true,
      style: 'pricing-popular border-emerald-600',
      btnStyle: 'bg-white text-emerald-700 hover:bg-emerald-50 font-semibold',
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      period: '',
      description: 'For large firms and organizations',
      features: [
        'Unlimited Users',
        'Unlimited Matters & Storage',
        'Custom Document Archives',
        'Uncapped Client Portal (all features)',
        'Dedicated Onboarding & SLA',
      ],
      cta: 'Contact Sales',
      popular: false,
      style: 'bg-white border-slate-200',
      btnStyle: 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50',
    },
  ]

  return (
    <section id="pricing" className="py-24 lg:py-32 bg-slate-50/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <Badge variant="secondary" className="mb-4 bg-emerald-50 text-emerald-700 border-emerald-200/60 font-medium">
            Simple Pricing
          </Badge>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight mb-5">
            Start free. <span className="gradient-text">Scale as you grow.</span>
          </h2>
          <p className="text-lg text-slate-500 leading-relaxed">
            No hidden fees. No per-document charges. No surprises. VEGA plans shown below
            — Atrium property management also available.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 max-w-6xl mx-auto">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={`relative rounded-2xl border-2 ${plan.style} overflow-hidden ${
                plan.popular ? 'scale-[1.03] shadow-2xl shadow-emerald-200/40 z-10' : 'shadow-sm'
              }`}
            >
              {plan.popular && (
                <div className="absolute top-0 left-0 right-0 bg-white/20 text-center py-1.5">
                  <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                    Most Popular
                  </span>
                </div>
              )}
              <CardContent className={`p-6 ${plan.popular ? 'pt-10' : ''}`}>
                <h3
                  className={`text-lg font-bold mb-1 ${
                    plan.popular ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  {plan.name}
                </h3>
                <p
                  className={`text-sm mb-5 ${
                    plan.popular ? 'text-emerald-100' : 'text-slate-500'
                  }`}
                >
                  {plan.description}
                </p>
                <div className="flex items-baseline gap-1 mb-6">
                  <span
                    className={`text-4xl font-extrabold ${
                      plan.popular ? 'text-white' : 'text-slate-900'
                    }`}
                  >
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span
                      className={`text-sm ${
                        plan.popular ? 'text-emerald-200' : 'text-slate-400'
                      }`}
                    >
                      {plan.period}
                    </span>
                  )}
                </div>
                <Button
                  className={`w-full rounded-xl h-11 ${plan.btnStyle}`}
                >
                  {plan.cta}
                </Button>
                <ul className="mt-6 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <Check
                        className={`w-4 h-4 mt-0.5 shrink-0 ${
                          plan.popular ? 'text-emerald-200' : 'text-emerald-500'
                        }`}
                      />
                      <span
                        className={`text-sm ${
                          plan.popular ? 'text-emerald-50' : 'text-slate-600'
                        }`}
                      >
                        {f}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Guarantee */}
        <div className="mt-12 text-center">
          <div className="inline-flex items-center gap-2 text-sm text-slate-500">
            <Shield className="w-4 h-4 text-emerald-500" />
            <span>14-day free trial on Pro · No credit card required · Cancel anytime</span>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ────────────────────────────── TESTIMONIALS ────────────────────────────── */

function TestimonialsSection() {
  const testimonials = [
    {
      quote:
        'VEGA has completely transformed how we draft professional documents. The auto-formatting alone saves us hours on every originating process. The AI Copilot is like having a junior associate who never sleeps.',
      name: 'Barr. Adaeze Okonkwo',
      title: 'Managing Partner, Okonkwo & Associates',
      location: 'Lagos',
      avatar: 'AO',
    },
    {
      quote:
        'We manage over 200 rental units across Lagos and Abuja. Atrium handles everything from tenant onboarding to rent collection in Naira. Our overdue rate dropped from 30% to 8% in three months.',
      name: 'Chief Bello Adebayo',
      title: 'CEO, Adebaye Properties Ltd',
      location: 'Abuja',
      avatar: 'BA',
    },
    {
      quote:
        'The NDPA compliance features give me peace of mind. As a data protection officer, I need to know our practice\'s client data is handled properly. PracticePro does this by default.',
      name: 'Mrs. Funke Adeyemi',
      title: 'DPO, Adeyemi Consultants',
      location: 'Port Harcourt',
      avatar: 'FA',
    },
  ]

  return (
    <section id="testimonials" className="py-24 lg:py-32 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <Badge variant="secondary" className="mb-4 bg-emerald-50 text-emerald-700 border-emerald-200/60 font-medium">
            Trusted by Practitioners
          </Badge>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight mb-5">
            Hear from those who{' '}
            <span className="gradient-text">practice with us</span>
          </h2>
          <p className="text-lg text-slate-500 leading-relaxed">
            Legal practitioners and property managers across Nigeria trust PracticePro
            to run their practice efficiently.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <Card key={t.name} className="card-hover border border-slate-200/60 rounded-xl">
              <CardContent className="p-6">
                {/* Stars */}
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-sm text-slate-600 leading-relaxed mb-6 italic">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-sm font-bold">
                    {t.avatar}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-800">{t.name}</div>
                    <div className="text-xs text-slate-400">{t.title}</div>
                    <div className="text-xs text-emerald-600 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3" />
                      {t.location}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ────────────────────────────── COMPLIANCE ────────────────────────────── */

function ComplianceSection() {
  return (
    <section className="py-24 lg:py-32 bg-slate-50/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Content */}
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 border border-emerald-200/60 rounded-full mb-6">
              <Shield className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">
                Compliance
              </span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-5">
              Built for Nigeria's{' '}
              <span className="gradient-text">regulatory & data standards</span>
            </h2>
            <p className="text-lg text-slate-500 leading-relaxed mb-8">
              PracticePro isn't just adapted for Nigeria — it's built from the ground up
              to comply with Nigerian regulatory frameworks. From the NDPA 2023 to industry
              professional standards, every feature is designed with compliance in mind.
            </p>

            <div className="space-y-5">
              {[
                {
                  icon: Shield,
                  title: 'NDPA 2023 Compliant',
                  desc: 'Data processing agreements, consent management, data subject rights handling, and breach notification workflows — all built in.',
                },
                {
                  icon: Lock,
                  title: '7-Year Data Retention',
                  desc: 'Automatic retention policies for client matters, financial records, and professional documents. Configurable per practice area.',
                },
                {
                  icon: Globe,
                  title: 'Nigerian Data Residency',
                  desc: 'All data stored on African servers with full encryption at rest and in transit. Your client data never leaves the continent.',
                },
                {
                  icon: Scale,
                  title: 'Regulatory Standards',
                  desc: 'Client account rules, conflict checking, and matter management that align with Nigerian regulatory and professional body requirements.',
                },
              ].map((item) => (
                <div key={item.title} className="flex gap-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                    <item.icon className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-800 mb-0.5">{item.title}</h4>
                    <p className="text-sm text-slate-500 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Compliance visual */}
          <div className="relative">
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <Shield className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <div className="font-bold text-slate-800">Compliance Dashboard</div>
                  <div className="text-xs text-emerald-600 font-medium">All checks passing</div>
                </div>
              </div>

              <div className="space-y-3">
                {[
                  { label: 'NDPA Data Processing', status: 'Compliant', pct: 100 },
                  { label: 'Client Consent Records', status: 'Up to date', pct: 98 },
                  { label: '7-Year Retention', status: 'Active', pct: 100 },
                  { label: 'Access Controls', status: 'Verified', pct: 100 },
                  { label: 'Encryption at Rest', status: 'AES-256', pct: 100 },
                  { label: 'Audit Trail', status: 'Recording', pct: 100 },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                      <Check className="w-3 h-3 text-emerald-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-slate-700">{item.label}</span>
                        <span className="text-[10px] text-emerald-600 font-medium">{item.status}</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-400 rounded-full transition-all duration-1000"
                          style={{ width: `${item.pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ────────────────────────────── FAQ ────────────────────────────── */

function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const faqs = [
    {
      q: 'Is PracticePro only for Nigerian legal practitioners?',
      a: 'PracticePro is purpose-built for the Nigerian market. Our templates, formatting rules, and compliance features are designed specifically for Nigerian courts, regulatory standards, and NDPA 2023 requirements. However, the document editor and property management tools can be used by practitioners in other jurisdictions as well.',
    },
    {
      q: 'Do I need to pay separately for VEGA and Atrium?',
      a: 'No. Every PracticePro plan includes both VEGA (document drafting) and Atrium (property management). You get the complete platform — there are no hidden add-on costs for individual products.',
    },
    {
      q: 'How does ARIA, the AI assistant, work?',
      a: 'ARIA is built into the VEGA document editor. You can ask it to draft documents, apply Nigerian professional formatting, review content for completeness, or suggest improvements. ARIA understands Nigerian professional terminology, regulatory structures, and document conventions. It runs entirely within PracticePro — your data never leaves our secure environment.',
    },
    {
      q: 'Is my client data safe and NDPA-compliant?',
      a: 'Absolutely. PracticePro is built with NDPA 2023 compliance as a core requirement, not an afterthought. All data is encrypted at rest (AES-256) and in transit (TLS 1.3), stored on African servers, and subject to automatic retention policies. We provide data processing agreements, consent management tools, and full audit trails.',
    },
    {
      q: 'Can I import my existing documents and templates?',
      a: 'Yes. PracticePro supports importing .docx files directly into the VEGA editor. Your formatting, styles, and content are preserved. You can also save frequently used documents as templates for your practice.',
    },
    {
      q: 'What happens after the 14-day Pro trial?',
      a: 'After your trial ends, you can choose to subscribe to Pro or move to our Free plan. Your documents and data are always yours — we never delete your work. If you decide not to continue with Pro, you can export everything at any time.',
    },
  ]

  return (
    <section className="py-24 lg:py-32 bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-5">
            Frequently asked questions
          </h2>
          <p className="text-lg text-slate-500">
            Everything you need to know about PracticePro.
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="border border-slate-200/60 rounded-xl overflow-hidden"
            >
              <button
                className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-slate-50/50 transition-colors"
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
              >
                <span className="text-sm font-semibold text-slate-800 pr-4">{faq.q}</span>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                    openIndex === i ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {openIndex === i && (
                <div className="px-6 pb-4 pt-0">
                  <p className="text-sm text-slate-500 leading-relaxed">{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ────────────────────────────── CTA ────────────────────────────── */

function CTASection() {
  return (
    <section className="py-24 lg:py-32 bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-700 relative overflow-hidden">
      {/* Decorative circles */}
      <div className="absolute top-0 left-0 w-72 h-72 bg-emerald-500/30 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-teal-500/20 rounded-full blur-3xl translate-x-1/3 translate-y-1/3" />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight mb-5">
          Ready to transform your practice?
        </h2>
        <p className="text-lg text-emerald-100 max-w-2xl mx-auto mb-10 leading-relaxed">
          Join over 2,400 Nigerian professionals who draft faster, manage smarter,
          and stay compliant with PracticePro. Start free today.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button
            size="lg"
            className="bg-white text-emerald-700 hover:bg-emerald-50 shadow-xl shadow-emerald-900/20 rounded-xl px-8 h-13 text-base font-semibold"
          >
            Get Started Free
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="border-emerald-400/40 text-white hover:bg-emerald-600/50 rounded-xl px-8 h-13 text-base font-medium"
          >
            <Phone className="w-4 h-4 mr-2" />
            Talk to Sales
          </Button>
        </div>
        <p className="mt-6 text-sm text-emerald-200/80">
          No credit card required · Free plan available · 14-day Pro trial
        </p>
      </div>
    </section>
  )
}

/* ────────────────────────────── FOOTER ────────────────────────────── */

function Footer() {
  const columns = [
    {
      title: 'Product',
      links: [
        { label: 'VEGA', href: '#vega' },
        { label: 'Atrium', href: '#atrium' },
        { label: 'Features', href: '/features' },
        { label: 'Pricing', href: '#pricing' },
        { label: 'Changelog', href: '#' },
      ],
    },
    {
      title: 'Portals',
      links: [
        { label: 'Client Portal', href: '/portal/client/login' },
        { label: 'Tenant Portal (Atrium)', href: '/portal/tenant/login' },
      ],
    },
    {
      title: 'Resources',
      links: [
        { label: 'Documentation', href: '#' },
        { label: 'API Reference', href: '#' },
        { label: 'Blog', href: '#' },
        { label: 'Community', href: '#' },
        { label: 'Status', href: '#' },
      ],
    },
    {
      title: 'Company',
      links: [
        { label: 'About', href: '#' },
        { label: 'Careers', href: '#' },
        { label: 'Contact', href: '#' },
        { label: 'Partners', href: '#' },
        { label: 'Press', href: '#' },
      ],
    },
    {
      title: 'Legal',
      links: [
        { label: 'Privacy Policy', href: '#' },
        { label: 'Terms of Service', href: '#' },
        { label: 'NDPA Compliance', href: '#' },
        { label: 'Data Processing', href: '#' },
        { label: 'Cookie Policy', href: '#' },
      ],
    },
  ]

  return (
    <footer className="bg-slate-900 text-slate-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <Scale className="w-4.5 h-4.5 text-white" />
              </div>
              <span className="text-lg font-bold text-white tracking-tight">
                Practice<span className="text-emerald-400">Pro</span>
              </span>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed mb-4">
              Legal & property practice management, purpose-built for Nigeria.
            </p>
            <div className="flex gap-3">
              <a href="#" className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition-colors" aria-label="Twitter">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </a>
              <a href="#" className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition-colors" aria-label="LinkedIn">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
              </a>
              <a href="#" className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition-colors" aria-label="GitHub">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
              </a>
            </div>
          </div>

          {/* Link columns */}
          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="text-sm font-semibold text-white mb-4">{col.title}</h4>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-slate-400 hover:text-emerald-400 transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()} PracticePro. All rights reserved.
          </p>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Shield className="w-3 h-3 text-emerald-500" />
              NDPA 2023 Compliant
            </span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <Globe className="w-3 h-3 text-emerald-500" />
              African Data Centers
            </span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <Scale className="w-3 h-3 text-emerald-500" />
              Regulatory Standards Aligned
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}

/* ────────────────────────────── PAGE ────────────────────────────── */

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />
      <main className="flex-1">
        <Hero />
        <TrustBar />
        <FeaturesOverview />
        <VegaSection />
        <AtriumSection />
        <ComplianceSection />
        <PricingSection />
        <TestimonialsSection />
        <FAQSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  )
}
