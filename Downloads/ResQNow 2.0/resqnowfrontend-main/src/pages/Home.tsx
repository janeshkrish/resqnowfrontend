
import Hero from "@/components/Hero";
import Services from "@/components/Services";
import VehicleTypes from "@/components/VehicleTypes";
import HowItWorks from "@/components/HowItWorks";
import Testimonials from "@/components/Testimonials";

const Home = () => {
  return (
    <div className="min-h-screen">
      <Hero />
      <Services />
      <VehicleTypes />
      <HowItWorks />
      <Testimonials />
    </div>
  );
};

export default Home;
