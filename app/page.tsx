"use client";
import { Inter } from 'next/font/google';
import {
  Mic,
  Video,
  MonitorUp,
  Cloud,
  PhoneOff,
  ArrowUp,
  Play,
  Layers,
  ChevronDown,
  LayoutDashboard,
  FileText,
  Upload,
  Users,
  Briefcase,
  Globe,
  CloudLightning,
  Monitor,
  Wifi,
  ArrowRight,
  Waves,
  Twitter,
  Github,
  Linkedin,
  Instagram,
  Settings,
  Sparkles,
  MessageSquare,
} from 'lucide-react';
import VideoGrid from '@/components/VideoGrid';
import Link from 'next/link';

const inter = Inter({ subsets: ['latin'] });

// --- DATA FOR DROPDOWNS ---
const navData = {
  product: [
    { title: "Studio", icon: Mic, desc: "Record high-quality audio & video" },
    { title: "Transcripts", icon: FileText, desc: "AI-generated text from your recordings" },
    { title: "Upload Media", icon: Upload, desc: "Import and edit your existing files" },
    { title: "Recording Dashboard", icon: LayoutDashboard, desc: "Manage all studio sessions in one place" },
  ],

  features: [
    { title: "4K Local Recording", icon: Video, desc: "Capture crisp, lossless video locally" },
    { title: "Separate Tracks", icon: Layers, desc: "Download individual audio & video tracks" },
    { title: "Multi-Guest Rooms", icon: Users, desc: "Record with multiple remote participants" },
    { title: "Screen Recording", icon: Monitor, desc: "Share and capture your screen in HD" },
    { title: "Cloud Backup", icon: CloudLightning, desc: "Auto-save everything securely to the cloud" },
  ],

  solutions: [
    { title: "Podcasters", icon: Mic, desc: "Create professional podcast episodes easily" },
    { title: "Interviewers", icon: MessageSquare, desc: "Record reliable, remote interviews" },
    { title: "Creators", icon: Sparkles, desc: "Produce content with cinematic quality" },
    { title: "Teams", icon: Briefcase, desc: "Collaborate and record across your organization" },
    { title: "Remote Workflows", icon: Globe, desc: "Run smooth, fully remote recording sessions" },
  ]
};


