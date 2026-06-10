import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    KeepTogether, PageBreak, Preformatted
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily

# ── Font Registration ──
pdfmetrics.registerFont(TTFont('LiberationSerif', '/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf'))
pdfmetrics.registerFont(TTFont('LiberationSerif-Bold', '/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans', '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans-Bold', '/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf'))
pdfmetrics.registerFont(TTFont('Carlito', '/usr/share/fonts/truetype/english/Carlito-Regular.ttf'))
pdfmetrics.registerFont(TTFont('Carlito-Bold', '/usr/share/fonts/truetype/english/Carlito-Bold.ttf'))
registerFontFamily('LiberationSerif', normal='LiberationSerif', bold='LiberationSerif-Bold')
registerFontFamily('DejaVuSans', normal='DejaVuSans', bold='DejaVuSans-Bold')
registerFontFamily('Carlito', normal='Carlito', bold='Carlito-Bold')

# ── Palette ──
ACCENT       = colors.HexColor('#d72d4a')
TEXT_PRIMARY  = colors.HexColor('#201e1c')
TEXT_MUTED    = colors.HexColor('#908b84')
BG_SURFACE   = colors.HexColor('#e1ded9')
BG_PAGE      = colors.HexColor('#f4f3f1')

# ── Styles ──
title_style = ParagraphStyle(
    name='DocTitle', fontName='LiberationSerif', fontSize=22,
    leading=28, alignment=TA_CENTER, textColor=ACCENT,
    spaceAfter=6
)
subtitle_style = ParagraphStyle(
    name='DocSubtitle', fontName='LiberationSerif', fontSize=13,
    leading=18, alignment=TA_CENTER, textColor=TEXT_MUTED,
    spaceAfter=18
)
h1_style = ParagraphStyle(
    name='H1', fontName='LiberationSerif', fontSize=16,
    leading=22, textColor=ACCENT, spaceBefore=18, spaceAfter=8
)
h2_style = ParagraphStyle(
    name='H2', fontName='LiberationSerif', fontSize=13,
    leading=18, textColor=TEXT_PRIMARY, spaceBefore=14, spaceAfter=6
)
h3_style = ParagraphStyle(
    name='H3', fontName='LiberationSerif', fontSize=11,
    leading=16, textColor=TEXT_PRIMARY, spaceBefore=10, spaceAfter=4
)
body_style = ParagraphStyle(
    name='Body', fontName='LiberationSerif', fontSize=10.5,
    leading=16, alignment=TA_LEFT, textColor=TEXT_PRIMARY,
    spaceAfter=6
)
bullet_style = ParagraphStyle(
    name='Bullet', fontName='LiberationSerif', fontSize=10.5,
    leading=16, alignment=TA_LEFT, textColor=TEXT_PRIMARY,
    leftIndent=20, spaceAfter=4, bulletIndent=8
)
code_style = ParagraphStyle(
    name='Code', fontName='DejaVuSans', fontSize=8,
    leading=11, alignment=TA_LEFT, textColor=colors.HexColor('#1a1a2e'),
    backColor=colors.HexColor('#f0efed'), leftIndent=12,
    rightIndent=12, spaceBefore=4, spaceAfter=4,
    borderPadding=6
)
checklist_style = ParagraphStyle(
    name='Checklist', fontName='LiberationSerif', fontSize=10.5,
    leading=16, alignment=TA_LEFT, textColor=TEXT_PRIMARY,
    leftIndent=20, spaceAfter=4
)
rule_style = ParagraphStyle(
    name='Rule', fontName='LiberationSerif', fontSize=10.5,
    leading=16, alignment=TA_LEFT, textColor=colors.HexColor('#b91c1c'),
    leftIndent=20, spaceAfter=4
)
table_header_style = ParagraphStyle(
    name='TableHeader', fontName='LiberationSerif', fontSize=10,
    leading=14, textColor=colors.white, alignment=TA_CENTER
)
table_cell_style = ParagraphStyle(
    name='TableCell', fontName='LiberationSerif', fontSize=9.5,
    leading=13, textColor=TEXT_PRIMARY, alignment=TA_LEFT
)
table_cell_code_style = ParagraphStyle(
    name='TableCellCode', fontName='DejaVuSans', fontSize=8,
    leading=11, textColor=TEXT_PRIMARY, alignment=TA_LEFT
)
divider_style = ParagraphStyle(
    name='Divider', fontName='LiberationSerif', fontSize=6,
    leading=8, alignment=TA_CENTER, textColor=TEXT_MUTED,
    spaceBefore=12, spaceAfter=12
)

