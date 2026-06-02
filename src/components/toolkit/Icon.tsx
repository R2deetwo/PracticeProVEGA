import * as React from 'react';

interface IconProps {
    icon: React.FC<{className?: string}>;
    className?: string;
}

export const Icon: React.FC<IconProps> = ({ icon: IconComponent, className }) => {
    return <IconComponent className={`w-5 h-5 mr-2 flex-shrink-0 ${className || ''}`} />;
};