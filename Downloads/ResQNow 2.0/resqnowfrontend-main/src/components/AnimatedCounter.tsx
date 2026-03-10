
import React, { useRef, useEffect } from 'react';
import { useCountUp } from '@/hooks/useCountUp';

interface AnimatedCounterProps {
  end: number;
  duration?: number;
  suffix?: string;
  className?: string;
}

const AnimatedCounter: React.FC<AnimatedCounterProps> = ({ 
  end, 
  duration = 2000, 
  suffix = '', 
  className = '' 
}) => {
  const ref = useRef<HTMLSpanElement>(null);
  const { count, startAnimation } = useCountUp({ end, duration, startOnView: false });

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          startAnimation();
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [startAnimation]);

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  return (
    <span ref={ref} className={className}>
      {formatNumber(count)}{suffix}
    </span>
  );
};

export default AnimatedCounter;
