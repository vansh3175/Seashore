'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser, useClerk } from '@clerk/nextjs';
import axios from 'axios';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import relativeTime from 'dayjs/plugin/relativeTime';
import { 
  Waves, LayoutGrid, FolderOpen, Calendar as CalendarIcon, 
  Menu, ArrowLeft, User, LogOut,
  ChevronDown, Download, Mic, Clock, FileVideo, Video, Loader2,X
} from 'lucide-react';

dayjs.extend(duration);
dayjs.extend(relativeTime);

// --- TYPES ---
type Recording = {
  id: string;
  type: 'camera' | 'screen';
  status: string;
  startedAt: string;
  endedAt: string | null;
  duration?: number;
};

type Participant = {
  id: string;
  name: string;
  identity: string;
  recordings: Recording[];
};

type Session = {
  id: string;
  title: string | null;
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
  participants: Participant[];
};

export default function ProjectsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const studioId = id;
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  
  // Data State
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchRecordings = async () => {
      try {
        const res = await axios.get(`/api/studio/${studioId}/recordings`);
        setSessions(res.data.sessions);
        // Auto-expand the most recent session
        if (res.data.sessions.length > 0) {
            setExpandedSessions(new Set([res.data.sessions[0].id]));
        }
      } catch (e) {
        console.error("Failed to load recordings", e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchRecordings();
  }, [studioId]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getInitials = () => {
    if (!isLoaded || !user) return "ME";
    return (user.firstName?.[0] || "") + (user.lastName?.[0] || "");
  };

  const toggleSession = (sessionId: string) => {
    setExpandedSessions(prev => {
      const next = new Set(prev);
      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);
      return next;
    });
  };

  const handleDownload = async (recordingId: string) => {
    setDownloadingId(recordingId);
    try {
        const res = await axios.get(`/api/recording/${recordingId}/download`);
        const { url } = res.data;
        
        // Trigger download
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', ''); // Force download attribute
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (e) {
        console.error("Download failed", e);
        alert("Failed to generate download link.");
    } finally {
        setDownloadingId(null);
    }
  };

  const formatDuration = (start: string | null, end: string | null) => {
      if (!start || !end) return "Processing...";
      const diff = dayjs(end).diff(dayjs(start));
      return dayjs.duration(diff).format('HH:mm:ss');
  };

  return (
    <div className="flex h-screen bg-[#050810] text-white overflow-hidden selection:bg-[#3CE8FF]/30 font-sans">
      
      {/* BACKGROUND FX */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[800px] h-[800px] bg-blue-600/10 rounded-full blur-[150px] opacity-40 animate-pulse-slow" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[150px] opacity-30" />
      </div>

      {/* --- SIDEBAR --- */}
      <aside className={`
        fixed inset-y-0 left-0 z-[70] w-64 bg-[#050810] border-r border-white/5 flex flex-col items-start py-6 transition-transform duration-300 ease-in-out shadow-2xl md:shadow-none
        md:relative md:translate-x-0 md:w-20 md:items-center md:bg-[#050810]/50 md:backdrop-blur-xl
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
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
            onClick={() => router.push(`/studio/${studioId}`)}
          />
          <NavIcon 
            icon={<FolderOpen />} 
            label="Projects" 
            active={true}
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <NavIcon 
            icon={<CalendarIcon />} 
            label="Schedule" 
            onClick={() => router.push(`/studio/${studioId}/schedule`)}
          />
        </nav>
      </aside>

      {/* --- MAIN COLUMN --- */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative z-10">
        
        {/* --- HEADER --- */}
        <header className="h-16 flex items-center justify-between px-6 md:px-8 shrink-0 border-b border-white/5 bg-[#050810]/80 backdrop-blur-md sticky top-0 z-50">
          <div className="flex items-center gap-4">
              <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden text-slate-400 hover:text-white transition-colors">
                <Menu className="w-6 h-6" />
              </button>
              
              <div className="flex items-center gap-3">
                  <span className="font-bold text-lg tracking-tight text-white hidden sm:block">Seashore</span>
                  <span className="text-slate-600 hidden sm:block">/</span>
                  <span className="text-sm font-medium text-slate-400 hidden sm:block">Projects</span>
              </div>
          </div>

          <div className="relative" ref={dropdownRef}>
              <button onClick={() => setIsProfileOpen(!isProfileOpen)} className="flex items-center gap-3 group focus:outline-none">
                  <div className="text-right hidden md:block">
                      <p className="text-sm font-medium text-white group-hover:text-[#3CE8FF] transition-colors">{user?.fullName || "Guest"}</p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">Creator</p>
                  </div>
                  <div className={`w-9 h-9 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 border border-white/10 flex items-center justify-center text-xs font-bold text-white shadow-lg transition-all ${isProfileOpen ? 'ring-2 ring-[#3CE8FF] ring-offset-2 ring-offset-[#050810]' : 'group-hover:scale-105'}`}>
                      {getInitials().toUpperCase()}
                  </div>
              </button>

              {isProfileOpen && (
                  <div className="absolute right-0 top-12 w-60 bg-[#0F131F] border border-white/10 rounded-2xl shadow-2xl shadow-black/80 overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-[100]">
                      <div className="p-4 border-b border-white/5">
                          <p className="text-xs text-slate-400">Signed in as</p>
                          <p className="text-white text-sm font-medium truncate">{user?.primaryEmailAddress?.emailAddress}</p>
                      </div>
                      <div className="p-2">
                          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 transition-colors text-sm text-left">
                              <User className="w-4 h-4" /> Account Settings
                          </button>
                          <button onClick={() => signOut(() => router.push('/'))} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors text-sm text-left mt-1">
                              <LogOut className="w-4 h-4" /> Log Out
                          </button>
                      </div>
                  </div>
              )}
          </div>
        </header>

        {/* --- MAIN CONTENT --- */}
        <main className="flex-1 flex flex-col overflow-hidden px-4 md:px-8 py-4 md:py-6 relative">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 shrink-0">
               <div>
                  <h1 className="text-2xl font-bold text-white">Recordings</h1>
                  <p className="text-slate-400 text-xs">Access and download your studio sessions.</p>
               </div>
            </div>

            {/* SESSIONS LIST */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
                
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-40 gap-4">
                        <Loader2 className="w-8 h-8 text-slate-500 animate-spin" />
                        <p className="text-slate-500 text-sm">Loading sessions...</p>
                    </div>
                ) : sessions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 border border-dashed border-white/10 rounded-2xl">
                        <p className="text-slate-500">No recordings found.</p>
                    </div>
                ) : (
                    sessions.map((session) => {
                      const isExpanded = expandedSessions.has(session.id);
                      const sessionDuration = formatDuration(session.startedAt, session.endedAt);

                      return (
                        <div key={session.id} className="bg-[#0F131F] border border-white/5 rounded-2xl overflow-hidden transition-all duration-300">
                          
                          {/* 1. SESSION HEADER */}
                          <button 
                            onClick={() => toggleSession(session.id)}
                            className={`w-full flex items-center justify-between p-5 text-left hover:bg-white/[0.02] transition-colors ${isExpanded ? 'border-b border-white/5 bg-white/[0.02]' : ''}`}
                          >
                            <div className="flex items-center gap-4">
                               <div className={`w-10 h-10 rounded-full flex items-center justify-center border border-white/10 bg-[#141825] transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                                  <ChevronDown className="w-5 h-5 text-slate-400" />
                               </div>
                               <div>
                                  <h3 className="text-base font-bold text-white mb-1">{session.title || "Untitled Session"}</h3>
                                  <div className="flex items-center gap-3 text-xs text-slate-500">
                                     <span className="flex items-center gap-1"><CalendarIcon className="w-3 h-3" /> {dayjs(session.createdAt).format('MMM D, YYYY • h:mm A')}</span>
                                     <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {sessionDuration !== "Processing..." ? sessionDuration : "--:--"}</span>
                                  </div>
                               </div>
                            </div>
                          </button>

                          {/* 2. PARTICIPANTS LIST */}
                          <div className={`transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'}`}>
                             <div className="p-2 space-y-2">
                                {session.participants.length === 0 && (
                                    <div className="p-4 text-center text-xs text-slate-600 italic">No recordings found for this session.</div>
                                )}
                                {session.participants.map((participant) => (
                                   <div key={participant.id} className="bg-[#0B0F19] rounded-xl p-3 border border-white/5">
                                      
                                      {/* Participant Header */}
                                      <div className="flex items-center gap-3 mb-3 border-b border-white/5 pb-2">
                                          <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold">
                                              {participant.name.charAt(0).toUpperCase()}
                                          </div>
                                          <span className="text-sm font-bold text-slate-300">{participant.name}</span>
                                      </div>

                                      {/* Recordings List */}
                                      <div className="space-y-2">
                                          {participant.recordings.map((rec, index) => (
                                              <div key={rec.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-colors">
                                                  <div className="flex items-center gap-3">
                                                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${rec.type === 'screen' ? 'bg-blue-900/20 text-blue-400' : 'bg-purple-900/20 text-purple-400'}`}>
                                                          {rec.type === 'screen' ? <FileVideo className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                                                      </div>
                                                      <div>
                                                          <div className="text-xs font-medium text-white flex items-center gap-2">
                                                              {rec.type === 'screen' ? 'Screen Share' : 'Camera Feed'}
                                                              <span className="text-[10px] text-slate-500 bg-white/5 px-1.5 rounded">Part {index + 1}</span>
                                                          </div>
                                                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                                              {dayjs(rec.startedAt).format('h:mm:ss A')} - {rec.endedAt ? dayjs(rec.endedAt).format('h:mm:ss A') : '...'}
                                                          </div>
                                                      </div>
                                                  </div>

                                                  <button 
                                                    onClick={() => handleDownload(rec.id)}
                                                    disabled={downloadingId === rec.id}
                                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#3CE8FF]/10 hover:bg-[#3CE8FF]/20 text-[#3CE8FF] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                                  >
                                                      {downloadingId === rec.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                                                      <span className="text-xs font-bold">Download</span>
                                                  </button>
                                              </div>
                                          ))}
                                      </div>
                                   </div>
                                ))}
                             </div>
                          </div>

                        </div>
                      );
                    })
                )}

            </div>
        </main>
      </div>
    </div>
  );
}

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