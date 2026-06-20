import React, { useState, useMemo } from 'react';
import { useCoreState } from '../../contexts/CoreContext';
import { useUI } from '../../contexts/UIContext';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { translateError } from '../../utils/errorTranslator';
import { 
  estimateChakraPlan, 
  deriveIntegrationStatus, 
  getAllChakraPlans, 
  ChakraPlanKey 
} from '../../services/communicationIntegration';

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

  // Estimation state
  const totalUnits = useMemo(() => (coreState.properties || []).reduce((acc, p) => acc + (p.numberOfUnits || 1), 0), [coreState.properties]);
  const estimation = useMemo(() => estimateChakraPlan(totalUnits, 3), [totalUnits]);
  
  const status = deriveIntegrationStatus(chakraConfig);
  const plans = getAllChakraPlans();

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
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center p-2">
              <img src="https://chakrahq.com/favicon.ico" alt="ChakraHQ" className="w-full h-full object-contain" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">ChakraHQ Integration</h3>
              <p className="text-xs text-slate-500">WhatsApp Business API & Omni-channel Communication</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${
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

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Configuration</h4>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl border border-slate-800">
                <span className="text-sm text-slate-300">Enable Integration</span>
                <button 
                  onClick={() => setEditingConfig({ ...editingConfig, isActive: !editingConfig.isActive })}
                  className={`w-10 h-6 rounded-full transition-colors relative ${editingConfig.isActive ? 'bg-emerald-600' : 'bg-slate-700'}`}
                >
                  <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${editingConfig.isActive ? 'translate-x-4' : ''}`} />
                </button>
              </div>

              {editingConfig.isActive && (
                <div className="space-y-3 animate-slide-down">
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1 uppercase tracking-wider">Account ID</label>
                    <input 
                      type="text" 
                      value={editingConfig.accountId || ''} 
                      onChange={e => setEditingConfig({ ...editingConfig, accountId: e.target.value })}
                      placeholder="ACxxxxxxxxxxxxxxxxxxxx"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1 uppercase tracking-wider">Plan Level</label>
                    <select 
                      value={editingConfig.plan || 'free'} 
                      onChange={e => setEditingConfig({ ...editingConfig, plan: e.target.value as any })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="free">Free Tier</option>
                      <option value="starter">Starter Plan</option>
                      <option value="pro">Professional Plan</option>
                      <option value="enterprise">Enterprise</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1 uppercase tracking-wider">Connected Phone</label>
                    <input 
                      type="text" 
                      value={editingConfig.connectedPhone || ''} 
                      onChange={e => setEditingConfig({ ...editingConfig, connectedPhone: e.target.value })}
                      placeholder="+234 800 000 0000"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="bg-amber-900/10 border border-amber-900/30 rounded-xl p-3">
                    <p className="text-[10px] text-amber-500/80 leading-relaxed italic">
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
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-emerald-900/20 disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Update Integration'}
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Plan Estimator (AI Recommendation)</h4>
            
            <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg">
                  <ZapIcon />
                </div>
                <div>
                  <p className="text-xs text-slate-400">Recommended for your firm:</p>
                  <p className="text-sm font-black text-white">{estimation.planDetails.label} Plan</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {estimation.reasoning}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-slate-500 uppercase">Estimated Monthly</p>
                  <p className="text-sm font-black text-white">{estimation.planDetails.currency} {estimation.planDetails.cost.toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-500 uppercase">Volume Cap</p>
                  <p className="text-sm font-black text-white">{estimation.planDetails.whatsappLimit === 0 ? 'Unlimited' : `${estimation.planDetails.whatsappLimit.toLocaleString()} msgs`}</p>
                </div>
              </div>

              {estimation.alternatives.length > 0 && (
                <div className="bg-slate-800/30 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Alternative Option</p>
                  <p className="text-[10px] text-slate-300 italic">
                    <span className="font-bold text-slate-100">{estimation.alternatives[0].plan.toUpperCase()}:</span> {estimation.alternatives[0].why}
                  </p>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2 p-3 bg-blue-900/10 border border-blue-900/30 rounded-xl">
              <div className="text-blue-400">ℹ️</div>
              <p className="text-[10px] text-slate-400 leading-tight">
                ChakraHQ provides a dedicated WhatsApp Business account. Once connected, your tenants will receive official notifications from your firm's name.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Plan Comparison Table */}
      <div className="space-y-4">
        <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest px-1">ChakraHQ Pricing Tiers</h4>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {plans.map(plan => (
            <div key={plan.key} className={`p-4 rounded-2xl border transition-all ${
              editingConfig.plan === plan.key ? 'bg-emerald-900/10 border-emerald-500/50' : 'bg-slate-900 border-slate-800 hover:border-slate-700'
            }`}>
              <p className="text-xs font-black text-white uppercase tracking-wider mb-1">{plan.label}</p>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-xl font-black text-white">{plan.cost === 0 && plan.key === 'enterprise' ? 'Custom' : plan.cost === 0 ? 'Free' : `₦${(plan.cost/1000).toFixed(0)}k`}</span>
                {plan.cost > 0 && <span className="text-[10px] text-slate-500">/mo</span>}
              </div>
              <ul className="space-y-2 mb-4">
                {plan.features.slice(0, 3).map((f, i) => (
                  <li key={i} className="text-[10px] text-slate-400 flex items-start gap-1.5">
                    <span className="text-emerald-500 text-[8px] mt-0.5">●</span>
                    {f}
                  </li>
                ))}
              </ul>
              <button 
                onClick={() => setEditingConfig({ ...editingConfig, plan: plan.key as any, isActive: true })}
                className={`w-full py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors ${
                  editingConfig.plan === plan.key ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                }`}
              >
                {editingConfig.plan === plan.key ? 'Selected' : 'Select'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default IntegrationSettings;