// --- REUSABLE NAV ITEM COMPONENT ---
function NavDropdown({ title, items }: { title: string, items: any[] }) {
  return (
    <div className="group relative h-full flex items-center">
      <button className="flex items-center gap-1 text-sm font-medium text-slate-400 hover:text-white transition-colors py-4">
        {title}
        <ChevronDown className="w-3 h-3 transition-transform duration-300 group-hover:-rotate-180" />
      </button>

      {/* Dropdown Menu */}
      <div className="absolute top-full left-1/2 -translate-x-1/2 pt-4 opacity-0 invisible translate-y-2 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 transition-all duration-300 ease-out z-50">
        <div className="w-64 p-2 bg-[#0F131F] border border-white/10 rounded-xl shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col gap-1">
            {items.map((item, i) =>{
              const Icon = item.icon;
             return (
              
              <a key={i} href="#" className="flex cursor-auto items-center gap-3 p-3 rounded-lg hover:bg-white/5 group/item transition-colors">
                <div className=" w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-400 group-hover/item:text-blue-400 group-hover/item:bg-blue-500/10 transition-colors">
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-200 group-hover/item:text-white">
                    {item.title}
                  </div>
                  {item.desc && (
                    <div className="text-[10px] text-slate-500 leading-tight mt-0.5">
                      {item.desc}
                    </div>
                  )}
                </div>
              </a>
            )})}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  
  return (
    <main className={`relative min-h-screen w-full bg-[#0B0F19] text-white overflow-hidden selection:bg-blue-500/30 ${inter.className}`}>

      {/* --- AMBIENT BACKGROUND --- */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px] mix-blend-screen animate-pulse-slow" />
        <div className="absolute bottom-[-10%] right-[20%] w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[120px] mix-blend-screen" />
      </div>

      {/* --- NAVBAR --- */}
      <nav className="fixed top-0 w-full z-50 flex justify-between items-center px-6 py-5 md:px-12 backdrop-blur-md bg-[#0B0F19]/50 border-b border-white/5">
        <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
          <Waves className="w-6 h-6 text-blue-400" />
          SeaShore
        </div>
        <div className="hidden md:flex gap-8 h-full items-center">
          <NavDropdown title="Product" items={navData.product} />
          <NavDropdown title="Features" items={navData.features} />
          <NavDropdown title="Solutions" items={navData.solutions} />
          
          {/* Simple Link for Pricing */}
          <Link href={'/pricing'}>
          <p  className="text-sm font-medium text-slate-400 hover:text-white transition-colors">
            Pricing
          </p>
          </Link>
        </div>
        <div className="flex gap-4 items-center">
          <Link href={'/studio'}>
                    <button className="text-sm font-medium text-slate-300 hover:text-white transition-colors cursor-pointer">Log in</button>
          </Link>
          <Link href={'/studio'}>
            <button className="px-4 py-2 text-sm font-medium cursor-pointer bg-white text-black rounded-full hover:bg-slate-200 transition-all">
              Get Started
            </button>
          </Link>
        </div>
      </nav>

      {/* --- HERO SECTION --- */}
      <section className="relative z-10 pt-40 pb-20 px-6 flex flex-col items-center text-center">

        

        {/* Headline */}
        <h1 className="max-w-4xl text-5xl md:text-7xl font-bold tracking-tight leading-[1.1] mb-6 animate-fade-in-up delay-100">
          Studio quality recording.<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
            Right from your browser.
          </span>
        </h1>

        {/* Subtext */}
        <p className="max-w-xl text-lg text-slate-400 mb-10 leading-relaxed animate-fade-in-up delay-200">
          The modern platform for podcasts and video interviews.
          Separate tracks, 4K video, and crystal clear uncompressed audio.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 mb-20 animate-fade-in-up delay-300">
          <Link href={'/studio'}>
            <button className="h-12 px-8 rounded-full cursor-pointer bg-blue-600 hover:bg-blue-500 text-white font-medium transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)] flex items-center justify-center gap-2">
            Start Recording
            </button>
          </Link>
          <Link href={'/demo'}>
            <button className="h-12 px-8 rounded-full border cursor-pointer border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white bg-slate-900/50 backdrop-blur-sm transition-all flex items-center justify-center gap-2">
              <Play className="w-4 h-4 fill-current" /> View Demo
            </button>
          </Link>
        </div>

        {/* --- HERO UI VISUAL (THE INTERFACE) --- */}
        <div className="relative w-full max-w-5xl animate-fade-in-up delay-500 group">
          {/* Ambient Glow behind the interface */}
          <div className="absolute -inset-1 bg-gradient-to-b from-blue-500/20 to-transparent rounded-xl blur-xl opacity-50 group-hover:opacity-75 transition duration-1000"></div>

          {/* Main Interface Container */}
          <div className="relative rounded-xl bg-[#0F131F] border border-white/10 shadow-2xl overflow-hidden flex flex-col">

            {/* 1. Header Bar */}
            <div className="h-12 border-b border-white/5 bg-[#141825]/80 backdrop-blur-sm flex items-center justify-between px-4 relative z-20">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
                <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50" />
              </div>
              <div className="absolute left-1/2 -translate-x-1/2 text-xs text-slate-400 font-medium flex items-center gap-2 bg-slate-900/50 px-3 py-1 rounded-full border border-white/5">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                Recording • 00:12:43
              </div>
              <div className="flex items-center gap-3 text-slate-500">
                <div className="flex items-center gap-1.5 text-[10px] font-mono bg-slate-800/50 px-2 py-1 rounded text-green-400 border border-green-500/20">
                  <Wifi className="w-3 h-3" /> 4K
                </div>
              </div>
            </div>

            {/* 2. Video Grid Area - Aspect Ratio Fixed */}
            <VideoGrid/>


            {/* 3. INTEGRATED CONTROL BAR  */}
              <div className="p-6 flex justify-center z-20">
                <div className="flex items-center gap-8">

                  {/* Mic & Cam (Active - White) */}
                  <button className="text-white hover:text-slate-300 transition-colors">
                    <Mic className="w-6 h-6" />
                  </button>
                  <button className="text-white hover:text-slate-300 transition-colors">
                    <Video className="w-6 h-6" />
                  </button>

                  {/* Main Actions (Inactive - Grey) */}
                  <button className="text-slate-500 hover:text-white transition-colors">
                    <MonitorUp className="w-6 h-6" />
                  </button>
                  <button className="text-slate-500 hover:text-white transition-colors">
                    <Settings className="w-6 h-6" />
                  </button>

                  {/* END CALL BUTTON (Red Icon) */}
                  <button className="text-red-500 hover:text-red-400 transition-colors">
                    <PhoneOff className="w-7 h-7" />
                  </button>
                </div>
              </div>

          </div>
        </div>
      </section>

      {/* --- FEATURE SECTION (BENTO GRID STYLE) --- */}
      <section className="relative py-32 px-6 overflow-hidden">
        
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-blue-900/10 blur-[100px] rounded-full pointer-events-none" />
        <div className="max-w-7xl mx-auto relative z-10">
          
          <div className="text-center mb-20">
             <h2 className="text-3xl md:text-5xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">
               Everything you need to <br/>create a masterpiece.
             </h2>
             <p className="text-slate-400 max-w-2xl mx-auto text-lg">
               Powerful tools designed for the modern creator workflow.
             </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            
            {/* CARD 1: 4K RECORDING */}
            <div className="group relative p-1 rounded-3xl bg-gradient-to-b from-white/10 to-white/5 hover:from-blue-500/50 hover:to-indigo-500/50 transition-all duration-500">
              <div className="relative h-full bg-[#0F131F] rounded-[22px] p-8 flex flex-col overflow-hidden">
                
                {/* Visual */}
                <div className="h-48 mb-6 rounded-xl bg-slate-900/50 border border-white/5 flex items-center justify-center relative overflow-hidden group-hover:border-blue-500/30 transition-colors">
                  
                  {/* Background Grid */}
                  <div className="absolute inset-0 bg-grid-pattern opacity-20" />
                  
                  {/* 4K Text */}
                  <div className="relative z-10 flex flex-col items-center gap-2">
                    <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-slate-600 group-hover:from-blue-400 group-hover:to-white transition-all duration-500">
                      4K
                    </div>
                    <div className="px-3 py-1 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-400 text-[10px] font-mono tracking-widest uppercase">
                      Ultra HD
                    </div>
                  </div>

                  {/* ANIMATION: Blue Laser (Uses .scan-line class) */}
                  <div className="scan-line absolute left-0 w-full h-[2px] bg-blue-400/80 shadow-[0_0_15px_rgba(96,165,250,0.8)]" />
                </div>

                <div className="mt-auto">
                  <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                    <Video className="w-5 h-5 text-blue-400" /> Local Recording
                  </h3>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    We record directly on your guest's device. Internet lag doesn't affect the final video quality.
                  </p>
                </div>
              </div>
            </div>

            {/* CARD 2: SEPARATE TRACKS */}
            <div className="group relative p-1 rounded-3xl bg-gradient-to-b from-white/10 to-white/5 hover:from-indigo-500/50 hover:to-purple-500/50 transition-all duration-500">
              <div className="relative h-full bg-[#0F131F] rounded-[22px] p-8 flex flex-col overflow-hidden">
                
                {/* Visual: Tracks */}
                <div className="h-48 mb-6 rounded-xl bg-slate-900/50 border border-white/5 flex flex-col justify-center gap-4 px-6 relative overflow-hidden group-hover:border-indigo-500/30 transition-colors">
                    
                    {/* Track 1 (Blue) */}
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-[10px] text-blue-400 font-bold">V</div>
                      <div className="flex-1 h-8 rounded bg-slate-800 border border-white/5 flex items-center px-2 gap-[2px] overflow-hidden">
                          {/* Animated Bars (Uses .eq-bar class) */}
                          {[0.1, 0.3, 0.5, 0.2, 0.4,
                            0.6, 0.8, 0.7, 0.9, 0.25,
                            0.45, 0.65, 0.15, 0.35, 0.55].map((delay,i) => (
                            <div 
                              key={i} 
                              className="w-1 bg-blue-500/60 rounded-full eq-bar" 
                              style={{ animationDelay: `${delay}s` }} 
                            />
                          ))}
                      </div>
                    </div>

                    {/* Track 2 (Purple) */}
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-[10px] text-purple-400 font-bold">A</div>
                      <div className="flex-1 h-8 rounded bg-slate-800 border border-white/5 flex items-center px-2 gap-[2px] overflow-hidden">
                          {/* Animated Bars (Uses .eq-bar class) */}
                          {[0.1, 0.3, 0.5, 0.2, 0.4,
                            0.6, 0.8, 0.7, 0.9, 0.25,
                            0.45, 0.65, 0.15, 0.35, 0.55].map((delay,i) => (
                            <div 
                              key={i} 
                              className="w-1 bg-purple-500/60 rounded-full eq-bar" 
                              style={{ animationDelay: `${delay}s` }} 
                            />
                          ))}
                      </div>
                    </div>

                </div>

                <div className="mt-auto">
                  <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                    <Layers className="w-5 h-5 text-indigo-400" /> Separate Tracks
                  </h3>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    Get individual WAV and MP4 files for every participant. Perfect for post-production editing.
                  </p>
                </div>
              </div>
            </div>

            {/* CARD 3: PROGRESSIVE UPLOADS */}
            <div className="group relative p-1 rounded-3xl bg-gradient-to-b from-white/10 to-white/5 hover:from-cyan-500/50 hover:to-sky-500/50 transition-all duration-500">
              <div className="relative h-full bg-[#0F131F] rounded-[22px] p-8 flex flex-col overflow-hidden">
                
                {/* Visual: Cloud Sync */}
                <div className="h-48 mb-6 rounded-xl bg-slate-900/50 border border-white/5 flex items-center justify-center relative overflow-hidden group-hover:border-cyan-500/30 transition-colors">
                  {/* Subtle Grid Background */}
                  <div className="absolute inset-0 bg-grid-pattern opacity-10" />

                  {/* Central Cloud Animation */}
                  <div className="relative z-10 flex flex-col items-center gap-4">
                     
                     {/* The Cloud Icon */}
                     <div className="relative">
                        <Cloud className="w-16 h-16 text-slate-600 group-hover:text-cyan-400 transition-colors duration-500" strokeWidth={1.5} />
                        
                        {/* The Animated Arrow (Moves up on hover) */}
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 translate-y-4 group-hover:-translate-y-2 opacity-0 group-hover:opacity-100 transition-all duration-700 ease-out">
                           <ArrowUp className="w-6 h-6 text-cyan-200 drop-shadow-[0_0_10px_rgba(34,211,238,0.8)]" strokeWidth={3} />
                        </div>
                     </div>

                     {/* Status Badge */}
                     <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 border border-white/10 group-hover:border-cyan-500/50 group-hover:bg-cyan-500/10 transition-colors">
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-500 group-hover:bg-cyan-400 group-hover:animate-pulse" />
                        <span className="text-[10px] font-mono text-slate-400 group-hover:text-cyan-300 uppercase tracking-widest transition-colors">
                          Syncing...
                        </span>
                     </div>
                  </div>
                </div>

                <div className="mt-auto">
                  <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                    <Cloud className="w-5 h-5 text-cyan-400" /> Progressive Uploads
                  </h3>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    We sync data chunks in real-time. If your browser crashes or wifi dies, your recordings are already safe.
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* --- FINAL CTA SECTION (Split Layout) --- */}
      <section className="relative h-[700px] overflow-hidden">

        {/* 1. THE BACKGROUND IMAGE */}
        <div className="absolute inset-0 md:block hidden">
          <img
            src="laptop-women.jpg" // Ensure this path is correct
            alt="Woman working on laptop"
            // object-cover ensures it fills the space. object-[center_right] anchors focus slightly right.
            className="w-full h-full object-cover object-[center_right]"
          />
        </div>

        {/* 2. THE GRADIENT OVERLAY (The Magic Part) */}
        {/*
            - bg-gradient-to-r: Gradient goes left to right.
            - from-[#0B0F19]: Starts as solid dark theme color on the left.
            - via-[#0B0F19]/80: Stays mostly dark through the middle.
            - to-transparent: Fades to clear on the right, revealing the image.
        */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0B0F19] via-[#0B0F19]/90 md:via-[#0B0F19]/60 to-transparent/10 z-10" />


        {/* 3. THE CONTENT (Positioned on the left) */}
        <div className="relative z-20 h-full max-w-7xl mx-auto px-6 flex flex-col justify-center">
          <div className="max-w-2xl">
            
            <h2 className="text-5xl md:text-6xl font-bold mb-6 tracking-tight leading-[1.1] text-white">
              Ready to sound <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">professional?</span>
            </h2>
            
            <p className="text-slate-300 text-lg mb-10 leading-relaxed max-w-xl drop-shadow-sm">
              Join 10,000+ creators who use Seashore to record studio-quality content, manage permissions, and collaborate securely from anywhere.
            </p>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
              {/* Primary Button */}
              <Link href={'/studio'}>
              <button className="h-14 px-10 cursor-pointer rounded-full bg-[#3CE8FF] hover:bg-[#2bc8dd] text-[#0B0F19] font-bold text-lg transition-all shadow-[0_0_20px_rgba(60,232,255,0.3)] hover:shadow-[0_0_30px_rgba(60,232,255,0.5)]">
                Get Started for Free
              </button>
              </Link>

              {/* Secondary Link */}
              <Link href={'/pricing'}>
              <button className="group flex items-center gap-2 cursor-pointer text-white font-medium hover:text-[#3CE8FF] transition-colors text-lg">
                Explore Enterprise
                <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
              </button>
              </Link>
            </div>
            
            <p className="mt-8 text-xs text-slate-400 font-medium tracking-wide uppercase opacity-80">
              No credit card required • Cancel anytime
            </p>

          </div>
        </div>

      </section>


      {/* --- FOOTER --- */}
      <footer className="py-12 border-t border-white/5 bg-[#0B0F19] text-center relative z-10">
        <div className="flex flex-col items-center gap-6">
          
          {/* Social Icons (Hover effects match the blue theme) */}
          <div className="flex gap-6 text-slate-500">
             <a href="https://www.instagram.com/vanshahuja317?igsh=djd6b2FqZ3BiYjh1" className="hover:text-[#3CE8FF] transition-colors duration-300">
               <Instagram className="w-5 h-5" />
             </a>
             <a href="https://github.com/vansh3175" className="hover:text-[#3CE8FF] transition-colors duration-300">
               <Github className="w-5 h-5" />
             </a>
             <a href="https://www.linkedin.com/in/vansh-ahuja-b3648b273/" className="hover:text-[#3CE8FF] transition-colors duration-300">
               <Linkedin className="w-5 h-5" />
             </a>
          </div>

          {/* Copyright & Credit */}
          <p className="text-slate-600 text-sm">
            © 2025 Seashore Inc. Design by <span className="text-slate-400 font-medium hover:text-white transition-colors cursor-pointer">Vansh</span>.
          </p>
          
        </div>
      </footer>
      
    </main>
  );
}

