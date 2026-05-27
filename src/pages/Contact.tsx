import React, { useState } from "react";
import { motion } from "framer-motion";
import { MapPin, Phone, Mail, Clock, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

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
    <div className="min-h-screen bg-[#fafafa] selection:bg-blue-100 selection:text-blue-900 font-sans pb-24 relative overflow-hidden">
      
      {/* Sleek Minimalist Header */}
      <div className="relative pt-32 pb-20 lg:pt-40 lg:pb-32 flex flex-col items-center justify-center text-center px-4 overflow-hidden">
        <div className="absolute inset-0 bg-white" />
        <div className="absolute top-0 inset-x-0 h-[500px] bg-[radial-gradient(ellipse_at_top,rgba(37,99,235,0.08)_0%,transparent_70%)]" />
        <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
        
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="relative z-10"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-200 bg-white text-[11px] font-bold uppercase tracking-[0.15em] text-slate-600 shadow-sm mb-6">
            <Sparkles size={12} className="text-blue-600" />
            24/7 Support Desk
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tight mb-6">
            Let's keep you <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">moving.</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-500 font-medium max-w-2xl mx-auto leading-relaxed">
            Whether you have questions about our dispatch network, need technical support, or want to partner with us, our team is ready.
          </p>
        </motion.div>
      </div>

      <div className="container relative mx-auto max-w-6xl px-4 lg:px-8 -mt-10 lg:-mt-16 z-20">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          
          {/* Form Side */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-3 bg-white/70 backdrop-blur-2xl p-8 lg:p-12 rounded-[2rem] shadow-[0_20px_50px_-15px_rgba(15,23,42,0.08)] border border-white"
          >
            <h2 className="text-2xl font-bold text-slate-900 mb-8">Send a message</h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 group">
                  <Label htmlFor="name" className="text-xs font-bold uppercase tracking-wider text-slate-500 group-focus-within:text-blue-600 transition-colors">Full Name</Label>
                  <Input id="name" name="name" placeholder="John Doe" required className="h-14 px-4 bg-slate-50 border-slate-200 rounded-xl focus-visible:ring-blue-500 focus-visible:border-blue-500 transition-all shadow-inner text-base" />
                </div>
                <div className="space-y-2 group">
                  <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-slate-500 group-focus-within:text-blue-600 transition-colors">Email Address</Label>
                  <Input id="email" name="email" type="email" placeholder="john@example.com" required className="h-14 px-4 bg-slate-50 border-slate-200 rounded-xl focus-visible:ring-blue-500 focus-visible:border-blue-500 transition-all shadow-inner text-base" />
                </div>
              </div>

              <div className="space-y-2 group">
                <Label htmlFor="subject" className="text-xs font-bold uppercase tracking-wider text-slate-500 group-focus-within:text-blue-600 transition-colors">Subject</Label>
                <Input id="subject" name="subject" placeholder="How can we help?" required className="h-14 px-4 bg-slate-50 border-slate-200 rounded-xl focus-visible:ring-blue-500 focus-visible:border-blue-500 transition-all shadow-inner text-base" />
              </div>

              <div className="space-y-2 group">
                <Label htmlFor="message" className="text-xs font-bold uppercase tracking-wider text-slate-500 group-focus-within:text-blue-600 transition-colors">Message</Label>
                <Textarea id="message" name="message" rows={5} placeholder="Tell us more about your inquiry..." required className="p-4 bg-slate-50 border-slate-200 rounded-xl focus-visible:ring-blue-500 focus-visible:border-blue-500 transition-all shadow-inner resize-none text-base" />
              </div>

              <div className="pt-4 flex items-center justify-between">
                <div className="text-[13px] font-medium text-slate-400">Response within <span className="font-bold text-slate-600">2 hours</span>.</div>
                <Button type="submit" disabled={loading} size="xl" className="h-14 px-8 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 hover:shadow-lg hover:-translate-y-0.5 transition-all">
                  {loading ? "Sending..." : (
                    <>
                      Send Message <Send className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </form>
          </motion.div>

          {/* Info Side */}
          <motion.div 
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-2 bg-gradient-to-b from-blue-50 to-white rounded-[2rem] p-8 lg:p-12 text-slate-900 relative overflow-hidden shadow-lg border border-blue-100/50"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[60px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[60px] translate-y-1/2 -translate-x-1/2 pointer-events-none" />
            
            <h3 className="text-2xl font-bold mb-8 relative z-10 text-slate-900">Direct Contact</h3>
            
            <ul className="space-y-10 relative z-10">
              <li className="flex flex-col gap-2">
                <div className="flex items-center gap-3 text-blue-600">
                  <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center border border-slate-100">
                    <MapPin size={18} />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Headquarters</span>
                </div>
                <div className="text-slate-600 font-medium leading-relaxed pl-13 ml-[52px]">
                  KGISL Institute of Technology,<br />
                  KGISL Campus, Thudiyalur Road,<br />
                  Saravanampatti, Coimbatore - 641 035
                </div>
              </li>
              
              <li className="flex flex-col gap-2">
                <div className="flex items-center gap-3 text-blue-600">
                  <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center border border-slate-100">
                    <Phone size={18} />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Phone</span>
                </div>
                <div className="text-slate-600 font-medium pl-13 ml-[52px]">
                  <a href="tel:+919566510080" className="text-lg font-bold text-slate-900 hover:text-blue-600 transition-colors block">+91 9566510080</a>
                </div>
              </li>
              
              <li className="flex flex-col gap-2">
                <div className="flex items-center gap-3 text-blue-600">
                  <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center border border-slate-100">
                    <Mail size={18} />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Email</span>
                </div>
                <div className="text-slate-600 font-medium pl-13 ml-[52px]">
                  <a href="mailto:resqnow01@gmail.com" className="font-bold text-slate-900 hover:text-blue-600 transition-colors block">resqnow01@gmail.com</a>
                </div>
              </li>
              
              <li className="flex flex-col gap-2 pt-6 border-t border-slate-200">
                <div className="flex items-center gap-3 text-emerald-600">
                  <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center border border-slate-100">
                    <Clock size={18} />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-widest text-emerald-600">Operating Hours</span>
                </div>
                <div className="text-slate-900 font-bold text-lg pl-13 ml-[52px]">
                  24/7 Emergency Support Grid
                </div>
              </li>
            </ul>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Contact;
