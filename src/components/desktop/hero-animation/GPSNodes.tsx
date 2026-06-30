import React from 'react';
import { motion } from 'framer-motion';

const nodes = [
  { distance: "15%" },
  { distance: "35%" },
  { distance: "55%" },
  { distance: "75%" },
  { distance: "90%" },
];

const GPSNodes = ({ activePath }: { activePath: string }) => {
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
      {nodes.map((node, i) => (
        <motion.div
          key={i}
          className="absolute top-0 left-0 w-2 h-2 -ml-1 -mt-1 bg-[#0ea5e9] rounded-full shadow-[0_0_12px_rgba(14,165,233,0.8)] z-0"
          style={{
            offsetPath: `path('${activePath}')`,
            offsetDistance: node.distance,
          } as any}
        >
          {/* Subtle static pulse around node */}
          <motion.div
            className="absolute inset-0 rounded-full bg-[#0ea5e9]"
            animate={{
              scale: [1, 3],
              opacity: [0.6, 0],
            }}
            transition={{
              duration: 2.5,
              repeat: Infinity,
              delay: i * 0.5,
              ease: "easeOut",
            }}
          />
        </motion.div>
      ))}
    </div>
  );
};

export default GPSNodes;
