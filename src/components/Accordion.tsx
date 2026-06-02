
import React, { useState, useEffect } from 'react';

interface AccordionItemProps {
  title: string | React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  isOpen?: boolean;
  onToggle?: () => void;
  id?: string;
}

const ChevronDownIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transition-transform duration-300" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
);

export const AccordionItem: React.FC<AccordionItemProps> = ({ title, children, defaultOpen = false, isOpen: controlledIsOpen, onToggle, id }) => {
  const [internalIsOpen, setInternalIsOpen] = useState(defaultOpen);

  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  
  const handleToggle = () => {
      if (onToggle) {
          onToggle();
      } else {
          setInternalIsOpen(!internalIsOpen);
      }
  };

  return (
    <div id={id} className="border-b border-gray-200 dark:border-gray-700 scroll-mt-24">
      <button
        onClick={handleToggle}
        className="w-full flex justify-between items-center text-left py-4 px-2 group"
        aria-expanded={isOpen}
      >
        <span className={`font-semibold text-lg transition-colors ${isOpen ? 'text-primary-600 dark:text-primary-400' : 'text-gray-800 dark:text-gray-200 group-hover:text-primary-600'}`}>{title}</span>
        <span className={`text-gray-400 group-hover:text-primary-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
            <ChevronDownIcon />
        </span>
      </button>
      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="p-4 pt-0 text-gray-600 dark:text-gray-300 prose prose-sm dark:prose-invert max-w-none">
          {children}
        </div>
      </div>
    </div>
  );
};

interface AccordionProps {
    children: React.ReactNode;
    className?: string;
}

const Accordion: React.FC<AccordionProps> = ({ children, className }) => {
    return <div className={`border-t border-gray-200 dark:border-gray-700 ${className || ''}`}>{children}</div>
}

export default Accordion;
