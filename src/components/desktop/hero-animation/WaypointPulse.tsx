import React from 'react';
import { motion } from 'framer-motion';

const WaypointPulse = ({ activePath, duration }: { activePath: string, duration: number }) => {
  return (
    <>
      {[0, 1].map((i) => (
        <motion.div
          key={i}
          className="absolute top-0 left-0 w-16 h-16 -ml-8 -mt-8 rounded-full border border-red-500/20"
          style={{
            offsetPath: `path('${activePath}')`,
          } as any}
          initial={{ offsetDistance: "0%", scale: 0, opacity: 0 }}
          animate={{
            offsetDistance: "100%",
            scale: [0.2, 1.2],
            opacity: [0, 0.4, 0],
          }}
          transition={{
            duration: duration,
            repeat: Infinity,
            ease: "linear",
            delay: i * (duration / 2),
          }}
        />
      ))}
    </>
  );
};

export default WaypointPulse;
