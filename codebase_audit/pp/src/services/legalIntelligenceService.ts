import { LegalModule } from '../utils/legalModules';

/**
 * Service to interact with the secondary Convex Legal Intelligence backend.
 */
export const legalIntelligenceService = {
    /**
     * Fetches the active legal modules licensed to a specific firm.
     * 
     * @param firmId - The ID of the firm in the primary database
     * @param endpoint - The URL to the secondary Convex HTTP action (e.g., https://<secondary-convex>.convex.site/api/get-active-modules)
     */
    fetchActiveModules: async (firmId: string, endpoint: string): Promise<any[]> => {
        try {
            if (!endpoint || !firmId) {
                console.warn("LegalIntelService: Missing firmId or endpoint URL.");
                return [];
            }

            const url = new URL(endpoint);
            url.searchParams.append('firmId', firmId);

            const response = await fetch(url.toString(), {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    // Note: If the secondary backend requires a shared secret for server-to-server 
                    // authentication, it should be appended here. E.g.:
                    // 'Authorization': `Bearer ${process.env.VITE_LEGAL_INTEL_SECRET}`
                },
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data.modules || [];
        } catch (error) {
            console.error("LegalIntelService: Failed to fetch active modules from secondary backend:", error);
            // Fallback: gracefully return empty array so app doesn't crash 
            return [];
        }
    },

    /**
     * Tracks usage of a specific legal module action (e.g. "generated_deadline", "queried_case_law").
     * 
     * @param firmId - The ID of the firm
     * @param moduleId - The ID of the module (e.g. 'nwlr')
     * @param action - The action performed
     * @param endpoint - The usage tracking endpoint
     */
    trackModuleUsage: async (firmId: string, moduleId: string, action: string, endpoint: string): Promise<boolean> => {
        try {
            if (!endpoint) return false;

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    firmId,
                    moduleId,
                    action,
                    timestamp: new Date().toISOString()
                })
            });

            return response.ok;
        } catch (error) {
            console.error("LegalIntelService: Failed to track module usage:", error);
            return false;
        }
    }
};
