
import { Matter, LitigationParty } from '../types';

/**
 * Service to generate pre-filled legal document content for Nigerian litigation.
 * Optimised for PracticePro VEGA with Orange/Blue intelligence syntax.
 */
export class TemplateService {

    /**
     * Formats a list of parties for Nigerian court headings.
     */
    static formatPartyListForHeading(parties: LitigationParty[], role: string): string {
        if (!parties || parties.length === 0) return `<p><strong>[${role.toUpperCase()}]</strong></p>`;
        
        const roleUpper = role.toUpperCase();
        if (parties.length === 1) {
            return `<p><strong>{${parties[0].name.toUpperCase()}}</strong> <span style="float: right;">.................................................... ${roleUpper}</span></p>`;
        }
        
        const list = parties.map((p, i) => `<p><strong>${i + 1}. {${p.name.toUpperCase()}}</strong></p>`).join('');
        return `${list}<p style="text-align: right;"><strong>.................................................... ${roleUpper}S</strong></p>`;
    }

    /**
     * Generates a standard Nigerian High Court heading with proper alignment and styling.
     */
    static generateHeading(matter: Matter): string {
        const court = (matter.court || 'IN THE HIGH COURT OF JUSTICE').toUpperCase();
        const division = (matter.judicialDivision || 'LAGOS STATE').toUpperCase();
        const suitNo = (matter.suitNumber || '[SUIT NUMBER]').toUpperCase();
        
        const claimants = matter.parties?.filter(p => p.role === 'Claimant') || [];
        const defendants = matter.parties?.filter(p => p.role === 'Defendant') || [];
        
        return `
            <p style="text-align: center;"><strong>{${court}}</strong></p>
            <p style="text-align: center;"><strong>IN THE {${division} JUDICIAL DIVISION}</strong></p>
            <p style="text-align: center;"><strong>HOLDEN AT {${division.split(' ')[0]}}</strong></p>
            <p>&nbsp;</p>
            <p style="text-align: left;"><strong>SUIT NO: {${suitNo}}</strong></p>
            <p>&nbsp;</p>
            <p><strong>BETWEEN:</strong></p>
            <div style="margin-left: 20px;">
                ${this.formatPartyListForHeading(claimants, 'Claimant')}
            </div>
            <p style="text-align: center;"><strong>AND</strong></p>
            <div style="margin-left: 20px;">
                ${this.formatPartyListForHeading(defendants, 'Defendant')}
            </div>
            <p style="text-align: center;"><strong>====================================================</strong></p>
        `.trim();
    }

    /**
     * Generates a pre-filled Writ of Summons draft formatted for Nigerian courts.
     */
    static generateWritOfSummons(matter: Matter): string {
        const heading = this.generateHeading(matter);
        
        return `
            ${heading}
            <p style="text-align: center;"><strong>WRIT OF SUMMONS</strong></p>
            <p>&nbsp;</p>
            <p>To: [DEFENDANT NAME] of [DEFENDANT ADDRESS]</p>
            <p>You are hereby commanded that within forty-two (42) days after the service of this writ on you, inclusive of the day of such service, you do cause an appearance to be entered for you in an action at the suit of:</p>
            <p><strong>{[CLAIMANT NAME]}</strong></p>
            <p>And take notice that in default of your so doing the Claimants may proceed therein, and judgment may be given in your absence.</p>
            <p>&nbsp;</p>
            <p>DATED this {DAY} day of {MONTH} 20[YEAR]</p>
            <p>&nbsp;</p>
            <p style="text-align: right;"><strong>..........................................</strong></p>
            <p style="text-align: right;"><strong>REGISTRAR</strong></p>
        `.trim();
    }

    /**
     * Generates a pre-filled Statement of Claim draft.
     */
    static generateStatementOfClaim(matter: Matter): string {
        const heading = this.generateHeading(matter);
        const claimant = matter.parties?.find(p => p.role === 'Claimant')?.name || '[CLAIMANT]';
        const defendant = matter.parties?.find(p => p.role === 'Defendant')?.name || '[DEFENDANT]';

        return `
            ${heading}
            <p style="text-align: center;"><strong>STATEMENT OF CLAIM</strong></p>
            <p>&nbsp;</p>
            <p>1. The Claimant, {${claimant}}, is a [Description] and resides at [Address].</p>
            <p>2. The Defendant, {${defendant}}, is a [Description] and carries on business at [Address].</p>
            <p>3. {That the cause of action in this suit relates to [CAUSE OF ACTION DETAILS] which occurred within the jurisdiction of this Honourable Court}.</p>
            <p>4. [Additional Background facts]...</p>
            <p>&nbsp;</p>
            <p><strong>WHEREOF</strong> the Claimant claims against the Defendant as follows:</p>
            <p>(a) A DECLARATION that [RELIEF 1]...</p>
            <p>(b) THE SUM OF {[AMOUNT]} being [NATURE OF DEBT/LIABILITY]...</p>
            <p>(c) {Interest at the rate of 10% per annum from judgment until the debt is liquidated}.</p>
            <p>&nbsp;</p>
            <p>DATED this {DAY} day of {MONTH} 20[YEAR]</p>
            <p>&nbsp;</p>
            <p><strong>..........................................</strong></p>
            <p><strong>[LEAD COUNSEL]</strong></p>
            <p>{FOR: [FIRM NAME]}</p>
        `.trim();
    }

