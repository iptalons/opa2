import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { Icons } from '../icons';

interface SelectContextType {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  value: string | undefined;
  setValue: (value: string) => void;
  items: Map<string, React.ReactNode>;
  registerItem: (value: string, label: React.ReactNode) => void;
  unregisterItem: (value: string) => void;
}

const SelectContext = createContext<SelectContextType | null>(null);

const useSelectContext = () => {
  const context = useContext(SelectContext);
  if (!context) {
    throw new Error('useSelectContext must be used within a Select provider');
  }
  return context;
};

interface SelectProps {
  children: React.ReactNode;
  value?: string | number;
  onValueChange?: (value: string) => void;
  defaultValue?: string | number;
}

const Select = ({ children, value, onValueChange, defaultValue }: SelectProps) => {
  const [open, setOpen] = useState(false);
  const [internalValue, setInternalValue] = useState<string | undefined>(
    value !== undefined ? String(value) : (defaultValue !== undefined ? String(defaultValue) : undefined)
  );
  const [items, setItems] = useState(new Map<string, React.ReactNode>());
  const selectRef = useRef<HTMLDivElement>(null);

  const registerItem = (value: string, label: React.ReactNode) => {
    setItems(prev => new Map(prev).set(value, label));
  };

  const unregisterItem = (value: string) => {
    setItems(prev => {
      const newItems = new Map(prev);
      newItems.delete(value);
      return newItems;
    });
  };
  
  const currentValue = value !== undefined ? String(value) : internalValue;

  const contextValue = {
    open,
    setOpen,
    value: currentValue,
    setValue: (val: string) => {
      if (value === undefined) { // Uncontrolled
        setInternalValue(val);
      }
      if (onValueChange) {
        onValueChange(val);
      }
    },
    items,
    registerItem,
    unregisterItem,
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  return (
    <SelectContext.Provider value={contextValue}>
      <div className="relative" ref={selectRef}>
        {children}
      </div>
    </SelectContext.Provider>
  );
};

const SelectTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, children, ...props }, ref) => {
  const { open, setOpen } = useSelectContext();
  return (
    <button
      ref={ref}
      type="button"
      onClick={() => setOpen(prev => !prev)}
      className={cn(
        'flex h-9 w-full items-center justify-between rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      aria-expanded={open}
      {...props}
    >
      {children}
      <Icons.TriangleDown className="h-4 w-4 opacity-50 shrink-0" />
    </button>
  );
});
SelectTrigger.displayName = 'SelectTrigger';

const SelectValue = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement> & { placeholder?: string }
>(({ className, placeholder, ...props }, ref) => {
  const { value, items } = useSelectContext();
  const displayValue = value !== undefined ? items.get(value) : null;

  // FIX: The `cn` utility function does not support object syntax. Using a conditional expression instead.
  return (
    <span ref={ref} className={cn(!displayValue && 'text-slate-500', className)} {...props}>
      {displayValue ?? placeholder}
    </span>
  );
});
SelectValue.displayName = 'SelectValue';

const SelectContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  const { open } = useSelectContext();
  if (!open) return null;

  return (
    <div
      ref={ref}
      className={cn(
        'absolute z-50 mt-1 w-full rounded-md border bg-white text-slate-900 shadow-md animate-in fade-in-0 zoom-in-95',
        className
      )}
      {...props}
    >
      <div className="p-1 max-h-60 overflow-y-auto">{children}</div>
    </div>
  );
});
SelectContent.displayName = 'SelectContent';

const SelectItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { value: string | number }
>(({ className, children, value, ...props }, ref) => {
  const { setValue, setOpen, registerItem, unregisterItem, value: selectedValue } = useSelectContext();
  const stringValue = String(value);

  useEffect(() => {
    if (children) {
      registerItem(stringValue, children);
    }
    return () => unregisterItem(stringValue);
  }, [stringValue, children, registerItem, unregisterItem]);

  const handleClick = () => {
    setValue(stringValue);
    setOpen(false);
  };

  const isSelected = selectedValue === stringValue;

  return (
    <div
      ref={ref}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      role="option"
      aria-selected={isSelected}
      tabIndex={0}
      className={cn(
        'relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none focus:bg-slate-100 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 hover:bg-slate-100',
        isSelected && 'font-semibold',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});
SelectItem.displayName = 'SelectItem';

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };