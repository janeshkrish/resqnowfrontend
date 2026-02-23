
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

const LoadingAnimation = () => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Hide loading animation quickly after initial load
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 800);

    return () => clearTimeout(timer);
  }, []);

  if (!isLoading) return null;

  return (
    <div 
      className={cn(
        "fixed inset-0 z-50 flex flex-col items-center justify-center bg-white transition-opacity duration-500",
        isLoading ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
    >
      <div className="relative flex flex-col items-center">
        <div className="w-48 h-32 md:w-64 md:h-40 relative flex items-end justify-center">
          <svg
            viewBox="0 0 240 120"
            className="w-full h-full"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Shadow Effect */}
            <ellipse cx="120" cy="100" rx="80" ry="8" className="fill-gray-200 animate-shadow" />
            
            {/* Main Truck Body - more detailed */}
            <rect x="45" y="35" width="120" height="35" rx="6" className="fill-red-600" filter="url(#shadow)" />
            <rect x="45" y="50" width="120" height="20" className="fill-red-700" />
            
            {/* Cabin - more detailed */}
            <path d="M140 20h35l8 15v28h-43V25a5 5 0 0 1 5-5z" className="fill-red-600" filter="url(#shadow)" />
            
            {/* Windows with reflection */}
            <path d="M145 25h25l6 12h-31v-12z" className="fill-sky-200" />
            <path d="M145 25h15l4 12h-19v-12z" className="fill-white opacity-40" />
            
            {/* Towing Arm - more detailed */}
            <path d="M35 45 l25 -15 h15 v35 h-40 v-10 a10 10 0 0 1 0-10z" className="fill-gray-600" />
            <rect x="50" y="35" width="5" height="25" className="fill-gray-700" />
            
            {/* Wheels with details */}
            <g className="animate-suspension">
              {/* Rear wheels */}
              <circle cx="70" cy="75" r="18" className="fill-gray-800" />
              <circle cx="70" cy="75" r="12" className="fill-gray-700" />
              <circle cx="70" cy="75" r="3" className="fill-gray-600" />
              
              {/* Front wheels */}
              <circle cx="160" cy="75" r="16" className="fill-gray-800" />
              <circle cx="160" cy="75" r="10" className="fill-gray-700" />
              <circle cx="160" cy="75" r="3" className="fill-gray-600" />
            </g>

            {/* Wheel Motion Blur */}
            <g className="animate-wheel-blur">
              <path d="M52 75 a18 18 0 0 1 36 0" className="stroke-gray-400 opacity-20" strokeWidth="2" />
              <path d="M142 75 a16 16 0 0 1 36 0" className="stroke-gray-400 opacity-20" strokeWidth="2" />
            </g>
            
            {/* Smoke Effect */}
            <g className="animate-exhaust">
              <circle cx="180" cy="45" r="3" className="fill-gray-400 opacity-40" />
              <circle cx="185" cy="42" r="4" className="fill-gray-400 opacity-30" />
              <circle cx="190" cy="44" r="3" className="fill-gray-400 opacity-20" />
            </g>

            {/* Details */}
            <rect x="165" y="30" width="12" height="4" rx="2" className="fill-yellow-400" /> {/* Headlights */}
            <rect x="45" y="40" width="8" height="3" rx="1" className="fill-red-400" /> {/* Taillights */}
            
            {/* Filters for shadows and effects */}
            <defs>
              <filter id="shadow" x="-2" y="-2" width="104%" height="104%">
                <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.2"/>
              </filter>
            </defs>
          </svg>
        </div>
        <style>
          {`
            @keyframes suspension {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(2px); }
            }
            .animate-suspension {
              animation: suspension 1s ease-in-out infinite;
            }

            @keyframes wheel-blur {
              0% { opacity: 0.1; }
              50% { opacity: 0.3; }
              100% { opacity: 0.1; }
            }
            .animate-wheel-blur {
              animation: wheel-blur 0.5s linear infinite;
            }

            @keyframes exhaust {
              0% { transform: translateX(0) translateY(0) scale(1); opacity: 0.4; }
              100% { transform: translateX(15px) translateY(-8px) scale(2); opacity: 0; }
            }
            .animate-exhaust {
              animation: exhaust 2s linear infinite;
            }

            @keyframes shadow {
              0%, 100% { transform: scaleX(1); opacity: 0.2; }
              50% { transform: scaleX(0.95); opacity: 0.15; }
            }
            .animate-shadow {
              animation: shadow 1s ease-in-out infinite;
            }
          `}
        </style>
        <h1 className="text-3xl font-bold text-center mt-6 text-red-600">ResQNow</h1>
        <p className="text-center text-gray-600 mt-2">Your Roadside Assistance Partner</p>
      </div>
    </div>
  );
};

export default LoadingAnimation;
