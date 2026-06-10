#!/usr/bin/env python3
"""
Generate: Revenue Monitor — Enterprise Feature Gate Prompt (PDF)
For handoff to Ati Gravity platform for implementation.
"""

import os, sys
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch, cm
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.lib import colors
from reportlab.platypus import (
    Paragraph, Spacer, Table, TableStyle, PageBreak,
    KeepTogether, SimpleDocTemplate, HRFlowable
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily

# ── Font Registration ──────────────────────────────────────────────────────
pdfmetrics.registerFont(TTFont('LiberationSerif', '/usr/share/fonts/truetype/chinese/LiberationSerif-Regular.ttf'))
pdfmetrics.registerFont(TTFont('LiberationSerif-Bold', '/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf'))
pdfmetrics.registerFont(TTFont('Carlito', '/usr/share/fonts/truetype/english/Carlito-Regular.ttf'))
pdfmetrics.registerFont(TTFont('Carlito-Bold', '/usr/share/fonts/truetype/english/Carlito-Bold.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans', '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'))
registerFontFamily('LiberationSerif', normal='LiberationSerif', bold='LiberationSerif-Bold')
registerFontFamily('Carlito', normal='Carlito', bold='Carlito-Bold')
registerFontFamily('DejaVuSans', normal='DejaVuSans', bold='DejaVuSans')

# ── Palette ────────────────────────────────────────────────────────────────
ACCENT       = colors.HexColor('#4f2eb0')
TEXT_PRIMARY  = colors.HexColor('#222526')
TEXT_MUTED    = colors.HexColor('#757d81')
BG_SURFACE   = colors.HexColor('#dae0e3')
BG_PAGE      = colors.HexColor('#edeff1')

TABLE_HEADER_COLOR = ACCENT
TABLE_HEADER_TEXT  = colors.white
TABLE_ROW_EVEN     = colors.white
TABLE_ROW_ODD      = BG_SURFACE

# ── Page Setup ─────────────────────────────────────────────────────────────
OUTPUT_PATH = '/home/z/my-project/download/Revenue_Monitor_Enterprise_Gate_Prompt.pdf'
PAGE_W, PAGE_H = A4
LEFT_M = 0.9 * inch
RIGHT_M = 0.9 * inch
TOP_M = 0.7 * inch
BOTTOM_M = 0.7 * inch
CONTENT_W = PAGE_W - LEFT_M - RIGHT_M

# ── Styles ─────────────────────────────────────────────────────────────────
sTitle = ParagraphStyle(
    'DocTitle', fontName='LiberationSerif', fontSize=26, leading=32,
    textColor=ACCENT, alignment=TA_LEFT, spaceAfter=4
)
sSubtitle = ParagraphStyle(
    'DocSubtitle', fontName='LiberationSerif', fontSize=13, leading=18,
    textColor=TEXT_MUTED, alignment=TA_LEFT, spaceAfter=18
)
sH1 = ParagraphStyle(
    'H1', fontName='LiberationSerif', fontSize=18, leading=24,
    textColor=ACCENT, spaceBefore=18, spaceAfter=8
)
sH2 = ParagraphStyle(
    'H2', fontName='LiberationSerif', fontSize=14, leading=19,
    textColor=TEXT_PRIMARY, spaceBefore=14, spaceAfter=6
)
sH3 = ParagraphStyle(
    'H3', fontName='LiberationSerif', fontSize=12, leading=16,
    textColor=TEXT_PRIMARY, spaceBefore=10, spaceAfter=4
)
sBody = ParagraphStyle(
    'Body', fontName='LiberationSerif', fontSize=10.5, leading=17,
    textColor=TEXT_PRIMARY, alignment=TA_JUSTIFY, spaceAfter=6
)
sBodyLeft = ParagraphStyle(
    'BodyLeft', fontName='LiberationSerif', fontSize=10.5, leading=17,
    textColor=TEXT_PRIMARY, alignment=TA_LEFT, spaceAfter=4
)
sBullet = ParagraphStyle(
    'Bullet', fontName='LiberationSerif', fontSize=10.5, leading=17,
    textColor=TEXT_PRIMARY, alignment=TA_LEFT, spaceAfter=3,
    leftIndent=18, bulletIndent=6
)
sCode = ParagraphStyle(
    'Code', fontName='DejaVuSans', fontSize=8.5, leading=13,
    textColor=colors.HexColor('#1a1a2e'), alignment=TA_LEFT, spaceAfter=6,
    leftIndent=12, backColor=colors.HexColor('#f4f4f8')
)
sCallout = ParagraphStyle(
    'Callout', fontName='LiberationSerif', fontSize=10, leading=15,
    textColor=colors.HexColor('#4f2eb0'), alignment=TA_LEFT, spaceAfter=6,
    leftIndent=14, borderPadding=6, borderWidth=0
)
sTableHead = ParagraphStyle(
    'TableHead', fontName='LiberationSerif', fontSize=9.5, leading=13,
    textColor=colors.white, alignment=TA_CENTER
)
sTableCell = ParagraphStyle(
    'TableCell', fontName='LiberationSerif', fontSize=9, leading=13,
    textColor=TEXT_PRIMARY, alignment=TA_LEFT
)
sTableCellC = ParagraphStyle(
    'TableCellC', fontName='LiberationSerif', fontSize=9, leading=13,
    textColor=TEXT_PRIMARY, alignment=TA_CENTER
)
sFooter = ParagraphStyle(
    'Footer', fontName='LiberationSerif', fontSize=8, leading=10,
    textColor=TEXT_MUTED, alignment=TA_CENTER
)

# ── Helpers ────────────────────────────────────────────────────────────────
def h1(text):
    return Paragraph(f'<b>{text}</b>', sH1)

def h2(text):
    return Paragraph(f'<b>{text}</b>', sH2)

def h3(text):
    return Paragraph(f'<b>{text}</b>', sH3)

def p(text):
    return Paragraph(text, sBody)

def pl(text):
    return Paragraph(text, sBodyLeft)

def bullet(text):
    return Paragraph(f'<bullet>&bull;</bullet> {text}', sBullet)

def code(text):
    return Paragraph(text, sCode)

def callout(text):
    return Paragraph(f'<b>IMPORTANT:</b> {text}', sCallout)

def hr():
    return HRFlowable(width='100%', thickness=0.5, color=BG_SURFACE, spaceAfter=8, spaceBefore=8)

def make_table(headers, rows, col_widths=None):
    """Build a styled table with header + rows."""
    data = [[Paragraph(f'<b>{h}</b>', sTableHead) for h in headers]]
    for row in rows:
        data.append([Paragraph(str(c), sTableCell) for c in row])
    if col_widths is None:
        col_widths = [CONTENT_W / len(headers)] * len(headers)
    t = Table(data, colWidths=col_widths, hAlign='CENTER')
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER_COLOR),
        ('TEXTCOLOR', (0, 0), (-1, 0), TABLE_HEADER_TEXT),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('GRID', (0, 0), (-1, -1), 0.5, TEXT_MUTED),
    ]
    for i in range(1, len(data)):
        bg = TABLE_ROW_EVEN if i % 2 == 1 else TABLE_ROW_ODD
        style_cmds.append(('BACKGROUND', (0, i), (-1, i), bg))
    t.setStyle(TableStyle(style_cmds))
    return t

