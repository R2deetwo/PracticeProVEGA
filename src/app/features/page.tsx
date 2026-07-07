'use client'

import React, { useState } from 'react'
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
  Lock,
  Sparkles,
  LayoutGrid,
  Receipt,
  CalendarClock,
  DoorOpen,
  MessageSquare,
  Bell,
  Clock,
  FolderOpen,
  Milestone,
  Landmark,
} from 'lucide-react'
import Link from 'next/link'

/* ────────────────────────────── VEGA FEATURES ────────────────────────────── */

const vegaFeatures = [
  {
    category: 'Matter Management',
    icon: Scale,
    color: 'emerald',
    items: [
      {
        title: 'Matter Management',
        desc: 'Organize matters by court, jurisdiction, and matter type. Link documents, parties, and deadlines in a unified workspace with custom matter IDs and court rule templates.',
        icon: FileText,
      },
      {
        title: 'Task Board',
        desc: 'Kanban-style task management with assignments, due dates, priority levels, and matter linking. Track every deliverable from intake to resolution.',
        icon: CalendarClock,
      },
      {
        title: 'Client Portal',
        desc: 'Self-service portal for clients to view matter milestones, access documents from a secure vault, and submit KYC uploads. Available on Growth and Pro plans.',
        icon: DoorOpen,
        badge: 'Growth+',
      },
      {
        title: 'Contacts & Parties',
        desc: 'Structured contact management with party grouping, witness tracking, and counsel records. Link contacts to matters and documents automatically.',
        icon: Users,
      },
    ],
  },
  {
    category: 'Legal Drafting',
    icon: Sparkles,
    color: 'violet',
    items: [
      {
        title: 'DraftPro Editor',
        desc: 'Rich-text legal editor with true A4 pagination, Nigerian legal fonts, and court-compliant formatting. What you see is what prints — no reformatting required.',
        icon: LayoutGrid,
      },
      {
        title: 'VEGA AI Copilot',
        desc: 'AI-powered drafting assistant built on Gemini, trained for Nigerian legal terminology, court rules, and document structures. Draft originating processes, affidavits, and conveyances with natural language instructions.',
        icon: Bot,
        badge: 'Growth+',
      },
      {
        title: 'Document Vault',
        desc: 'Secure document storage linked to every matter. Version history, access controls, NDPA-compliant metadata, and full-text search across your practice\'s document library.',
        icon: FolderOpen,
      },
      {
        title: 'Research Studio',
        desc: 'Legal research workspace with jurisdiction-specific modules, statute lookup, and AI-assisted case analysis. Build research notebooks with source citations.',
        icon: Scale,
        badge: 'Growth+',
      },
    ],
  },
  {
    category: 'Billing & Finance',
    icon: CreditCard,
    color: 'amber',
    items: [
      {
        title: 'Legal Billing',
        desc: 'Generate professional invoices with sequential numbering (INV-[FirmInitials][ManagerInitials]-[Seq]). Track billable hours, apply court-aligned rates, and automate retainer billing.',
        icon: Receipt,
      },
      {
        title: 'Financial Dashboard',
        desc: 'Real-time revenue analytics, outstanding balances, and payment tracking. See which matters are profitable, which clients are overdue, and where your practice stands financially.',
        icon: BarChart3,
        badge: 'Pro',
      },
      {
        title: 'Bank Transfer Payments',
        desc: 'Honest payment workflow with Nigerian bank account details displayed on invoices. No pretend card forms — clients transfer directly to your practice\'s account.',
        icon: CreditCard,
      },
    ],
  },
]

/* ────────────────────────────── ATRIUM FEATURES ────────────────────────────── */

