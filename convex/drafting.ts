import { mutation, query, action } from "./_generated/server";
import { v } from "convex/values";
import { requireFirmUser } from "./authHelpers";


interface FieldMapping {
  landlord_name?: string;
  landlord_address?: string;
  tenant_name?: string;
  tenant_address?: string;
  property_address?: string;
  rent_amount?: number;
  rent_period?: string;
  arrears_from?: Date;
  arrears_to?: Date;
  total_arrears?: number;
  demand_date?: Date;
  notice_period?: number;
}

export const generateRentDemand = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    propertyId: v.id("properties"),
    matterId: v.optional(v.id("matters")),
  },
  handler: async (ctx, args) => {
    const { firmId, userId } = await requireFirmUser(ctx, undefined, args.sessionToken);
    
    // Fetch property
    const property = await ctx.db.get(args.propertyId);
    if (!property || property.firmId !== firmId) {
      throw new Error("Property not found");
    }

    // Fetch landlord (contact)
    let landlord = null;
    if (property.ownerId) {
      landlord = await ctx.db.get(property.ownerId as any);
    }

    // Fetch active tenancy
    const tenancies = await ctx.db
      .query("tenancies")
      .withIndex("by_property", (q) => q.eq("propertyId", args.propertyId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect() as unknown as any[];
      
    const activeTenancy = tenancies[0];
    
    let tenant = null;
    if (activeTenancy && activeTenancy.tenantId) {
      tenant = await ctx.db.get(activeTenancy.tenantId);
    }

    const fields: FieldMapping = {
      landlord_name: (landlord as any)?.name,
      landlord_address: (landlord as any)?.address,
      tenant_name: (tenant as any)?.name,
      tenant_address: (tenant as any)?.address,
      property_address: (property as any)?.address || undefined,
      rent_amount: activeTenancy?.rentAmount,
      rent_period: activeTenancy?.paymentFrequency || "Yearly",
      arrears_from: activeTenancy?.arrearsFrom ? new Date(activeTenancy.arrearsFrom) : undefined,
      arrears_to: activeTenancy?.arrearsTo ? new Date(activeTenancy.arrearsTo) : undefined,
      total_arrears: activeTenancy?.totalArrears || 0,
      demand_date: new Date(),
      notice_period: 7
    };

    const detectMissingFields = (f: FieldMapping): string[] => {
      const required = ['landlord_name', 'tenant_name', 'property_address', 'rent_amount', 'total_arrears'];
      return required.filter(key => !(f as any)[key]);
    };

    const renderRentDemandMarkdown = (f: FieldMapping): string => {
      const formatCurrency = (amt?: number) => amt ? `₦${amt.toLocaleString('en-NG')}` : '[AMOUNT]';
      const formatDate = (d?: Date) => d ? d.toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' }) : '[DATE]';

      return `
---
**RENT DEMAND NOTICE**  
*(Recovery of Premises Act, Cap R9, LFN 2004)*

---

**Date:** ${formatDate(f.demand_date)}

**To:**  
${f.tenant_name || '[TENANT NAME]'}  
${f.tenant_address || '[TENANT ADDRESS]'}

**Re: Rent Arrears for Property at ${f.property_address || '[PROPERTY ADDRESS]'}**

---

Dear ${f.tenant_name || 'Tenant'},

We act for **${f.landlord_name || '[LANDLORD NAME]'}**, the landlord of the above-referenced property.

Our client has instructed us that you are currently in arrears of rent for the period from **${formatDate(f.arrears_from)}** to **${formatDate(f.arrears_to)}**, amounting to **${formatCurrency(f.total_arrears)}**.

**TAKE NOTICE** that you are hereby required to pay the outstanding sum of **${formatCurrency(f.total_arrears)}** within **${f.notice_period || 7} days** from the date of this notice, failing which our client shall commence recovery proceedings without further notice to you.

Payment should be made to:  
**${f.landlord_name || '[LANDLORD NAME]'}**  
${f.landlord_address || '[LANDLORD ADDRESS]'}

Yours faithfully,

**PracticePro Legal Services**  
*For and on behalf of ${f.landlord_name || '[LANDLORD NAME]'}*

---
      `.trim();
    };

    const renderRentDemandLaTeX = (f: FieldMapping): string => {
      const formatCurrency = (amt?: number) => amt ? `\\#${amt.toLocaleString('en-NG')}` : '[AMOUNT]';
      const formatDate = (d?: Date) => d ? d.toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' }) : '[DATE]';

      return `\\documentclass[12pt,a4paper]{article}
\\usepackage{times}
\\usepackage[margin=2.5cm]{geometry}
\\usepackage{fancyhdr}
\\usepackage{ulem}
\\pagestyle{fancy}
\\fancyhf{}
\\renewcommand{\\headrulewidth}{0pt}
\\begin{document}

\\begin{flushright}
\\textbf{Date:} ${formatDate(f.demand_date)}
\\end{flushright}

\\vspace{1cm}

\\noindent
\\textbf{TO:}\\\\
\\textbf{${f.tenant_name || '[TENANT NAME]'}}\\\\
${f.tenant_address?.replace(/\\n/g, '\\\\') || '[TENANT ADDRESS]'}

\\vspace{1cm}

\\begin{center}
\\textbf{\\Large RENT DEMAND NOTICE}\\\\
\\textit{(Pursuant to the Recovery of Premises Act, Cap R9, LFN 2004)}
\\end{center}

\\vspace{0.5cm}

\\noindent
\\textbf{RE: RENT ARREARS FOR PROPERTY AT ${f.property_address || '[PROPERTY ADDRESS]'}}

\\vspace{0.5cm}

\\noindent
Dear ${f.tenant_name || 'Tenant'},

\\vspace{0.5cm}

\\noindent
We act as legal practitioners and managing agents for \\textbf{${f.landlord_name || '[LANDLORD NAME]'} (hereinafter referred to as "our Client")}, the Landlord of the above-referenced property.

\\vspace{0.5cm}

\\noindent
Our Client has instructed us that you are currently in arrears of rent for the period from \\textbf{${formatDate(f.arrears_from)}} to \\textbf{${formatDate(f.arrears_to)}}, amounting to \\textbf{${formatCurrency(f.total_arrears)}}.

\\vspace{0.5cm}

\\noindent
\\textbf{TAKE NOTICE} that you are hereby required to pay the outstanding sum of \\textbf{${formatCurrency(f.total_arrears)}} within \\textbf{${f.notice_period || 7} days} from the date of service of this notice upon you, failing which our Client shall commence recovery of premises proceedings against you without further notice.

\\vspace{0.5cm}

\\noindent
Payment should be made immediately to:

\\vspace{0.3cm}
\\noindent
\\textbf{${f.landlord_name || '[LANDLORD NAME]'}}\\\\
${f.landlord_address?.replace(/\\n/g, '\\\\') || '[LANDLORD ADDRESS]'}

\\vspace{1cm}

\\noindent
Yours faithfully,

\\vspace{1.5cm}

\\noindent
\\textbf{___________________________}\\\\
\\textbf{PracticePro Legal Services}\\\\
\\textit{For and on behalf of ${f.landlord_name || '[LANDLORD NAME]'} }

\\end{document}`;
    };

    const missingFields = detectMissingFields(fields);
    const markdown = renderRentDemandMarkdown(fields);
    const latex = renderRentDemandLaTeX(fields);

    const metaId = await ctx.db.insert("documentGenerationMetadata", {
      documentType: "rent_demand",
      propertyId: args.propertyId,
      matterId: args.matterId,
      firmId,
      fieldMappings: JSON.stringify(fields),
      missingFields: JSON.stringify(missingFields),
      renderedOutput: markdown,
      createdAt: Date.now(),
      createdBy: userId,
    });

    return {
      metadataId: metaId,
      markdown,
      latex,
      missingFields,
    };
  },
});