# ── Build Document ─────────────────────────────────────────────────────────
doc = SimpleDocTemplate(
    OUTPUT_PATH, pagesize=A4,
    leftMargin=LEFT_M, rightMargin=RIGHT_M,
    topMargin=TOP_M, bottomMargin=BOTTOM_M,
    title='Revenue Monitor - Enterprise Feature Gate Prompt',
    author='Z.ai', creator='Z.ai',
    subject='Implementation prompt for wiring Revenue Monitor behind Custom/Enterprise tier gate'
)

story = []

# ── Title Block ────────────────────────────────────────────────────────────
story.append(Spacer(1, 18))
story.append(Paragraph('<b>Revenue Monitor: Enterprise Feature Gate</b>', sTitle))
story.append(Paragraph('Implementation Prompt for Ati Gravity', sSubtitle))
story.append(hr())
story.append(Paragraph(
    'This document provides the complete specification for wiring the Revenue Monitor (Atrium Revenue Engine) '
    'so that it is fully functional and data-hydrated, but accessible <b>only to firms on the Custom/Enterprise tier</b>. '
    'Lower-tier firms (Starter/Core, Growth, Pro) will see the Revenue Monitor navigation item, but clicking it will surface '
    'an upgrade prompt rather than the full feature. This approach ensures the Revenue Monitor is "built out completely" '
    'and properly wired up, while preserving its value as a premium differentiator for enterprise clients. The document '
    'is structured to be handed directly to the Ati Gravity platform for implementation, with precise file references, '
    'code patterns, acceptance criteria, and risk considerations.', sBody))
story.append(Spacer(1, 12))

# ── Section 1: Current State ──────────────────────────────────────────────
story.append(h1('1. Current State of the Revenue Monitor'))

story.append(p(
    'The Revenue Monitor (internally named <b>RevenueEngine</b>) is a five-tab property management dashboard that '
    'provides service charge tracking, financial ledger management, a unified inbox, automation centre, and a vacancy '
    'pipeline. It is the centrepiece of the Atrium product and the primary reason an enterprise property firm would '
    'upgrade from a lower tier. However, several critical gaps currently prevent it from functioning for real (non-demo) '
    'users, and there is no tier-level gate controlling access.'
))

story.append(h2('1.1 What Works'))
story.append(bullet('The UI shell is fully built: <b>RevenueEngine.tsx</b> renders five tabs (Service Charges, Payments and Receipts, Unified Inbox, Automation Centre, Available Units) with KPI stats, badges, and responsive layout.'))
story.append(bullet('The Convex backend is complete: <b>convex/sentry.ts</b> contains working mutations and queries for all five revenue tables (ledger_entries, service_charges, leads_pipeline, automation_logs, atrium_inbound_messages).'))
story.append(bullet('The Convex schema defines all five tables with proper indexes (by_firm, by_unit, by_status, by_timestamp, etc.) in <b>convex/schema.ts</b>.'))
story.append(bullet('Navigation exists: the Sidebar shows a RevenueEngineNavItem for property-mode firms, and BottomNav has a "Revenue" tab.'))
story.append(bullet('A <b>FeatureGuard</b> already gates access to property-mode firms only (requiredProduct="property").'))

story.append(h2('1.2 What Is Broken or Missing'))
story.append(bullet('<b>No tier-level gate:</b> Any property firm, regardless of plan (Starter/Core through Enterprise), can access the full Revenue Monitor. There is no canUseRevenueMonitor flag in the useFeatures hook.'))
story.append(bullet('<b>Revenue data is never hydrated for real users:</b> The getFirmData query in convex/myFunctions.ts fetches 29 tables but does NOT include ledger_entries, service_charges, leads_pipeline, or automation_logs. These arrays are always empty for non-demo users, even though the Convex tables exist and have data.'))
story.append(bullet('<b>Only AtriumInbox works around this:</b> AtriumInbox.tsx bypasses coreState by calling useQuery(api.sentry.getInboundMessages) directly. The other four tabs (ServiceChargeMonitor, LedgerManager, AutomationCenter, VacancyPipeline) read from coreState, which is always empty.'))
story.append(bullet('<b>No backend tier enforcement:</b> The sentry.ts mutations (addLedgerEntry, upsertServiceCharge, etc.) do not check the firm subscription plan before writing. A Starter-tier firm could theoretically write ledger entries.'))
story.append(bullet('<b>SubscriptionPlan enum inconsistency:</b> types.ts defines SubscriptionPlan with Core, Growth, Pro, Ultimate, and Enterprise. But tiers.ts defines TierId as Core, Growth, Pro, and Enterprise (no Ultimate). This causes confusion in tier checks.'))

story.append(Spacer(1, 10))

# ── Section 2: Architecture of the Tier Gate ──────────────────────────────
story.append(h1('2. Architecture of the Enterprise Tier Gate'))