# ── Build Document ──
output_path = '/home/z/my-project/download/Replit_CRUD_Fix_Prompt.pdf'
doc = SimpleDocTemplate(
    output_path, pagesize=A4,
    leftMargin=0.75*inch, rightMargin=0.75*inch,
    topMargin=0.75*inch, bottomMargin=0.75*inch,
    title='PracticePro CRUD Fix Prompt for Replit',
    author='Z.ai'
)

story = []

# ── Title Section ──
story.append(Paragraph('<b>REPLIT PROMPT</b>', title_style))
story.append(Paragraph('Fix All CRUD Operations and Rebuild Property/Tenant Data Architecture', subtitle_style))
story.append(Paragraph('Copy this entire document and paste it into Replit AI Assistant', ParagraphStyle(
    name='Instruction', fontName='LiberationSerif', fontSize=10, leading=14,
    alignment=TA_CENTER, textColor=TEXT_MUTED, spaceAfter=6
)))
story.append(Paragraph('<font color="#d72d4a"><b>ONE SOURCE - COPY EVERYTHING BELOW</b></font>', ParagraphStyle(
    name='CopyNote', fontName='LiberationSerif', fontSize=11, leading=16,
    alignment=TA_CENTER, textColor=ACCENT, spaceAfter=12
)))
story.append(Paragraph('___' * 30, divider_style))

# ── Preamble ──
story.append(Paragraph(
    'You are an expert full-stack developer taking over an existing React + Convex codebase called PracticePro. '
    'This app has <b>critical, persistent CRUD bugs</b> that must be fixed once and for all. I am giving you '
    '<b>one-time permission</b> to delete corrupted data, rebuild the database architecture, and re-add clean data. '
    'This permission is strictly ONE-TIME - after this fix, the app must NEVER automatically delete or revert data '
    'under any circumstances.',
    body_style
))
story.append(Spacer(1, 12))

# ════════════════════════════════════════════════════════════════
# SECTION: THE BUGS
# ════════════════════════════════════════════════════════════════
story.append(Paragraph('<b>THE BUGS I AM EXPERIENCING</b>', h1_style))

story.append(Paragraph('<b>Bug 1: Property DELETE fails - shows "restored" / item reappears</b>', h2_style))
story.append(Paragraph(
    'When I click Delete on a property, it momentarily disappears then comes back. '
    'The app shows a "restored" or "reverting" message instead of successfully deleting. '
    'The property seems deleted for a moment, but then the UI rolls back the change and the property '
    'reappears in the list, creating the impression that it was "restored" even though the database '
    'record was actually removed by the first mutation.',
    body_style
))

story.append(Paragraph('<b>Bug 2: Property/unit EDIT fails - shows "Failed to update Property. Reverting changes."</b>', h2_style))
story.append(Paragraph(
    'When I edit a property or unit and click Save, it fails. Two error messages appear: '
    '"Failed to update Property. Reverting changes." and "Failed to save property. Please try again." '
    'The form reverts to the old values. This happens because the updateItem mutation uses v.any() for '
    'the data parameter with no type validation and no authentication check, causing silent failures '
    'that trigger the DataProvider rollback mechanism.',
    body_style
))
story.append(Spacer(1, 8))

# ════════════════════════════════════════════════════════════════
# SECTION: ROOT CAUSE ANALYSIS
# ════════════════════════════════════════════════════════════════
story.append(Paragraph('<b>ROOT CAUSE ANALYSIS (Confirmed bugs from codebase audit)</b>', h1_style))

# Root Cause 1
story.append(Paragraph('<b>ROOT CAUSE 1: Property delete DOUBLE-FIRES</b>', h2_style))
story.append(Paragraph(
    '<b>File:</b> <font name="DejaVuSans" size="8">src/hooks/useProperties.ts</font> - handleDeleteProperty',
    body_style
))
story.append(Paragraph(
    'The delete handler calls BOTH: (1) deletePropertyCascadeMutation which hard-deletes from the database, '
    'AND (2) actions.deleteItem which is the generic delete that tries to delete the SAME record again. '
    'Since the cascade mutation already deleted the record, the second generic delete call FAILS because the '
    'record is not found. The DataProvider.tsx optimistic update pattern then ROLLS BACK the UI change '
    '(removes the deletion from local state), making the property reappear - even though it was actually '
    'deleted from the database. On the next data refresh, the property is gone, but until then it looks '
    'like it "restored" itself.',
    body_style
))

