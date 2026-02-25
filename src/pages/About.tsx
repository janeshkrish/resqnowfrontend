
import { Shield, Clock, CheckSquare, MapPin, User, Users, Car, Award } from "lucide-react";
import AnimatedCounter from "@/components/AnimatedCounter";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

const About = () => {
  const [stats, setStats] = useState({
    users: 0,
    technicians: 0,
    completedServices: 0
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await apiFetch("/api/public/stats");
        if (res.ok) {
          const data = await res.json();
          setStats({
            users: data.users || 0,
            technicians: data.technicians || 0,
            completedServices: data.completedServices || 0
          });
        }
      } catch (err) {
        console.error("Failed to fetch stats", err);
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="min-h-screen">
      <div className="bg-red-600 text-white py-16">
        <div className="container">
          <h1 className="text-4xl md:text-5xl font-bold text-center">About ResQNow</h1>
          <p className="text-xl text-center mt-4 max-w-3xl mx-auto">
            Your trusted partner for real-time roadside assistance and technician connectivity.
          </p>
        </div>
      </div>

      <div className="container py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center mb-16">
          <div>
            <h2 className="text-3xl font-bold mb-6">Our Mission</h2>
            <p className="text-lg text-gray-700 mb-4">
              At ResQNow, our mission is to revolutionize roadside assistance by building a seamless and reliable network that connects travelers with nearby expert technicians in real-time. We are committed to creating a trustworthy ecosystem where help is just a click away—ensuring safety, convenience, and peace of mind for everyone on the road.
            </p>
            <p className="text-lg text-gray-700 mb-4">
              Whether it's a flat tire, fuel shortage, or battery issue, our advanced platform empowers users with fast, transparent, and dependable support wherever they are.
            </p>
          </div>
          <div className="bg-gray-100 rounded-lg p-8">
            <div className="grid grid-cols-2 gap-6">
              <div className="text-center">
                <Shield className="h-12 w-12 text-red-600 mx-auto mb-3" />
                <h3 className="font-bold text-xl">Reliable</h3>
                <p className="text-gray-600">Verified professionals</p>
              </div>
              <div className="text-center">
                <Clock className="h-12 w-12 text-red-600 mx-auto mb-3" />
                <h3 className="font-bold text-xl">Fast</h3>
                <p className="text-gray-600">Real-time connections</p>
              </div>
              <div className="text-center">
                <CheckSquare className="h-12 w-12 text-red-600 mx-auto mb-3" />
                <h3 className="font-bold text-xl">Professional</h3>
                <p className="text-gray-600">Skilled technicians</p>
              </div>
              <div className="text-center">
                <MapPin className="h-12 w-12 text-red-600 mx-auto mb-3" />
                <h3 className="font-bold text-xl">Everywhere</h3>
                <p className="text-gray-600">Wide service coverage</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-10">Platform Impact</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-card dark:bg-slate-900 p-6 rounded-lg shadow-sm border border-gray-100 text-center">
              <User className="h-10 w-10 text-red-600 mx-auto mb-4" />
              <p className="text-4xl font-bold text-gray-900 mb-2">
                <AnimatedCounter end={stats.users} suffix="+" duration={2000} />
              </p>
              <p className="text-gray-600">Registered Users</p>
            </div>
            <div className="bg-card dark:bg-slate-900 p-6 rounded-lg shadow-sm border border-gray-100 text-center">
              <Users className="h-10 w-10 text-red-600 mx-auto mb-4" />
              <p className="text-4xl font-bold text-gray-900 mb-2">
                <AnimatedCounter end={stats.technicians} suffix="+" duration={2000} />
              </p>
              <p className="text-gray-600">Verified Technicians</p>
            </div>
            <div className="bg-card dark:bg-slate-900 p-6 rounded-lg shadow-sm border border-gray-100 text-center">
              <Car className="h-10 w-10 text-red-600 mx-auto mb-4" />
              <p className="text-4xl font-bold text-gray-900 mb-2">
                <AnimatedCounter end={stats.completedServices} suffix="+" duration={2000} />
              </p>
              <p className="text-gray-600">Services Completed</p>
            </div>
            <div className="bg-card dark:bg-slate-900 p-6 rounded-lg shadow-sm border border-gray-100 text-center">
              <Award className="h-10 w-10 text-red-600 mx-auto mb-4" />
              <p className="text-4xl font-bold text-gray-900 mb-2">
                <AnimatedCounter end={24} suffix="/7" duration={1000} />
              </p>
              <p className="text-gray-600">Support Availability</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-8 mb-16">
          <h2 className="text-3xl font-bold mb-6 text-center">Our Story</h2>
          <div className="max-w-3xl mx-auto space-y-4">
            <p className="text-lg text-gray-700">
              The concept of ResQNow was born from a pivotal moment in 2025 experienced by Arokiya Aswanth A. Stranded in an isolated area with a vehicle breakdown and no immediate assistance available, the vulnerability of such a situation became starkly apparent. It highlighted a critical gap in the traditional roadside assistance landscape: the disconnect between drivers in distress and local, available skill.
            </p>
            <p className="text-lg text-gray-700">
              This experience became the catalyst for building a solution. Driven by the vision of a connected and safer road network, the idea evolved into a technology-driven platform. The goal was simple—to engineer a digital ecosystem that instantly connects stranded motorists with the nearest qualified technicians.
            </p>
            <p className="text-lg text-gray-700">
              Today, ResQNow stands as a testament to that vision. We have transformed from a simple idea into a robust platform that ensures no traveler is left helpless. By leveraging real-time location technology and a network of verified providers, we are redefining reliability on the road.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default About;
