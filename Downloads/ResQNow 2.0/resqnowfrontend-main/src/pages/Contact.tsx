
import { MapPin, Phone, Mail, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { toast } from "sonner";
import { useState } from "react";
import { apiFetch } from "@/lib/api";

const Contact = () => {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name"),
      email: formData.get("email"),
      subject: formData.get("subject"),
      message: formData.get("message"),
    };

    try {
      const res = await apiFetch("/api/public/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (res.ok) {
        toast.success("Message Sent", {
          description: "We've received your message and will get back to you shortly.",
        });
        (e.target as HTMLFormElement).reset();
      } else {
        throw new Error(result.error || "Failed to send message");
      }
    } catch (error) {
      toast.error("Error", {
        description: error instanceof Error ? error.message : "Something went wrong. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <div className="bg-red-600 text-white py-16">
        <div className="container">
          <h1 className="text-4xl md:text-5xl font-bold text-center">Contact Us</h1>
          <p className="text-xl text-center mt-4 max-w-3xl mx-auto">
            Have questions or need assistance? We're here to help 24/7.
          </p>
        </div>
      </div>

      <div className="container py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div>
            <h2 className="text-2xl font-bold mb-6">Get In Touch</h2>
            <p className="text-muted-foreground mb-8">
              Whether you have questions about our services, need technical support, or want to provide feedback, our team is ready to assist you. Fill out the form, and we'll get back to you as soon as possible.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" name="name" placeholder="Your full name" required />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" placeholder="you@example.com" required />
                </div>
              </div>

              <div>
                <Label htmlFor="subject">Subject</Label>
                <Input id="subject" name="subject" placeholder="Subject" required />
              </div>

              <div>
                <Label htmlFor="message">Message</Label>
                <Textarea id="message" name="message" rows={6} placeholder="Write your message..." required />
              </div>

              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">We reply within 24 hours.</div>
                <Button type="submit" disabled={loading}>{loading ? "Sending..." : "Send Message"}</Button>
              </div>
            </form>
          </div>

          <div>
            <div className="bg-muted p-6 rounded-lg shadow-sm">
              <h3 className="text-lg font-semibold mb-4">Contact Information</h3>
              <ul className="space-y-4 text-muted-foreground">
                <li className="flex items-start gap-3">
                  <MapPin className="mt-1" />
                  <div>123 ResQ Street, Bengaluru, Karnataka</div>
                </li>
                <li className="flex items-start gap-3">
                  <Phone className="mt-1" />
                  <div><a href="tel:+919876543210" className="hover:text-red-500">+91 98765 43210</a></div>
                </li>
                <li className="flex items-start gap-3">
                  <Mail className="mt-1" />
                  <div><a href="mailto:support@resqnow.com" className="hover:text-red-500">support@resqnow.com</a></div>
                </li>
                <li className="flex items-start gap-3">
                  <Clock className="mt-1" />
                  <div>24/7 Emergency Support</div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Contact;
