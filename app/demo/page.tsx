'use client';

import React from 'react';
import Link from 'next/link';
import { Inter } from 'next/font/google';
import { 
  Waves, ArrowRight, MousePointerClick, 
  Users, Video, Download, Skull 
} from 'lucide-react';

const inter = Inter({ subsets: ['latin'] });

export default function DemoPage() {
  return (
    <div className={`min-h-screen bg-[#050810] text-white flex flex-col ${inter.className} selection:bg-[#3CE8FF]/30`}>
      
      {/* Background FX */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[120px] opacity-30" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] opacity-30" />
      </div>

      {/* Header */}
      <header className="h-20 flex items-center justify-between px-6 md:px-10 border-b border-white/5 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
            <Waves className="w-6 h-6 text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight">Seashore</span>
        </div>
        <Link href="/" className="text-sm text-slate-400 hover:text-white transition-colors">
          Back to Safety
        </Link>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 relative z-10">
        
        <div className="max-w-3xl w-full text-center space-y-6 mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-[#3CE8FF] mb-4">
            <Skull className="w-3 h-3" /> WARNING: EXTREMELY COMPLICATED TUTORIAL
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-tight">
            Bro, why do you need <br/> 
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#3CE8FF] to-blue-600">a tutorial?</span>
          </h1>
          <p className="text-lg text-slate-400 max-w-xl mx-auto leading-relaxed">
            It's literally 3 buttons. But sure, since you insisted, here is the "Advanced Guide" to using Seashore. Try to keep up.
          </p>
        </div>

        {/* The "Steps" Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-5xl mb-16">
          
          {/* Step 1 */}
          <div className="p-8 rounded-3xl bg-[#0F131F] border border-white/5 hover:border-[#3CE8FF]/30 transition-all group">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <MousePointerClick className="w-6 h-6 text-blue-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">1. Click the Big Button</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Go to the dashboard. Find the button that says "Create Studio". Click it. If you miss it, you might need glasses, not a tutorial.
            </p>
          </div>

          {/* Step 2 */}
          <div className="p-8 rounded-3xl bg-[#0F131F] border border-white/5 hover:border-purple-500/30 transition-all group">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Users className="w-6 h-6 text-purple-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">2. Invite Friends (Optional)</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Send the link to people. Ideally people who want to talk to you. If nobody joins, that's a social issue, not a technical one.
            </p>
          </div>

          {/* Step 3 */}
          <div className="p-8 rounded-3xl bg-[#0F131F] border border-white/5 hover:border-red-500/30 transition-all group">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Video className="w-6 h-6 text-red-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">3. Record Stuff</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Hit "Start Recording". Talk. Make faces. Do a podcast. Don't forget to unmute your mic, we can't fix that in post.
            </p>
          </div>

          {/* Step 4 */}
          <div className="p-8 rounded-3xl bg-[#0F131F] border border-white/5 hover:border-green-500/30 transition-all group">
            <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Download className="w-6 h-6 text-green-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">4. Download & Profit</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              When you're done, go to "Projects" and download the files. They are high quality (unlike your jokes). That's it. You're done.
            </p>
          </div>

        </div>

        {/* CTA */}
        <Link 
          href="/studio"
          className="group relative px-8 py-4 bg-white text-black rounded-full font-bold text-lg hover:scale-105 transition-all shadow-[0_0_40px_rgba(255,255,255,0.3)]"
        >
          <span className="relative z-10 flex items-center gap-2">
            I think I can handle it <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </span>
        </Link>

      </main>

    </div>
  );
}