story.append(p(
    'The goal is to make the Revenue Monitor fully functional and data-hydrated, but accessible only to Custom/Enterprise-tier firms. '
    'Lower-tier firms should see the Revenue Monitor in navigation (as a teaser), but clicking it should display an upgrade prompt. '
    'This creates a natural upsell path without hiding the feature entirely. The implementation follows existing patterns in the codebase: '
    'the useFeatures hook for frontend entitlement checks, the FeatureGuard component for product-level gates, and backend ATRIUM_LIMITS for server-side enforcement.'
))

story.append(h2('2.1 Tier Gate Layers'))

story.append(make_table(
    ['Layer', 'Mechanism', 'Location', 'Purpose'],
    [
        ['Frontend Entitlement', 'canUseRevenueMonitor boolean in useFeatures hook', 'src/hooks/useFeatures.ts', 'Controls UI rendering and upgrade prompts'],
        ['Navigation Guard', 'Conditional rendering of nav items + upgrade CTA', 'src/components/Sidebar.tsx, BottomNav.tsx', 'Shows nav item but redirects non-Enterprise to upgrade'],
        ['Route Guard', 'TierGuard wrapper around RevenueEngine route', 'src/App.tsx (atriumEngine case)', 'Blocks direct URL access for non-Enterprise firms'],
        ['Backend Enforcement', 'Subscription plan check in sentry.ts mutations', 'convex/sentry.ts', 'Prevents API-level data manipulation by non-Enterprise firms'],
        ['Data Hydration', 'Dedicated Convex queries per sub-component', 'Each Atrium sub-component', 'Feeds real data from Convex tables to Enterprise users'],
    ],
    col_widths=[CONTENT_W*0.14, CONTENT_W*0.28, CONTENT_W*0.28, CONTENT_W*0.30]
))

story.append(Spacer(1, 10))

story.append(h2('2.2 Entitlement Logic'))
story.append(p(
    'The canUseRevenueMonitor flag should be defined in <b>src/hooks/useFeatures.ts</b> alongside the existing feature gates. '
    'The logic should mirror the existing canUseAutomation gate, which is already Enterprise-only. For Atrium/Property firms, '
    'the Revenue Monitor is the premium revenue management suite and should only unlock at the Enterprise/Custom tier. For '
    'Vega/Legal-only firms, it should remain inaccessible regardless of plan (the existing FeatureGuard handles product-level gating).'
))

story.append(code(
    '// In src/hooks/useFeatures.ts, add:\n'
    'canUseRevenueMonitor: isEnterprise,  // Enterprise/Custom only\n'
    '\n'
    '// Also add to checkFeatureAccess switch:\n'
    "case 'revenue_monitor': return isEnterprise;"
))

story.append(Spacer(1, 6))
story.append(callout(
    'The isEnterprise variable is already computed in useFeatures as: '
    'isEnterprise = plan === SubscriptionPlan.Enterprise. Since the user mentioned "Custom/Enterprise", '
    'and the ATRIUM_TIERS defines Enterprise as "Custom" pricing, this single check covers both labels. '
    'No additional tier level is needed.'
))

story.append(Spacer(1, 10))

# ── Section 3: Data Hydration Strategy ────────────────────────────────────
story.append(h1('3. Data Hydration Strategy'))

story.append(p(
    'This is the most critical part of wiring the Revenue Monitor properly. Currently, the four main sub-components '
    '(ServiceChargeMonitor, LedgerManager, AutomationCenter, VacancyPipeline) all read from coreState, which is populated '
    'by getFirmData. However, getFirmData does NOT fetch from the revenue tables. The solution must hydrate these components '
    'with real Convex data without overloading the initial app load for non-Enterprise firms.'
))

story.append(h2('3.1 Recommended Approach: Dedicated Convex Queries Per Component'))

story.append(p(
    'Rather than adding all five revenue tables to the already-heavy getFirmData query (which already fetches 29 tables and '
    'can take 2-5 seconds for large firms), the recommended approach is to add dedicated Convex queries inside each '
    'sub-component, following the pattern already established by AtriumInbox. This approach has several advantages: it avoids '
    'increasing the initial page load for all users; it only fetches data when an Enterprise user actually navigates to the '
    'Revenue Monitor; it is consistent with the Phase 2 data-loading strategy (chatMessages, firmActivity, and researchMessages '
    'were already moved to dedicated queries); and it allows each component to paginate and filter independently.'
))

story.append(h2('3.2 Required Query Additions'))

story.append(make_table(
    ['Component', 'Current Data Source', 'Required Convex Query', 'Convex Function'],
    [
        ['ServiceChargeMonitor', 'coreState.serviceCharges (empty)', 'useQuery(api.sentry.getServiceChargesByFirm, {firmId})', 'getServiceChargesByFirm (exists)'],
        ['LedgerManager', 'coreState.ledgerEntries (empty)', 'useQuery(api.sentry.getLedgerByFirm, {firmId})', 'getLedgerByFirm (exists)'],
        ['AutomationCenter', 'coreState.automationLogs (empty)', 'useQuery(api.sentry.getAutomationLogs, {firmId})', 'getAutomationLogs (exists)'],
        ['VacancyPipeline', 'coreState.leadsPipeline (empty)', 'useQuery(api.sentry.getLeadsPipelineByFirm, {firmId})', 'getLeadsPipelineByFirm (NEEDS CREATION)'],
        ['AtriumInbox', 'Direct query (works)', 'Already uses dedicated query', 'getInboundMessages (exists)'],
    ],
    col_widths=[CONTENT_W*0.16, CONTENT_W*0.22, CONTENT_W*0.32, CONTENT_W*0.30]
))

story.append(Spacer(1, 6))
story.append(p(
    '<b>Important:</b> The Convex backend already has most of the required query functions in <b>convex/sentry.ts</b>. '
    'The only missing query is getLeadsPipelineByFirm, which needs to be added. It should follow the same pattern as '
    'getServiceChargesByFirm and getLedgerByFirm, querying the leads_pipeline table with the by_firm index.'
))

story.append(h2('3.3 Frontend Refactor Per Component'))