# Root Cause 2
story.append(Paragraph('<b>ROOT CAUSE 2: updateItem mutation has NO authentication - it silently fails</b>', h2_style))
story.append(Paragraph(
    '<b>File:</b> <font name="DejaVuSans" size="8">convex/myFunctions.ts</font> - updateItem (around line 1663)',
    body_style
))
story.append(Paragraph(
    'The updateItem mutation does NOT call requireFirmUser or any auth check. It also uses v.any() for the '
    'data parameter with no type validation. When the edit form submits, the mutation may fail due to: '
    'invalid field names or types being passed with no validation via v.any(); the mutation converting null '
    'to undefined for field deletion which can cause schema validation errors; and no firmId authorization '
    'check so ownership validation is completely missing.',
    body_style
))

# Root Cause 3
story.append(Paragraph('<b>ROOT CAUSE 3: Stale prevState in optimistic updates</b>', h2_style))
story.append(Paragraph(
    '<b>File:</b> <font name="DejaVuSans" size="8">src/contexts/DataProvider.tsx</font>',
    body_style
))
story.append(Paragraph(
    'The updateItem and deleteItem functions capture prevState = appState at call time via closure, NOT at '
    'render time. If two rapid operations happen, the second rollback undoes the first operation changes. '
    'This causes state desync where the UI shows stale data that does not match the actual database state, '
    'and sequential operations can interfere with each other in unpredictable ways.',
    body_style
))

# Root Cause 4
story.append(Paragraph('<b>ROOT CAUSE 4: deleteItem Strategy A deletes wrong records</b>', h2_style))
story.append(Paragraph(
    '<b>File:</b> <font name="DejaVuSans" size="8">convex/myFunctions.ts</font> - deleteItem (around line 1713)',
    body_style
))
story.append(Paragraph(
    'The deleteItem mutation has a dangerous pattern: try { ctx.db.delete(id) } catch(e) { fallback to UUID search }. '
    'This catches ALL errors, including permission errors. If a valid Convex ID from a DIFFERENT table is '
    'accidentally passed, it silently deletes that record instead. There is NO table validation and NO firmId '
    'check, which means any authenticated user could potentially delete any record from any table in the '
    'entire database.',
    body_style
))
story.append(Spacer(1, 8))

# ════════════════════════════════════════════════════════════════
# SECTION: EXECUTION PLAN
# ════════════════════════════════════════════════════════════════
story.append(Paragraph('<b>EXECUTION PLAN - Follow This Exact Sequence</b>', h1_style))

# ── PHASE 1 ──
story.append(Paragraph('<b>PHASE 1: FIX THE PROPERTY DELETE BUG (Highest Priority)</b>', h2_style))

story.append(Paragraph('<b>Step 1: Open src/hooks/useProperties.ts and find handleDeleteProperty</b>', h3_style))
story.append(Paragraph(
    'Currently it does something like this (BROKEN - double-fires delete):',
    body_style
))
story.append(Paragraph(
    'await deletePropertyCascadeMutation({ id: propertyId });<br/>'
    'actions.deleteItem("properties", propertyId); // This fails because record is already gone',
    code_style
))
story.append(Paragraph('Fix it to ONLY use the cascade mutation, and manually update local state:', body_style))
story.append(Paragraph(
    'try {<br/>'
    '&nbsp;&nbsp;await deletePropertyCascadeMutation({ id: propertyId });<br/>'
    '&nbsp;&nbsp;// Remove from local state directly instead of calling generic deleteItem<br/>'
    '&nbsp;&nbsp;setAppState(prev =&gt; ({<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;...prev,<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;properties: prev.properties.filter(p =&gt; p._id !== propertyId &amp;&amp; p.id !== propertyId),<br/>'
    '&nbsp;&nbsp;}));<br/>'
    '&nbsp;&nbsp;toast.success("Property deleted successfully");<br/>'
    '} catch (error) {<br/>'
    '&nbsp;&nbsp;toast.error("Failed to delete property. Please try again.");<br/>'
    '&nbsp;&nbsp;// DO NOT roll back - only roll back if the mutation itself failed<br/>'
    '}',
    code_style
))

