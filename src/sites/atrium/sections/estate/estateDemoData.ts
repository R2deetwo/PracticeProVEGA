/**
 * estateDemoData — the demo estate the interactive explorer runs on.
 *
 * R41 owner direction: the estate band should let a visitor "almost play
 * around with it" — click a property, open the units, open a unit, pull
 * its menu. The dataset below is the app's OWN demo estate (the same
 * Parkview Gardens / Lekki Heights / Warehouse Block 4 / Horizon Plaza
 * portfolio that ships in src/utils/demoData.ts and appears in every
 * live capture), lifted into a small, typed, dependency-free module so
 * the marketing page can run the interface without Convex, auth, or any
 * app import.
 *
 * Dates are computed at module load (daysAgo / daysFromNow) exactly like
 * the app's demo data, so lease ends, urgency chips and term progress
 * always read current. Nothing here is invented marketing copy — every
 * name, rent and status is the demo estate the product itself ships.
 */

export type UnitStatus = 'Occupied' | 'Vacant' | 'Maintenance';

export type DemoServiceCharge = {
    category: string;
    amount: number;
    status: 'PAID_FULLY' | 'PARTIALLY_PAID' | 'UNPAID';
    outstanding: number;
};

export type DemoUnit = {
    id: string;
    name: string;
    floor: number | null;
    status: UnitStatus;
    tenantName?: string;
    tenantPhone?: string;
    rentAmount: number;
    rentFrequency: 'Annually' | 'Monthly';
    leaseStart?: Date;
    leaseEnd?: Date;
    serviceCharge?: DemoServiceCharge;
};

export type DemoPayment = {
    id: string;
    description: string;
    amount: number;
    date: Date;
    status: 'paid' | 'pending' | 'overdue';
};

export type DemoTimelineEvent = {
    id: string;
    type: 'inspection' | 'maintenance' | 'rent_collected';
    date: Date;
    description: string;
};

export type DemoProperty = {
    id: string;
    address: string;
    owner: string;
    propertyType: 'Residential' | 'Industrial' | 'Commercial';
    category: 'Tenanted Property' | 'Property For Sale';
    status: 'Occupied' | 'Partially Occupied' | 'Vacant';
    value: number;
    units: DemoUnit[];
    saleTarget?: number;
    payments: DemoPayment[];
    timeline: DemoTimelineEvent[];
};

// ─── date helpers (module-load, like the app's demo data) ───────────────────
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);
const daysFromNow = (n: number) => new Date(Date.now() + n * DAY);

/** en-GB short date — the format the app renders everywhere (31/07/2027). */
export const fmtDate = (d?: Date): string => {
    if (!d) return '—';
    try { return d.toLocaleDateString('en-GB'); } catch { return '—'; }
};

/** ₦3,200,000 — the app's rent chip format (en-NG grouping). */
export const fmtNaira = (n: number): string => `₦${n.toLocaleString('en-NG')}`;

/** Days until a lease ends (negative = past). Null when no lease. */
export const daysUntil = (d?: Date): number | null =>
    d ? Math.ceil((d.getTime() - Date.now()) / DAY) : null;

/** Tenancy term progress 0..1 (same math as the app's computeTermProgress). */
export const termProgress = (u: DemoUnit): number | null => {
    if (!u.leaseStart || !u.leaseEnd) return null;
    const start = u.leaseStart.getTime();
    const end = u.leaseEnd.getTime();
    if (end <= start) return null;
    return Math.max(0, Math.min(1, (Date.now() - start) / (end - start)));
};

// ─── the estate ─────────────────────────────────────────────────────────────

const parkviewUnits: DemoUnit[] = [
    {
        id: 'spu-1', name: 'Unit 1A', floor: 1, status: 'Occupied',
        tenantName: 'Mr. Emeka Obi', tenantPhone: '0803 111 0001',
        rentAmount: 3200000, rentFrequency: 'Annually',
        leaseStart: daysAgo(90), leaseEnd: daysFromNow(275),
        serviceCharge: { category: 'Diesel', amount: 45000, status: 'PAID_FULLY', outstanding: 0 },
    },
    {
        id: 'spu-2', name: 'Unit 1B', floor: 1, status: 'Occupied',
        tenantName: 'Mrs. Funke Adeyemi', tenantPhone: '0803 111 0002',
        rentAmount: 3200000, rentFrequency: 'Annually',
        leaseStart: daysAgo(200), leaseEnd: daysFromNow(165),
        serviceCharge: { category: 'Cleaning', amount: 15000, status: 'PARTIALLY_PAID', outstanding: 7000 },
    },
    {
        id: 'spu-3', name: 'Unit 2A', floor: 2, status: 'Vacant',
        rentAmount: 3500000, rentFrequency: 'Annually',
    },
    {
        id: 'spu-4', name: 'Unit 2B', floor: 2, status: 'Occupied',
        tenantName: 'Dr. Aisha Bello', tenantPhone: '0803 111 0004',
        rentAmount: 3500000, rentFrequency: 'Annually',
        leaseStart: daysAgo(30), leaseEnd: daysFromNow(335),
        serviceCharge: { category: 'Cleaning', amount: 15000, status: 'PARTIALLY_PAID', outstanding: 7000 },
    },
    {
        id: 'spu-5', name: 'Unit 3A', floor: 3, status: 'Occupied',
        tenantName: 'Mr. Tunde Williams', tenantPhone: '0803 111 0005',
        rentAmount: 3800000, rentFrequency: 'Annually',
        leaseStart: daysAgo(120), leaseEnd: daysFromNow(245),
        serviceCharge: { category: 'Security', amount: 25000, status: 'UNPAID', outstanding: 25000 },
    },
    {
        id: 'spu-6', name: 'Unit 3B', floor: 3, status: 'Vacant',
        rentAmount: 3800000, rentFrequency: 'Annually',
    },
    {
        id: 'spu-7', name: 'Penthouse A', floor: 4, status: 'Occupied',
        tenantName: 'Dr. John Doe', tenantPhone: '0802 222 3333',
        rentAmount: 8500000, rentFrequency: 'Annually',
        leaseStart: daysAgo(60), leaseEnd: daysFromNow(305),
    },
    {
        id: 'spu-8', name: 'Penthouse B', floor: 4, status: 'Maintenance',
        rentAmount: 8500000, rentFrequency: 'Annually',
    },
];

export const ESTATE_PROPERTIES: DemoProperty[] = [
    {
        id: 'sp-4',
        address: 'Parkview Gardens, 5 Golf Estate Road, GRA, Port Harcourt',
        owner: 'Dr. John Doe',
        propertyType: 'Residential',
        category: 'Tenanted Property',
        status: 'Partially Occupied',
        value: 780000000,
        units: parkviewUnits,
        payments: [
            { id: 'sph4', description: 'Monthly Rent - Unit 1A', amount: 3200000, date: daysAgo(10), status: 'pending' },
            { id: 'sph5', description: 'Service Charge - Unit 2B', amount: 3500000, date: daysAgo(40), status: 'overdue' },
        ],
        timeline: [
            { id: 'spt4', type: 'inspection', date: daysAgo(5), description: 'Q2 block inspection completed. Unit 3B cleared for re-letting.' },
        ],
    },
    {
        id: 'sp-1',
        address: 'Lekki Heights Apartments, 12b Admiralty Way, Lekki Phase 1, Lagos',
        owner: 'Dr. John Doe',
        propertyType: 'Residential',
        category: 'Tenanted Property',
        status: 'Occupied',
        value: 450000000,
        units: [
            {
                id: 'sp-1-a1', name: 'Unit A1', floor: 1, status: 'Occupied',
                tenantName: 'Dr. John Doe', tenantPhone: '08022223333',
                rentAmount: 4500000, rentFrequency: 'Annually',
                leaseStart: daysAgo(180), leaseEnd: daysFromNow(185),
            },
        ],
        payments: [
            { id: 'sph1', description: 'Annual Rent 2023/24', amount: 4500000, date: daysAgo(180), status: 'paid' },
            { id: 'sph2', description: 'Annual Rent 2024/25', amount: 4500000, date: daysFromNow(180), status: 'pending' },
        ],
        timeline: [
            { id: 'spt1', type: 'rent_collected', date: daysAgo(30), description: 'Annual rent collected for Unit A1' },
        ],
    },
    {
        id: 'sp-2',
        address: 'Warehouse Block 4, Agbara Industrial Estate, Ogun',
        owner: 'Z-Alpha Logistics Ltd',
        propertyType: 'Industrial',
        category: 'Tenanted Property',
        status: 'Occupied',
        value: 320000000,
        units: [
            {
                id: 'sp-2-w4', name: 'Block 4', floor: null, status: 'Occupied',
                tenantName: 'Z-Alpha Logistics Ltd', tenantPhone: '012224444',
                rentAmount: 12000000, rentFrequency: 'Annually',
                leaseStart: daysAgo(300), leaseEnd: daysFromNow(65),
            },
        ],
        payments: [
            { id: 'sph3', description: 'Annual Service Charge', amount: 12000000, date: daysAgo(300), status: 'overdue' },
        ],
        timeline: [
            { id: 'spt2', type: 'maintenance', date: daysAgo(10), description: 'Roof repairs completed' },
        ],
    },
    {
        id: 'sp-3',
        address: 'Horizon Plaza, Plot 44 CBD, Abuja',
        owner: 'Horizon Properties',
        propertyType: 'Commercial',
        category: 'Property For Sale',
        status: 'Vacant',
        value: 1200000000,
        units: [],
        saleTarget: 1500000000,
        payments: [],
        timeline: [
            { id: 'spt3', type: 'inspection', date: daysAgo(2), description: 'Prospective buyer site inspection' },
        ],
    },
];

// ─── derived reads (same grammar the app's list and Units tab use) ──────────

export const unitCount = (p: DemoProperty): number => Math.max(p.units.length, 1);

export const unitCountText = (p: DemoProperty): string => {
    const n = unitCount(p);
    return `${n} ${n === 1 ? 'Unit' : 'Units'}`;
};

export const rentRange = (p: DemoProperty): [number, number] | null => {
    const rents = p.units.map(u => u.rentAmount).filter(r => r > 0);
    if (rents.length === 0) return null;
    return [Math.min(...rents), Math.max(...rents)];
};

export const occupancy = (p: DemoProperty) => ({
    occupied: p.units.filter(u => u.status === 'Occupied').length,
    vacant: p.units.filter(u => u.status === 'Vacant').length,
    maintenance: p.units.filter(u => u.status === 'Maintenance').length,
});

/** The manager signed in on this workspace (the app's demo user). */
export const MANAGER = { name: 'David Atrium', initials: 'DA', role: 'ADMIN' };

/** The firm label the sidebar carries. */
export const FIRM_LABEL = { name: 'Atrium Management', sub: 'ATRIUM OS' };