const atriumFeatures = [
  {
    category: 'Property Management',
    icon: Building2,
    color: 'amber',
    items: [
      {
        title: 'Property Portfolio',
        desc: 'Manage residential, commercial, and mixed-use properties from a single dashboard. Track occupancy, upload photos, organize by location, and link to tenancy records.',
        icon: Building2,
      },
      {
        title: 'Tenant Management',
        desc: 'Complete tenant profiles with KYC fields, lease agreements, and communication history. Manage tenant lifecycles from application through to departure.',
        icon: Users,
      },
      {
        title: 'Tenant Portal',
        desc: 'Self-service portal where tenants view SC/MV payment status, download rent receipts, and log maintenance tickets directly into your workflow. Available on Growth and Pro plans.',
        icon: DoorOpen,
        badge: 'Growth+',
      },
      {
        title: 'Revenue Monitor',
        desc: 'Real-time defaulter dashboard, rent collection tracking, and portfolio-level financial analytics. Know which tenants are overdue and which properties are underperforming.',
        icon: BarChart3,
      },
    ],
  },
  {
    category: 'Rent & Collections',
    icon: CreditCard,
    color: 'emerald',
    items: [
      {
        title: 'Rent Collection',
        desc: 'Collect rent in Naira with payment reminders, receipt generation, and payment tracking. Generate invoices and track status at a glance.',
        icon: CreditCard,
      },
      {
        title: 'Service Charge Tracking',
        desc: 'Itemized SC (Service Charge) and MV (Minimum Vend) tracking per unit. Monitor payment status, flag defaulters, and generate compliance-ready financial reports.',
        icon: Receipt,
      },
      {
        title: 'WhatsApp Automation',
        desc: 'Automated rent reminders and demand notices via WhatsApp. Tiered volume limits with morning notification throttles on Pro plans.',
        icon: MessageSquare,
        badge: 'Pro',
      },
      {
        title: 'Lease Management',
        desc: 'Lease expiry alerts and calendar integration. Send renewal notices and rent review communications. Never miss a critical date again.',
        icon: CalendarClock,
      },
    ],
  },
  {
    category: 'Maintenance & Operations',
    icon: Shield,
    color: 'teal',
    items: [
      {
        title: 'Maintenance Tickets',
        desc: 'Tenants log issues directly into your workflow via the portal. Categorize by plumbing, electrical, structural, or other. Track status from open to resolved.',
        icon: Bell,
      },
      {
        title: 'Expense Tracking',
        desc: 'Log maintenance costs, service charges, and utility bills per property. Track income vs. expenses with cash flow visualizations.',
        icon: BarChart3,
      },
      {
        title: 'Legal Document Generation',
        desc: 'Pro plan includes automated generation of notices, demands, and other legal documents tailored to Nigerian property law.',
        icon: FileText,
        badge: 'Pro',
      },
    ],
  },
]

/* ────────────────────────────── SECURITY & COMPLIANCE ────────────────────────────── */

const securityFeatures = [
  { icon: Shield, title: 'NDPA 2023 Compliant', desc: 'Data processing agreements, consent management, data subject rights handling, and breach notification workflows — all built in from day one.' },
  { icon: Lock, title: 'AES-256 Encryption at Rest', desc: 'All data encrypted at rest using AES-256. Client files, financial records, and personal data are protected to banking-grade standards.' },
  { icon: Scale, title: 'ISO 27001 Aligned', desc: 'Information security management practices aligned with ISO 27001 standards. Regular security reviews and access control audits.' },
  { icon: Landmark, title: 'Nigerian Data Residency', desc: 'All data stored on African servers with full encryption in transit (TLS 1.3). Your client and tenant data never leaves the continent.' },
  { icon: Clock, title: '7-Year Data Retention', desc: 'Automatic retention policies for client matters, financial records, and legal documents. Configurable per practice area to meet regulatory requirements.' },
  { icon: Bell, title: 'Breach Notification', desc: 'Automated 72-hour breach notification workflows compliant with NDPA Section 40. Full audit trails for every data access event.' },
]

/* ────────────────────────────── COMPONENT HELPERS ────────────────────────────── */

const colorMap: Record<string, { bg: string; icon: string; border: string; text: string }> = {
  emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600', border: 'border-emerald-100', text: 'text-emerald-700' },
  teal: { bg: 'bg-teal-50', icon: 'text-teal-600', border: 'border-teal-100', text: 'text-teal-700' },
  amber: { bg: 'bg-amber-50', icon: 'text-amber-600', border: 'border-amber-100', text: 'text-amber-700' },
  violet: { bg: 'bg-violet-50', icon: 'text-violet-600', border: 'border-violet-100', text: 'text-violet-700' },
}