story.append(Paragraph('<b>Step 2: Open src/contexts/DataProvider.tsx and fix the optimistic update rollback</b>', h3_style))
story.append(Paragraph(
    'The deleteItem function currently captures prevState = appState at call time and uses it for rollback. '
    'This creates stale state issues. Fix ALL three functions (addItem, updateItem, deleteItem) to use '
    'functional state updates instead. For deleteItem:',
    body_style
))
story.append(Paragraph(
    'deleteItem: async (table, id) =&gt; {<br/>'
    '&nbsp;&nbsp;let removedItem: any = null;<br/>'
    '&nbsp;&nbsp;let removedIndex = -1;<br/><br/>'
    '&nbsp;&nbsp;setAppState(prev =&gt; {<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;const items = prev[table as keyof typeof prev] as any[];<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;const idx = items.findIndex((item: any) =&gt; item._id === id || item.id === id);<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;if (idx !== -1) {<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;removedItem = items[idx];<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;removedIndex = idx;<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;const newItems = [...items];<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;newItems.splice(idx, 1);<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;return { ...prev, [table]: newItems };<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;}<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;return prev;<br/>'
    '&nbsp;&nbsp;});<br/><br/>'
    '&nbsp;&nbsp;try {<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;await deleteItemMutation({ table, id });<br/>'
    '&nbsp;&nbsp;} catch (error) {<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;// Roll back by re-inserting the removed item at its original position<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;if (removedItem &amp;&amp; removedIndex !== -1) {<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;setAppState(prev =&gt; {<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;const items = [...(prev[table as keyof typeof prev] as any[])];<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;items.splice(removedIndex, 0, removedItem);<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;return { ...prev, [table]: items };<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;});<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;}<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;toast.error(`Failed to delete ${table.slice(0, -1)}. Changes reverted.`);<br/>'
    '&nbsp;&nbsp;}<br/>'
    '},',
    code_style
))

story.append(Paragraph('Apply the same functional setState pattern to updateItem:', body_style))
story.append(Paragraph(
    'updateItem: async (table, id, data) =&gt; {<br/>'
    '&nbsp;&nbsp;let previousItem: any = null;<br/><br/>'
    '&nbsp;&nbsp;setAppState(prev =&gt; {<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;const items = prev[table as keyof typeof prev] as any[];<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;const idx = items.findIndex((item: any) =&gt; item._id === id || item.id === id);<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;if (idx !== -1) {<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;previousItem = { ...items[idx] };<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;const newItems = [...items];<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;newItems[idx] = { ...newItems[idx], ...data };<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;return { ...prev, [table]: newItems };<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;}<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;return prev;<br/>'
    '&nbsp;&nbsp;});<br/><br/>'
    '&nbsp;&nbsp;try {<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;await updateItemMutation({ table, id, data });<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;toast.success(`${table.slice(0, -1)} updated successfully`);<br/>'
    '&nbsp;&nbsp;} catch (error) {<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;// Roll back the specific item, not the entire state<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;if (previousItem) {<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;setAppState(prev =&gt; {<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;const items = [...(prev[table as keyof typeof prev] as any[])];<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;const idx = items.findIndex((item: any) =&gt; item._id === id || item.id === id);<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;if (idx !== -1) { items[idx] = previousItem; }<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;return { ...prev, [table]: items };<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;});<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;}<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;toast.error(`Failed to update ${table.slice(0, -1)}. Reverting changes.`);<br/>'
    '&nbsp;&nbsp;}<br/>'
    '},',
    code_style
))
story.append(Spacer(1, 8))

