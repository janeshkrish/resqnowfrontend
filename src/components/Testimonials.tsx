import { Quote, StarIcon } from "lucide-react";
import { useEffect, useState } from "react";

const reviews = [
  {
    name: "Arun Kumar",
    location: "Gandhipuram, Coimbatore",
    text: "My bike broke down near Gandhipuram. The service was quick and the technician was very helpful!",
    image: "/users/user1.jpg",
  },
  {
    name: "Dhinakaran A",
    location: "Peelamedu, Coimbatore",
    text: "Battery issue was fixed within 20 minutes. Very professional service.",
    image: "/users/user2.jpg",
  },
  {
    name: "Karthik R",
    location: "RS Puram, Coimbatore",
    text: "Fast response and affordable pricing. Great experience overall.",
    image: "/users/user3.jpg",
  },
] as const;

export default function Testimonials() {
  const [index, setIndex] = useState(0);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const interval = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % reviews.length);
    }, 3000);

    return () => window.clearInterval(interval);
  }, []);

  const review = reviews[index];

  return (
    <section className="w-full">
      <div className="mx-auto max-w-2xl px-4 md:px-6">
        <div className="mb-8 text-center md:mb-10">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-100 bg-amber-50 px-3 py-1.5">
            <StarIcon className="h-4 w-4 fill-amber-400 text-amber-400" />
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">
              Coimbatore Reviews
            </span>
          </div>
          <h2 className="text-3xl font-black tracking-tight text-foreground md:text-4xl">
            Trusted by drivers across Coimbatore.
          </h2>
          <p className="mt-3 text-sm font-medium text-slate-500 md:text-base">
            Real roadside assistance stories from Gandhipuram, Peelamedu, and RS Puram.
          </p>
        </div>

        <div className="mx-auto max-w-xl">
          <div
            key={review.image}
            className="rounded-2xl bg-white p-5 shadow-md transition-all duration-500 ease-in-out animate-in fade-in-0 slide-in-from-right-3 md:p-6"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                {failedImages[review.image] ? (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-red-400 to-red-500 text-base font-semibold text-white">
                    {review.name[0]}
                  </div>
                ) : (
                  <img
                    src={review.image}
                    alt={review.name}
                    className="h-12 w-12 rounded-full object-cover shadow-sm"
                    onError={() =>
                      setFailedImages((prev) => ({
                        ...prev,
                        [review.image]: true,
                      }))
                    }
                  />
                )}

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-semibold text-gray-800">{review.name}</h4>
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-600">
                      ✔ Verified
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">{review.location}</p>
                </div>
              </div>

              <Quote className="h-5 w-5 shrink-0 text-slate-200" />
            </div>

            <div className="mb-3 flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, starIndex) => (
                <StarIcon
                  key={starIndex}
                  className="h-4 w-4 fill-amber-400 text-amber-400"
                />
              ))}
            </div>

            <p className="text-sm leading-7 text-gray-600">{review.text}</p>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-center gap-2">
          {reviews.map((item, dotIndex) => {
            const isActive = dotIndex === index;
            return (
              <button
                key={item.image}
                type="button"
                aria-label={`Show review ${dotIndex + 1}`}
                onClick={() => setIndex(dotIndex)}
                className={`h-2.5 rounded-full transition-all duration-500 ease-in-out ${
                  isActive ? "w-8 bg-slate-900" : "w-2.5 bg-slate-300 hover:bg-slate-400"
                }`}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}
