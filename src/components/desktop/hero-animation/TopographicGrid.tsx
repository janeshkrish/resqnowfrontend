import React from 'react';

const TopographicGrid = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-[0.03] select-none">
      <svg className="absolute w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="120" height="120" patternUnits="userSpaceOnUse">
            <path d="M 120 0 L 0 0 0 120" fill="none" stroke="#0F172A" strokeWidth="0.5" />
          </pattern>
        </defs>
        
        {/* Base Grid */}
        <rect width="100%" height="100%" fill="url(#grid)" />
        
        {/* Topographic Lines */}
        <path d="M -100 200 Q 500 50 1500 300" fill="none" stroke="#0F172A" strokeWidth="1" strokeDasharray="4 4" />
        <path d="M -100 400 Q 600 200 1500 600" fill="none" stroke="#0F172A" strokeWidth="0.5" />
        <path d="M -100 600 Q 700 800 1500 400" fill="none" stroke="#0F172A" strokeWidth="0.5" strokeDasharray="2 8" />
        
        {/* Navigation Circles */}
        <circle cx="15%" cy="30%" r="200" fill="none" stroke="#0F172A" strokeWidth="0.5" strokeDasharray="2 6" />
        <circle cx="85%" cy="70%" r="400" fill="none" stroke="#0F172A" strokeWidth="0.5" />
        <circle cx="85%" cy="70%" r="420" fill="none" stroke="#0F172A" strokeWidth="0.5" strokeDasharray="4 8" />
        
        {/* Coordinate Points */}
        <circle cx="35%" cy="25%" r="2" fill="#0F172A" />
        <circle cx="75%" cy="15%" r="2" fill="#0F172A" />
        <circle cx="45%" cy="85%" r="2" fill="#0F172A" />
        
        {/* Tiny Coordinates Text */}
        <text x="35%" y="25%" dx="10" dy="5" fontSize="10" fill="#0F172A" fontFamily="monospace">41.8781° N</text>
        <text x="75%" y="15%" dx="10" dy="5" fontSize="10" fill="#0F172A" fontFamily="monospace">87.6298° W</text>
        <text x="45%" y="85%" dx="10" dy="5" fontSize="10" fill="#0F172A" fontFamily="monospace">SYNCED</text>
      </svg>
    </div>
  );
};

export default TopographicGrid;
