
/**
 * LEGAL PRACTITIONERS REMUNERATION CALCULATOR
 * Based on the Legal Practitioners (Remuneration for Legal Documentation and Other Land Matters) Order 2023.
 * 
 * This fortification ensures lawyers do not undercharge and run afoul of the NBA guidelines.
 */

export type ScaleType = 'Scale I' | 'Scale II' | 'Scale III';

export interface FeeCalculation {
    scale: ScaleType;
    minFee: number;
    percentage: number;
    breakdown: string;
}

/**
 * SCALE I: Sales, Purchases, and Mortgages (Vendor/Mortgagor's Solicitor)
 * - First N10m: 15%
 * - Next N10m: 10%
 * - Next N30m: 7.5%
 * - Next N450m: 3%
 * - Above N500m: 1.5%
 */
export const calculateScaleIFees = (consideration: number): FeeCalculation => {
    let remaining = consideration;
    let fee = 0;
    let breakdown = "";
    
    // Tier 1: First 10m
    const tier1 = Math.min(remaining, 10000000);
    fee += tier1 * 0.15;
    breakdown += `First ₦10m @ 15% = ₦${(tier1 * 0.15).toLocaleString()}\n`;
    remaining -= tier1;

    // Tier 2: Next 10m
    if (remaining > 0) {
        const tier2 = Math.min(remaining, 10000000);
        fee += tier2 * 0.10;
        breakdown += `Next ₦10m @ 10% = ₦${(tier2 * 0.10).toLocaleString()}\n`;
        remaining -= tier2;
    }

    // Tier 3: Next 30m
    if (remaining > 0) {
        const tier3 = Math.min(remaining, 30000000);
        fee += tier3 * 0.075;
        breakdown += `Next ₦30m @ 7.5% = ₦${(tier3 * 0.075).toLocaleString()}\n`;
        remaining -= tier3;
    }

    // Tier 4: Next 450m
    if (remaining > 0) {
        const tier4 = Math.min(remaining, 450000000);
        fee += tier4 * 0.03;
        breakdown += `Next ₦450m @ 3% = ₦${(tier4 * 0.03).toLocaleString()}\n`;
        remaining -= tier4;
    }

    // Tier 5: Remainder
    if (remaining > 0) {
        fee += remaining * 0.015;
        breakdown += `Balance > ₦500m @ 1.5% = ₦${(remaining * 0.015).toLocaleString()}\n`;
    }

    return {
        scale: 'Scale I',
        minFee: fee,
        percentage: (fee / consideration) * 100,
        breakdown: breakdown.trim()
    };
};

/**
 * SCALE II: Leases/Tenancy (Solicitor to Lessor)
 * - Rent < N5m: 15%
 * - Rent > N5m: 10% (on residue?)
 */
export const calculateScaleIIFees = (rent: number, years: number = 1): FeeCalculation => {
    const totalConsideration = rent * years;
    let fee = 0;
    let percentage = 0;
    let breakdown = "";

    if (totalConsideration <= 5000000) {
        fee = totalConsideration * 0.15;
        percentage = 15;
        breakdown = `Total Rent ₦${totalConsideration.toLocaleString()} @ 15% = ₦${fee.toLocaleString()}`;
    } else {
        // First 5m at 15%
        fee += 5000000 * 0.15;
        breakdown += `First ₦5m @ 15% = ₦750,000\n`;
        
        // Remainder at 10%
        const balance = totalConsideration - 5000000;
        fee += balance * 0.10;
        breakdown += `Balance ₦${balance.toLocaleString()} @ 10% = ₦${(balance * 0.10).toLocaleString()}`;
        
        percentage = (fee / totalConsideration) * 100;
    }

    return {
        scale: 'Scale II',
        minFee: fee,
        percentage: percentage,
        breakdown: breakdown.trim()
    };
};