story.append(p(
    'Each of the four affected components needs a two-line refactor: replace the coreState data source with a dedicated '
    'Convex query. The existing Convex mutations (addLedgerEntry, upsertServiceCharge, etc.) will continue to work without '
    'changes because they write directly to the Convex tables, and the new queries will automatically pick up the updated data '
    'through Convex reactivity. Here is the pattern for each component:'
))

story.append(code(
    '// BEFORE (broken - reads empty coreState):\n'
    'const { coreState } = useCoreState();\n'
    'const entries = coreState.ledgerEntries || [];\n'
    '\n'
    '// AFTER (working - uses dedicated Convex query):\n'
    'const { coreState } = useCoreState();\n'
    'const firmId = coreState.firmDetails?.id || currentUser?.firmId || "";\n'
    'const entries = useQuery(api.sentry.getLedgerByFirm, { firmId }) ?? [];'
))

story.append(Spacer(1, 6))
story.append(callout(
    'After this refactor, the coreState.ledgerEntries, coreState.serviceCharges, coreState.leadsPipeline, and '
    'coreState.automationLogs properties become unused. They should be kept in the type definitions (to avoid breaking '
    'destructuring patterns) but can be documented as deprecated with a comment pointing to the dedicated queries.'
))

story.append(Spacer(1, 10))

# ── Section 4: Frontend Tier Gate Implementation ──────────────────────────
story.append(h1('4. Frontend Tier Gate Implementation'))

story.append(h2('4.1 Step 1: Add canUseRevenueMonitor to useFeatures'))

story.append(p(
    'Open <b>src/hooks/useFeatures.ts</b> and add the new entitlement flag. This follows the exact same pattern as '
    'the existing canUseAutomation and canUseAuditLogs gates, which are both Enterprise-only. The flag should appear in '
    'the returned object and in the checkFeatureAccess switch statement.'
))

story.append(code(
    '// Add to the Entitlements section of useFeatures():\n'
    'canUseRevenueMonitor: isEnterprise,\n'
    '\n'
    '// Add to checkFeatureAccess switch:\n'
    "case 'revenue_monitor': return isEnterprise;"
))

story.append(h2('4.2 Step 2: Create a TierGuard Component'))

story.append(p(
    'The existing FeatureGuard component handles product-level gating (property vs. legal), but there is no component for '
    'tier-level gating. Create a new <b>TierGuard</b> component that follows the same visual pattern as FeatureGuard but checks '
    'the subscription plan instead of the product mode. This component should show an upgrade prompt when the user does not '
    'have the required tier, with a call-to-action linking to the plan selection page. The component should accept a requiredTier '
    'prop (or a feature flag name) and use the useFeatures hook internally.'
))

story.append(code(
    '// src/components/TierGuard.tsx\n'
    'interface Props {\n'
    '  feature: string;  // e.g. "revenue_monitor"\n'
    '  children: React.ReactNode;\n'
    '}\n'
    '\n'
    'export const TierGuard: React.FC<Props> = ({ feature, children }) => {\n'
    '  const { checkFeatureAccess, currentPlan } = useFeatures();\n'
    '  const { navigateTo } = useUI();\n'
    '\n'
    '  if (!checkFeatureAccess(feature as any)) {\n'
    '    return (\n'
    '      <UpgradePrompt\n'
    '        featureName="Revenue Monitor"\n'
    '        description="Full revenue tracking, service charge enforcement, vacancy pipeline, and automated notifications are available on the Enterprise plan."\n'
    '        targetPlan={SubscriptionPlan.Enterprise}\n'
    '        onUpgrade={() => navigateTo("settings")}\n'
    '      />\n'
    '    );\n'
    '  }\n'
    '  return <>{children}</>;\n'
    '};'
))

story.append(h2('4.3 Step 3: Guard the RevenueEngine Route in App.tsx'))

story.append(p(
    'In <b>src/App.tsx</b>, wrap the RevenueEngine route with both the existing FeatureGuard (product check) and the new '
    'TierGuard (tier check). The FeatureGuard must come first because it checks product mode, and the TierGuard wraps inside it '
    'to check the subscription tier.'
))

story.append(code(
    "// In App.tsx, replace the existing 'atriumEngine' case:\n"
    "case 'atriumEngine': return (\n"
    "  <ViewWrapper>\n"
    '    <FeatureGuard requiredProduct="property">\n'
    '      <TierGuard feature="revenue_monitor">\n'
    '        <RevenueEngine />\n'
    '      </TierGuard>\n'
    '    </FeatureGuard>\n'
    '  </ViewWrapper>\n'
    ');'
))

story.append(h2('4.4 Step 4: Update Navigation Items'))

story.append(p(
    'The Revenue Monitor should remain visible in navigation for all property-mode firms (as an upsell teaser), but '
    'clicking it when the firm is not on Enterprise should navigate to the atriumEngine view, which will then render the '
    'TierGuard upgrade prompt. This means no changes are needed to the navigation visibility logic itself, because the '
    'TierGuard in App.tsx will handle the blocking. However, the following refinements should be made for polish:'
))

story.append(bullet('<b>Sidebar.tsx:</b> Keep the RevenueEngineNavItem visible for all property firms. No code change needed since the TierGuard in App.tsx handles the gate.'))
story.append(bullet('<b>BottomNav.tsx:</b> The permission function on the Revenue tab is currently permission: () =&gt; true. Consider adding a visual indicator (lock icon or "Enterprise" badge) for non-Enterprise firms, but do not hide the tab.'))
story.append(bullet('<b>Optional enhancement:</b> Add a small "Enterprise" badge or lock icon next to the Revenue nav item when canUseRevenueMonitor is false. This provides a visual hint that the feature requires an upgrade before the user clicks it.'))

story.append(Spacer(1, 10))

# ── Section 5: Backend Tier Enforcement ───────────────────────────────────
story.append(h1('5. Backend Tier Enforcement'))

story.append(p(
    'Frontend gates can be bypassed by direct API calls. The Convex mutations in sentry.ts must enforce the Enterprise-tier '
    'requirement server-side. This prevents a non-Enterprise firm from writing ledger entries, service charges, or pipeline '
    'leads through direct Convex client calls, even if they circumvent the frontend TierGuard.'
))

story.append(h2('5.1 Add Tier Check to Sentry Mutations'))