# ── PHASE 2 ──
story.append(Paragraph('<b>PHASE 2: FIX THE PROPERTY UPDATE BUG</b>', h2_style))
story.append(Paragraph(
    '<b>Step 1: Open convex/myFunctions.ts and find the updateItem mutation (around line 1663)</b>',
    h3_style
))
story.append(Paragraph(
    'Add authentication and proper validation. Replace the existing updateItem mutation with this fixed version '
    'that includes: authentication check requiring getUserIdentity(); table whitelist to prevent access to '
    'unknown tables; proper data processing that converts null to undefined for field deletion; document '
    'existence verification; and firmId ownership check to ensure users can only update their own firm data.',
    body_style
))
story.append(Paragraph(
    'export const updateItem = mutation({<br/>'
    '&nbsp;&nbsp;args: { table: v.string(), id: v.string(), data: v.any() },<br/>'
    '&nbsp;&nbsp;handler: async (ctx, args) =&gt; {<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;// ADD: Authentication check<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;const identity = await ctx.auth.getUserIdentity();<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;if (!identity) { throw new ConvexError("Not authenticated"); }<br/><br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;// ADD: Table whitelist<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;const allowedTables = ["properties", "contacts", "matters", "tasks", "documents",<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"events", "notePages", "ledger_entries", "serviceCharges",<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"invoices", "timeEntries", "expenses", "chatMessages",<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"clientMessages", "researchNotes", "automations"];<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;if (!allowedTables.includes(args.table)) { throw new ConvexError(`Invalid table: ${args.table}`); }<br/><br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;// Strip internal fields<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;const { _id, _creationTime, _version, createdAt, ...cleanData } = args.data as any;<br/><br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;// ADD: Convert null to undefined for field deletion<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;const processedData: any = {};<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;for (const [key, value] of Object.entries(cleanData)) {<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;if (value === undefined) continue;<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;if (value === null) { processedData[key] = undefined; }<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;else { processedData[key] = value; }<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;}<br/><br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;// Resolve document ID<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;let docId: Id&lt;any&gt;;<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;try { docId = args.id as Id&lt;any&gt;; }<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;catch {<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;const doc = await ctx.db.query(args.table)<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.filter(q =&gt; q.eq(q.field("id"), args.id)).first();<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;if (!doc) throw new ConvexError(`Document not found: ${args.id}`);<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;docId = doc._id;<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;}<br/><br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;// ADD: Verify document exists and belongs to user firm<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;const existing = await ctx.db.get(docId);<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;if (!existing) throw new ConvexError(`Document not found: ${args.id}`);<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;if (existing.firmId) {<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;const user = await ctx.db.query("users")<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.filter(q =&gt; q.eq(q.field("clerkId"), identity.subject)).first();<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;if (!user || user.firmId !== existing.firmId) {<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;throw new ConvexError("Not authorized to update this resource");<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;}<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;}<br/><br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;await ctx.db.patch(docId, {<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;...processedData,<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;_version: (existing._version || 0) + 1,<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;updatedAt: Date.now(),<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;});<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;return { success: true, id: docId };<br/>'
    '&nbsp;&nbsp;},<br/>'
    '});',
    code_style
))
story.append(Spacer(1, 8))

# ── PHASE 3 ──
story.append(Paragraph('<b>PHASE 3: FIX THE deleteItem MUTATION (Prevent Wrong-Record Deletion)</b>', h2_style))
story.append(Paragraph(
    'In convex/myFunctions.ts, find deleteItem (around line 1713) and replace it with this fixed version. '
    'The key changes are: adding authentication checks; adding a table whitelist; validating that the document '
    'actually belongs to the expected table before deleting; and verifying firmId ownership for both Convex ID '
    'and UUID-based deletions. Also fix forceDeleteItem (around line 1796) - add the same authentication and '
    'firmId checks. This mutation currently has NO authorization and could delete ANY record across ALL firms.',
    body_style
))
story.append(Paragraph(
    'export const deleteItem = mutation({<br/>'
    '&nbsp;&nbsp;args: { table: v.string(), id: v.string() },<br/>'
    '&nbsp;&nbsp;handler: async (ctx, args) =&gt; {<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;const identity = await ctx.auth.getUserIdentity();<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;if (!identity) throw new ConvexError("Not authenticated");<br/><br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;const allowedTables = ["properties", "contacts", "matters", "tasks", "documents",<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"events", "notePages", "ledger_entries", "serviceCharges",<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"invoices", "timeEntries", "expenses", "chatMessages",<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"clientMessages", "researchNotes", "automations"];<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;if (!allowedTables.includes(args.table)) throw new ConvexError(`Invalid table: ${args.table}`);<br/><br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;let docId: Id&lt;any&gt;;<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;try {<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;docId = args.id as Id&lt;any&gt;;<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;const existing = await ctx.db.get(docId);<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;if (!existing) throw new ConvexError(`Document not found: ${args.id}`);<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;if (args.table === "properties" &amp;&amp; !existing.firmId)<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;throw new ConvexError("Document does not belong to properties table");<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;if (existing.firmId) {<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;const user = await ctx.db.query("users")<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.filter(q =&gt; q.eq(q.field("clerkId"), identity.subject)).first();<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;if (!user || user.firmId !== existing.firmId)<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;throw new ConvexError("Not authorized to delete this resource");<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;}<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;await ctx.db.delete(docId);<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;return { success: true, deletedId: args.id };<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;} catch (ConvexError) { throw ConvexError; }<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;catch (e) {<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;const doc = await ctx.db.query(args.table)<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.filter(q =&gt; q.eq(q.field("id"), args.id)).first();<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;if (!doc) throw new ConvexError(`Document not found in ${args.table}: ${args.id}`);<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;if (doc.firmId) {<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;const user = await ctx.db.query("users")<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.filter(q =&gt; q.eq(q.field("clerkId"), identity.subject)).first();<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;if (!user || user.firmId !== doc.firmId)<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;throw new ConvexError("Not authorized to delete this resource");<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;}<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;await ctx.db.delete(doc._id);<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;return { success: true, deletedId: args.id };<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;}<br/>'
    '&nbsp;&nbsp;},<br/>'
    '});',
    code_style
))
story.append(Spacer(1, 8))

