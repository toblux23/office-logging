export default function StartupLabBrand() {
  return (
    <div className="flex items-center gap-3" aria-label="StartupLab Business Center">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-sm">
        <svg
          viewBox="0 0 96 96"
          className="h-9 w-9"
          role="img"
          aria-hidden="true"
        >
          <path
            d="M31 27h34c8 0 15 7 15 15 0 7-5 13-12 15v19c0 13-9 22-20 22S28 89 28 76V57c-7-2-12-8-12-15 0-8 7-15 15-15Z"
            fill="none"
            stroke="#2D2D2D"
            strokeWidth="10"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M37 52h22v23c0 7-5 12-11 12s-11-5-11-12V52Z"
            fill="#37BCF1"
          />
          <circle cx="44" cy="65" r="4" fill="#FFFFFF" />
          <circle cx="56" cy="58" r="5" fill="#FFFFFF" />
          <circle cx="56" cy="74" r="5" fill="#FFFFFF" />
          <circle cx="48" cy="12" r="5" fill="#37BCF1" />
          <circle cx="36" cy="24" r="5" fill="#37BCF1" />
          <circle cx="60" cy="22" r="5" fill="#37BCF1" />
          <path
            d="M30 42h36"
            fill="none"
            stroke="#000000"
            strokeWidth="5"
            strokeLinecap="round"
          />
        </svg>
      </div>

      <div className="leading-none">
        <div className="font-display text-xl font-black tracking-tight sm:text-2xl">
          <span className="text-[#37BCF1]">Startup</span>
          <span className="text-[#2D2D2D]">Lab</span>
        </div>
        <div className="mt-1 text-[9px] font-extrabold uppercase tracking-[0.45em] text-[#2D2D2D] sm:text-[10px]">
          Business Center
        </div>
      </div>
    </div>
  );
}
