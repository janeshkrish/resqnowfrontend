import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";

import { cn } from "@/lib/utils";
import MaterialSymbol from "./MaterialSymbol";

const SEARCH_HINTS = ["“flat tyre”", "“towing”", "“battery jumpstart”", "“fuel delivery”", "“car lockout”"];
const HINT_MS = 2400;

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export function HomeSearch() {
  const navigate = useNavigate();
  const [hint, setHint] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion()) return undefined;
    const timer = window.setInterval(() => setHint((value) => (value + 1) % SEARCH_HINTS.length), HINT_MS);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <button type="button" className="rq-h-search rq-press" onClick={() => navigate("/services")} aria-label="Search services">
      <MaterialSymbol name="search" className="rq-h-search-icon" />
      <span className="rq-h-search-text">
        Search
        <span className="rq-h-ticker" aria-hidden="true">
          <span className="rq-h-ticker-col" style={{ transform: `translateY(-${hint * 20}px)` }}>
            {SEARCH_HINTS.map((term) => <span key={term}>{term}</span>)}
          </span>
        </span>
      </span>
    </button>
  );
}

type Banner = {
  id: string;
  kicker: string;
  icon: string;
  title: string;
  text: string;
  cta: string;
  to: string;
  tone: string;
  photo?: string;
  art?: { src: string; className: string };
};

const BANNERS: Banner[] = [
  {
    id: "roadside",
    kicker: "24/7 roadside help",
    icon: "bolt",
    title: "Stuck on the road?",
    text: "Towing, repairs and jump-starts.",
    cta: "Get help",
    to: "/services",
    tone: "is-photo",
    photo: "/images/home/banner-towing.webp",
  },
  {
    id: "ev",
    kicker: "EV support",
    icon: "ev_station",
    title: "Out of charge?",
    text: "Portable charging where you stopped.",
    cta: "Book a charge",
    to: "/request-service/ev-charging",
    tone: "is-mint",
    art: { src: "/images/vehicles/ev.webp", className: "rq-h-bn-art-ev" },
  },
  {
    id: "smart-care",
    kicker: "Smart Care · ₹99/month",
    icon: "workspace_premium",
    title: "Priority help, zero fees",
    text: "Faster technician assignment.",
    cta: "View plan",
    to: "/subscription",
    tone: "is-slate",
    art: { src: "/images/vehicles/bike.webp", className: "rq-h-bn-art-bike" },
  },
  {
    id: "partner",
    kicker: "Partner with us",
    icon: "handshake",
    title: "Drive with ResQNow",
    text: "Flexible hours, steady jobs.",
    cta: "Apply now",
    to: "/technician/register",
    tone: "is-sand",
    art: { src: "/images/vehicles/truck.webp", className: "rq-h-bn-art-truck" },
  },
];

export function HomeBanners() {
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, align: "center" },
    prefersReducedMotion() ? [] : [Autoplay({ delay: 4500, stopOnInteraction: false, stopOnMouseEnter: true })],
  );
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    if (!emblaApi) return undefined;
    const onSelect = () => setSelected(emblaApi.selectedScrollSnap());
    onSelect();
    emblaApi.on("select", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi]);

  const goTo = useCallback((index: number) => emblaApi?.scrollTo(index), [emblaApi]);

  return (
    <section aria-label="Highlights" aria-roledescription="carousel">
      <div className="rq-h-bn-viewport" ref={emblaRef}>
        <div className="rq-h-bn-track">
          {BANNERS.map((banner, index) => (
            <div key={banner.id} className="rq-h-bn-slide">
              <article
                className={cn("rq-h-bn", banner.tone)}
                aria-roledescription="slide"
                aria-label={`${index + 1} of ${BANNERS.length}: ${banner.title}`}
              >
                {banner.photo ? (
                  <>
                    <img className="rq-h-bn-photo" src={banner.photo} alt="" draggable={false} />
                    <span aria-hidden="true" className="rq-h-bn-fade" />
                  </>
                ) : null}
                {banner.art ? <img className={cn("rq-h-bn-art", banner.art.className)} src={banner.art.src} alt="" draggable={false} /> : null}
                <span className="rq-h-kicker">
                  <MaterialSymbol name={banner.icon} className="rq-symbol-sm" />
                  {banner.kicker}
                </span>
                <h2 className="rq-h-bn-title">{banner.title}</h2>
                <p className="rq-h-bn-text">{banner.text}</p>
                <Link to={banner.to} className="rq-h-bn-cta rq-press">
                  {banner.cta}
                  <MaterialSymbol name="chevron_right" />
                </Link>
              </article>
            </div>
          ))}
        </div>
      </div>
      <div className="rq-h-dots">
        {BANNERS.map((banner, index) => (
          <button
            key={banner.id}
            type="button"
            className={cn("rq-h-dot", index === selected && "is-on")}
            aria-label={`Show ${banner.title}`}
            aria-current={index === selected ? "true" : undefined}
            onClick={() => goTo(index)}
          />
        ))}
      </div>
    </section>
  );
}
