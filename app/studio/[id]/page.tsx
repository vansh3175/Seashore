'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';
import { useUser, useClerk } from '@clerk/nextjs';
import { 
  Waves, LayoutGrid, FolderOpen, Calendar as CalendarIcon, 
  ArrowRight, Lock, Users, Globe, Copy, Loader2, Menu, X,
  Zap, Clock, CalendarDays, Check, ArrowLeft, User, LogOut
} from 'lucide-react';

// --- MUI IMPORTS ---
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import dayjs from 'dayjs';



// Custom Dark Theme for MUI
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#3CE8FF', 
    },
    background: {
      paper: '#0F131F', 
    },
    text: {
      primary: '#fff',
      secondary: '#94a3b8', 
    },
  },
  components: {
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: '#050810',
          borderRadius: '0.75rem',
          height: '56px',
          display: 'flex',
          alignItems: 'center',
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(255, 255, 255, 0.1)',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(255, 255, 255, 0.2)',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#3CE8FF',
          },
        },
        input: {
          padding: '0 16px',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          '&::placeholder': {
            opacity: 0.5,
          },
        }
      },
    },
  },
});

export default function StudioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const studioId = id;
  
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  
  // --- STATE ---
  const [sessionName, setSessionName] = useState("My Awesome Podcast");
  const [scheduleType, setScheduleType] = useState<'now' | 'later'>('now');
  const [date, setDate] = useState<dayjs.Dayjs | null>(null);
  const [time, setTime] = useState<dayjs.Dayjs | null>(null);
  
  const [isCreating, setIsCreating] = useState(false);
  const [isSessionCreated, setIsSessionCreated] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [copied, setCopied] = useState(false);

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

  useEffect(() => {
    setInviteLink(`${window.location.origin}/room/${studioId}/join`);
  }, [studioId]);

  const getInitials = () => {
    if (!isLoaded || !user) return "ME";
    return (user.firstName?.[0] || "") + (user.lastName?.[0] || "");
  };

  const handleAction = async () => {
    if (!studioId) {
      alert("Error: Missing Studio ID");
      return;
    }

    setIsCreating(true);
    
    try {
      let scheduledAt = null;
      if (scheduleType === 'later' && date && time) {
        scheduledAt = date.hour(time.hour()).minute(time.minute()).toDate();
      }

      await axios.post('/api/session', {
        studioId,
        title: sessionName,
        scheduledAt: scheduledAt
      });

      setIsSessionCreated(true);
      
    } catch (err: any) {
      console.error(err);
      const errorMessage = err.response?.data?.error || err.message || "Error creating session";
      alert(errorMessage);
    } finally {
      setIsCreating(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const enterGreenRoom = () => {
    router.push(`/room/${studioId}/join`);
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <div className="flex h-screen bg-[#050810] text-white overflow-hidden selection:bg-[#3CE8FF]/30 font-sans">
          
          {/* BACKGROUND FX */}
          <div className="fixed inset-0 z-0 pointer-events-none">
            <div className="absolute top-[-20%] left-[-10%] w-[800px] h-[800px] bg-blue-600/10 rounded-full blur-[150px] opacity-40 animate-pulse-slow" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-[#3CE8FF]/5 rounded-full blur-[150px] opacity-30" />
          </div>

          {/* --- SIDEBAR --- */}
          <aside className={`
            fixed inset-y-0 left-0 z-[70] w-64 bg-[#050810] border-r border-white/5 flex flex-col items-start py-6 transition-transform duration-300 ease-in-out shadow-2xl md:shadow-none
            md:relative md:translate-x-0 md:w-20 md:items-center md:bg-[#050810]/50 md:backdrop-blur-xl
            ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
          `}>
            
            {/* Mobile Header in Sidebar */}
            <div className="w-full flex items-center justify-between px-6 mb-8 md:mb-10 md:justify-center md:px-0">
               <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.3)]">
                  <Waves className="w-6 h-6 text-white" />
               </div>
               <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-slate-500 md:hidden hover:text-white transition-colors">
                  <X className="w-6 h-6" />
               </button>
            </div>

            <nav className="flex-1 flex flex-col gap-3 w-full px-4">
              <NavIcon 
                icon={<LayoutGrid />} 
                label="Home" 
                active={true} 
                onClick={() => setIsMobileMenuOpen(false)}
              />
              <NavIcon 
                icon={<FolderOpen />} 
                label="Projects" 
                onClick={() => router.push(`/studio/${studioId}/projects`)} 
              />
              <NavIcon 
                icon={<CalendarIcon />} 
                label="Schedule" 
                onClick={() => router.push(`/studio/${studioId}/schedule`)}
              />
            </nav>
            
            {/* Settings/Logout removed as requested */}
          </aside>

          {/* --- MAIN COLUMN (Header + Content) --- */}
          <div className="flex-1 flex flex-col h-full overflow-hidden relative z-10">
            
            {/* --- HEADER --- */}
            <header className="h-20 flex items-center justify-between px-6 md:px-10 shrink-0 border-b border-white/5 bg-[#050810]/80 backdrop-blur-md sticky top-0 z-50">
              
              {/* LEFT: Back + Brand/Menu */}
              <div className="flex items-center gap-4 md:gap-6">
                  {/* Mobile Menu Toggle */}
                  <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden text-slate-400 hover:text-white transition-colors">
                    <Menu className="w-6 h-6" />
                  </button>

                  <Link href="/studio" className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all border border-white/5 hover:border-white/20">
                      <ArrowLeft className="w-5 h-5" />
                  </Link>
                  
                  <div className="flex items-center gap-3">
                      <span className="font-bold text-xl tracking-tight text-white hidden sm:block">
                          Seashore
                      </span>
                      <span className="text-slate-600 hidden sm:block">/</span>
                      <span className="text-sm font-medium text-slate-400 hidden sm:block">New Session</span>
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

            {/* --- MAIN CONTENT SCROLL AREA --- */}
            <main className="flex-1 overflow-y-auto px-6 md:px-10 py-8 xl:ml-30 ">
                
                {/* HERO HEADER */}
                <div className="w-full mb-10">
                  <h1 className="text-3xl xl:text-5xl lg:text-4xl md:text-3xl font-bold text-white mb-3 text-left leading-tight md:whitespace-nowrap whitespace-normal">What masterpiece will you record today?</h1>
                  <div className="flex items-center gap-3 justify-start">
                    <p className="text-slate-400 text-sm">Everything is operational. Ready to record.</p>
                    <div className="h-1 w-1 rounded-full bg-slate-600"></div>
                    <div className="flex items-center gap-2 text-[#3CE8FF] text-xs font-bold uppercase tracking-wider">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#3CE8FF] animate-pulse" />
                        System Online
                    </div>
                  </div>
                </div>

                {/* SETUP FORM */}
                <div className="flex flex-col justify-start max-w-5xl w-full animate-fade-in-up pb-20">
                  
                  {/* SESSION NAME */}
                  <div className="mb-10 relative group">
                      <label className="text-xs font-bold text-[#3CE8FF] uppercase tracking-[0.2em] mb-2 block ml-1">Session Name</label>
                      <input 
                        type="text" 
                        value={sessionName}
                        onChange={(e) => setSessionName(e.target.value)}
                        disabled={isSessionCreated}
                        className={`w-full bg-transparent border-b-2 text-2xl md:text-4xl font-bold focus:outline-none transition-all py-2 placeholder:text-slate-800
                          ${isSessionCreated ? 'text-slate-500 border-white/5 cursor-not-allowed' : 'text-white border-white/10 focus:border-[#3CE8FF]'}
                        `}
                        placeholder="Enter episode title..."
                      />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-start">
                    
                    {/* LEFT COLUMN: Configuration */}
                    <div className={`lg:col-span-7 space-y-8 transition-all duration-700 ${isSessionCreated ? 'opacity-40 grayscale pointer-events-none' : 'opacity-100'}`}>
                      
                      <div className="space-y-4">
                          <div className="text-sm font-medium text-slate-400 flex items-center gap-2">
                            <Clock className="w-4 h-4" /> When should we start?
                          </div>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <ScheduleCard 
                              icon={<Zap className="w-5 h-5" />}
                              title="Start Now" 
                              desc="Launch studio immediately" 
                              active={scheduleType === 'now'} 
                              onClick={() => setScheduleType('now')} 
                            />
                            <ScheduleCard 
                              icon={<CalendarDays className="w-5 h-5" />}
                              title="Schedule" 
                              desc="Plan for a future date" 
                              active={scheduleType === 'later'} 
                              onClick={() => setScheduleType('later')} 
                            />
                          </div>

                          {/* Date Picker Drawer */}
                          <div className={`overflow-hidden transition-all duration-500 ease-in-out ${scheduleType === 'later' ? 'max-h-64 opacity-100 mt-4' : 'max-h-0 opacity-0'}`}>
                            <div className="bg-[#0F131F] border border-white/5 rounded-2xl p-5 space-y-4">
                                <div className="grid grid-cols-2 gap-5">
                                    <div className="space-y-2">
                                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Date</label>
                                      <DatePicker value={date} onChange={setDate} slotProps={{ textField: { placeholder: 'Select Date' } }} />
                                  </div>
                                  <div className="space-y-2">
                                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Time</label>
                                      <TimePicker value={time} onChange={setTime} slotProps={{ textField: { placeholder: 'Select Time' } }} />
                                  </div>
                                </div>
                                <p className="text-[11px] text-slate-500 flex items-center gap-1">
                                  <Globe className="w-3 h-3" /> Timezone: Local System Time
                                </p>
                            </div>
                          </div>
                      </div>
                      
                      <button 
                        onClick={handleAction}
                        disabled={isSessionCreated || isCreating || (scheduleType === 'later' && (!date || !time))}
                        className={`group relative w-full py-5 rounded-2xl font-bold text-lg overflow-hidden transition-all duration-300 shadow-[0_0_40px_rgba(255,255,255,0.05)] cursor-pointer
                          ${isSessionCreated ? 'bg-green-500/10 text-green-500 cursor-default' : 'bg-white text-black hover:scale-[1.01] hover:shadow-[0_0_60px_rgba(60,232,255,0.2)] disabled:opacity-50 disabled:cursor-not-allowed'}
                        `}
                      >
                          <div className="relative z-10 flex items-center justify-center gap-2">
                              {isCreating ? (
                                <><Loader2 className="w-5 h-5 animate-spin" /> {scheduleType === 'now' ? 'Creating Session...' : 'Scheduling...'}</>
                              ) : isSessionCreated ? (
                                <> {scheduleType === 'now' ? 'Session Ready' : 'Scheduled'}</>
                              ) : (
                                <>{scheduleType === 'now' ? 'Create Session' : 'Schedule Session'} <ArrowRight className="w-5 h-5" /></>
                              )}
                          </div>
                          {!isSessionCreated && <div className="absolute inset-0 bg-gradient-to-r from-[#3CE8FF] to-blue-500 opacity-0 group-hover:opacity-10 transition-opacity" />}
                      </button>
                    </div>

                    {/* RIGHT COLUMN: Access & Links */}
                    <div className={`lg:col-span-5 flex flex-col gap-4 transition-all duration-700 transform ${isSessionCreated ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-60 grayscale pointer-events-none'}`}>
                        <div className="relative p-1 rounded-2xl bg-gradient-to-b from-white/10 to-transparent">
                          <div className="relative rounded-xl bg-[#0F131F]/90 backdrop-blur-xl border border-white/5 overflow-hidden">
                            
                            {!isSessionCreated && (
                              <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#050810]/60 backdrop-blur-[2px]">
                                <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-2 shadow-[0_0_20px_rgba(0,0,0,0.5)]"><Lock className="w-4 h-4 text-slate-400" /></div>
                                <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">Setup Required</p>
                              </div>
                            )}

                            <div className="p-5 space-y-6">
                                <div className="flex items-center justify-between">
                                  <h3 className="font-bold text-white flex items-center gap-2"><Users className="w-4 h-4 text-[#3CE8FF]" /> Session Access</h3>
                                  
                                  {/* STATUS BADGE */}
                                  {isSessionCreated && (
                                    <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded animate-fade-in ${
                                      scheduleType === 'now' ? 'text-green-400 bg-green-500/10' : 'text-blue-400 bg-blue-500/10'
                                    }`}>
                                      {scheduleType === 'now' ? 'Live' : 'Scheduled'}
                                    </span>
                                  )}
                                </div>
                                
                                <div className="space-y-2">
                                  <label className="text-xs font-medium text-slate-400 ml-1">Shareable Link</label>
                                  <div className="group flex items-center justify-between bg-[#050810] border border-white/10 rounded-lg p-1 pr-1 hover:border-white/20 transition-colors">
                                      <div className="flex items-center gap-3 px-3 overflow-hidden">
                                        <Globe className={`w-4 h-4 transition-colors ${isSessionCreated ? 'text-[#3CE8FF]' : 'text-slate-600'}`} />
                                        <span className="text-sm text-slate-300 truncate font-mono">
                                          {isSessionCreated ? inviteLink.replace(/^https?:\/\//, '') : 'waiting for setup...'}
                                        </span>
                                      </div>
                                      <button 
                                        onClick={copyLink}
                                        className="p-2 rounded-md bg-white/5 hover:bg-white/10 text-white transition-all active:scale-95 cursor-pointer"
                                      >
                                        {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                                      </button>
                                  </div>
                                </div>

                                <div className="bg-[#050810] border border-white/5 rounded-lg p-3">
                                  <p className="text-xs text-slate-500 leading-relaxed">
                                      {scheduleType === 'now' 
                                        ? "Guests can join immediately using the link above once you enter the room."
                                        : `You can share this link now, but the session will not start until ${date ? date.format('MMMM D') : 'the scheduled date'} at ${time ? time.format('h:mm A') : 'the scheduled time'}.`
                                      }
                                  </p>
                                </div>
                            </div>
                          </div>
                        </div>

                        <div className={`transition-all duration-700 delay-200 ${isSessionCreated ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                          <button 
                            onClick={enterGreenRoom}
                            className="group relative w-full py-4 rounded-xl bg-[#3CE8FF] hover:bg-[#2bc8dd] text-[#0B0F19] font-bold text-lg overflow-hidden hover:scale-[1.02] transition-transform duration-200 shadow-[0_0_30px_rgba(60,232,255,0.3)] cursor-pointer"
                          >
                              <div className="relative z-10 flex items-center justify-center gap-2">
                                {scheduleType === 'now' ? 'Enter Green Room' : 'View in Calendar'} 
                                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                              </div>
                          </button>
                          {scheduleType === 'now' && <p className="text-center text-xs text-slate-500 mt-4">Host creates the room first, then joins.</p>}
                        </div>
                    </div>
                  </div>
                </div>

            </main>
          </div>
        </div>
      </LocalizationProvider>
    </ThemeProvider>
  );
}

// --- SUB-COMPONENTS ---

function NavIcon({ icon, label, active, onClick }: any) {
  return (
    <button onClick={onClick} className={`
      group relative flex items-center gap-4
      w-full md:w-12 h-12 rounded-2xl
      px-4 md:px-0 md:justify-center
      transition-all duration-300 cursor-pointer
      ${active ? 'bg-blue-600/10 text-blue-400 md:bg-blue-600 md:text-white md:shadow-[0_0_20px_rgba(37,99,235,0.4)]' : 'text-slate-500 hover:bg-white/5 hover:text-white'}
    `}>
      <div className="w-5 h-5 md:w-6 md:h-6 shrink-0">{icon}</div>
      
      {/* Label: Visible on Mobile, Tooltip on Desktop */}
      <span className={`
        text-sm font-medium
        md:absolute md:left-14 md:bg-slate-900 md:text-white md:px-3 md:py-1.5 md:rounded-lg
        md:opacity-0 md:group-hover:opacity-100 md:whitespace-nowrap md:pointer-events-none md:z-50 md:border md:border-white/10 md:shadow-xl
        md:translate-x-2 md:group-hover:translate-x-0 md:transform md:transition-all
      `}>
        {label}
      </span>
    </button>
  )
}

function ScheduleCard({ icon, title, desc, active, onClick }: any) {
  return (
    <button onClick={onClick} className={`flex flex-col items-start gap-3 p-5 rounded-2xl border text-left transition-all duration-300 cursor-pointer h-full ${active ? 'bg-blue-600/10 border-[#3CE8FF] shadow-[0_0_30px_rgba(60,232,255,0.1)]' : 'bg-[#0F131F] border-white/5 hover:border-white/20 hover:bg-[#151a29]'}`}>
      <div className={`p-2.5 rounded-xl ${active ? 'bg-[#3CE8FF] text-black' : 'bg-slate-800 text-slate-400'}`}>
        {icon}
      </div>
      <div>
        <div className={`font-bold text-lg ${active ? 'text-white' : 'text-slate-300'}`}>{title}</div>
        <div className="text-xs text-slate-500 mt-1">{desc}</div>
      </div>
    </button>
  )
}