# ── PHASE 4 ──
story.append(Paragraph('<b>PHASE 4: ADD SOFT-DELETE TO PROPERTIES AND CONTACTS</b>', h2_style))

story.append(Paragraph('<b>Step 1: In convex/schema.ts</b> - Add soft-delete fields to the properties and contacts table definitions:', h3_style))
story.append(Paragraph(
    'isDeleted: v.optional(v.boolean()),&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;// Soft-delete flag<br/>'
    'deletedAt: v.optional(v.number()),&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;// Timestamp of deletion<br/>'
    'deletedBy: v.optional(v.string()),&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;// User who deleted',
    code_style
))

story.append(Paragraph('<b>Step 2: Update ALL queries</b> that fetch properties/contacts to filter out soft-deleted items:', h3_style))
story.append(Paragraph(
    'In convex/myFunctions.ts, find getFirmData (around line 149) and update the fetchByFirm helper. '
    'After collecting items from the query, filter out soft-deleted items for tables that support it '
    '(properties and contacts). The filter is: items.filter(item =&gt; !item.isDeleted) for those tables.',
    body_style
))

story.append(Paragraph('<b>Step 3: Create a new softDeleteItem mutation</b> in convex/myFunctions.ts:', h3_style))
story.append(Paragraph(
    'This mutation should: authenticate the user; only allow soft-delete on properties and contacts tables; '
    'resolve the document ID (try as Convex ID first, then fallback to UUID search); verify the document exists; '
    'verify firmId ownership; then patch the document to set isDeleted=true, deletedAt=Date.now(), '
    'deletedBy=identity.subject, bump _version, and set updatedAt. Return { success: true }.',
    body_style
))

story.append(Paragraph('<b>Step 4: Create a restoreItem mutation</b> in convex/myFunctions.ts:', h3_style))
story.append(Paragraph(
    'This mutation should: authenticate the user; only allow restore on properties and contacts tables; '
    'resolve the document ID; verify the document exists; patch the document to set isDeleted=false, '
    'deletedAt=undefined, deletedBy=undefined, bump _version, and set updatedAt. Return { success: true }.',
    body_style
))
story.append(Spacer(1, 8))

# ── PHASE 5 ──
story.append(Paragraph('<b>PHASE 5: ONE-TIME DATA CLEANUP AND REBUILD</b>', h2_style))
story.append(Paragraph(
    '<font color="#d72d4a"><b>THIS IS A ONE-TIME OPERATION. After this, the app must NEVER automatically delete data.</b></font>',
    body_style
))
story.append(Paragraph(
    '<b>Step 1:</b> Add a one-time cleanup mutation (DELETE THIS MUTATION AFTER RUNNING IT):',
    h3_style
))
story.append(Paragraph(
    'export const oneTimeCleanupProperties = mutation({<br/>'
    '&nbsp;&nbsp;args: { firmId: v.string() },<br/>'
    '&nbsp;&nbsp;handler: async (ctx, args) =&gt; {<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;const properties = await ctx.db.query("properties")<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.withIndex("by_firm", q =&gt; q.eq("firmId", args.firmId)).collect();<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;let deleted = 0, repaired = 0;<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;for (const prop of properties) {<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;if (!prop.name || !prop.address || !prop.firmId) {<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;await ctx.db.delete(prop._id); deleted++; continue;<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;}<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;if (!prop.rentalDetails || typeof prop.rentalDetails !== "object") {<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;await ctx.db.patch(prop._id, { rentalDetails: {<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;rentAmount: 0, currency: "NGN", paymentFrequency: "annual",<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;serviceCharge: 0, cautionFee: 0, totalPackage: 0,<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;}}); repaired++;<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;}<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;if (prop.isDeleted === undefined) {<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;await ctx.db.patch(prop._id, { isDeleted: false });<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;}<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;}<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;return { deleted, repaired, total: properties.length };<br/>'
    '&nbsp;&nbsp;},<br/>'
    '});',
    code_style
))
story.append(Paragraph(
    '<b>Step 2:</b> Run the cleanup from the Convex dashboard (dashboard.convex.dev - your project - Functions - run oneTimeCleanupProperties with your firmId).',
    h3_style
))
story.append(Paragraph(
    '<font color="#d72d4a"><b>Step 3: DELETE the oneTimeCleanupProperties mutation from the codebase after running it. '
    'This ensures it can never be triggered again.</b></font>',
    h3_style
))
story.append(Spacer(1, 8))

