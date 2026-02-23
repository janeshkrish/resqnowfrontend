
import { Button } from "./ui/button";
import { ArrowRight, PhoneCall, MapPin, Wrench, Anchor, Battery, ShoppingCart } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

import Autoplay from "embla-carousel-autoplay";

const Hero = () => {
  return (
    <section className="relative bg-gradient-to-br from-primary via-primary/90 to-accent text-white overflow-hidden">
      {/* Modern Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0 bg-grid-pattern"></div>
      </div>
      <div className="absolute top-10 right-10 w-96 h-96 bg-white/5 rounded-full blur-3xl"></div>
      <div className="absolute bottom-20 left-10 w-80 h-80 bg-white/5 rounded-full blur-3xl"></div>

      <div className="relative z-10 container mx-auto px-4 py-12 text-center">
        <Carousel
          className="w-full max-w-5xl mx-auto"
          plugins={[
            Autoplay({
              delay: 4000,
            }) as any,
          ]}
          opts={{
            loop: true,
          }}
        >
          <CarouselContent>
            {/* Slide 1: Emergency Call */}
            <CarouselItem>
              <div className="animate-fade-in max-w-4xl mx-auto space-y-8 py-4">
                {/* Status Badge */}
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-sm font-medium border border-white/20">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                  <PhoneCall className="h-4 w-4 text-green-300" />
                  Available 24/7
                </div>

                <h1 className="text-4xl md:text-6xl font-bold leading-tight">
                  Your Trusted
                  <span className="block bg-gradient-to-r from-yellow-300 to-orange-300 bg-clip-text text-transparent">
                    Vehicle Service Partner
                  </span>
                </h1>

                <p className="text-xl text-white/90 max-w-2xl mx-auto leading-relaxed">
                  Professional roadside assistance at your fingertips. Fast, reliable, and available when you need us most.
                </p>

                {/* Emergency CTA */}
                <Button
                  size="xl"
                  className="bg-white text-primary hover:bg-white/90 font-bold px-8 py-4 text-lg rounded-2xl shadow-2xl hover:shadow-xl transition-all transform hover:-translate-y-1"
                  asChild
                >
                  <Link to="/emergency">
                    <PhoneCall className="w-5 h-5 mr-2" />
                    Emergency Call Now
                  </Link>
                </Button>
              </div>
            </CarouselItem>

            {/* Slide 2: Technician Recruitment */}
            <CarouselItem>
              <div className="animate-fade-in max-w-4xl mx-auto space-y-8 py-4">
                {/* Recruitment Badge */}
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-sm font-medium border border-white/20">
                  <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></span>
                  <Wrench className="h-4 w-4 text-blue-300" />
                  Join Our Team
                </div>

                <h1 className="text-4xl md:text-6xl font-bold leading-tight">
                  Grow Your Business
                  <span className="block bg-gradient-to-r from-blue-300 to-cyan-300 bg-clip-text text-transparent">
                    Partner With Us
                  </span>
                </h1>

                <p className="text-xl text-white/90 max-w-2xl mx-auto leading-relaxed">
                  Join our network of skilled technicians. Get steady job requests, flexible hours, and guaranteed payments.
                </p>

                <Button
                  size="xl"
                  className="bg-white text-primary hover:bg-white/90 font-bold px-8 py-4 text-lg rounded-2xl shadow-2xl hover:shadow-xl transition-all transform hover:-translate-y-1"
                  asChild
                >
                  <Link to="/technician/register">
                    <Wrench className="w-5 h-5 mr-2" />
                    Join as Technician
                  </Link>
                </Button>
              </div>
            </CarouselItem>

            {/* Slide 3: Customer Promotion */}
            <CarouselItem>
              <div className="animate-fade-in max-w-4xl mx-auto space-y-8 py-4">
                {/* Promotion Badge */}
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-sm font-medium border border-white/20">
                  <span className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></span>
                  <ArrowRight className="h-4 w-4 text-purple-300" />
                  Premium Benefits
                </div>

                <h1 className="text-4xl md:text-6xl font-bold leading-tight">
                  Experience The Best
                  <span className="block bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">
                    Roadside Assistance
                  </span>
                </h1>

                <p className="text-xl text-white/90 max-w-2xl mx-auto leading-relaxed">
                  Sign up today for faster response times, real-time tracking, and exclusive member discounts.
                </p>

                <Button
                  size="xl"
                  className="bg-white text-primary hover:bg-white/90 font-bold px-8 py-4 text-lg rounded-2xl shadow-2xl hover:shadow-xl transition-all transform hover:-translate-y-1"
                  asChild
                >
                  <Link to="/register">
                    <ArrowRight className="w-5 h-5 mr-2" />
                    Get Started
                  </Link>
                </Button>
              </div>
            </CarouselItem>
          </CarouselContent>
          <CarouselPrevious className="hidden md:flex -left-12 bg-white/10 text-white border-white/20 hover:bg-white/20 hover:text-white" />
          <CarouselNext className="hidden md:flex -right-12 bg-white/10 text-white border-white/20 hover:bg-white/20 hover:text-white" />
        </Carousel>
      </div>

      {/* Modern Quick Services Card */}
      <div className="relative z-20 mx-4 mb-6">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden max-w-5xl mx-auto">
          <div className="p-6">
            <h3 className="text-gray-800 font-bold text-lg mb-6 text-center">Quick Access Services</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { icon: Anchor, name: "Towing", color: "bg-blue-50 text-blue-600 border-blue-100", link: "/request-service/towing" },
                { icon: Wrench, name: "Tire Fix", color: "bg-green-50 text-green-600 border-green-100", link: "/request-service/flat-tire" },
                { icon: Battery, name: "Battery", color: "bg-yellow-50 text-yellow-600 border-yellow-100", link: "/request-service/battery" },
                { icon: ArrowRight, name: "All Services", color: "bg-purple-50 text-purple-600 border-purple-100", link: "/services" }
              ].map((service, index) => (
                <Link
                  key={index}
                  to={service.link}
                  className={`${service.color} border-2 rounded-2xl p-4 text-center hover:scale-105 transition-all active:scale-95 cursor-pointer shadow-sm hover:shadow-md`}
                >
                  <service.icon className="w-8 h-8 mx-auto mb-2" />
                  <span className="text-sm font-semibold">{service.name}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Auto Parts Store CTA */}
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-6">
            <div className="text-center">
              <h4 className="text-gray-800 font-bold text-lg mb-2">Auto Parts Store</h4>
              <p className="text-gray-600 mb-4 text-sm">Premium parts at great prices</p>
              <Button
                variant="outline"
                className="text-primary border-primary hover:bg-primary hover:text-white transition-all"
                asChild
              >
                <Link to="/marketplace">
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Shop Now
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
