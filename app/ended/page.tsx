'use client';

import React from 'react';
import Link from 'next/link';
import { Inter } from 'next/font/google';
import { Waves, ArrowRight, Home, CheckCircle2 } from 'lucide-react';

const inter = Inter({ subsets: ['latin'] });

export default function SessionEndedPage() {
  return (
    <div className={`min-h-screen bg-[#050810] text-white flex flex-col ${inter.className} overflow-hidden selection:bg-[#3CE8FF]/30`}>
      
      {/* Background FX */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[20%] w-[800px] h-[800px] bg-blue-600/10 rounded-full blur-[150px] opacity-40 animate-pulse-slow" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-[#3CE8FF]/5 rounded-full blur-[150px] opacity-30" />
      </div>

      {/* Header */}
      <header className="h-20 flex items-center justify-between px-8 z-20 relative border-b border-white/5 bg-[#050810]/50 backdrop-blur-md">
         <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tight hover:opacity-80 transition-opacity">
              <Waves className="w-6 h-6 text-[#3CE8FF]" />
              <span className="text-slate-200">SeaShore</span>
            </Link>
         </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 relative z-10">
        
        <div className="max-w-md w-full bg-[#0F131F]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-10 text-center shadow-2xl animate-fade-in-up">
            
            <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-500/20">
                <CheckCircle2 className="w-10 h-10 text-green-500" />
            </div>
            
            <h1 className="text-3xl font-bold mb-3 text-white">That's a wrap!</h1>
            <p className="text-slate-400 mb-8 leading-relaxed">
                The session has ended. Your local recordings have been securely uploaded to the cloud.
            </p>

            <div className="space-y-3">
                
                
                <Link href="/">
                    <button className="w-full py-3.5 rounded-xl font-bold text-slate-300 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 transition-all flex items-center justify-center gap-2">
                        Return Home <ArrowRight className="w-4 h-4" />
                    </button>
                </Link>
            </div>

            
        </div>

      </main>
    </div>
  );
}