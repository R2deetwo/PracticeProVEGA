
import React from 'react';

const NairaSymbol: React.FC = () => {
  // Using system-ui fonts ensures better character support for special glyphs like ₦
  const style: React.CSSProperties = {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    fontWeight: 500,
    letterSpacing: '0.02em',
  };

  return <span style={style}>&#8358;</span>;
};

export default NairaSymbol;
