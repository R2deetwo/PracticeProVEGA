
/**
 * Shared validation utilities for the Atrium/Vega platform.
 */

export const isValidEmail = (email: string): boolean => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
};

export const formatPhoneNumber = (phone: string): string => {
    // Basic Nigerian format normalization: 080... -> +23480...
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('0') && cleaned.length === 11) {
        return '+234' + cleaned.substring(1);
    }
    return phone;
};

export const sanitizeString = (str: string): string => {
    return str.trim().replace(/[<>]/g, ''); // Simple XSS protection
};
