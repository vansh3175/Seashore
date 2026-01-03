"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import axios from "axios";
import { useUser, useClerk } from "@clerk/nextjs";
import {
  Waves,
  LayoutGrid,
  FolderOpen,
  Calendar as CalendarIcon,
  ArrowRight,
  Menu,
  X,
  ArrowLeft,
  User,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Clock,
} from "lucide-react";
import dayjs from "dayjs";
import localizedFormat from "dayjs/plugin/localizedFormat";

dayjs.extend(localizedFormat);

// --- TYPES ---
type Session = {
  id: string;
  title: string;
  scheduledAt: string;
  status: "scheduled" | "live" | "completed";
};

export default function SchedulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = React.use(params);
  const studioId = id;

  const router = useRouter();
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // --- CALENDAR STATE ---
  const [currentDate, setCurrentDate] = useState(dayjs());
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch Sessions
  const fetchSchedule = async () => {
    setIsLoading(true);
    try {
      const res = await axios.get(
        `/api/studio/${studioId}/schedule?month=${currentDate.format(
          "YYYY-MM"
        )}`
      );
      setSessions(res.data.sessions || []);
    } catch (error) {
      console.error("Failed to fetch schedule", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedule();
  }, [studioId, currentDate.month()]);

  const getInitials = () => {
    if (!isLoaded || !user) return "ME";
    return (
      (user.firstName?.[0] || "") + (user.lastName?.[0] || "")
    ).toUpperCase();
  };

  // --- Clicking on a day should only show sessions ---
  const handleCellClick = (day: number) => {
    const clickedDate = currentDate.date(day);
    setSelectedDate(clickedDate);
    setIsModalOpen(true);
  };

  // Calendar helpers
  const daysInMonth = currentDate.daysInMonth();
  const firstDayOfMonth = currentDate.startOf("month").day();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDayOfMonth }, (_, i) => i);

  const totalSlots = 42;
  const trailingBlanks = Array.from(
    { length: totalSlots - (days.length + blanks.length) },
    (_, i) => i
  );

  const prevMonth = () => setCurrentDate(currentDate.subtract(1, "month"));
  const nextMonth = () => setCurrentDate(currentDate.add(1, "month"));
  const goToToday = () => setCurrentDate(dayjs());

  const getSessionsForDay = (day: number) => {
    return sessions.filter((s) => {
      const sessionDate = dayjs(s.scheduledAt);
      return (
        sessionDate.date() === day &&
        sessionDate.month() === currentDate.month() &&
        sessionDate.year() === currentDate.year()
      );
    });
  };

  const getSelectedDateSessions = () => {
    if (!selectedDate) return [];
    return sessions.filter((s) => {
      const sessionDate = dayjs(s.scheduledAt);
      return (
        sessionDate.date() === selectedDate.date() &&
        sessionDate.month() === selectedDate.month() &&
        sessionDate.year() === selectedDate.year()
      );
    });
  };

  return (
    <div className="flex h-screen bg-[#050810] text-white overflow-hidden selection:bg-[#3CE8FF]/30 font-sans">
      {/* BACKGROUND FX */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[800px] h-[800px] bg-purple-600/10 rounded-full blur-[150px] opacity-40 animate-pulse-slow" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[150px] opacity-30" />
      </div>

      {/* SIDEBAR */}
      <aside
        className={`
        fixed inset-y-0 left-0 z-[70] w-64 bg-[#050810] border-r border-white/5 flex flex-col items-start py-6 transition-transform duration-300 ease-in-out shadow-2xl md:shadow-none
        md:relative md:translate-x-0 md:w-20 md:items-center md:bg-[#050810]/50 md:backdrop-blur-xl
        ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
      `}
      >
        <div className="w-full flex items-center justify-between px-6 mb-8 md:mb-10 md:justify-center md:px-0">
          <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.3)]">
            <Waves className="w-6 h-6 text-white" />
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="p-2 text-slate-500 md:hidden hover:text-white transition-colors"
          >
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
            onClick={() => router.push(`/studio/${studioId}/projects`)}
          />
          <NavIcon
            icon={<CalendarIcon />}
            label="Schedule"
            active={true}
            onClick={() => setIsMobileMenuOpen(false)}
          />
        </nav>
      </aside>

      {/* MAIN COLUMN */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative z-10">
        {/* HEADER */}
        <header className="h-16 flex items-center justify-between px-6 md:px-8 shrink-0 border-b border-white/5 bg-[#050810]/80 backdrop-blur-md sticky top-0 z-50">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden text-slate-400 hover:text-white transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
            
            <div className="flex items-center gap-3">
              <span className="font-bold text-lg tracking-tight text-white hidden sm:block">
                Seashore
              </span>
              <span className="text-slate-600 hidden sm:block">/</span>
              <span className="text-sm font-medium text-slate-400 hidden sm:block">
                Schedule
              </span>
            </div>
          </div>

          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center gap-3 group focus:outline-none"
            >
              <div className="text-right hidden md:block">
                <p className="text-sm font-medium text-white group-hover:text-[#3CE8FF] transition-colors">
                  {user?.fullName || "Guest"}
                </p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                  Creator
                </p>
              </div>
              <div
                className={`w-9 h-9 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 border border-white/10 flex items-center justify-center text-xs font-bold text-white shadow-lg transition-all ${
                  isProfileOpen
                    ? "ring-2 ring-[#3CE8FF] ring-offset-2 ring-offset-[#050810]"
                    : "group-hover:scale-105"
                }`}
              >
                {getInitials()}
              </div>
            </button>

            {isProfileOpen && (
              <div className="absolute right-0 top-12 w-60 bg-[#0F131F] border border-white/10 rounded-2xl shadow-2xl shadow-black/80 overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-[100]">
                <div className="p-4 border-b border-white/5">
                  <p className="text-xs text-slate-400">Signed in as</p>
                  <p className="text-white text-sm font-medium truncate">
                    {user?.primaryEmailAddress?.emailAddress}
                  </p>
                </div>
                <div className="p-2">
                  
                  <button
                    onClick={() => signOut(() => router.push("/"))}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors text-sm text-left mt-1"
                  >
                    <LogOut className="w-4 h-4" /> Log Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* MAIN CONTENT */}
        <main className="flex-1 flex flex-col overflow-hidden px-4 md:px-8 py-4 md:py-6 relative">
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 shrink-0">
            <div>
              <h1 className="text-2xl font-bold text-white">Schedule</h1>
              <p className="text-slate-400 text-xs">
                Manage upcoming sessions.
              </p>
            </div>

            {/* Month Navigator */}
            <div className="flex items-center gap-2 bg-[#0F131F] border border-white/5 rounded-xl p-1.5 shadow-lg">
              <button
                onClick={prevMonth}
                className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="text-sm font-bold w-32 text-center select-none">
                {currentDate.format("MMMM YYYY")}
              </div>
              <button
                onClick={nextMonth}
                className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <div className="w-px h-5 bg-white/10 mx-1" />
              <button
                onClick={goToToday}
                className="px-3 py-1 rounded-md text-xs font-bold bg-[#3CE8FF]/10 text-[#3CE8FF] hover:bg-[#3CE8FF]/20 transition-colors"
              >
                Today
              </button>
            </div>
          </div>

          {/* Calendar */}
          <div className="flex-1 flex flex-col bg-[#0F131F] border border-white/5 rounded-2xl overflow-hidden shadow-2xl min-h-0">
            <div className="grid grid-cols-7 border-b border-white/5 bg-[#141825] shrink-0">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                (day) => (
                  <div
                    key={day}
                    className="py-2 text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest"
                  >
                    {day}
                  </div>
                )
              )}
            </div>

            <div className="flex-1 grid grid-cols-7 grid-rows-6">
              {blanks.map((_, i) => (
                <div
                  key={`blank-${i}`}
                  className="border-r border-b border-white/5 bg-[#050810]/30"
                />
              ))}

              {days.map((day) => {
                const daySessions = getSessionsForDay(day);
                const isToday =
                  day === dayjs().date() &&
                  currentDate.isSame(dayjs(), "month");

                return (
                  <div
                    key={day}
                    onClick={() => handleCellClick(day)}
                    className={`relative flex flex-col p-1 md:p-2 border-r border-b border-white/5 group transition-colors hover:bg-white/[0.04] cursor-pointer ${
                      isToday ? "bg-blue-900/10" : ""
                    }`}
                  >
                    <div
                      className={`w-6 h-6 flex shrink-0 items-center justify-center rounded-full text-xs font-medium mb-1 ${
                        isToday
                          ? "bg-[#3CE8FF] text-black font-bold"
                          : "text-slate-400"
                      }`}
                    >
                      {day}
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-1 min-h-0 scrollbar-none pointer-events-none">
                      {daySessions.map((session) => (
                        <div
                          key={session.id}
                          className="block p-1.5 rounded-md bg-[#3CE8FF]/10 border border-[#3CE8FF]/20"
                        >
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <div className="w-1 h-1 rounded-full bg-[#3CE8FF] shrink-0" />
                            <span className="text-[10px] font-bold text-[#3CE8FF] truncate leading-none">
                              {dayjs(session.scheduledAt).format("h:mm A")}
                            </span>
                          </div>
                          <p className="text-[10px] text-white font-medium truncate leading-tight">
                            {session.title}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {trailingBlanks.map((_, i) => (
                <div
                  key={`empty-${i}`}
                  className="border-r border-b border-white/5 bg-[#050810]/30"
                />
              ))}
            </div>
          </div>

          {/* VIEW-ONLY MODAL */}
          {isModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={() => setIsModalOpen(false)}
              />

              <div className="relative w-full max-w-md bg-[#0F131F] border border-white/10 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
                <div className="p-6">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-xl font-bold text-white">
                        Scheduled Sessions
                      </h2>
                      <p className="text-xs text-slate-400 mt-1">
                        {selectedDate?.format("dddd, MMMM D, YYYY")}
                      </p>
                    </div>
                    <button
                      onClick={() => setIsModalOpen(false)}
                      className="text-slate-400 hover:text-white transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* LIST OF SESSIONS */}
                  <div className="space-y-4">
                    <div className="min-h-[200px] max-h-[300px] overflow-y-auto pr-1">
                      {getSelectedDateSessions().length > 0 ? (
                        <div className="space-y-3">
                          {getSelectedDateSessions().map((session) => (
                            <div
                              key={session.id}
                              className="p-3 bg-white/5 border border-white/5 rounded-xl flex items-center justify-between group hover:border-white/10 transition-colors"
                            >
                              <div className="min-w-0 pr-4">
                                <h3 className="text-sm font-bold text-white truncate">
                                  {session.title}
                                </h3>
                                <div className="flex items-center gap-2 mt-1">
                                  <Clock className="w-3 h-3 text-slate-500" />
                                  <span className="text-xs text-slate-400 font-mono">
                                    {dayjs(session.scheduledAt).format(
                                      "h:mm A"
                                    )}
                                  </span>
                                  <span
                                    className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                                      session.status === "live"
                                        ? "bg-red-500/10 text-red-400"
                                        : session.status === "completed"
                                        ? "bg-green-500/10 text-green-400"
                                        : "bg-blue-500/10 text-blue-400"
                                    }`}
                                  >
                                    {session.status}
                                  </span>
                                </div>
                              </div>

                              <Link
                                href={`/room/${studioId}/join`}
                                className="p-2 rounded-lg bg-[#3CE8FF]/10 text-[#3CE8FF] hover:bg-[#3CE8FF] hover:text-black transition-colors"
                              >
                                <ArrowRight className="w-4 h-4" />
                              </Link>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-500 py-10 border border-dashed border-white/10 rounded-xl">
                          <CalendarIcon className="w-8 h-8 mb-2 opacity-50" />
                          <p className="text-sm">No sessions scheduled.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function NavIcon({ icon, label, active, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className={`
      group relative flex items-center gap-4
      w-full md:w-12 h-12 rounded-2xl
      px-4 md:px-0 md:justify-center
      transition-all duration-300 cursor-pointer
      ${
        active
          ? "bg-blue-600/10 text-blue-400 md:bg-blue-600 md:text-white md:shadow-[0_0_20px_rgba(37,99,235,0.4)]"
          : "text-slate-500 hover:bg-white/5 hover:text-white"
      }
    `}
    >
      <div className="w-5 h-5 md:w-6 md:h-6 shrink-0">{icon}</div>
      <span
        className={`
        text-sm font-medium
        md:absolute md:left-14 md:bg-slate-900 md:text-white md:px-3 md:py-1.5 md:rounded-lg
        md:opacity-0 md:group-hover:opacity-100 md:whitespace-nowrap md:pointer-events-none md:z-50 md:border md:border-white/10 md:shadow-xl
        md:translate-x-2 md:group-hover:translate-x-0 md:transform md:transition-all
      `}
      >
        {label}
      </span>
    </button>
  );
}
