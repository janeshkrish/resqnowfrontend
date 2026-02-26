import React, { useState, useRef, useEffect } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SlideButtonProps {
    onSlideComplete: () => void;
    text?: string;
    isSubmitting?: boolean;
    className?: string;
    disabled?: boolean;
}

export const SlideButton: React.FC<SlideButtonProps> = ({
    onSlideComplete,
    text = "Slide to Submit",
    isSubmitting = false,
    className,
    disabled = false,
}) => {
    const [isDone, setIsDone] = useState(false);
    const [dragWidth, setDragWidth] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const thumbRef = useRef<HTMLDivElement>(null);
    const controls = useAnimation();

    useEffect(() => {
        const calculateWidth = () => {
            if (containerRef.current && thumbRef.current) {
                const containerW = containerRef.current.offsetWidth;
                const thumbW = thumbRef.current.offsetWidth;
                const thumbLeftOffset = thumbRef.current.offsetLeft;
                setDragWidth(containerW - thumbW - (thumbLeftOffset * 2));
            }
        };

        // Delay initial calculation slightly to ensure styles are applied
        const timeoutId = setTimeout(calculateWidth, 10);

        window.addEventListener('resize', calculateWidth);
        return () => {
            clearTimeout(timeoutId);
            window.removeEventListener('resize', calculateWidth);
        };
    }, []);

    useEffect(() => {
        if (!isSubmitting && isDone) {
            // If submitting finished, maybe reset the button state
            setTimeout(() => {
                setIsDone(false);
                controls.start({ x: 0 });
            }, 500);
        }
    }, [isSubmitting, isDone, controls]);

    const handleDragEnd = async (_: any, info: any) => {
        if (disabled || isSubmitting) return;

        const threshold = dragWidth * 0.85; // 85% to trigger

        if (info.offset.x >= threshold || info.point.x >= threshold) {
            setIsDone(true);
            await controls.start({ x: dragWidth });
            onSlideComplete();
        } else {
            controls.start({ x: 0 });
            setIsDone(false);
        }
    };

    return (
        <div
            ref={containerRef}
            className={cn(
                "relative flex items-center w-full h-[56px] sm:h-[68px] rounded-full overflow-hidden bg-primary touch-none select-none shadow-md",
                disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer",
                className
            )}
        >
            {/* Background Text */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                {isSubmitting ? (
                    <div className="flex items-center text-primary-foreground font-bold text-[15px] sm:text-[17px] tracking-wide">
                        <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 mr-2 sm:mr-3 animate-spin" />
                        Finding technicians...
                    </div>
                ) : (
                    <motion.span
                        animate={{ opacity: isDone ? 0 : 1 }}
                        className="text-primary-foreground font-medium sm:font-semibold text-[15px] sm:text-[17px] tracking-wide"
                    >
                        {text}
                    </motion.span>
                )}
            </div>

            {/* Draggable Thumb */}
            <motion.div
                ref={thumbRef}
                drag={disabled || isSubmitting || isDone ? false : "x"}
                dragConstraints={{ left: 0, right: dragWidth }}
                dragElastic={0.05}
                dragMomentum={false}
                onDragEnd={handleDragEnd}
                animate={controls}
                initial={{ x: 0 }}
                className={cn(
                    "absolute left-1.5 sm:left-2 flex h-[44px] w-[44px] sm:h-[52px] sm:w-[52px] items-center justify-center rounded-full bg-background shadow-[0_2px_8px_rgba(0,0,0,0.15)] z-10",
                    (disabled || isSubmitting) ? "cursor-not-allowed" : "cursor-grab active:cursor-grabbing"
                )}
            >
                {isSubmitting ? (
                    <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 text-primary animate-spin" />
                ) : (
                    <div className="flex -space-x-1 sm:-space-x-1.5 ml-0.5 sm:ml-1">
                        <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 text-primary/70" />
                        <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                    </div>
                )}
            </motion.div>
        </div>
    );
};
