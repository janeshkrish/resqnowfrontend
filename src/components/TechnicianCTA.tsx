
import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, Star, Clock, DollarSign } from "lucide-react";

const TechnicianCTA = () => {
  return (
    <section className="py-20 bg-muted">
      <div className="container px-4 md:px-6">
        <div className="grid gap-6 lg:grid-cols-2 lg:gap-12 items-center">
          <div className="space-y-4">
            <div className="inline-block rounded-lg bg-blue-100 px-3 py-1 text-sm text-blue-800">
              Technicians
            </div>
            <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
              Join our network of professionals
            </h2>
            <p className="text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
              Become a ResQNow technician and grow your business while helping drivers in need. Get access to a steady stream of customers and enjoy the benefits of our platform.
            </p>
            <div className="flex flex-col gap-2 min-[400px]:flex-row">
              <Button className="bg-blue-600 hover:bg-blue-700" size="lg" asChild>
                <Link to="/technician/register">Apply Now</Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link to="/technician/login">Login</Link>
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-6 flex flex-col items-center text-center">
                <Shield className="h-10 w-10 text-blue-600 mb-4" />
                <h3 className="text-xl font-bold">Reliable Income</h3>
                <p className="text-sm text-gray-500 mt-2">
                  Access to consistent service requests in your area
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 flex flex-col items-center text-center">
                <Star className="h-10 w-10 text-blue-600 mb-4" />
                <h3 className="text-xl font-bold">Build Reputation</h3>
                <p className="text-sm text-gray-500 mt-2">
                  Grow your business through customer ratings and reviews
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 flex flex-col items-center text-center">
                <Clock className="h-10 w-10 text-blue-600 mb-4" />
                <h3 className="text-xl font-bold">Flexible Schedule</h3>
                <p className="text-sm text-gray-500 mt-2">
                  Work when you want with complete schedule control
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 flex flex-col items-center text-center">
                <DollarSign className="h-10 w-10 text-blue-600 mb-4" />
                <h3 className="text-xl font-bold">Competitive Pay</h3>
                <p className="text-sm text-gray-500 mt-2">
                  Earn competitive rates with transparent payment processes
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TechnicianCTA;
