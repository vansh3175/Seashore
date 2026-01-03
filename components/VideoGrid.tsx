// "use client";

function VideoGrid() {
  return (
      <div className="p-4 grid grid-cols-2 gap-4 z-10 bg-[#0B0F19] relative">

              {/* --- CARD 1: SARAH (HOST) --- */}
              <div className="relative w-full aspect-[4/3] bg-slate-800 rounded-lg overflow-hidden border border-white/10 group/card shadow-2xl">
                <img
                  src="/people-on-call-two.jpg"
                  alt="Sarah Host"
                  className="w-full h-full object-cover opacity-90 transition-transform duration-700 "
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-80" />

               
                <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2">
                  <div className="bg-black/60 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-full flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    <span className="text-xs font-semibold text-white tracking-wide">Sarah (Host)</span>
                  </div>
                </div>
              </div>

              {/* --- CARD 2: GUEST --- */}
              <div className="relative w-full aspect-[4/3] bg-slate-800 rounded-lg overflow-hidden border border-white/10 group/card shadow-2xl">
                <img
                  src="/people-on-call-one.jpg"
                  alt="Guest"
                  className="w-full h-full object-cover opacity-90 transition-transform duration-700 "
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-80" />

                <div className="absolute bottom-4 left-4 z-20">
                  <div className="bg-black/60 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-full flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    <span className="text-xs font-semibold text-white tracking-wide">David</span>
                  </div>
                </div>
              </div>

            </div>
  )
}

export default VideoGrid;