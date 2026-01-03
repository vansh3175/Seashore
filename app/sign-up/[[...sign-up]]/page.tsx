import { SignUp } from '@clerk/nextjs'

import { Waves, CheckCircle2 } from "lucide-react";

export default function Page() {
  return (
    <div className="min-h-screen bg-[#050810] text-white flex overflow-hidden selection:bg-[#3CE8FF]/30">
      
      {/* --- LEFT SIDE: CINEMATIC VISUAL --- */}
      <div className="hidden lg:flex w-1/2 relative bg-[#0B0F19] items-center justify-center overflow-hidden border-r border-white/5">
        
        {/* Background Ambiance */}
        <div className="absolute top-[-20%] left-[-20%] w-[800px] h-[800px] bg-blue-600/20 rounded-full blur-[150px] opacity-50" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-[#3CE8FF]/10 rounded-full blur-[150px] opacity-40" />
        
        {/* Content */}
        <div className="relative z-10 p-12 max-w-lg">
          <div className="w-12 h-12 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.3)] mb-8">
            <Waves className="w-7 h-7 text-white" />
          </div>
          
          <h1 className="text-4xl font-bold mb-6 leading-tight">
            Create your new <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#3CE8FF] to-blue-500">
                Digital Studio.
            </span>
          </h1>
          
          <p className="text-slate-400 text-lg mb-10 leading-relaxed">
            Record studio-quality 4K video and crystal clear audio from anywhere in the world.
          </p>

          <div className="space-y-4">
            {['Separate Audio/Video Tracks', 'Cloud Backups', 'Forget about bad internet'].map((feature, i) => (
              <div key={i} className="flex items-center gap-3 text-slate-300">
                <div className="p-1 rounded-full bg-[#3CE8FF]/10 text-[#3CE8FF]">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                {feature}
              </div>
            ))}
          </div>
        </div>

        {/* Decorative Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_80%)]" />
      </div>

      {/* --- RIGHT SIDE: CLERK FORM --- */}
      {/* Added a subtle gradient here so it's not "flat black" */}
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-6 relative bg-gradient-to-b from-[#0B0F19] to-[#050810]">
        
        {/* Subtle top-right glow for the right side */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-900/10 blur-[120px] pointer-events-none" />

        {/* Mobile Header */}
        <div className="lg:hidden flex items-center gap-2 font-bold text-xl tracking-tight mb-8">
          <Waves className="w-6 h-6 text-[#3CE8FF]" />
          SeaShore
        </div>

        <SignUp 
          appearance={{
            layout: {
              socialButtonsVariant: "blockButton",
            },
            variables: {
              colorPrimary: "#3CE8FF",
              colorBackground: "#141825",
              colorText: "white",
              colorTextSecondary: "#94a3b8",
              colorInputBackground: "#0B0F19",
              colorInputText: "white",
              borderRadius: "0.75rem",
            },
            elements: {
              card: "bg-[#141825] border border-white/10 shadow-2xl shadow-black/80 p-8",
              
              headerTitle: "text-2xl font-bold text-white",
              headerSubtitle: "text-slate-400",
              
              // --- THE FIX ---
              // Added '!' to force override Clerk's default white background
              socialButtonsBlockButton: 
                "!bg-white/10 !border-white/10 hover:!bg-white/20 !text-white transition-all h-12",
              
              socialButtonsBlockButtonText: "!text-white !font-semibold",
              socialButtonsBlockButtonArrow: "!text-white",
              
              // Divider
              dividerLine: "bg-white/10",
              dividerText: "text-slate-500",
              
              // Inputs
              formFieldLabel: "text-xs font-bold text-slate-500 uppercase tracking-wide",
              formFieldInput: "bg-[#0B0F19] border border-white/10 focus:border-[#3CE8FF] transition-colors py-3 text-white",
              
              // Primary Button
              formButtonPrimary: "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3 shadow-lg shadow-blue-500/20 border-0",
              
              footerActionText: "text-slate-400",
              footerActionLink: "text-[#3CE8FF] hover:text-blue-400 font-bold",
              
              logoBox: "hidden",
            }
          }}
        />
        
      </div>
    </div>
  );
}