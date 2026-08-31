
import React from 'react';

// FIX: callers pass className throughout the app (size/color tweaks) but the
// component never accepted it — every such usage was a TS2322 error and the
// class was silently dropped at runtime.
const NairaSymbol: React.FC<{ className?: string }> = ({ className }) => {
  // Using system-ui fonts ensures better character support for special glyphs like ₦
  const style: React.CSSProperties = {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    fontWeight: 500,
    letterSpacing: '0.02em',
  };

  return <span style={style} className={className}>&#8358;</span>;
};

export default NairaSymbol;
