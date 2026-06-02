
/**
 * NIGERIAN COURT RULES CALCULATOR
 * 
 * Handles time computation in accordance with the Interpretation Act and 
 * Civil Procedure Rules of various High Courts (Lagos, Abuja, FHC).
 */

// Fixed Nigerian Public Holidays (Month is 0-indexed in JS Date)
const FIXED_HOLIDAYS = [
    { month: 0, day: 1, name: "New Year's Day" },
    { month: 4, day: 1, name: "Workers' Day" },
    { month: 5, day: 12, name: "Democracy Day" },
    { month: 9, day: 1, name: "Independence Day" },
    { month: 11, day: 25, name: "Christmas Day" },
    { month: 11, day: 26, name: "Boxing Day" },
];

/**
 * Calculates Western Easter Date using the Meeus/Jones/Butcher's algorithm.
 * Needed for Good Friday and Easter Monday.
 */
const getEasterDate = (year: number): Date => {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31) - 1; // 0-indexed month
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month, day);
};

// Helper to check if a specific date is a Nigerian public holiday
export const isPublicHoliday = (date: Date, customHolidays: string[] = []): boolean => {
    // 1. Check Fixed Holidays
    const isFixed = FIXED_HOLIDAYS.some(h => h.month === date.getMonth() && h.day === date.getDate());
    if (isFixed) return true;

    // 2. Check Dynamic Christian Holidays (Easter)
    const year = date.getFullYear();
    const easterSunday = getEasterDate(year);
    
    // Good Friday (2 days before Easter)
    const goodFriday = new Date(easterSunday);
    goodFriday.setDate(easterSunday.getDate() - 2);
    
    // Easter Monday (1 day after Easter)
    const easterMonday = new Date(easterSunday);
    easterMonday.setDate(easterSunday.getDate() + 1);

    if (date.toDateString() === goodFriday.toDateString()) return true;
    if (date.toDateString() === easterMonday.toDateString()) return true;

    // 3. Check Custom/Govt Declared Holidays (ISO Strings YYYY-MM-DD)
    const dateString = date.toISOString().split('T')[0];
    if (customHolidays.includes(dateString)) return true;

    return false;
};

export const isWeekend = (date: Date): boolean => {
    const day = date.getDay();
    return day === 0 || day === 6; // Sunday (0) or Saturday (6)
};

/**
 * Calculates the deadline date adding days to a start date.
 * 
 * RULE LOGIC:
 * 1. If the timeline is less than 7 days, weekends and public holidays are excluded (Business Days).
 * 2. If the timeline is 7 days or more, weekends/holidays are included (Calendar Days).
 * 3. EXCEPTION: If the calculated deadline falls on a weekend or public holiday, 
 *    it shifts to the next business day (Order 15, Lagos Rules / Interpretation Act).
 */
export const calculateCourtDeadline = (
    startDate: Date, 
    daysToAdd: number, 
    customHolidays: string[] = []
): { deadline: Date; isBusinessDays: boolean; note: string } => {
    let currentDate = new Date(startDate);
    // Rule 1: Determine if we are counting Business Days or Calendar Days
    const isBusinessDayCalculation = daysToAdd < 6; // Common rule in many States (e.g. Lagos Order 44)
    
    let daysAdded = 0;
    
    while (daysAdded < daysToAdd) {
        currentDate.setDate(currentDate.getDate() + 1);
        
        if (isBusinessDayCalculation) {
            // If strictly business days, skip weekends and holidays
            if (!isWeekend(currentDate) && !isPublicHoliday(currentDate, customHolidays)) {
                daysAdded++;
            }
        } else {
            // If calendar days, just count it
            daysAdded++;
        }
    }

    // Rule 3: The "Next Working Day" Rule
    // Even if we counted calendar days, the filing cannot happen on a Sunday or Holiday.
    let shiftMessage = "";
    let shiftCount = 0;
    
    // Safety loop to prevent infinite loop in case of configuration error
    while ((isWeekend(currentDate) || isPublicHoliday(currentDate, customHolidays)) && shiftCount < 30) {
        currentDate.setDate(currentDate.getDate() + 1);
        shiftMessage = "Deadline shifted to next working day via Interpretation Act.";
        shiftCount++;
    }

    return {
        deadline: currentDate,
        isBusinessDays: isBusinessDayCalculation,
        note: shiftMessage
    };
};

/**
 * Calculates days remaining, accounting for business days if the remaining time is short.
 */
export const calculateDaysRemaining = (
    dueDate: Date, 
    customHolidays: string[] = []
): { days: number; type: 'Calendar' | 'Business' } => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dueDate);
    target.setHours(0, 0, 0, 0);
    
    // Raw difference in ms
    const diffTime = target.getTime() - today.getTime();
    const diffDaysRaw = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDaysRaw <= 0) return { days: diffDaysRaw, type: 'Calendar' };

    // If gap is small, calculate actual business days remaining for better urgency context
    if (diffDaysRaw < 7) {
        let workingDays = 0;
        let tempDate = new Date(today);
        // Don't count today if it's already passed
        
        while (tempDate.getTime() < target.getTime()) {
            tempDate.setDate(tempDate.getDate() + 1);
            if (!isWeekend(tempDate) && !isPublicHoliday(tempDate, customHolidays)) {
                workingDays++;
            }
        }
        return { days: workingDays, type: 'Business' };
    }

    return { days: diffDaysRaw, type: 'Calendar' };
};
