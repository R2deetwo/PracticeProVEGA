
import React, { createContext, useContext, useState, useCallback, useMemo, useId } from 'react';
import { ChevronDownIcon } from '../../constants';

interface AccordionContextProps {
  value: string[];
  onValueChange: (value: string) => void;
  type: 'single' | 'multiple';
}

const AccordionContext = createContext<AccordionContextProps | null>(null);

const useAccordion = () => {
  const context = useContext(AccordionContext);
  if (!context) {
    throw new Error('useAccordion must be used within an <Accordion>');
  }
  return context;
};

interface AccordionProps extends React.HTMLAttributes<HTMLDivElement> {
  type?: 'single' | 'multiple';
  defaultValue?: string | string[];
}

export const Accordion: React.FC<AccordionProps> = ({ type = 'single', defaultValue, children, ...props }) => {
  const [value, setValue] = useState<string[]>(
    defaultValue ? (Array.isArray(defaultValue) ? defaultValue : [defaultValue]) : []
  );

  const onValueChange = useCallback((itemValue: string) => {
    setValue(currentValue => {
      if (type === 'single') {
        return currentValue[0] === itemValue ? [] : [itemValue];
      } else {
        const nextValue = new Set(currentValue);
        if (nextValue.has(itemValue)) {
          nextValue.delete(itemValue);
        } else {
          nextValue.add(itemValue);
        }
        return Array.from(nextValue);
      }
    });
  }, [type]);

  const contextValue = useMemo(() => ({ value, onValueChange, type }), [value, onValueChange, type]);

  return (
    <AccordionContext.Provider value={contextValue}>
      <div {...props}>{children}</div>
    </AccordionContext.Provider>
  );
};

interface AccordionItemContextProps {
  value: string;
  isOpen: boolean;
  triggerId: string;
  contentId: string;
}

const AccordionItemContext = createContext<AccordionItemContextProps | null>(null);

const useAccordionItem = () => {
  const context = useContext(AccordionItemContext);
  if (!context) {
    throw new Error('useAccordionItem must be used within an <AccordionItem>');
  }
  return context;
};


interface AccordionItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

export const AccordionItem: React.FC<AccordionItemProps> = ({ value, children, ...props }) => {
  const { value: contextValue } = useAccordion();
  const id = useId();
  const triggerId = `accordion-trigger-${id}`;
  const contentId = `accordion-content-${id}`;

  const isOpen = contextValue.includes(value);
  const itemContextValue = useMemo(() => ({ value, isOpen, triggerId, contentId }), [value, isOpen, triggerId, contentId]);

  return (
    <AccordionItemContext.Provider value={itemContextValue}>
      <div {...props}>{children}</div>
    </AccordionItemContext.Provider>
  );
};

export const AccordionTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ children, className, ...props }, ref) => {
    const { value, isOpen, triggerId, contentId } = useAccordionItem();
    const { onValueChange } = useAccordion();

    return (
      <button
        type="button" // CRITICAL FIX: Prevent form submission
        ref={ref}
        id={triggerId}
        onClick={() => onValueChange(value)}
        aria-expanded={isOpen}
        aria-controls={contentId}
        className={`w-full flex justify-between items-center text-sm font-bold text-slate-800 dark:text-white rounded-md hover:bg-slate-100 dark:hover:bg-zinc-700 ${className || 'p-2'}`}
        {...props}
      >
        {children}
        <ChevronDownIcon className={`w-4 h-4 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
    );
  }
);
AccordionTrigger.displayName = 'AccordionTrigger';

export const AccordionContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ children, className, ...props }, ref) => {
    const { isOpen, triggerId, contentId } = useAccordionItem();
    return (
      <div
        ref={ref}
        id={contentId}
        role="region"
        aria-labelledby={triggerId}
        aria-hidden={!isOpen}
        className={`grid transition-[grid-template-rows] duration-300 ease-in-out will-change-[grid-template-rows] ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
      >
        <div className={`overflow-hidden ${isOpen ? '' : ''}`}>
          <div className={className || 'p-2 space-y-2'}>
            {children}
          </div>
        </div>
      </div>
    );
  }
);
AccordionContent.displayName = 'AccordionContent';
