import { useState } from "react";
import { Link } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { toast } from "sonner";

import { apiUrl } from "@/lib/api";
import MaterialSymbol from "./MaterialSymbol";

const COUPON_CODE = "RESQ10";

export function GarageCard() {
  return (
    <section className="rq-h-card rq-h-garage">
      <img className="rq-h-garage-art" src="/images/vehicles/car.webp" alt="" draggable={false} loading="lazy" />
      <div className="rq-h-garage-copy">
        <p className="rq-h-kicker">My garage</p>
        <h2 className="rq-h-garage-title">Save your vehicle</h2>
        <p className="rq-h-garage-text">Keep its details ready for faster requests.</p>
        <Link to="/my-garage/add" className="rq-h-btn-outline rq-press">
          <MaterialSymbol name="add" />
          Add vehicle
        </Link>
      </div>
    </section>
  );
}

export function OffersRail() {
  const [downloading, setDownloading] = useState(false);
  // The download card only makes sense in the browser, not inside the Android app itself.
  const showAppCard = !Capacitor.isNativePlatform();

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(COUPON_CODE);
      toast.success(`Code ${COUPON_CODE} copied`, { description: "Apply it at checkout." });
    } catch {
      toast.info(`Use code ${COUPON_CODE} at checkout`);
    }
  };

  const downloadApp = () => {
    if (downloading) return;
    setDownloading(true);
    window.location.href = apiUrl("/api/public/android-app/download");
    window.setTimeout(() => setDownloading(false), 3000);
  };

  return (
    <section className="rq-h-section" aria-labelledby="rq-h-offers-title">
      <div className="rq-h-head">
        <h2 id="rq-h-offers-title" className="rq-h-title">Offers for you</h2>
      </div>
      <div className="rq-h-rail">
        <article className="rq-h-coupon">
          <div className="rq-h-coupon-stub">
            <span className="rq-h-coupon-pct">10%</span>
            <span className="rq-h-coupon-off">OFF</span>
          </div>
          <span aria-hidden="true" className="rq-h-notch is-top" />
          <span aria-hidden="true" className="rq-h-notch is-bottom" />
          <div className="rq-h-coupon-body">
            <span className="rq-h-coupon-kicker">NEW USER</span>
            <span className="rq-h-coupon-title">On any two services</span>
            <button type="button" className="rq-h-code rq-press" onClick={copyCode} aria-label={`Copy code ${COUPON_CODE}`}>
              {COUPON_CODE}
              <MaterialSymbol name="content_copy" className="rq-symbol-sm" />
            </button>
          </div>
        </article>

        {showAppCard ? (
          <article className="rq-h-card rq-h-app">
            <span aria-hidden="true" className="rq-h-app-badge">
              <MaterialSymbol name="android" />
            </span>
            <p className="rq-h-kicker">Android app</p>
            <span className="rq-h-app-title">Get the ResQNow app</span>
            <span className="rq-h-app-text">Faster alerts and smoother live tracking.</span>
            <button type="button" className="rq-h-btn-ink rq-press" onClick={downloadApp} disabled={downloading}>
              <MaterialSymbol name="download" />
              {downloading ? "Starting…" : "Download"}
            </button>
          </article>
        ) : null}
      </div>
    </section>
  );
}

const REVIEWS = [
  { initials: "DA", name: "Dhinakaran A", place: "Peelamedu, Coimbatore", text: "Battery issue was fixed within 20 minutes. Very professional service." },
  { initials: "AK", name: "Arun Kumar", place: "Gandhipuram, Coimbatore", text: "My bike broke down near Gandhipuram. The service was quick and the technician was very helpful!" },
  { initials: "KR", name: "Karthik R", place: "RS Puram, Coimbatore", text: "Fast response and affordable pricing. Great experience overall." },
];

export function ReviewsRail() {
  return (
    <section className="rq-h-section" aria-labelledby="rq-h-reviews-title">
      <div className="rq-h-head">
        <div>
          <h2 id="rq-h-reviews-title" className="rq-h-title">Trusted across Coimbatore</h2>
          <span className="rq-h-sub">
            <MaterialSymbol name="star" className="rq-symbol-sm rq-h-star" />
            Real stories from drivers near you
          </span>
        </div>
      </div>
      <div className="rq-h-rail">
        {REVIEWS.map((review) => (
          <article key={review.name} className="rq-h-card rq-h-review">
            <div className="rq-h-review-top">
              <span aria-hidden="true" className="rq-h-avatar">{review.initials}</span>
              <span className="rq-h-review-who">
                <span className="rq-h-review-name">
                  {review.name}
                  <span className="rq-h-verified">
                    <MaterialSymbol name="verified" className="rq-symbol-xs" />
                    Verified
                  </span>
                </span>
                <span className="rq-h-review-place">{review.place}</span>
              </span>
            </div>
            <span className="rq-h-stars" role="img" aria-label="Rated 5 out of 5">
              {[0, 1, 2, 3, 4].map((star) => <MaterialSymbol key={star} name="star" className="rq-symbol-sm" />)}
            </span>
            <p className="rq-h-review-text">{review.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function PartnerCard() {
  return (
    <section className="rq-h-partner">
      <span aria-hidden="true" className="rq-h-partner-ring" />
      <p className="rq-h-kicker is-light">
        <MaterialSymbol name="handshake" className="rq-symbol-sm" />
        Partner program
      </p>
      <h2 className="rq-h-partner-title">Earn with ResQNow</h2>
      <p className="rq-h-partner-text">Join our network of professional mechanics and tow operators.</p>
      <div className="rq-h-partner-actions">
        <Link to="/technician/login" className="rq-h-btn-soft rq-press">Tech login</Link>
        <Link to="/technician/register" className="rq-h-btn rq-press">
          Apply now
          <MaterialSymbol name="arrow_forward" />
        </Link>
      </div>
    </section>
  );
}