# ── PHASE 6 ──
story.append(Paragraph('<b>PHASE 6: FIX ALL OTHER ENTITY CRUD</b>', h2_style))
story.append(Paragraph(
    'After fixing Properties, verify and fix CRUD for EVERY other entity in the application. '
    'This is critical because the same patterns that caused the property bugs likely affect other entities:',
    body_style
))
story.append(Paragraph('1. <b>Contacts/Tenants</b> - Ensure create, read, update, delete all work. Verify the edit form saves correctly and the delete does not double-fire.', checklist_style))
story.append(Paragraph('2. <b>Matters</b> - Verify deleteMatterCascade does not double-fire with generic deleteItem. Apply the same fix as properties if it does.', checklist_style))
story.append(Paragraph('3. <b>Tasks, Documents, Events</b> - These use the generic createItem/updateItem/deleteItem. After fixing those generic mutations, verify they work for each entity type.', checklist_style))
story.append(Paragraph('4. <b>Ledger Entries</b> - Verify addLedgerEntry and updateLedgerStatus work correctly. These are in convex/sentry.ts.', checklist_style))
story.append(Paragraph('5. <b>Service Charges</b> - Verify upsertServiceCharge works for both create and update operations.', checklist_style))
story.append(Paragraph('6. <b>Notes</b> - Verify notePages archive/restore works (it has archivedAt).', checklist_style))
story.append(Spacer(1, 8))

# ── PHASE 7 ──
story.append(Paragraph('<b>PHASE 7: FIX THE FRONTEND - Property Edit Form</b>', h2_style))
story.append(Paragraph(
    'Find the property edit modal/form component (likely in src/components/ or src/pages/) and fix these issues:',
    body_style
))
story.append(Paragraph('1. Ensure the form submits using actions.updateItem("properties", id, data) - NOT a separate mutation that bypasses the data provider.', checklist_style))
story.append(Paragraph('2. Ensure field names in the form match EXACTLY what the Convex schema expects (check convex/schema.ts for the properties table definition).', checklist_style))
story.append(Paragraph('3. The rentalDetails object must be sent as a complete nested object, not as flattened individual fields.', checklist_style))
story.append(Paragraph('4. Add proper error handling - if the mutation fails, show the specific error message from the backend, not a generic "Failed to update".', checklist_style))
story.append(Spacer(1, 8))

# ── PHASE 8 ──
story.append(Paragraph('<b>PHASE 8: PREVENTION - Ensure This Never Happens Again</b>', h2_style))
story.append(Paragraph('1. Add a comment block at the top of myFunctions.ts stating: <i>"All mutations must call authentication checks. Never use try/catch to silently swallow errors in delete operations. Always validate table ownership before deleting. Soft-delete is mandatory for properties and contacts."</i>', body_style))
story.append(Paragraph('2. Add input validation to createItem and updateItem - replace v.any() with proper schema validation for each table type.', body_style))
story.append(Paragraph('3. Remove or secure forceDeleteItem - it currently has no authorization and could delete any record in any table.', body_style))
story.append(Paragraph('4. Remove or secure purgeFirmData - it deletes ALL data for a firm across 18 tables with no server-side confirmation.', body_style))
story.append(Paragraph('5. Add requireFirmUser to ALL mutations in myFunctions.ts - it already exists in convex/authHelpers.ts but is only used in drafting.ts.', body_style))
story.append(Spacer(1, 12))

# ════════════════════════════════════════════════════════════════
# SECTION: FILES TO MODIFY
# ════════════════════════════════════════════════════════════════
story.append(Paragraph('<b>FILES TO MODIFY</b>', h1_style))

