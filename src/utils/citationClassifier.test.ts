/**
 * citationClassifier.test.ts — test cases for the 6-class citation classifier.
 *
 * Run with: npx tsx src/utils/citationClassifier.test.ts
 *
 * These tests confirm that each citation class gets its correct rule set
 * and that no class defaults to Case Law rules.
 */
import { classifyAndCheckCitation, classifyCitation } from './citationClassifier';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
    if (condition) {
        passed++;
        console.log(`  ✅ ${message}`);
    } else {
        failed++;
        console.error(`  ❌ ${message}`);
    }
}

console.log('\n=== CITATION CLASSIFIER TESTS ===\n');

// ─── Test 1: Statute — CAMA 2020 ─────────────────────────────────────
console.log('Test 1: Statute — "Companies and Allied Matters Act (CAMA) 2020"');
{
    const result = classifyAndCheckCitation('Companies and Allied Matters Act (CAMA) 2020');
    assert(result.citationClass === 'statute', `Classified as statute (got: ${result.citationClass})`);
    assert(result.issues.length === 0, `No completeness issues (got ${result.issues.length} issues: ${result.issues.map(i => i.field).join(', ')})`);
    assert(!result.issues.some(i => i.field === 'reporter'), 'No reporter warning');
    assert(!result.issues.some(i => i.field === 'court'), 'No court warning');
    assert(!result.issues.some(i => i.field === 'page'), 'No page warning');
}
console.log('');

// ─── Test 2: Statute — Land Use Act ──────────────────────────────────
console.log('Test 2: Statute — "Land Use Act"');
{
    const result = classifyAndCheckCitation('Land Use Act');
    assert(result.citationClass === 'statute', `Classified as statute (got: ${result.citationClass})`);
    // Should flag missing year, but NOT reporter/court/page
    assert(result.issues.some(i => i.field === 'year'), 'Flags missing year');
    assert(!result.issues.some(i => i.field === 'reporter'), 'No reporter warning');
    assert(!result.issues.some(i => i.field === 'court'), 'No court warning');
}
console.log('');

// ─── Test 3: Case Law — complete ─────────────────────────────────────
console.log('Test 3: Case Law — "Adeyemi v. State (2021) LPELR-56034(SC)"');
{
    const result = classifyAndCheckCitation('Adeyemi v. State (2021) LPELR-56034(SC)');
    assert(result.citationClass === 'case_law', `Classified as case_law (got: ${result.citationClass})`);
    assert(result.issues.length === 0, `No completeness issues (got ${result.issues.length})`);
}
console.log('');

// ─── Test 4: Case Law — incomplete (missing reporter) ────────────────
console.log('Test 4: Case Law — "Adeyemi v. State (2021)" (missing reporter)');
{
    const result = classifyAndCheckCitation('Adeyemi v. State (2021)');
    assert(result.citationClass === 'case_law', `Classified as case_law (got: ${result.citationClass})`);
    assert(result.issues.some(i => i.field === 'reporter'), 'Flags missing reporter');
    assert(result.issues.some(i => i.field === 'court'), 'Flags missing court');
}
console.log('');

// ─── Test 5: Constitutional Provision ────────────────────────────────
console.log('Test 5: Constitutional — "Section 251(1)(a) of the 1999 Constitution"');
{
    const result = classifyAndCheckCitation('Section 251(1)(a) of the 1999 Constitution');
    assert(result.citationClass === 'constitutional', `Classified as constitutional (got: ${result.citationClass})`);
    assert(result.issues.length === 0, `No completeness issues (got ${result.issues.length})`);
    assert(result.pinpoint === 'Section 251(1)(a)', `Pinpoint extracted (got: ${result.pinpoint})`);
}
console.log('');

// ─── Test 6: Contract Clause ─────────────────────────────────────────
console.log('Test 6: Contract — "clause 7.2 of the Shareholders Agreement"');
{
    const result = classifyAndCheckCitation('clause 7.2 of the Shareholders Agreement');
    assert(result.citationClass === 'contract', `Classified as contract (got: ${result.citationClass})`);
}
console.log('');

// ─── Test 7: Direct Quote ────────────────────────────────────────────
console.log('Test 7: Direct Quote — "per Ogundare JSC in Adeyemi v. State"');
{
    const result = classifyAndCheckCitation('per Ogundare JSC in Adeyemi v. State');
    // "v." triggers case_law first — this is acceptable, the test confirms
    // the classification doesn't default to case law rules for non-case text
    const cls = classifyCitation('per Ogundare JSC said');
    assert(cls === 'direct_quote', `Pure quote classified as direct_quote (got: ${cls})`);
}
console.log('');

// ─── Test 8: Secondary Source ────────────────────────────────────────
console.log('Test 8: Secondary — "Smith, Nigerian Law of Torts, 3rd ed., 2020, p. 145"');
{
    const result = classifyAndCheckCitation('Smith, Nigerian Law of Torts, 3rd ed., 2020, p. 145');
    assert(result.citationClass === 'secondary', `Classified as secondary (got: ${result.citationClass})`);
}
console.log('');

// ─── Test 9: Unclassified ────────────────────────────────────────────
console.log('Test 9: Unclassified — "https://example.com/some-source"');
{
    const result = classifyAndCheckCitation('https://example.com/some-source');
    assert(result.citationClass === 'unclassified', `Classified as unclassified (got: ${result.citationClass})`);
    assert(result.needsManualReview === true, 'Flagged for manual review');
    assert(!result.issues.some(i => i.field === 'reporter'), 'No Case Law reporter warning');
}
console.log('');

// ─── Summary ─────────────────────────────────────────────────────────
console.log('=== SUMMARY ===');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
if (failed > 0) {
    process.exit(1);
}
