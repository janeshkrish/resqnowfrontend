import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const TermsOfService = () => {
  return (
    <div className="container py-12 max-w-4xl">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>
      </div>

      <Card className="mb-8">
        <CardContent className="p-6 md:p-8 space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-3 text-primary">1. Agreement to Terms</h2>
            <p className="text-gray-700 leading-relaxed">
              By accessing or using the ResQNow platform, you agree to be bound by these Terms of Service and our Privacy Policy. If you do not agree to these terms, simply do not access the platform.
            </p>
          </section>

          <Separator />

          <section>
            <h2 className="text-xl font-semibold mb-3 text-primary">2. Platform Overview</h2>
            <p className="text-gray-700 leading-relaxed">
              ResQNow operates as a technology platform that connects users in need of roadside assistance with independent technicians. ResQNow is an intermediary and is not a provider of vehicle repair services. We are not a party to any agreement between users and technicians.
            </p>
          </section>

          <Separator />

          <section>
            <h2 className="text-xl font-semibold mb-3 text-primary">3. User Responsibilities</h2>
            <ul className="list-disc pl-6 space-y-2 text-gray-700">
              <li>You agree to provide accurate and complete information when creating an account or requesting service.</li>
              <li>You are responsible for the security of your account credentials.</li>
              <li>You agree to treat technicians with respect and ensure a safe environment for service delivery.</li>
              <li>You will not use the platform for any illegal or unauthorized purpose.</li>
            </ul>
          </section>

          <Separator />

          <section>
            <h2 className="text-xl font-semibold mb-3 text-primary">4. Technician Responsibilities</h2>
            <p className="text-gray-700 leading-relaxed">
              Technicians using the platform operate as independent contractors. They are responsible for:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-gray-700 mt-2">
              <li>Maintaining necessary licenses, insurance, and professional standards.</li>
              <li>Providing services in a timely and professional manner.</li>
              <li>Adhering to the pricing and service terms agreed upon via the platform.</li>
            </ul>
          </section>

          <Separator />

          <section>
            <h2 className="text-xl font-semibold mb-3 text-primary">5. Payments & Disputes</h2>
            <p className="text-gray-700 leading-relaxed">
              Payment terms are agreed upon between the user and the technician or facilitated through the platform. ResQNow is not responsible for any payment disputes but may assist in mediation at its sole discretion.
            </p>
          </section>

          <Separator />

          <section>
            <h2 className="text-xl font-semibold mb-3 text-primary">6. Limitation of Liability</h2>
            <p className="text-gray-700 leading-relaxed">
              To the maximum extent permitted by law, ResQNow shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, or any loss of data, use, goodwill, or other intangible losses, resulting from (a) your access to or use of or inability to access or use the platform; (b) any conduct or content of any third party on the platform.
            </p>
          </section>

          <Separator />

          <section>
            <h2 className="text-xl font-semibold mb-3 text-primary">7. Account Termination</h2>
            <p className="text-gray-700 leading-relaxed">
              We may terminate or suspend your account immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.
            </p>
          </section>

          <Separator />

          <section>
            <h2 className="text-xl font-semibold mb-3 text-primary">8. Governing Law</h2>
            <p className="text-gray-700 leading-relaxed">
              These Terms shall be governed and construed in accordance with the laws of India, without regard to its conflict of law provisions. Any disputes involving ResQNow shall be subject to the exclusive jurisdiction of the courts in Coimbatore, Tamil Nadu.
            </p>
          </section>

          <Separator />

          <section>
            <h2 className="text-xl font-semibold mb-3 text-primary">9. Contact Information</h2>
            <p className="text-gray-700 leading-relaxed mb-2">
              Questions about the Terms of Service should be sent to us at:
            </p>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="font-medium">ResQNow Legal</p>
              <p>Email: <a href="mailto:resqnow01@gmail.com" className="text-blue-600 hover:underline">resqnow01@gmail.com</a></p>
              <p>Phone: <a href="tel:+919566510080" className="text-blue-600 hover:underline">+91 9566510080</a></p>
            </div>
          </section>
        </CardContent>
      </Card>

      <div className="text-center text-sm text-gray-500">
        &copy; {new Date().getFullYear()} ResQNow. All rights reserved.
      </div>
    </div>
  );
};

export default TermsOfService;