function FeatureCard({ title, desc, icon: FeatureIcon, color, badge }: { title: string; desc: string; icon: any; color: string; badge?: string }) {
  const c = colorMap[color] || colorMap.emerald
  return (
    <Card className={`border ${c.border} bg-white rounded-xl hover:shadow-lg transition-shadow`}>
      <CardContent className="p-6">
        <div className={`w-11 h-11 rounded-xl ${c.bg} ${c.icon} flex items-center justify-center mb-4`}>
          <FeatureIcon className="w-5 h-5" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-2">
          {title}
          {badge && (
            <span className="ml-2 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-100 text-blue-600 border border-blue-200">
              {badge}
            </span>
          )}
        </h3>
        <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
      </CardContent>
    </Card>
  )
}

/* ────────────────────────────── MAIN PAGE ────────────────────────────── */

export default function FeaturesPage() {
  const [activeProduct, setActiveProduct] = useState<'vega' | 'atrium'>('vega')

  const features = activeProduct === 'vega' ? vegaFeatures : atriumFeatures

  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md">
                <Scale className="w-4.5 h-4.5 text-white" />
              </div>
              <span className="text-lg font-bold text-slate-900 tracking-tight">
                Practice<span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">Pro</span>
              </span>
            </Link>
            <div className="flex items-center gap-3">
              <Link href="/#pricing" className="text-sm font-medium text-slate-600 hover:text-emerald-700 transition-colors">Pricing</Link>
              <Link href="/">
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-200 rounded-lg px-5">
                  Get Started Free <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-28 pb-16 lg:pt-36 lg:pb-24 bg-gradient-to-b from-emerald-50/40 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Badge variant="secondary" className="mb-4 bg-emerald-50 text-emerald-700 border-emerald-200/60 font-medium">
            Feature Deep-Dive
          </Badge>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight mb-5">
            Everything your practice needs,{' '}
            <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
              nothing it doesn&apos;t
            </span>
          </h1>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto leading-relaxed mb-10">
            PracticePro combines AI-powered legal drafting with institutional-grade property management.
            Explore the full feature set for both products below.
          </p>

          {/* Product Toggle */}
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
            <button
              onClick={() => setActiveProduct('vega')}
              className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                activeProduct === 'vega'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              VEGA — Legal
            </button>
            <button
              onClick={() => setActiveProduct('atrium')}
              className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                activeProduct === 'atrium'
                  ? 'bg-white text-amber-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Atrium — Property
            </button>
          </div>
        </div>
      </section>

      {/* Product Features */}
      <section className="py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {features.map((category) => {
            const c = colorMap[category.color] || colorMap.emerald
            return (
              <div key={category.category} className="mb-16 last:mb-0">
                <div className="flex items-center gap-3 mb-8">
                  <div className={`w-10 h-10 rounded-xl ${c.bg} ${c.icon} flex items-center justify-center`}>
                    <category.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">{category.category}</h2>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {category.items.map((item: any) => (
                    <FeatureCard key={item.title} {...item} color={category.color} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Security & Compliance */}
      <section className="py-16 lg:py-24 bg-slate-50/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <Badge variant="secondary" className="mb-4 bg-emerald-50 text-emerald-700 border-emerald-200/60">
              Security
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-4">
              Security &{' '}
              <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">Compliance</span>
            </h2>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto">
              Built from the ground up for Nigeria&apos;s data protection and legal regulatory requirements.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {securityFeatures.map((f) => (
              <Card key={f.title} className="border border-slate-200/60 bg-white rounded-xl hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
                    <f.icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">{f.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 lg:py-24 bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-700 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-72 h-72 bg-emerald-500/30 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-teal-500/20 rounded-full blur-3xl translate-x-1/3 translate-y-1/3" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight mb-5">
            Ready to transform your practice?
          </h2>
          <p className="text-lg text-emerald-100 max-w-2xl mx-auto mb-10 leading-relaxed">
            Join thousands of Nigerian legal practitioners and property managers who trust PracticePro.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/">
              <Button size="lg" className="bg-white text-emerald-700 hover:bg-emerald-50 shadow-lg rounded-xl px-8 h-13 text-base font-semibold">
                Start Free — No Card Required
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <Link href="/#pricing">
              <Button size="lg" variant="outline" className="rounded-xl px-8 h-13 text-base font-medium border-white/20 text-white hover:bg-white/10">
                View Pricing
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-white/5 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-600">&copy; {new Date().getFullYear()} PracticePro Tech Ltd. Lagos, Nigeria.</p>
          <p className="text-xs text-slate-700">ISO 27001 Aligned &middot; NDPA 2023 Compliant &middot; TLS Encrypted</p>
        </div>
      </footer>
    </div>
  )
}
