'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser, useClerk } from '@clerk/nextjs';
import { Inter } from 'next/font/google';
import { 
  Waves, Plus, X, Clapperboard, ArrowRight,
  Loader2, Hash, ArrowLeft, LogOut, User
} from 'lucide-react';
import axios from 'axios';

const inter = Inter({ subsets: ['latin'] });

// --- 10 PREMIUM GRADIENTS (Album Art Style) ---
const GRADIENTS = [
  "from-blue-600 to-indigo-600",      // 1. Deep Blue
  "from-purple-600 to-pink-600",      // 2. Neon Purple
  "from-emerald-600 to-teal-600",     // 3. Nature Green
  "from-orange-600 to-red-600",       // 4. Sunset
  "from-pink-600 to-rose-600",        // 5. Hot Pink
  "from-cyan-600 to-blue-600",        // 6. Ocean
  "from-violet-600 to-fuchsia-600",   // 7. Magic
  "from-amber-600 to-orange-600",     // 8. Gold
  "from-teal-600 to-cyan-600",        // 9. Aqua
  "from-indigo-600 to-violet-600",    // 10. Galaxy
];

type Studio = {
  id: string;
  name: string;
  _count:{
    sessions: number;
  };
}

export default function WorkspacePage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [MY_STUDIOS, setMY_STUDIOS] = useState<Studio[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Close dropdown when clicking outside
  const dropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Navigation Handler
  const handleEnterStudio = (id: string) => {
    router.push(`/studio/${id}`);
  };

  useEffect(()=>{
    const fetchStudios = async () => {
      setLoading(true);
      try {
          const response = await axios.get('/api/studio');
          setMY_STUDIOS(response.data.studios);
      } catch (error) {
          console.error("Failed to load studios", error);
      }
      setLoading(false);
    }
    fetchStudios();
  },[isModalOpen]);

  // Get User Initials
  const getInitials = () => {
    if (!isLoaded || !user) return "ME";
    return (user.firstName?.[0] || "") + (user.lastName?.[0] || "");
  };

  return (
    <div className={`min-h-screen bg-[#050810] text-white flex flex-col overflow-x-hidden selection:bg-[#3CE8FF]/30 ${inter.className}`}>
      
      {/* --- AMBIENT BACKGROUND --- */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[800px] h-[800px] bg-blue-600/10 rounded-full blur-[150px] opacity-40 animate-pulse-slow" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[150px] opacity-30" />
      </div>

      {/* --- HEADER --- */}
      <header className="h-20 flex items-center justify-between px-6 md:px-10 shrink-0 z-50 border-b border-white/5 bg-[#050810]/80 backdrop-blur-md sticky top-0">
         
         {/* LEFT: Back + Brand */}
         <div className="flex items-center gap-6">
            <Link href="/" className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all border border-white/5 hover:border-white/20">
                <ArrowLeft className="w-5 h-5" />
            </Link>
            
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-900/20">
                    <Waves className="w-5 h-5 text-white" />
                </div>
                <span className="font-bold text-xl tracking-tight text-white hidden sm:block">
                    Seashore
                </span>
            </div>
         </div>

         {/* RIGHT: User Profile */}
         <div className="relative" ref={dropdownRef}>
            <button 
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center gap-3 group focus:outline-none"
            >
                <div className="text-right hidden md:block">
                    <p className="text-sm font-medium text-white group-hover:text-[#3CE8FF] transition-colors">{user?.fullName || "Guest"}</p>
                    <p className="text-xs text-slate-500">Creator</p>
                </div>
                <div className={`w-10 h-10 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 border border-white/10 flex items-center justify-center text-sm font-bold text-white shadow-lg transition-all ${isProfileOpen ? 'ring-2 ring-[#3CE8FF] ring-offset-2 ring-offset-[#050810]' : 'group-hover:scale-105'}`}>
                    {getInitials().toUpperCase()}
                </div>
            </button>

            {/* Dropdown Modal */}
            {isProfileOpen && (
                <div className="absolute right-0 top-14 w-60 bg-[#0F131F] border border-white/10 rounded-2xl shadow-2xl shadow-black/80 overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-[100]">
                    <div className="p-4 border-b border-white/5">
                        <p className="text-sm text-slate-400">Signed in as</p>
                        <p className="text-white font-medium truncate">{user?.primaryEmailAddress?.emailAddress}</p>
                    </div>
                    <div className="p-2">
                        
                        <button 
                            onClick={() => signOut(() => router.push('/'))}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors text-sm text-left mt-1"
                        >
                            <LogOut className="w-4 h-4" /> Log Out
                        </button>
                    </div>
                </div>
            )}
         </div>
      </header>

      {/* --- MAIN CONTENT AREA --- */}
      <main className="flex-1 flex flex-col relative z-10 overflow-y-auto">
        <div className="flex-1 px-6 md:px-10 py-10 max-w-7xl mx-auto w-full animate-fade-in">
          
          {/* 1. HERO SECTION */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">My Studios</h1>
              <p className="text-slate-400 max-w-lg">
                Your creative hubs. Each studio is a workspace for your recordings and assets.
              </p>
            </div>
            
            {/* Create Button */}
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex max-w-60 items-center gap-2 px-6 py-3 rounded-full bg-white text-black font-bold hover:bg-blue-50 transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:scale-105 cursor-pointer"
            >
              <Plus className="w-5 h-5" /> Create New Studio
            </button>
          </div>

          {/* 2. STUDIOS GRID (ALBUM ART STYLE) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            
            {/* "Create New" Placeholder Card */}
            <button 
               onClick={() => setIsModalOpen(true)}
               className="group h-80 hidden md:flex rounded-4xl border-2 border-dashed border-white/10 hover:border-[#3CE8FF]/50 hover:bg-[#3CE8FF]/5 transition-all duration-300  flex-col items-center justify-center gap-4 cursor-pointer"
            >
               <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center group-hover:scale-110 group-hover:border-[#3CE8FF] group-hover:text-[#3CE8FF] transition-all">
                  <Plus className="w-8 h-8 text-slate-500 group-hover:text-[#3CE8FF]" />
               </div>
               <span className="text-slate-500 font-medium group-hover:text-white transition-colors">New Studio</span>
            </button>

            {loading ? (
                <div className="col-span-full flex items-center justify-center py-20">
                  <Loader2 className="w-10 h-10 text-slate-500 animate-spin" />
                </div>
              ) : (
                <>
                {/* Render Studios */}
                {MY_STUDIOS.map((studio, index) => {
                  // Cycle through gradients based on index
                  const gradient = GRADIENTS[index % GRADIENTS.length];
                  
                  return (
                    <div 
                      key={studio.id}
                      onClick={() => handleEnterStudio(studio.id)}
                      className="group relative bg-[#141825] rounded-[2rem] border border-white/5 overflow-hidden hover:border-white/20 transition-all duration-300 hover:shadow-2xl hover:shadow-black/50 cursor-pointer flex flex-col h-80"
                    >
                      {/* Album Art Header */}
                       <div className={`h-40 w-full bg-gradient-to-br ${gradient} relative overflow-hidden`}>
                        {/* Noise */}
                        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />
                        {/* Center Icon */}
                        <div className="absolute inset-0 flex items-center justify-center text-white/35 group-hover:text-white/60 transition-colors">
                          <Clapperboard className="w-14 h-14" />
                        </div>
                        {/* Hover Overlay */}
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/10 backdrop-blur-sm">
                          <div className="px-4 py-2 bg-white text-black rounded-full font-bold text-sm flex items-center gap-2 translate-y-3 group-hover:translate-y-0 transition-transform shadow-xl">
                            Enter Studio <ArrowRight className="w-4 h-4" />
                          </div>
                        </div>
                      </div>

                       {/* INFO BODY */}
                       <div className="p-6 flex-1 flex flex-col justify-between">
                         <div>
                             <h3 className="text-xl font-bold text-white leading-tight group-hover:text-[#3CE8FF] transition-colors line-clamp-2">
                               {studio.name}
                             </h3>
                         </div>
                         <div className="flex items-center justify-between pt-4 border-t border-white/5 mt-2">
                             <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                                <Hash className="w-3 h-3 text-slate-500" />
                                {studio._count.sessions} Recordings
                             </div>
                         </div>
                       </div>
                    </div>
                  );
                })}
                </>
              )
            }
          </div>
        </div>
      </main>

      {/* --- CREATE STUDIO MODAL --- */}
      {isModalOpen && <CreateStudioModal onClose={() => setIsModalOpen(false)} />}

    </div>
  );
}

// --- MODAL: CREATE A SPACE ---
function CreateStudioModal({ onClose }: { onClose: () => void }) {
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');

  const handleCreate = async () => {
    if (!name) return;
    setIsCreating(true);
    try {
        await axios.post('/api/studio', { name });
        onClose();
    } catch (e) {
        console.error(e);
    } finally {
        setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop with Blur */}
      <div 
        className="absolute inset-0 bg-[#050810]/60 backdrop-blur-md transition-opacity animate-in fade-in duration-200" 
        onClick={onClose}
      />

      <div className="relative w-full max-w-lg bg-[#0F131F] border border-white/10 rounded-3xl shadow-2xl shadow-black/50 overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Subtle Top Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-1 bg-gradient-to-r from-transparent via-[#3CE8FF] to-transparent opacity-50 blur-sm" />

        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-slate-500 hover:text-white hover:bg-white/5 transition-colors z-20"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-10 flex flex-col gap-10">
          {/* Header */}
          <div className="text-center space-y-3">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-[#141825] border border-white/5 flex items-center justify-center shadow-inner mb-4 group">
               <Clapperboard className="w-7 h-7 text-slate-400 group-hover:text-[#3CE8FF] transition-colors" />
            </div>
            <h2 className="text-2xl font-bold text-white">Initialize Studio</h2>
            <p className="text-slate-400 text-sm">Name your workspace to begin.</p>
          </div>

          {/* INPUT FIELD (Center Stage) */}
          <div className="relative group">
             <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-[#3CE8FF] rounded-xl opacity-0 group-focus-within:opacity-50 transition duration-500 blur" />
             <div className="relative bg-[#0B0F19] rounded-xl border border-white/10 p-2 flex items-center">
                <input 
                  type="text" 
                  placeholder="e.g. Morning Podcast"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-transparent text-white px-4 py-3 text-lg outline-none placeholder:text-slate-700 font-medium text-center"
                  autoFocus
                />
             </div>
          </div>

          {/* ACTION BUTTON */}
          <button 
            onClick={handleCreate}
            disabled={!name || isCreating}
            className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-lg
              ${!name 
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                : 'bg-gradient-to-r from-[#3CE8FF] to-blue-600 text-white hover:scale-[1.02] shadow-blue-500/25'
              }
            `}
          >
            {isCreating ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Initializing...</>
            ) : (
              <>Create & Enter <ArrowRight className="w-5 h-5" /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}