avail_w = A4[0] - 2 * 0.75 * inch
file_data = [
    [Paragraph('<b>File</b>', table_header_style), Paragraph('<b>Changes</b>', table_header_style)],
    [Paragraph('convex/myFunctions.ts', table_cell_code_style), Paragraph('Fix updateItem, deleteItem, forceDeleteItem - add auth, validation, table ownership checks. Add softDeleteItem, restoreItem, one-time cleanup mutation.', table_cell_style)],
    [Paragraph('convex/schema.ts', table_cell_code_style), Paragraph('Add isDeleted, deletedAt, deletedBy fields to properties and contacts tables.', table_cell_style)],
    [Paragraph('src/contexts/DataProvider.tsx', table_cell_code_style), Paragraph('Fix optimistic update rollback - use functional setState instead of stale prevState.', table_cell_style)],
    [Paragraph('src/hooks/useProperties.ts', table_cell_code_style), Paragraph('Fix handleDeleteProperty - remove double-fire, use cascade mutation only.', table_cell_style)],
    [Paragraph('Property edit form component', table_cell_code_style), Paragraph('Fix form submission, field names, rentalDetails object, and error handling.', table_cell_style)],
]

file_table = Table(file_data, colWidths=[avail_w*0.30, avail_w*0.70], hAlign='CENTER')
file_table.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), ACCENT),
    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
    ('BACKGROUND', (0, 1), (-1, 1), colors.white),
    ('BACKGROUND', (0, 2), (-1, 2), BG_SURFACE),
    ('BACKGROUND', (0, 3), (-1, 3), colors.white),
    ('BACKGROUND', (0, 4), (-1, 4), BG_SURFACE),
    ('BACKGROUND', (0, 5), (-1, 5), colors.white),
    ('GRID', (0, 0), (-1, -1), 0.5, TEXT_MUTED),
    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ('LEFTPADDING', (0, 0), (-1, -1), 8),
    ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ('TOPPADDING', (0, 0), (-1, -1), 6),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
]))
story.append(file_table)
story.append(Spacer(1, 12))

# ════════════════════════════════════════════════════════════════
# SECTION: TESTING CHECKLIST
# ════════════════════════════════════════════════════════════════
story.append(Paragraph('<b>TESTING CHECKLIST</b>', h1_style))
story.append(Paragraph('After all fixes, verify EVERY operation:', body_style))

checklist_items = [
    'CREATE a new property - it should appear immediately without refresh',
    'EDIT a property (change name, rent amount, etc.) - changes should save and persist',
    'EDIT a unit within a property - changes should save without "reverting" error',
    'DELETE a property - it should disappear and NOT come back on refresh',
    'DELETE a property, then refresh the page - it should still be gone (soft-deleted in DB)',
    'CREATE a new contact/tenant - should work without errors',
    'EDIT a contact/tenant - changes should save correctly',
    'DELETE a contact/tenant - should work without the "restored" bug',
    'CREATE a new matter - should work',
    'DELETE a matter - cascade delete should work without double-fire',
    'Add a ledger entry - should persist correctly',
    'Rapid sequential operations (create + delete quickly) - should not cause state desync',
    'Two different users in different firms - should NOT be able to see or delete each other data',
]
for i, item in enumerate(checklist_items, 1):
    story.append(Paragraph(f'{i}. {item}', checklist_style))

story.append(Spacer(1, 12))

# ════════════════════════════════════════════════════════════════
# SECTION: ABSOLUTE RULES
# ════════════════════════════════════════════════════════════════
story.append(Paragraph('<b>ABSOLUTE RULES</b>', h1_style))

rules = [
    '<b>NEVER silently swallow errors in delete operations</b> - if a delete fails, throw the error, do not catch it and try a different strategy',
    '<b>NEVER delete a record without verifying it belongs to the correct table AND the user firm</b>',
    '<b>NEVER double-fire delete operations</b> - use either the cascade mutation OR the generic delete, never both',
    '<b>Soft-delete is mandatory for properties and contacts</b> - never hard-delete these',
    '<b>After the one-time cleanup, the app must NEVER automatically delete or purge data</b>',
    '<b>Every mutation must authenticate the user</b> - use requireFirmUser from convex/authHelpers.ts',
]
for i, rule in enumerate(rules, 1):
    story.append(Paragraph(f'<font color="#b91c1c">{i}. {rule}</font>', rule_style))

# ── Build ──
doc.build(story)
print(f"PDF generated successfully at: {output_path}")
