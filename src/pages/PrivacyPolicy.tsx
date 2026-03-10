import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const PrivacyPolicy = () => {
    return (
        <div className="container py-12 max-w-4xl">
            <div className="mb-8 text-center">
                <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
                <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>
            </div>

            <Card className="mb-8">
                <CardContent className="p-6 md:p-8 space-y-6">
                    <section>
                        <h2 className="text-xl font-semibold mb-3 text-primary">1. Information We Collect</h2>
                        <p className="text-muted-foreground leading-relaxed mb-4">
                            We collect information to provide better services to all our users. The types of information we collect include:
                        </p>
                        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                            <li><strong>Personal Information:</strong> Name, email address, phone number, and vehicle details provided during registration or service requests.</li>
                            <li><strong>Location Data:</strong> Real-time location information to connect you with nearby technicians and track service progress.</li>
                            <li><strong>Usage Data:</strong> Information about how you use our platform, including service history and interactions.</li>
                            <li><strong>Device Information:</strong> Device type, operating system, and unique device identifiers for security and optimization.</li>
                        </ul>
                    </section>

                    <Separator />

                    <section>
                        <h2 className="text-xl font-semibold mb-3 text-primary">2. How We Use Information</h2>
                        <p className="text-muted-foreground leading-relaxed mb-2">
                            We use the information we collect for the following purposes:
                        </p>
                        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                            <li>To facilitate roadside assistance and connect users with technicians.</li>
                            <li>To communicate with you regarding your service requests and account updates.</li>
                            <li>To improve our platform, develop new features, and ensure security.</li>
                            <li>To comply with legal obligations and resolve disputes.</li>
                        </ul>
                    </section>

                    <Separator />

                    <section>
                        <h2 className="text-xl font-semibold mb-3 text-primary">3. Data Sharing</h2>
                        <p className="text-muted-foreground leading-relaxed">
                            We do not sell your personal information. We may share your data with:
                        </p>
                        <ul className="list-disc pl-6 space-y-2 text-muted-foreground mt-2">
                            <li><strong>Technicians:</strong> To fulfill your service request (e.g., sharing your location and vehicle details).</li>
                            <li><strong>Service Providers:</strong> Third-party vendors who assist with payment processing, hosting, and analytics.</li>
                            <li><strong>Legal Requirements:</strong> If required by law or to protect the rights and safety of ResQNow, our users, or the public.</li>
                        </ul>
                    </section>

                    <Separator />

                    <section>
                        <h2 className="text-xl font-semibold mb-3 text-primary">4. Data Security</h2>
                        <p className="text-muted-foreground leading-relaxed">
                            We implement industry-standard security measures to protect your data from unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.
                        </p>
                    </section>

                    <Separator />

                    <section>
                        <h2 className="text-xl font-semibold mb-3 text-primary">5. User Rights</h2>
                        <p className="text-muted-foreground leading-relaxed">
                            You have the right to access, correct, or delete your personal information. You can manage your account settings within the app or contact us directly to exercise these rights.
                        </p>
                    </section>

                    <Separator />

                    <section>
                        <h2 className="text-xl font-semibold mb-3 text-primary">6. Cookies</h2>
                        <p className="text-muted-foreground leading-relaxed">
                            We use cookies and similar technologies to enhance your experience, analyze usage, and remember your preferences. You can control cookie settings through your browser.
                        </p>
                    </section>

                    <Separator />

                    <section>
                        <h2 className="text-xl font-semibold mb-3 text-primary">7. Policy Updates</h2>
                        <p className="text-muted-foreground leading-relaxed">
                            We may update this Privacy Policy from time to time. We will notify you of any significant changes by posting the new policy on this page and updating the "Last updated" date.
                        </p>
                    </section>

                    <Separator />

                    <section>
                        <h2 className="text-xl font-semibold mb-3 text-primary">8. Contact Information</h2>
                        <p className="text-muted-foreground leading-relaxed mb-2">
                            If you have any questions about this Privacy Policy, please contact us:
                        </p>
                        <div className="bg-muted p-4 rounded-lg">
                            <p className="font-medium">ResQNow Support</p>
                            <p>Email: <a href="mailto:resqnow01@gmail.com" className="text-blue-600 hover:underline">resqnow01@gmail.com</a></p>
                            <p>Phone: <a href="tel:+919566510080" className="text-blue-600 hover:underline">+91 9566510080</a></p>
                        </div>
                    </section>
                </CardContent>
            </Card>

            <div className="text-center text-sm text-muted-foreground/80">
                &copy; {new Date().getFullYear()} ResQNow. All rights reserved.
            </div>
        </div>
    );
};

export default PrivacyPolicy;
