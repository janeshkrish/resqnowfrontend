import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const ScrollToTop = () => {
    const { pathname, hash } = useLocation();

    useEffect(() => {
        if (hash) {
            window.setTimeout(() => {
                const target = document.getElementById(hash.slice(1));
                if (target) {
                    target.scrollIntoView({ behavior: "smooth", block: "start" });
                }
            }, 0);
            return;
        }

        window.scrollTo(0, 0);
    }, [hash, pathname]);

    return null;
};

export default ScrollToTop;
