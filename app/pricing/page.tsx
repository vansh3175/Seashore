'use client';

import React from 'react';
import Link from 'next/link';
import { Inter } from 'next/font/google';
import { 
  Waves, ArrowRight, Check, X, Gem, Crown, Rocket
} from 'lucide-react';

const inter = Inter({ subsets: ['latin'] });

export default function PricingPage() {
  return (
    <div className={`min-h-screen bg-[#050810] text-white flex flex-col ${inter.className} selection:bg-[#3CE8FF]/30`}>
      
      {/* Background FX */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-green-500/10 rounded-full blur-[120px] opacity-20" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] opacity-20" />
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
      <main className="flex-1 flex flex-col items-center justify-center p-6 relative z-10 py-20">
        
        <div className="max-w-4xl w-full text-center space-y-6 mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-green-400 mb-4">
            <Gem className="w-3 h-3" /> EXCLUSIVE OFFER FOR YOU SPECIFICALLY
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-tight">
            Pricing Plans for <br/> 
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-600">The 1%</span>
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Usually, we charge $10,000 per pixel. But since you look like you have great taste (and a limited budget), here is a special deal.
          </p>
        </div>

        {/* Pricing Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-7xl px-4">
          
          {/* Plan 1: The Joke */}
          <div className="relative p-8 rounded-[2rem] bg-[#0F131F] border border-white/5 flex flex-col opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
            <div className="absolute inset-0 bg-white/5 opacity-0 hover:opacity-100 transition-opacity rounded-[2rem] pointer-events-none" />
            <h3 className="text-xl font-bold text-slate-400 mb-2">The "Casual"</h3>
            <div className="text-4xl font-bold text-white mb-6">$999<span className="text-sm text-slate-500 font-normal">/mo</span></div>
            <p className="text-sm text-slate-500 mb-8">For people who hate money.</p>
            
            <div className="space-y-4 flex-1 mb-8">
              <li className="flex items-start gap-3 text-sm text-slate-400"><Check className="w-4 h-4 text-green-500 shrink-0 mt-0.5" /> 720p Video (Grainy)</li>
              <li className="flex items-start gap-3 text-sm text-slate-400"><Check className="w-4 h-4 text-green-500 shrink-0 mt-0.5" /> Mono Audio</li>
              <li className="flex items-start gap-3 text-sm text-slate-400"><X className="w-4 h-4 text-red-500 shrink-0 mt-0.5" /> No Support</li>
            </div>

            <button disabled className="w-full py-3 rounded-xl bg-white/5 text-slate-500 font-bold cursor-not-allowed">
              Sold Out (Somehow)
            </button>
          </div>

          {/* Plan 2: THE REAL DEAL (Highlighted) */}
          <div className="relative p-8 rounded-[2rem] bg-[#141825] border border-[#3CE8FF]/30 flex flex-col shadow-2xl shadow-blue-900/20 scale-105 z-20">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-[#3CE8FF] to-blue-600 px-4 py-1 rounded-full text-xs font-bold text-black uppercase tracking-wider shadow-lg">
              Most Popular
            </div>
            
            <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              <Rocket className="w-5 h-5 text-[#3CE8FF]" /> Free Trial
            </h3>
            <div className="text-5xl font-black text-white mb-6">$0<span className="text-sm text-slate-500 font-normal">/forever*</span></div>
            <p className="text-sm text-slate-400 mb-8">
              *Actually just free. We forgot to set up Stripe.
            </p>
            
            <div className="space-y-4 flex-1 mb-8">
              <li className="flex items-start gap-3 text-sm text-white"><Check className="w-4 h-4 text-[#3CE8FF] shrink-0 mt-0.5" /> 4K Video Recording</li>
              <li className="flex items-start gap-3 text-sm text-white"><Check className="w-4 h-4 text-[#3CE8FF] shrink-0 mt-0.5" /> Crystal Clear Audio</li>
              <li className="flex items-start gap-3 text-sm text-white"><Check className="w-4 h-4 text-[#3CE8FF] shrink-0 mt-0.5" /> Unlimited Storage (Probably)</li>
              <li className="flex items-start gap-3 text-sm text-white"><Check className="w-4 h-4 text-[#3CE8FF] shrink-0 mt-0.5" /> Crash Recovery (It works!)</li>
            </div>

            <Link 
              href="/studio"
              className="w-full py-4 rounded-xl bg-white text-black font-bold hover:bg-[#3CE8FF] transition-all shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:shadow-[0_0_30px_rgba(60,232,255,0.5)] flex items-center justify-center gap-2"
            >
              Steal This Deal <ArrowRight className="w-4 h-4" />
            </Link>
            <p className="text-[10px] text-center text-slate-600 mt-4">No credit card required. Only your soul.</p>
          </div>

          {/* Plan 3: The Impossible */}
          <div className="relative p-8 rounded-[2rem] bg-[#0F131F] border border-white/5 flex flex-col opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
            <h3 className="text-xl font-bold text-slate-400 mb-2 flex items-center gap-2">
              <Crown className="w-5 h-5 text-yellow-500" /> Enterprise
            </h3>
            <div className="text-4xl font-bold text-white mb-6">$1M<span className="text-sm text-slate-500 font-normal">/call</span></div>
            <p className="text-sm text-slate-500 mb-8">For Elon Musk only.</p>
            
            <div className="space-y-4 flex-1 mb-8">
              <li className="flex items-start gap-3 text-sm text-slate-400"><Check className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" /> We fly to your house</li>
              <li className="flex items-start gap-3 text-sm text-slate-400"><Check className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" /> Personal Director</li>
              <li className="flex items-start gap-3 text-sm text-slate-400"><Check className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" /> 8K IMAX Cameras</li>
            </div>

            <button disabled className="w-full py-3 rounded-xl bg-white/5 text-slate-500 font-bold cursor-not-allowed">
              Contact Sales (Don't)
            </button>
          </div>

        </div>

      </main>

    </div>
  );
}