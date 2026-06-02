import React from 'react';
import { HeaderConfiguration } from '../../types';

interface HeaderRendererProps {
    config?: HeaderConfiguration;
    className?: string;
}

export const HeaderRenderer: React.FC<HeaderRendererProps> = ({ config, className = '' }) => {
    if (!config) return null;

    return (
        <div className={`relative w-full overflow-hidden ${className}`} style={{ height: '180px' }}>
            {/* Logo */}
            {config.logo && (
                <div
                    className="absolute"
                    style={{
                        left: config.logo.x ?? 50,
                        top: config.logo.y ?? 50,
                        height: config.logo.height ?? 80,
                        width: 'auto'
                    }}
                >
                    <img src={config.logo.url} className="h-full w-auto object-contain" alt="Firm Logo" />
                </div>
            )}

            {/* Firm Name */}
            <div
                className="absolute"
                style={{
                    left: config.firmName.x ?? 250,
                    top: config.firmName.y ?? 50,
                    width: config.firmName.width ?? 400,
                }}
            >
                <div
                    style={{
                        fontSize: `${config.firmName.fontSize ?? 24}px`,
                        fontWeight: config.firmName.fontWeight ?? 'bold',
                        color: config.firmName.color ?? '#000000',
                        textAlign: config.firmName.alignment as any
                    }}
                >
                    {config.firmName.text}
                </div>
            </div>

            {/* Address */}
            <div
                className="absolute"
                style={{
                    left: config.address.x ?? 250,
                    top: config.address.y ?? 100,
                    width: config.address.width ?? 400,
                }}
            >
                <div
                    className="whitespace-pre-line"
                    style={{
                        fontSize: `${config.address.fontSize ?? 12}px`,
                        color: config.firmName.color ?? '#666666',
                        opacity: 0.85,
                        textAlign: config.address.alignment as any
                    }}
                >
                    {config.address.text}
                </div>
            </div>

            {/* Bottom Border/Line if desired (optional) */}
            <div className="absolute bottom-4 left-4 right-4 h-px bg-slate-100" />
        </div>
    );
};
