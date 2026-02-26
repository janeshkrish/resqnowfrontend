import { StarIcon, Quote } from "lucide-react";
import { useState } from "react";
import { Carousel, CarouselContent, CarouselItem } from "./ui/carousel";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

const testimonials = [
  {
    id: 1,
    name: "Sarah Johnson",
    location: "New York, NY",
    rating: 5,
    testimonial: "I was stranded on the highway with a flat tire. SwiftAssist arrived in just 20 minutes and got me back on the road quickly. Amazing service!",
    service: "Flat Tire Repair",
    avatar: "https://randomuser.me/api/portraits/women/44.jpg"
  },
  {
    id: 2,
    name: "Michael Chen",
    location: "Los Angeles, CA",
    rating: 5,
    testimonial: "Battery died in a parking lot late at night. Their technician was professional, fast, and got my car started in minutes. Would definitely recommend!",
    service: "Battery Jumpstart",
    avatar: "https://randomuser.me/api/portraits/men/32.jpg"
  },
  {
    id: 3,
    name: "Emily Rodriguez",
    location: "Chicago, IL",
    rating: 4,
    testimonial: "Locked my keys in the car with my toddler's car seat inside. The technician arrived quickly and helped me get back in without any damage. Very grateful!",
    service: "Lockout Assistance",
    avatar: "https://randomuser.me/api/portraits/women/68.jpg"
  },
  {
    id: 4,
    name: "David Williams",
    location: "Houston, TX",
    rating: 5,
    testimonial: "My car broke down miles from home. The towing service was prompt and the driver was incredibly helpful. They took great care of my vehicle.",
    service: "Towing Services",
    avatar: "https://randomuser.me/api/portraits/men/75.jpg"
  }
];

const Testimonials = () => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const isMobile = useIsMobile();

  return (
    <section>
      <div className="container px-4 md:px-6">
        <div className="mb-10 md:mb-16 text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-500/10 rounded-full mb-6 border border-amber-100 dark:border-amber-500/20">
             <StarIcon className="w-4 h-4 text-amber-500" />
             <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest">Customer Stories</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-black text-foreground tracking-tight mb-4">
            Loved by thousands.
          </h2>
          <p className="text-base md:text-xl text-slate-500 dark:text-slate-400 font-medium">
            Real stories from drivers we've helped get back on the road.
          </p>
        </div>

        {isMobile ? (
          <Carousel className="w-full" opts={{ loop: true, align: "center", dragFree: true }}>
            <CarouselContent className="-ml-3 pb-8">
              {testimonials.map((testimonial) => (
                <CarouselItem key={testimonial.id} className="pl-3 basis-[85%]">
                  <div className="bg-card dark:bg-slate-900 rounded-[2rem] p-7 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-border/60 h-full flex flex-col relative overflow-hidden group">
                    <Quote className="absolute -top-4 -right-4 h-28 w-28 text-slate-50 transform rotate-12 transition-transform group-hover:scale-110 duration-500" />

                    <div className="relative z-10 flex-grow">
                      <div className="flex items-center gap-1 mb-5">
                        {[...Array(5)].map((_, i) => (
                          <StarIcon
                            key={i}
                            className={cn(
                              "h-4 w-4",
                              i < testimonial.rating ? "text-amber-400 fill-amber-400 drop-shadow-sm" : "text-slate-200"
                            )}
                          />
                        ))}
                      </div>
                      <p className="text-muted-foreground font-medium leading-relaxed mb-6">
                        "{testimonial.testimonial}"
                      </p>
                    </div>

                    <div className="relative z-10 flex items-center gap-4 mt-auto pt-5 border-t border-border/80">
                       <img
                        src={testimonial.avatar}
                        alt={testimonial.name}
                        className="w-11 h-11 rounded-full object-cover ring-2 ring-white shadow-sm"
                      />
                      <div>
                        <h4 className="font-bold text-foreground text-sm">{testimonial.name}</h4>
                        <p className="text-muted-foreground/80 text-xs font-medium">{testimonial.location}</p>
                      </div>
                    </div>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {testimonials.map((testimonial, index) => (
              <div
                key={testimonial.id}
                className="bg-white dark:bg-card rounded-[2rem] p-8 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] border border-slate-100 dark:border-slate-800/60 hover:border-transparent transition-all duration-300 relative overflow-hidden group flex flex-col h-full hover:-translate-y-2"
                onMouseEnter={() => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
              >
                <Quote className={cn(
                  "absolute -top-6 -right-6 h-32 w-32 text-slate-50 dark:text-slate-800/30 transform rotate-12 transition-transform duration-500",
                  activeIndex === index && "scale-110 text-slate-100 dark:text-slate-800/50"
                )} />

                <div className="relative z-10 flex-grow">
                  <div className="flex items-center gap-1 mb-6">
                    {[...Array(5)].map((_, i) => (
                      <StarIcon
                        key={i}
                        className={cn(
                          "h-5 w-5",
                          i < testimonial.rating ? "text-amber-400 fill-amber-400" : "text-slate-200"
                        )}
                      />
                    ))}
                  </div>

                  <p className="text-slate-600 dark:text-slate-300 font-medium leading-relaxed mb-8 text-lg">
                    "{testimonial.testimonial}"
                  </p>
                </div>

                <div className="relative z-10 flex items-center gap-4 mt-auto pt-6 border-t border-slate-100 dark:border-slate-800">
                  <div className={cn(
                    "relative w-12 h-12 rounded-full overflow-hidden border-2 transition-all duration-300",
                    activeIndex === index ? "border-amber-400 scale-105 shadow-md" : "border-slate-100 dark:border-slate-800"
                  )}>
                    <img
                      src={testimonial.avatar}
                      alt={testimonial.name}
                      className="object-cover w-full h-full"
                    />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-slate-100">{testimonial.name}</h4>
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mt-0.5">{testimonial.location}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default Testimonials;
