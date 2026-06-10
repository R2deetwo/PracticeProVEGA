import React, { useState } from 'react';
import { EyeIcon, EyeOffIcon, LogoutIcon, LockClosedIcon } from '../constants';
import { inputLarge } from '../utils/formStyles';
import { useAuth } from '../contexts/AuthContext';

interface LockScreenProps {
    onUnlock: () => void;
}

const LockScreen: React.FC<LockScreenProps> = ({ onUnlock }) => {
    const { currentUser, logout, login } = useAuth();
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [attempts, setAttempts] = useState(0);
    const MAX_ATTEMPTS = 5;

    const handleUnlock = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!password.trim()) return;
        if (attempts >= MAX_ATTEMPTS) return;

        setIsLoading(true);
        setError('');

        try {
            // Re-authenticate against the real backend using the current user's email.
            // The login() function queries Convex to verify the account is valid and active.
            // This ensures the lock screen cannot be bypassed with arbitrary input.
            const result = await login(currentUser?.email || '', password);

            if (result.success) {
                onUnlock();
            } else {
                const newAttempts = attempts + 1;
                setAttempts(newAttempts);
                if (newAttempts >= MAX_ATTEMPTS) {
                    setError('Too many failed attempts. Please sign out and log back in.');
                } else {
                    setError(`Incorrect password. ${MAX_ATTEMPTS - newAttempts} attempt${MAX_ATTEMPTS - newAttempts === 1 ? '' : 's'} remaining.`);
                }
                setPassword('');
            }
        } catch {
            setError('Verification failed. Please check your connection and try again.');
        } finally {
            setIsLoading(false);
        }
    };


    // inputLarge is now imported at top level
    const commonInputClass = inputLarge.replace('rounded-md', 'rounded-lg').replace('dark:bg-zinc-700', 'dark:bg-zinc-700/50') + " focus:ring-2 focus:border-transparent transition-all placeholder:text-slate-400";

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center animate-fade-in">
            {/* Darker background and heavier blur */}
            <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-xl"></div>
            
            <div className="relative bg-white dark:bg-zinc-800 p-8 sm:p-10 rounded-3xl shadow-2xl text-center w-full max-w-md m-4 border border-slate-200 dark:border-zinc-700">
                <div className="w-16 h-16 bg-primary-50 dark:bg-primary-900/20 text-primary-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner mt-2">
                    <LockClosedIcon className="w-8 h-8" />
                </div>
                
                <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Session Locked</h2>
                <p className="text-sm text-slate-500 dark:text-zinc-400 mb-8 max-w-[280px] mx-auto">
                    Please enter your password to unlock your workspace.
                </p>

                <form onSubmit={handleUnlock} className="space-y-5 text-left">
                    <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-widest mb-1.5 ml-1">Email</label>
                        <input
                            type="email"
                            value={currentUser?.email || ''}
                            disabled
                            className={`${commonInputClass} opacity-60 cursor-not-allowed`}
                            autoComplete="username"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-widest mb-1.5 ml-1">Password</label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter password"
                                className={`${commonInputClass} pr-12`}
                                required
                                autoFocus
                                autoComplete="current-password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors"
                            >
                                {showPassword ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                            <p className="text-xs font-bold text-red-600 dark:text-red-400 text-center">{error}</p>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading || !password || attempts >= MAX_ATTEMPTS}
                        className="w-full mt-2 py-3.5 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : 'Unlock Workspace'}
                    </button>
                </form>

                <div className="mt-8 pt-6 border-t border-slate-100 dark:border-zinc-700/50">
                    <button 
                        onClick={() => logout()}
                        className="flex items-center justify-center gap-2 w-full text-sm font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors p-2 hover:bg-slate-50 dark:hover:bg-zinc-700/50 rounded-lg"
                    >
                        <LogoutIcon className="w-5 h-5" />
                        Sign Out Completely
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LockScreen;