story.append(p(
    'Every mutation in <b>convex/sentry.ts</b> that writes to the revenue tables should check the firm subscription plan '
    'before proceeding. The pattern should follow the existing withFirmAuth helper, but add a subscription plan check. '
    'Create a helper function that wraps the tier check logic.'
))

story.append(code(
    '// In convex/sentry.ts, add a helper:\n'
    'async function requireEnterpriseFirm(ctx: any, firmId: string) {\n'
    '  const firm = await ctx.db.get(firmId as any);\n'
    '  if (!firm) throw new Error("Firm not found");\n'
    '  if (firm.subscriptionPlan !== "Enterprise") {\n'
    '    throw new Error("Revenue Monitor requires an Enterprise subscription");\n'
    '  }\n'
    '  return firm;\n'
    '}\n'
    '\n'
    '// Then in each mutation handler, add as the first line:\n'
    'await requireEnterpriseFirm(ctx, args.firmId);'
))

story.append(h2('5.2 Mutations That Need the Guard'))

story.append(make_table(
    ['Mutation', 'Table Written', 'Risk If Unguarded'],
    [
        ['addLedgerEntry', 'ledger_entries', 'Financial data manipulation'],
        ['upsertServiceCharge', 'service_charges', 'Fraudulent charge creation'],
        ['markChargeAsPaid', 'service_charges', 'Payment status manipulation'],
        ['applyLatePenalty', 'service_charges', 'Penalty amount manipulation'],
        ['addLeadToPipeline', 'leads_pipeline', 'Pipeline data pollution'],
        ['advanceLeadStage', 'leads_pipeline', 'Stage manipulation'],
        ['logAutomation', 'automation_logs', 'Audit log fabrication'],
    ],
    col_widths=[CONTENT_W*0.26, CONTENT_W*0.24, CONTENT_W*0.50]
))

story.append(Spacer(1, 6))
story.append(p(
    '<b>Note:</b> The read queries (getLedgerByFirm, getServiceChargesByFirm, etc.) do NOT need the Enterprise guard because '
    'the frontend TierGuard already prevents non-Enterprise users from reaching the components that call these queries. Adding '
    'server-side checks to read queries would be defensive but is not strictly necessary. The mutations are the priority because '
    'they modify data.'
))

story.append(Spacer(1, 10))

# ── Section 6: SubscriptionPlan Enum Fix ──────────────────────────────────
story.append(h1('6. SubscriptionPlan Enum Fix'))

story.append(p(
    'There is a naming inconsistency between <b>src/types.ts</b> and <b>src/constants/tiers.ts</b> that should be resolved '
    'before implementing the tier gate. The SubscriptionPlan enum in types.ts includes an "Ultimate" value that does not exist '
    'in the ATRIUM_TIERS or the TierId type. Meanwhile, the useFeatures hook uses isUltimate and isUltimateOrAbove variables '
    'that will never be true for Atrium/Property firms because no Atrium tier is named "Ultimate". This can cause subtle bugs '
    'where Enterprise Atrium firms are denied features that check isUltimateOrAbove instead of isEnterprise.'
))

story.append(make_table(
    ['Source', 'Values', 'Issue'],
    [
        ['src/types.ts SubscriptionPlan', 'Core, Growth, Pro, Ultimate, Enterprise', 'Ultimate does not exist in any tier matrix'],
        ['src/constants/tiers.ts TierId', 'Core, Growth, Pro, Enterprise', 'No Ultimate tier defined'],
        ['useFeatures isUltimate', 'plan === SubscriptionPlan.Ultimate', 'Always false for Atrium firms'],
    ],
    col_widths=[CONTENT_W*0.28, CONTENT_W*0.34, CONTENT_W*0.38]
))

story.append(Spacer(1, 6))
story.append(p(
    '<b>Recommended fix:</b> Remove SubscriptionPlan.Ultimate from the enum (or alias it to Enterprise). Update all references '
    'to isUltimate and isUltimateOrAbove in useFeatures.ts to use isEnterprise instead. This ensures that the Enterprise tier '
    'check works correctly for both Atrium and Vega firms. The only code that currently uses isUltimate is the Sidebar for ALOA-X '
    'access, which should be updated to check isEnterprise.'
))

story.append(Spacer(1, 10))

# ── Section 7: KPI Stats in RevenueEngine.tsx ────────────────────────────
story.append(h1('7. KPI Stats Refactor in RevenueEngine.tsx'))

story.append(p(
    'The top-level RevenueEngine.tsx component computes KPI stats (Collected, Outstanding, Defaults, Vacant) from '
    'coreState.ledgerEntries, coreState.serviceCharges, coreState.leadsPipeline, and coreState.automationLogs. After the data '
    'hydration refactor, these values will come from the dedicated Convex queries inside the sub-components, not from coreState. '
    'However, the KPI bar in RevenueEngine.tsx needs aggregate data to display.'
))

story.append(h2('7.1 Options'))

story.append(make_table(
    ['Option', 'Description', 'Pros', 'Cons'],
    [
        ['A: Aggregate queries', 'Add getCashFlowSummary and getRevenueKPIs queries in sentry.ts that return pre-computed KPIs', 'Efficient, single query for KPIs', 'New backend queries needed'],
        ['B: Lift queries to parent', 'Move the four dedicated queries from sub-components up to RevenueEngine.tsx and pass data down as props', 'Parent has all data for KPIs', 'Breaks component independence, prop drilling'],
        ['C: Context-based hydration', 'Create an AtriumRevenueContext that fetches all revenue data and provides it to children', 'Clean data flow, single fetch point', 'New context provider needed'],
    ],
    col_widths=[CONTENT_W*0.14, CONTENT_W*0.32, CONTENT_W*0.27, CONTENT_W*0.27]
))

story.append(Spacer(1, 6))
story.append(p(
    '<b>Recommendation: Option A (Aggregate queries).</b> This is the cleanest approach because it separates the KPI display '
    'from the detailed data. The getCashFlowSummary query already exists in sentry.ts. Add a similar getRevenueKPIs query that '
    'returns { collected, outstanding, defaults, vacant, criticalCount }. This keeps RevenueEngine.tsx lightweight and allows '
    'each sub-component to fetch its own detailed data independently with pagination and filtering.'
))

