import React from 'react';

const AppMapBackground = () => {
  return (
    <div className="absolute inset-0 bg-[#f8fafc] z-0 overflow-hidden pointer-events-none">
      {/* 2D Vector Street Map representation */}
      <svg width="100%" height="100%" viewBox="0 0 320 650" className="opacity-50">
        
        {/* Main Arterials */}
        <path d="M 60 -50 L 60 220 L 160 280 L 160 700" stroke="#cbd5e1" strokeWidth="12" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M 260 -50 L 260 160 L 60 320 L -50 380" stroke="#cbd5e1" strokeWidth="10" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M 160 280 L 350 330" stroke="#cbd5e1" strokeWidth="12" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        
        {/* Secondary Streets */}
        <path d="M 60 220 L -50 170" stroke="#cbd5e1" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M 220 700 L 270 450 L 350 400" stroke="#cbd5e1" strokeWidth="8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M 0 520 L 160 520 L 220 480" stroke="#cbd5e1" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M 260 160 L 350 160" stroke="#cbd5e1" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        
        {/* Subtle Green Spaces (Parks) */}
        <rect x="230" y="60" width="70" height="50" rx="8" fill="#bbf7d0" className="opacity-60" />
        <rect x="30" y="420" width="90" height="70" rx="8" fill="#bbf7d0" className="opacity-60" />
        <rect x="180" y="550" width="60" height="100" rx="8" fill="#bbf7d0" className="opacity-60" />
      </svg>
    </div>
  );
};

export default AppMapBackground;
