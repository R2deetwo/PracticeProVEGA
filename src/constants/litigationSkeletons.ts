export interface LitigationSkeleton {
  docType: string;
  sections: { heading: string; instruction: string; mandatoryBoilerplate?: string }[];
  neverOmit: string[];
}

export const LITIGATION_SKELETONS: Record<string, LitigationSkeleton> = {
  AFFIDAVIT: {
    docType: 'AFFIDAVIT',
    sections: [
      { heading: 'Caption', instruction: 'Court name, suit number, parties. Include "IN THE MATTER OF..." if applicable.' },
      { heading: 'Title', instruction: '"AFFIDAVIT IN SUPPORT OF [APPLICATION TYPE]" — derive application type from context.' },
      { heading: 'Opening Paragraph', instruction: 'Deponent introduction.', mandatoryBoilerplate: 'I, [DEPONENT NAME], [Male/Female] Adult, Nigerian, [occupation], of [CLIENT ADDRESS], do hereby make oath and state as follows:' },
      { heading: 'Numbered Facts', instruction: 'One fact per paragraph, first person, each starting with "That". Sequential numbering 1, 2, 3...' },
      { heading: 'Competency Paragraph', instruction: "State deponent's relationship to the matter and authority to depose (party, counsel's clerk, or agent with written authority)." },
      { heading: 'Source of Information', instruction: 'Where applicable.', mandatoryBoilerplate: 'That I was informed by [WITNESS NAME] on [NOTICE DATE] at [PROPERTY ADDRESS] and I verily believe same to be true' },
      { heading: 'Exhibit Reference', instruction: "Any document referenced must state '...now produced and shown to me marked Exhibit [LETTER]'" },
      { heading: 'Concluding Paragraph', instruction: 'Good faith declaration.', mandatoryBoilerplate: 'That I depose to this affidavit in good faith, believing its contents to be true and in accordance with the Oaths Act.' },
      { heading: 'Jurat', instruction: 'Sworn declaration block.', mandatoryBoilerplate: 'SWORN TO at the [COURT NAME] this ___ day of __________, 20__\n\nBEFORE ME\n\n_______________________\nCOMMISSIONER FOR OATHS' },
    ],
    neverOmit: ['competency paragraph', 'jurat block', 'source-of-information clause for any non-personal-knowledge fact', 'exhibit marking on every referenced document'],
  },
  MOTION_ON_NOTICE: {
    docType: 'MOTION_ON_NOTICE',
    sections: [
      { heading: 'Caption', instruction: 'Court name, suit number, parties.' },
      { heading: 'Motion Header', instruction: 'Pursuant to rule.', mandatoryBoilerplate: 'MOTION ON NOTICE brought pursuant to [ORDER AND RULE] of the [Rules of Court] and under the inherent jurisdiction of this Honourable Court' },
      { heading: 'Prayers', instruction: "Numbered list of specific reliefs sought, ending with 'AND FOR SUCH FURTHER ORDER(S) as this Honourable Court may deem fit to make in the circumstances.'" },
      { heading: 'Grounds', instruction: "Numbered list under heading 'TAKE FURTHER NOTICE that the grounds for this application are as follows:' — one ground per line, using [GROUNDS OF APPLICATION]" },
      { heading: 'Supporting Documents', instruction: 'Reference to supporting affidavit and written address.', mandatoryBoilerplate: 'TAKE NOTICE that this application is supported by an Affidavit and a Written Address.' },
      { heading: 'Signature Block', instruction: 'Counsel name, firm name, address for service, using [FIRM NAME], [FIRM ADDRESS], [SOLICITOR NAME] placeholders.' },
    ],
    neverOmit: ['specific rule/order citation', 'supporting documents line', 'counsel signature block'],
  },
  MOTION_EX_PARTE: {
    docType: 'MOTION_EX_PARTE',
    sections: [
      { heading: 'Caption', instruction: 'Court name, suit number, parties.' },
      { heading: 'Motion Header', instruction: 'Ex parte motion.', mandatoryBoilerplate: 'MOTION EX PARTE brought pursuant to [ORDER AND RULE] of the [Rules of Court] and under the inherent jurisdiction of this Honourable Court' },
      { heading: 'Urgency Justification', instruction: 'Include urgency justification paragraph if application is for interim/interlocutory relief.' },
      { heading: 'Prayers', instruction: "Numbered list of specific reliefs sought, ending with 'AND FOR SUCH FURTHER ORDER(S) as this Honourable Court may deem fit to make in the circumstances.'" },
      { heading: 'Grounds', instruction: "Numbered list under heading 'TAKE FURTHER NOTICE that the grounds for this application are as follows:' — one ground per line, using [GROUNDS OF APPLICATION]" },
      { heading: 'Supporting Documents', instruction: '', mandatoryBoilerplate: 'TAKE NOTICE that this application is supported by an Affidavit and a Written Address.' },
      { heading: 'Signature Block', instruction: 'Counsel name, firm name, address for service.' },
    ],
    neverOmit: ['specific rule/order citation', 'supporting documents line', 'counsel signature block', 'urgency justification paragraph'],
  },
  STATEMENT_OF_CLAIM: {
    docType: 'STATEMENT_OF_CLAIM',
    sections: [
      { heading: 'Caption', instruction: 'Court name, suit number, parties.' },
      { heading: 'Numbered Paragraphs', instruction: 'Facts only, chronological. Identify parties, cause of action, and particulars of claim/damages in dedicated paragraphs.' },
      { heading: 'Final Paragraph', instruction: 'Reliefs claimed.', mandatoryBoilerplate: 'WHEREOF the Claimant claims against the Defendant as follows:' },
      { heading: 'Signature', instruction: 'Dated and signed by counsel, with address for service.' },
    ],
    neverOmit: ['particulars of claim/damages paragraph', 'final reliefs paragraph', 'counsel signature and dated line'],
  },
  STATEMENT_OF_DEFENCE: {
    docType: 'STATEMENT_OF_DEFENCE',
    sections: [
      { heading: 'Caption', instruction: 'Court name, suit number, parties.' },
      { heading: 'Paragraph-by-Paragraph Response', instruction: "Mirror the Statement of Claim's paragraph numbers. Each paragraph must explicitly admit, deny, or state 'not admitted and puts Claimant to strict proof.' A general denial without paragraph-by-paragraph response is insufficient." },
      { heading: 'Additional Facts / Counterclaim', instruction: 'If applicable.' },
      { heading: 'Prayer', instruction: 'Concluding prayer for dismissal of claim.' },
    ],
    neverOmit: ['paragraph-by-paragraph admission/denial — never a blanket denial', 'prayer paragraph'],
  },
  WITNESS_STATEMENT: {
    docType: 'WITNESS_STATEMENT',
    sections: [
      { heading: 'Caption', instruction: 'Court name, suit number, parties.' },
      { heading: 'Opening', instruction: 'Deponent introduction.', mandatoryBoilerplate: 'I, [DEPONENT NAME], make this statement on oath and state as follows:' },
      { heading: 'Numbered Paragraphs', instruction: 'First person, evidentiary facts in chronological/logical order. This is trial evidence, not argument.' },
      { heading: 'Jurat', instruction: 'Sworn declaration block.', mandatoryBoilerplate: 'SWORN TO at the [COURT NAME] this ___ day of __________, 20__\n\nBEFORE ME\n\n_______________________\nCOMMISSIONER FOR OATHS' },
    ],
    neverOmit: ['jurat block', 'first-person evidentiary framing (not argumentative)'],
  },
  WRITTEN_ADDRESS: {
    docType: 'WRITTEN_ADDRESS',
    sections: [
      { heading: 'Cover Page', instruction: 'Court, suit number, parties.', mandatoryBoilerplate: '[COURT NAME]\n[SUIT NUMBER]\nBETWEEN\n[CLAIMANT NAME]\nAND\n[DEFENDANT NAME]\n\nWRITTEN ADDRESS IN SUPPORT OF/OPPOSITION TO [APPLICATION]' },
      { heading: '1.0 Introduction', instruction: 'Brief overview of the application and the issues.' },
      { heading: '2.0 Issues for Determination', instruction: "State as a question, e.g. 'Whether the Applicant has met the conditions for grant of the reliefs sought.'" },
      { heading: '3.0 Argument', instruction: 'Address each issue with legal authority (case law/statute) and application to facts.' },
      { heading: '4.0 Conclusion/Prayer', instruction: 'Conclusion tying argument back to prayer.' },
    ],
    neverOmit: ['explicit issue(s) for determination section', 'conclusion tying argument back to prayer'],
  },
  RECOVERY_OF_PREMISES: {
    docType: 'RECOVERY_OF_PREMISES',
    sections: [
      { heading: 'Complaint Header', instruction: "Use 'IN THE MAGISTRATE COURT OF LAGOS STATE' caption, not High Court caption." },
      { heading: 'Parties and Premises', instruction: 'Full [PROPERTY ADDRESS], nature of tenancy, rent payment terms.' },
      { heading: 'Grounds for Possession', instruction: 'State expiration of tenancy/notice served (reference [NOTICE DATE]) or rent default with arrears figure.' },
      { heading: 'Relief', instruction: 'Claims sought.', mandatoryBoilerplate: 'WHEREFORE the Claimant/Complainant claims: (a) Possession of the premises; (b) Arrears of rent in the sum of [CLAIM AMOUNT]; (c) Mesne profits until possession is given up; (d) Costs of this action.' },
    ],
    neverOmit: ['proof of notice served paragraph', 'mesne profits relief', 'costs relief'],
  },
};

export function getSkeleton(docType: string): LitigationSkeleton | undefined {
  const normalized = docType.toUpperCase().replace(/\s+/g, '_');
  return LITIGATION_SKELETONS[normalized];
}

export function getCourtTierInstruction(courtTier?: string | null): { caption: string; rulesCitation: string } {
  if (courtTier === 'magistrate') {
    return {
      caption: 'IN THE MAGISTRATE COURT OF LAGOS STATE, HOLDEN AT [COURT ADDRESS]',
      rulesCitation: 'Magistrate Court (Civil Procedure) Rules and, where relevant, the Recovery of Premises Law of Lagos State',
    };
  }
  // Default to High Court (also used when courtTier is unset)
  return {
    caption: 'IN THE HIGH COURT OF LAGOS STATE\nIN THE [JURISDICTION] JUDICIAL DIVISION',
    rulesCitation: 'High Court of Lagos State (Civil Procedure) Rules',
  };
}