story.append(code(
    '// Add to convex/sentry.ts:\n'
    'export const getRevenueKPIs = query({\n'
    '  args: { firmId: v.string() },\n'
    '  handler: async (ctx, { firmId }) => {\n'
    '    const [ledger, charges, leads] = await Promise.all([\n'
    '      ctx.db.query("ledger_entries").withIndex("by_firm", q => q.eq("firmId", firmId)).collect(),\n'
    '      ctx.db.query("service_charges").withIndex("by_firm", q => q.eq("firmId", firmId)).collect(),\n'
    '      ctx.db.query("leads_pipeline").withIndex("by_firm", q => q.eq("firmId", firmId)).collect(),\n'
    '    ]);\n'
    '    const now = new Date();\n'
    '    const collected = ledger\n'
    '      .filter(e => e.status === "cleared" && new Date(e.timestamp).getMonth() === now.getMonth())\n'
    '      .reduce((s, e) => s + e.amount, 0);\n'
    '    const outstanding = ledger.filter(e => e.status === "pending").reduce((s, e) => s + e.amount, 0);\n'
    '    const criticalCount = charges.filter(d => d.isDefaulter && (d.daysOverdue || 0) > 14).length;\n'
    '    const vacant = leads.filter(l => l.stage !== "Closed").length;\n'
    '    return { collected, outstanding, defaults: criticalCount, vacant, criticalCount };\n'
    '  },\n'
    '});'
))

story.append(Spacer(1, 10))

# ── Section 8: Implementation Order ──────────────────────────────────────
story.append(h1('8. Implementation Order and Phases'))

story.append(p(
    'The implementation should proceed in phases to minimize regression risk. Each phase is independently testable and '
    'can be deployed without waiting for subsequent phases. The order is designed so that the most impactful changes '
    '(data hydration) come first, followed by the tier gate, and finally polish and edge cases.'
))

story.append(h2('Phase 1: Data Hydration (Highest Impact)'))
story.append(p(
    'This phase makes the Revenue Monitor actually work for users who have data. It has zero impact on existing functionality '
    'because it only adds new queries and changes internal data sources within the Revenue Monitor components. No other part '
    'of the app is affected.'
))

story.append(make_table(
    ['Task', 'Files Changed', 'Risk', 'Acceptance Criteria'],
    [
        ['1. Add getLeadsPipelineByFirm query', 'convex/sentry.ts', 'Low', 'Query returns leads for a firm from leads_pipeline table'],
        ['2. Add getRevenueKPIs query', 'convex/sentry.ts', 'Low', 'Query returns {collected, outstanding, defaults, vacant, criticalCount}'],
        ['3. Refactor ServiceChargeMonitor to use dedicated query', 'src/components/atrium/ServiceChargeMonitor.tsx', 'Low', 'Service charges display real data from Convex'],
        ['4. Refactor LedgerManager to use dedicated query', 'src/components/atrium/LedgerManager.tsx', 'Low', 'Ledger entries display real data from Convex'],
        ['5. Refactor AutomationCenter to use dedicated query', 'src/components/atrium/AutomationCenter.tsx', 'Low', 'Automation logs display real data from Convex'],
        ['6. Refactor VacancyPipeline to use dedicated query', 'src/components/atrium/VacancyPipeline.tsx', 'Low', 'Pipeline leads display real data from Convex'],
        ['7. Refactor RevenueEngine KPI bar to use getRevenueKPIs', 'src/components/atrium/RevenueEngine.tsx', 'Medium', 'KPI stats show real aggregated numbers'],
    ],
    col_widths=[CONTENT_W*0.28, CONTENT_W*0.30, CONTENT_W*0.10, CONTENT_W*0.32]
))

story.append(Spacer(1, 10))

story.append(h2('Phase 2: Tier Gate (Enterprise Lock)'))
story.append(p(
    'This phase restricts access to the Revenue Monitor to Enterprise-tier firms. It should be implemented after Phase 1 '
    'so that the gate is protecting a fully functional feature. The tier gate does not break any existing functionality for '
    'Enterprise users because it only adds an access check.'
))

story.append(make_table(
    ['Task', 'Files Changed', 'Risk', 'Acceptance Criteria'],
    [
        ['1. Add canUseRevenueMonitor to useFeatures', 'src/hooks/useFeatures.ts', 'Low', 'Flag returns true only for Enterprise firms'],
        ['2. Fix SubscriptionPlan.Ultimate inconsistency', 'src/types.ts, useFeatures.ts', 'Medium', 'isEnterprise correctly identifies Atrium Enterprise firms'],
        ['3. Create TierGuard component', 'src/components/TierGuard.tsx (new)', 'Low', 'Shows upgrade prompt for non-Enterprise, renders children for Enterprise'],
        ['4. Guard atriumEngine route with TierGuard', 'src/App.tsx', 'Low', 'Non-Enterprise firms see upgrade prompt instead of RevenueEngine'],
        ['5. Add Enterprise badge to nav items', 'Sidebar.tsx, BottomNav.tsx', 'Low', 'Lock icon or "Enterprise" badge shown for non-Enterprise firms'],
    ],
    col_widths=[CONTENT_W*0.28, CONTENT_W*0.30, CONTENT_W*0.10, CONTENT_W*0.32]
))

story.append(Spacer(1, 10))

story.append(h2('Phase 3: Backend Enforcement'))
story.append(p(
    'This phase adds server-side protection to prevent API-level circumvention. It is the final safety layer and should '
    'be deployed after the frontend gate is working. Each mutation check is independent and can be deployed incrementally.'
))