    /**
     * Generates a pre-filled Motion on Notice.
     */
    static generateMotionOnNotice(matter: Matter): string {
        const heading = this.generateHeading(matter);
        
        return `
            ${heading}
            <p style="text-align: center;"><strong>MOTION ON NOTICE</strong></p>
            <p style="text-align: center;"><strong>BROUGHT PURSUANT TO [ORDER & RULE] OF THE HIGH COURT (CIVIL PROCEDURE) RULES {2021}</strong></p>
            <p>&nbsp;</p>
            <p><strong>TAKE NOTICE</strong> that this Honourable Court will be moved on {[DATE]} at the hour of 9 o'clock in the forenoon or soon thereafter as Counsel can be heard for the following orders:</p>
            <p>1. <strong>AN ORDER</strong> [SPECIFIC RELIEF SOUGHT].</p>
            <p>2. <strong>AND FOR SUCH FURTHER ORDER(S)</strong> as this Honourable Court may deem fit to make in the circumstances.</p>
            <p>&nbsp;</p>
            <p><strong>GROUNDS FOR THE APPLICATION:</strong></p>
            <p>1. {That the Respondent has [ACTION REQUIRING REMEDY]}.</p>
            <p>2. {That the Applicant's interest will be irreparably prejudiced unless this application is granted}.</p>
            <p>&nbsp;</p>
            <p>DATED this {DAY} day of {MONTH} 20[YEAR]</p>
            <p>&nbsp;</p>
            <p><strong>..........................................</strong></p>
            <p><strong>[COUNSEL NAME]</strong></p>
        `.trim();
    }

    /**
     * Generates a professional Affidavit Support skeleton.
     */
    static generateAffidavit(matter: Matter): string {
        const heading = this.generateHeading(matter);
        const deponent = matter.parties?.[0]?.name || '[DEPONENT]';
        
        return `
            ${heading}
            <p style="text-align: center;"><strong>AFFIDAVIT IN SUPPORT OF [APPLICATION]</strong></p>
            <p>&nbsp;</p>
            <p>I, {${deponent}}, [gender] of [ residential address], [occupation], Nigerian citizen, do hereby make Oath and state as follows:</p>
            <p>1. That I am the {Plaintiff/Defendant} in this suit and by virtue of which I am conversant with the facts of this case.</p>
            <p>2. That I make this affidavit from facts within my personal knowledge, save where otherwise stated, and I verily believe same to be true.</p>
            <p>3. {That on or about the [DATE], the following events occurred: [FACT 1]}.</p>
            <p>4. {That as a result of the Respondent's actions, the Applicant has suffered [HARM]}.</p>
            <p>5. That [Fact requiring manual input].</p>
            <p>&nbsp;</p>
            <p><strong>SWORN TO at {the High Court Registry}</strong></p>
            <p><strong>This {DAY} day of {MONTH} 20[YEAR]</strong></p>
            <p>&nbsp;</p>
            <p style="text-align: right;"><strong>..........................................</strong></p>
            <p style="text-align: right;"><strong>D E P O N E N T</strong></p>
            <p>&nbsp;</p>
            <p><strong>BEFORE ME:</strong></p>
            <p>&nbsp;</p>
            <p><strong>COMMISSIONER FOR OATHS</strong></p>
        `.trim();
    }

    /**
     * Get template by name.
     */
    static getTemplate(templateName: string, matter: Matter): string {
        const name = templateName.toLowerCase();
        if (name.includes('writ')) return this.generateWritOfSummons(matter);
        if (name.includes('statement of claim') || name.includes('pleading')) return this.generateStatementOfClaim(matter);
        if (name.includes('affidavit')) return this.generateAffidavit(matter);
        if (name.includes('motion')) return this.generateMotionOnNotice(matter);
        
        const heading = this.generateHeading(matter);
        return `
            ${heading}
            <p style="text-align: center;"><strong>${templateName.toUpperCase()}</strong></p>
            <p>&nbsp;</p>
            <p>[DRAFT CONTENT COMMENCES HERE]</p>
        `.trim();
    }
}

