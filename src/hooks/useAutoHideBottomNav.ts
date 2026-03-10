import { useCallback, useEffect, useRef, useState } from "react";

type UseAutoHideBottomNavOptions = {
    enabled?: boolean;
    revealZoneHeight?: number;
};

export const useAutoHideBottomNav = ({
    enabled = true,
    revealZoneHeight = 96,
}: UseAutoHideBottomNavOptions = {}) => {
    const [isVisible, setIsVisible] = useState(true);
    const lastScrollYRef = useRef(0);

    const revealNav = useCallback(() => {
        setIsVisible(true);
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") return;

        if (!enabled) {
            setIsVisible(true);
            return;
        }

        lastScrollYRef.current = Math.max(window.scrollY || 0, 0);

        const handleScroll = () => {
            const currentY = Math.max(window.scrollY || 0, 0);
            const deltaY = currentY - lastScrollYRef.current;

            if (Math.abs(deltaY) < 6) return;

            if (currentY <= 24 || deltaY < 0) {
                setIsVisible(true);
            } else {
                setIsVisible(false);
            }

            lastScrollYRef.current = currentY;
        };

        const revealFromBottomTap = (event: TouchEvent | PointerEvent | MouseEvent) => {
            let pointerY = window.innerHeight;

            if ("touches" in event && event.touches.length > 0) {
                pointerY = event.touches[0].clientY;
            } else if ("clientY" in event) {
                pointerY = event.clientY;
            }

            if (window.innerHeight - pointerY <= revealZoneHeight) {
                setIsVisible(true);
            }
        };

        window.addEventListener("scroll", handleScroll, { passive: true });
        window.addEventListener("pointerdown", revealFromBottomTap as EventListener, { passive: true });
        window.addEventListener("touchstart", revealFromBottomTap as EventListener, { passive: true });

        return () => {
            window.removeEventListener("scroll", handleScroll);
            window.removeEventListener("pointerdown", revealFromBottomTap as EventListener);
            window.removeEventListener("touchstart", revealFromBottomTap as EventListener);
        };
    }, [enabled, revealZoneHeight]);

    const visibilityClasses = isVisible
        ? "translate-y-0 opacity-100 pointer-events-auto"
        : "translate-y-[calc(100%+env(safe-area-inset-bottom,0px))] opacity-0 pointer-events-none";

    return {
        isVisible,
        revealNav,
        visibilityClasses,
    };
};

export default useAutoHideBottomNav;