story.append(make_table(
    ['Task', 'Files Changed', 'Risk', 'Acceptance Criteria'],
    [
        ['1. Add requireEnterpriseFirm helper', 'convex/sentry.ts', 'Low', 'Helper throws error for non-Enterprise firms'],
        ['2. Guard addLedgerEntry', 'convex/sentry.ts', 'Low', 'Mutation rejects non-Enterprise firmId'],
        ['3. Guard upsertServiceCharge', 'convex/sentry.ts', 'Low', 'Mutation rejects non-Enterprise firmId'],
        ['4. Guard markChargeAsPaid', 'convex/sentry.ts', 'Low', 'Mutation rejects non-Enterprise firmId'],
        ['5. Guard applyLatePenalty', 'convex/sentry.ts', 'Low', 'Mutation rejects non-Enterprise firmId'],
        ['6. Guard addLeadToPipeline', 'convex/sentry.ts', 'Low', 'Mutation rejects non-Enterprise firmId'],
        ['7. Guard advanceLeadStage', 'convex/sentry.ts', 'Low', 'Mutation rejects non-Enterprise firmId'],
        ['8. Guard logAutomation', 'convex/sentry.ts', 'Low', 'Mutation rejects non-Enterprise firmId'],
    ],
    col_widths=[CONTENT_W*0.28, CONTENT_W*0.30, CONTENT_W*0.10, CONTENT_W*0.32]
))

story.append(Spacer(1, 10))

# ── Section 9: Risk Analysis ─────────────────────────────────────────────
story.append(h1('9. Risk Analysis and Safeguards'))

story.append(p(
    'The user specifically asked to "think through this carefully so that we do not spoil the good work done so far." '
    'The following risks have been identified and mitigated in the implementation plan.'
))

story.append(make_table(
    ['Risk', 'Severity', 'Mitigation'],
    [
        ['Breaking existing demo mode', 'High', 'Demo mode uses ATRIUM_DEMO_APP_STATE which populates coreState. After Phase 1, the demo will still work because the sub-components will fall back to coreState when the Convex queries return no data (demo firm IDs do not match real Convex data). Verify demo mode after each phase.'],
        ['Performance regression from new queries', 'Medium', 'Dedicated queries are only called when the user navigates to the Revenue Monitor, so they do not affect initial page load. Each query uses an indexed by_firm lookup. Add .take(100) limits and pagination for large firms.'],
        ['SubscriptionPlan.Ultimate removal breaks existing code', 'Medium', 'Before removing Ultimate, search the entire codebase for all references. The only current usage is in Sidebar.tsx (ALOA-X access) and useFeatures.ts. Replace with isEnterprise. Keep Ultimate as a deprecated alias of Enterprise if needed for backward compatibility.'],
        ['TierGuard breaks Unified/Komplet firms', 'Medium', 'Unified firms on Enterprise should access Revenue Monitor. The isEnterprise check covers this because Unified Enterprise maps to SubscriptionPlan.Enterprise. Test explicitly with a Unified Enterprise firm.'],
        ['Backend guard blocks legitimate operations', 'High', 'The requireEnterpriseFirm check must use the same subscriptionPlan value that useFeatures checks. Test with a real Enterprise firm in staging. Add logging before throwing errors.'],
        ['Race condition between tier upgrade and data access', 'Low', 'If a firm upgrades from Pro to Enterprise, the Convex subscriptionPlan field must be updated immediately. The frontend useFeatures re-reads from coreState.firmDetails.subscriptionPlan, which is fetched on login. A page refresh after upgrade will enable the feature.'],
    ],
    col_widths=[CONTENT_W*0.22, CONTENT_W*0.10, CONTENT_W*0.68]
))

story.append(Spacer(1, 10))

# ── Section 10: Additional Improvements ──────────────────────────────────
story.append(h1('10. Additional Improvements to Consider'))

story.append(p(
    'While wiring up the Revenue Monitor behind the Enterprise gate, the following additional improvements should be considered. '
    'These are not strictly required for the tier gate, but they address issues found during the codebase audit and would '
    'improve the overall quality of the Revenue Monitor feature.'
))

story.append(h2('10.1 Receipt Generation at Unit Level'))
story.append(p(
    'The current LedgerManager generates receipts at the property level, showing the property address rather than the tenant name. '
    'The user has explicitly requested that receipts should be at the unit level (for tenants), not the property level, and should '
    'show the tenant name. The generateReceipt function in LedgerManager.tsx should be updated to include the tenant name from the '
    'ledger entry (if tenantId is present) and to format the receipt for the specific unit/tenant rather than the whole property. '
    'Additionally, the "Issue Receipt" action should be added as a Quick Action in the property tracking view, not buried in the ledger.'
))

story.append(h2('10.2 Owner-Collects-Disburses Flow'))
story.append(p(
    'The user has highlighted that the property manager does not collect rent directly. Instead, the property owner collects rent '
    'and then disburses the management fee to the property manager. The current system assumes the property manager collects rent, '
    'which is architecturally incorrect for the Nigerian property management market. The Revenue Monitor should support this flow by '
    'adding a "Disbursement" entry type to the ledger (alongside rent, service_charge, penalty, deposit) and adding a "Record '
    'Disbursement" action that records the management fee payment from the owner to the property manager. This should be considered '
    'a Phase 4 enhancement after the tier gate is working.'
))

story.append(h2('10.3 Unit-Level Edit Buttons'))
story.append(p(
    'The user has requested unit-level edit buttons placed below the existing property edit button, beside each unit in the property '
    'tracking view. This is a UI improvement that would make the Revenue Monitor more usable for firms managing multi-unit properties. '
    'Each unit card should have an edit button that opens a unit-specific edit modal (not the current property-level modal that '
    'incorrectly shows a property selection dropdown).'
))

story.append(h2('10.4 Link Revenue Monitor to Financial and Analytics Pages'))
story.append(p(
    'The Revenue Monitor currently operates in isolation. The user has requested that it should link to the Financial and Analytics '
    'pages so that clicking on a KPI (e.g., "Outstanding" or "Defaults") navigates to the corresponding filtered view in the '
    'analytics dashboard. This would require adding navigation callbacks to the KPI stat cards in RevenueEngine.tsx that call '
    'navigateTo with appropriate filter parameters.'
))

story.append(h2('10.5 Dual Payment System Synchronisation'))
story.append(p(
    'The codebase audit identified that there are two independent payment tracking systems: the ledger_entries table and the '
    'property.rentPaymentHistory array. These are not synchronised, which means a payment recorded in one system does not appear '
    'in the other. The Revenue Monitor uses ledger_entries, while some property views use rentPaymentHistory. These should be '
    'consolidated so that ledger_entries is the single source of truth, and rentPaymentHistory is either deprecated or automatically '
    'synced from ledger entries. This is a larger refactor that should be planned separately.'
))

