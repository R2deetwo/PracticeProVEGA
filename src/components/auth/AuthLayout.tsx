
import * as React from 'react';
import { Logo } from '../../constants';
import { useUI } from '../../contexts/UIContext';

interface AuthLayoutProps {
  title: string;
  children: React.ReactNode;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({ title, children }) => {
  const { closeModal } = useUI();

  return (
    <div 
      className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-black/75 animate-fade-in"
      // FIX: Wrapped closeModal call in an arrow function to match the expected MouseEventHandler type.
      onClick={() => closeModal()}
    >
      <div 
        className="w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-white rounded-xl shadow-2xl p-8 border border-black/5 relative">
          <div className="flex justify-center mb-6">
            <Logo className="h-16 w-auto text-primary-600" />
          </div>
          <h2 className="text-2xl font-bold text-center text-slate-900 mb-6">{title}</h2>
          {children}
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
