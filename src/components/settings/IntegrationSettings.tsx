import React, { useState } from 'react';
import { useCoreState } from '../../contexts/CoreContext';
import { useUI } from '../../contexts/UIContext';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { translateError } from '../../utils/errorTranslator';

const WhatsAppIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);
const ZapIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
);
const ExternalLinkIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6m4-3h6v6m-11 5L21 3" />
  </svg>
);

const IntegrationSettings: React.FC = () => {
  const { coreState } = useCoreState();
  const { addToast } = useUI();
  const updateFirm = useMutation(api.myFunctions.updateFirmSettings);

  const chakraConfig = coreState.firmDetails?.automationSettings?.chakra || { isActive: false };
  const [editingConfig, setEditingConfig] = useState(chakraConfig);
  const [isSaving, setIsSaving] = useState(false);

  // Simple status derivation (inline — removed the upsell-related imports)
  const status = chakraConfig?.isActive ? 'connected' : 'not_configured';

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateFirm({
        firmId: coreState.firmDetails?.id || '',
        settings: {
          automationSettings: {
            ...coreState.firmDetails?.automationSettings,
            chakra: editingConfig,
            provider: editingConfig.isActive ? 'chakra' : 'manual'
          }
        }
      });
      addToast('Integration settings updated', { type: 'success' });
    } catch (e: any) {
      addToast(translateError(e, "save settings"), { type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-4xl">
      {/* Overview Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white dark:bg-zinc-900 rounded-lg flex items-center justify-center p-2">
              <img src="https://chakrahq.com/favicon.ico" alt="ChakraHQ" className="w-full h-full object-contain" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">ChakraHQ Integration</h3>
              <p className="text-xs text-slate-500">WhatsApp Business API & Omni-channel Communication</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <span className={`text-2xs font-black uppercase px-2 py-1 rounded-full ${
               status === 'connected' ? 'bg-emerald-500/20 text-emerald-400' : 
               status === 'simulated' ? 'bg-amber-500/20 text-amber-400' : 
               'bg-slate-800 text-slate-500'
             }`}>
               {status.replace('_', ' ')}
             </span>
             <a href="https://chakrahq.com" target="_blank" rel="noreferrer" className="text-slate-500 hover:text-white transition-colors">
               <ExternalLinkIcon />
             </a>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Configuration</h4>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-800">
                <span className="text-sm text-slate-300">Enable Integration</span>
                <button 
                  onClick={() => setEditingConfig({ ...editingConfig, isActive: !editingConfig.isActive })}
                  className={`w-10 h-6 rounded-full transition-colors relative ${editingConfig.isActive ? 'bg-emerald-600' : 'bg-slate-700'}`}
                >
                  <div className={`absolute top-1 left-1 w-4 h-4 bg-white dark:bg-zinc-900 rounded-full transition-transform ${editingConfig.isActive ? 'translate-x-4' : ''}`} />
                </button>
              </div>

              {editingConfig.isActive && (
                <div className="space-y-3 animate-slide-down">
                  <div>
                    <label className="block text-2xs text-slate-500 mb-1 uppercase tracking-wider">Account ID</label>
                    <input 
                      type="text" 
                      value={editingConfig.accountId || ''} 
                      onChange={e => setEditingConfig({ ...editingConfig, accountId: e.target.value })}
                      placeholder="ACxxxxxxxxxxxxxxxxxxxx"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-2xs text-slate-500 mb-1 uppercase tracking-wider">Connected Phone</label>
                    <input 
                      type="text" 
                      value={editingConfig.connectedPhone || ''} 
                      onChange={e => setEditingConfig({ ...editingConfig, connectedPhone: e.target.value })}
                      placeholder="+234 800 000 0000"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="bg-amber-900/10 border border-amber-900/30 rounded-lg p-3">
                    <p className="text-2xs text-amber-500/80 leading-relaxed italic">
                      API Keys are configured by the PracticePro administrator during the initial onboarding session for security.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4">
              <button 
                onClick={handleSave}
                disabled={isSaving}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-lg transition-all shadow-lg shadow-emerald-900/20 disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Update Integration'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IntegrationSettings;