story.append(Spacer(1, 10))

# ── Section 11: Acceptance Test Plan ─────────────────────────────────────
story.append(h1('11. Acceptance Test Plan'))

story.append(p(
    'The following tests should be performed after each phase to verify that the Revenue Monitor Enterprise gate is working '
    'correctly and that no existing functionality has been broken.'
))

story.append(h2('11.1 Phase 1: Data Hydration Tests'))

story.append(bullet('<b>Enterprise firm with data:</b> Log in as an Enterprise Atrium firm. Navigate to Revenue Monitor. Verify that all five tabs (Service Charges, Payments and Receipts, Unified Inbox, Automation Centre, Available Units) display real data from Convex tables.'))
story.append(bullet('<b>Enterprise firm with no data:</b> Log in as an Enterprise Atrium firm with no ledger entries. Verify that the Revenue Monitor shows empty states (e.g., "No ledger entries yet") rather than loading spinners or errors.'))
story.append(bullet('<b>Demo mode:</b> Log in with the demo firm ID. Verify that the Revenue Monitor still displays demo data correctly, falling back to coreState when Convex queries return empty.'))
story.append(bullet('<b>Mutation round-trip:</b> In the LedgerManager, click "Record Entry" and add a new payment. Verify the entry appears immediately in the list (Convex reactivity). Navigate away and back. Verify the entry persists.'))
story.append(bullet('<b>KPI accuracy:</b> Compare the KPI bar (Collected, Outstanding, Defaults, Vacant) with manual calculations from the raw Convex data. Verify they match.'))

story.append(h2('11.2 Phase 2: Tier Gate Tests'))

story.append(bullet('<b>Starter/Core firm:</b> Log in as a Starter-tier Atrium firm. Verify the Revenue nav item appears in Sidebar and BottomNav. Click it. Verify an upgrade prompt is shown instead of the Revenue Monitor. Verify the prompt mentions "Enterprise" and has a clear call-to-action.'))
story.append(bullet('<b>Growth firm:</b> Same as above for Growth tier. Verify upgrade prompt is shown.'))
story.append(bullet('<b>Pro firm:</b> Same as above for Pro tier. Verify upgrade prompt is shown.'))
story.append(bullet('<b>Enterprise firm:</b> Log in as an Enterprise Atrium firm. Verify the Revenue Monitor loads fully with all tabs and data. No upgrade prompt should appear.'))
story.append(bullet('<b>Unified Enterprise firm:</b> Log in as a Unified (Komplet) Enterprise firm. Verify the Revenue Monitor is accessible.'))
story.append(bullet('<b>URL bypass:</b> As a Starter-tier firm, manually navigate to the atriumEngine route via URL. Verify the TierGuard still shows the upgrade prompt.'))
story.append(bullet('<b>Upgrade flow:</b> As a Starter-tier firm, click the upgrade CTA. Verify it navigates to the settings/plan page. After upgrading to Enterprise (simulated), verify the Revenue Monitor becomes accessible after page refresh.'))

story.append(h2('11.3 Phase 3: Backend Enforcement Tests'))

story.append(bullet('<b>Direct API call from Starter firm:</b> Use the Convex client to call addLedgerEntry with a Starter-tier firmId. Verify the mutation throws an error with the message "Revenue Monitor requires an Enterprise subscription".'))
story.append(bullet('<b>Direct API call from Enterprise firm:</b> Use the Convex client to call addLedgerEntry with an Enterprise firmId. Verify the mutation succeeds and the entry is written.'))
story.append(bullet('<b>Read queries unguarded:</b> Verify that getLedgerByFirm, getServiceChargesByFirm, etc. still work for any firm tier (read queries should not be gated).'))

story.append(Spacer(1, 12))

# ── Section 12: Summary ──────────────────────────────────────────────────
story.append(h1('12. Summary'))

story.append(p(
    'This document provides a complete, implementation-ready specification for wiring the Revenue Monitor behind an '
    'Enterprise/Custom tier gate. The key changes are: (1) hydrating the Revenue Monitor sub-components with real Convex data '
    'using dedicated queries instead of the empty coreState arrays; (2) adding a canUseRevenueMonitor entitlement flag to the '
    'useFeatures hook and a TierGuard component that shows an upgrade prompt for non-Enterprise firms; (3) enforcing the '
    'Enterprise requirement in the Convex sentry.ts mutations to prevent API-level circumvention; and (4) fixing the '
    'SubscriptionPlan.Ultimate inconsistency that could cause the Enterprise check to fail for Atrium firms.'
))

story.append(p(
    'The implementation is structured in three phases (Data Hydration, Tier Gate, Backend Enforcement) that can be '
    'deployed independently. Phase 1 has the highest impact because it makes the Revenue Monitor functional for the first time. '
    'Phase 2 adds the business logic that restricts it to Enterprise firms. Phase 3 adds the server-side safety net. Each phase '
    'includes specific acceptance criteria and risk mitigations to ensure that existing functionality is not broken.'
))

story.append(p(
    'The additional improvements in Section 10 (unit-level receipts, owner-collects-disburses flow, unit-level edit buttons, '
    'analytics linking, and dual payment system synchronisation) should be considered for subsequent iterations after the tier gate '
    'is stable. They represent the next level of maturity for the Revenue Monitor feature and should be prioritised based on user feedback.'
))

# ── Build ──────────────────────────────────────────────────────────────────
def add_page_number(canvas, doc):
    """Add page number footer."""
    canvas.saveState()
    canvas.setFont('LiberationSerif', 8)
    canvas.setFillColor(TEXT_MUTED)
    page_num = canvas.getPageNumber()
    text = f"Revenue Monitor: Enterprise Feature Gate  |  Page {page_num}"
    canvas.drawCentredString(PAGE_W / 2, 0.4 * inch, text)
    canvas.restoreState()

doc.build(story, onFirstPage=add_page_number, onLaterPages=add_page_number)
print(f"PDF generated: {OUTPUT_PATH}")
