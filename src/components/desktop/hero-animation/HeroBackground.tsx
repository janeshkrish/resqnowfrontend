import React, { useEffect, useState } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import TopographicGrid from './TopographicGrid';
import RadarPulse from './RadarPulse';
import AnimatedRoad from './AnimatedRoad';

const HeroBackground = () => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const { scrollY } = useScroll();
  
  // Subtle parallax upward movement based on scroll to simulate depth
  const yParallax = useTransform(scrollY, [0, 1000], [0, -100]);

  useEffect(() => {
    // Accessibility check: disable mouse tracking if user prefers reduced motion
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.matches) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Calculate normalized mouse position (-1 to 1)
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = (e.clientY / window.innerHeight) * 2 - 1;
      
      // Request animation frame for smooth performance
      requestAnimationFrame(() => {
        setMousePosition({ x, y });
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none bg-[#fafafa]">
      
      {/* 
        ========================================================================
        LEFT SIDE: Ambient & Immersive
        Provides cinematic depth behind the text without complex overlapping lines
        ========================================================================
      */}
      <div className="absolute inset-y-0 left-0 w-full lg:w-[55%] z-0">
        {/* Soft glowing ambient orbs */}
        <div className="absolute top-[10%] -left-[10%] w-[600px] h-[600px] bg-blue-500/5 blur-[120px] rounded-full" />
        <div className="absolute top-[60%] left-[20%] w-[500px] h-[500px] bg-red-500/5 blur-[100px] rounded-full" />
        
        {/* Subtle topographic grid for texture */}
        <motion.div 
          className="absolute inset-0 opacity-50"
          style={{
            x: mousePosition.x * -1,
            y: mousePosition.y * -1,
          }}
        >
          <TopographicGrid />
        </motion.div>
      </div>

      {/* 
        ========================================================================
        RIGHT SIDE: Cinematic Dispatch Engine
        Houses the complex tracking animations, strictly contained to the right
        ========================================================================
      */}
      <div className="absolute inset-y-0 right-0 w-full lg:w-[45%] hidden lg:block z-10">
        
        {/* Massive atmospheric glow anchoring the right side */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500/5 blur-[120px] rounded-full" />

        <motion.div 
          className="absolute inset-0 w-full h-full"
          style={{ y: yParallax }}
        >
          <RadarPulse />
          
          <motion.div
            className="absolute inset-0"
            style={{
              x: mousePosition.x * -6,
              y: mousePosition.y * -6,
            }}
          >
            <AnimatedRoad />
          </motion.div>
        </motion.div>
      </div>

      {/* Subtle vignettes to blend edges into the main layout seamlessly */}
      <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-[#fafafa] to-transparent z-20" />
      <div className="absolute bottom-0 inset-x-0 h-40 bg-gradient-to-t from-[#fafafa] to-transparent z-20" />
      <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-[#fafafa] to-transparent z-20" />
      <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-[#fafafa] to-transparent z-20" />
    </div>
  );
};

export default HeroBackground;
