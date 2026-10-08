"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useRef, useState, Suspense } from "react";
import {
  type ApiProperty,
  type PropertySuggestion,
  mapApiPropertyToSuggestion,
} from "@/types/property";

const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/bookmark", label: "Bookmark" },
  { href: "/notification", label: "Notification" },
];

const UNREAD_POLL_MS = 15000;

/**
 * Cache tingkat modul: Navbar dirender ulang di setiap halaman, jadi tanpa cache
 * ini nama user & badge chat di-fetch ulang (dan sempat kosong) tiap pindah page.
 */
let cachedUser: { id: string; displayName: string | null } | null = null;
let cachedUnreadCount = 0;

function NavbarContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams?.get("q") || "");

  useEffect(() => {
    if (searchParams) {
      setSearchQuery(searchParams.get("q") || "");
    }
  }, [searchParams]);
  const { data: session, status: sessionStatus } = useSession();
  const userId = session?.user?.id ?? null;
  const [displayName, setDisplayName] = useState<string | null>(() =>
    cachedUser && cachedUser.id === userId ? cachedUser.displayName : null,
  );
  const [unreadCount, setUnreadCount] = useState(cachedUnreadCount);
  const isLoggedIn = sessionStatus === "authenticated";
  // Selama status login masih dicek, jangan arahkan ke /login
  const isLoggedOut = sessionStatus === "unauthenticated";
  const linkRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const searchWrapperRef = useRef<HTMLDivElement | null>(null);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [highlightStyle, setHighlightStyle] = useState({
    left: "0px",
    width: "0px",
    opacity: 0,
  });

  const [suggestions, setSuggestions] = useState<PropertySuggestion[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);

  const shouldShowSuggestions = isSearchFocused && searchQuery.trim().length > 0;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q) {
      router.push(`/search?q=${encodeURIComponent(q)}`);
    } else {
      if (pathname.startsWith('/search')) {
        router.push('/search');
      }
    }
    setIsSearchFocused(false);
  };

  const handleSuggestionClick = (item: PropertySuggestion) => {
    setSearchQuery(item.title);
    setIsSearchFocused(false);
    router.push(`/search?q=${encodeURIComponent(item.title)}`);
  };

  const isActive = (path: string) => pathname === path;

  useEffect(() => {
    const activeItem = NAV_ITEMS.find((item) => pathname === item.href);
    if (!activeItem) {
      setHighlightStyle((prev) => ({ ...prev, opacity: 0 }));
      return;
    }
    const activeEl = linkRefs.current[activeItem.href];
    if (!activeEl) return;
    setHighlightStyle({
      left: `${activeEl.offsetLeft}px`,
      width: `${activeEl.offsetWidth}px`,
      opacity: 1,
    });
  }, [pathname]);

  // Ambil username sekali per user, lalu simpan di cache modul
  useEffect(() => {
    if (sessionStatus === "unauthenticated") {
      cachedUser = null;
      cachedUnreadCount = 0;
      setDisplayName(null);
      setUnreadCount(0);
      return;
    }
    if (!userId || cachedUser?.id === userId) return;

    let isMounted = true;
    const fallbackName = session?.user?.name || session?.user?.email || null;
    (async () => {
      let name = fallbackName;
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = (await res.json()) as {
            user?: { username?: string | null; name?: string | null; email?: string | null };
          };
          name = data.user?.username || data.user?.name || data.user?.email || fallbackName;
        }
      } catch {
        // pakai nama dari session
      }
      cachedUser = { id: userId, displayName: name };
      if (isMounted) setDisplayName(name);
    })();
    return () => { isMounted = false; };
  }, [sessionStatus, userId, session?.user?.name, session?.user?.email]);

  // Fetch unread count untuk badge notif chat
  useEffect(() => {
    if (!isLoggedIn) return;
    let isMounted = true;
    const fetchUnread = async () => {
      try {
        const res = await fetch("/api/conversations");
        if (!res.ok) return;
        const data = await res.json();
        if (!isMounted) return;
        const total = Array.isArray(data)
          ? data.reduce((sum: number, c: { unreadCount?: number }) => sum + (c.unreadCount ?? 0), 0)
          : 0;
        cachedUnreadCount = total;
        setUnreadCount(total);
      } catch { /* silent */ }
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, UNREAD_POLL_MS);
    return () => { isMounted = false; clearInterval(interval); };
  }, [isLoggedIn]);

  useEffect(() => {
    const handleResize = () => {
      const activeItem = NAV_ITEMS.find((item) => pathname === item.href);
      if (!activeItem) return;
      const activeEl = linkRefs.current[activeItem.href];
      if (!activeEl) return;
      setHighlightStyle({
        left: `${activeEl.offsetLeft}px`,
        width: `${activeEl.offsetWidth}px`,
        opacity: 1,
      });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [pathname]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!searchWrapperRef.current) return;
      if (!searchWrapperRef.current.contains(event.target as Node)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) { setSuggestions([]); setIsSuggesting(false); return; }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setIsSuggesting(true);
      try {
        const res = await fetch(`/api/properties?q=${encodeURIComponent(trimmed)}&take=6`, { signal: controller.signal });
        const json = await res.json().catch(() => ({}));
        const data = Array.isArray(json.data) ? (json.data as ApiProperty[]) : [];
        setSuggestions(data.map(mapApiPropertyToSuggestion));
      } catch {
        if (!controller.signal.aborted) setSuggestions([]);
      } finally {
        if (!controller.signal.aborted) setIsSuggesting(false);
      }
    }, 250);

    return () => { controller.abort(); window.clearTimeout(timeoutId); };
  }, [searchQuery]);

  const isChatActive = pathname === "/chat" || pathname.startsWith("/chat/");
  // Selagi username diambil, pakai nama dari session yang sudah tersedia
  const profileLabel = isLoggedOut
    ? "Login"
    : displayName ?? session?.user?.name ?? (isLoggedIn ? "Profil" : "…");

  return (
    <div className="fixed top-3 sm:top-4 left-1/2 -translate-x-1/2 z-100 w-full max-w-[1040px] px-2.5 sm:px-3 md:px-4">
      <div className="h-[38px] sm:h-[42px] md:h-[46px] w-full flex items-center justify-center gap-1.5 sm:gap-2">

        {/* Left Section - Navigation Menu */}
        <div className="min-w-0 bg-[rgba(255,255,255,0.62)] backdrop-blur-md border border-[#9a9a9a] h-[38px] sm:h-[42px] md:h-[46px] rounded-[999px] px-3 sm:px-3.5 md:px-4 flex items-center gap-1.5 sm:gap-2 shadow-[0_5px_14px_rgba(0,0,0,0.06)]">
          {/* Logo */}
          <Link
            href="/"
            className="px-1.5 sm:px-2 md:px-2.5 py-1 rounded-full flex flex-col items-center justify-center gap-0.5 sm:gap-1 hover:bg-black/5 transition-all font-semibold text-[9px] sm:text-[10px] md:text-[11px] tracking-[0.2px] text-[#171717] leading-none"
          >
            <span className="relative w-[16px] h-[10px] sm:w-[18px] sm:h-[11px] md:w-[20px] md:h-[12px]">
              <Image
                src="/images/logoDark.png"
                alt="PAPAN logo"
                fill
                sizes="(max-width: 640px) 16px, (max-width: 768px) 18px, 20px"
                className="object-contain"
              />
            </span>
            PAPAN
          </Link>

          {/* Navigation Items */}
          <div className="relative flex items-center gap-1 sm:gap-1.5 md:gap-2.5">
            <div
              className="absolute top-1/2 -translate-y-1/2 rounded-full transition-all duration-300 ease-in-out pointer-events-none"
              style={{
                left: highlightStyle.left,
                width: highlightStyle.width,
                height: "clamp(20px, 2.2vw, 28px)",
                background: "rgba(0, 0, 0, 0.07)",
                opacity: highlightStyle.opacity,
              }}
            />
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                ref={(el) => { linkRefs.current[item.href] = el; }}
                className={`relative z-10 h-5 sm:h-6 md:h-7 px-2 sm:px-2.5 md:px-4 rounded-full flex items-center whitespace-nowrap text-[10px] sm:text-[11px] md:text-[12px] transition-all ${
                  isActive(item.href)
                    ? "font-semibold text-[#111111]"
                    : "font-medium text-[#303030] hover:text-[#111111]"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Center Section - Search Bar */}
        <form onSubmit={handleSearch} className="hidden sm:block flex-1 min-w-0 max-w-[240px] md:max-w-[340px]">
          <div ref={searchWrapperRef} className="relative">
            <div className="bg-[rgba(255,255,255,0.62)] backdrop-blur-md border border-[#9a9a9a] h-[38px] sm:h-[42px] md:h-[46px] rounded-[999px] w-full flex items-center pl-3 sm:pl-3.5 md:pl-4 pr-2 sm:pr-2.5 md:pr-3 shadow-[0_5px_14px_rgba(0,0,0,0.06)]">
              <div className="size-[14px] sm:size-[16px] md:size-[18px] mr-1.5 sm:mr-2 flex-shrink-0 flex items-center justify-center text-[10px] sm:text-[11px] md:text-[12px]">
                <span aria-hidden="true">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#404040" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </span>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                placeholder="Cari properti berdasarkan lokasi..."
                className="flex-1 min-w-0 bg-transparent text-[10px] sm:text-[11px] md:text-[12px] font-medium text-[#1f1f1f] placeholder:text-[#5f5f5f] outline-none"
              />
            </div>

            {shouldShowSuggestions && (
              <div className="absolute top-[calc(100%+8px)] left-0 right-0 rounded-2xl border border-[#b9b9b9] bg-[rgba(255,255,255,0.92)] backdrop-blur-md shadow-[0_10px_24px_rgba(0,0,0,0.1)] py-1 z-[120] max-h-72 overflow-y-auto">
                {isSuggesting ? (
                  <p className="px-3 py-2 text-[10px] md:text-[11px] text-[#5f5f5f]">Mencari...</p>
                ) : suggestions.length > 0 ? (
                  suggestions.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSuggestionClick(item)}
                      className="w-full text-left px-3 py-2 hover:bg-black/5 transition-colors"
                    >
                      <p className="text-[11px] md:text-[12px] font-semibold text-[#1f1f1f] truncate">{item.title}</p>
                      <p className="text-[10px] md:text-[11px] text-[#5f5f5f] truncate">{item.lokasi}</p>
                    </button>
                  ))
                ) : (
                  <p className="px-3 py-2 text-[10px] md:text-[11px] text-[#5f5f5f]">Tidak ada hasil yang mirip.</p>
                )}
              </div>
            )}
          </div>
        </form>

        {/* Chat Icon Button */}
        <Link
          href={isLoggedOut ? `/login?callbackUrl=${encodeURIComponent("/chat")}` : "/chat"}
          aria-label="Pesan"
          className={`shrink-0 relative bg-[rgba(255,255,255,0.62)] backdrop-blur-md border border-[#9a9a9a] h-[38px] sm:h-[42px] md:h-[46px] w-[38px] sm:w-[42px] md:w-[46px] rounded-full flex items-center justify-center hover:bg-white/80 transition-all shadow-[0_5px_14px_rgba(0,0,0,0.06)] ${
            isChatActive ? "bg-white/90 border-[#19263c]/40" : ""
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke={isChatActive ? "#19263c" : "#303030"}
            strokeWidth={isChatActive ? "2.5" : "2"}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          {/* Unread badge */}
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-[#e84b3b] text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Link>

        {/* Right Section - Login/Profile Button */}
        <Link
          href={isLoggedOut ? "/login" : "/profile"}
          className="shrink-0 bg-[rgba(255,255,255,0.62)] backdrop-blur-md border border-[#9a9a9a] h-[38px] sm:h-[42px] md:h-[46px] rounded-[999px] w-[74px] sm:w-[100px] md:w-[128px] px-2 flex items-center justify-center text-[10px] sm:text-[11px] md:text-[12px] font-semibold text-[#171717] hover:bg-white/80 transition-all shadow-[0_5px_14px_rgba(0,0,0,0.06)]"
          title={profileLabel}
        >
          <span className="truncate">{profileLabel}</span>
        </Link>
      </div>
    </div>
  );
}

export default function Navbar() {
  return (
    <Suspense fallback={<div className="h-[38px] sm:h-[42px] md:h-[46px]" />}>
      <NavbarContent />
    </Suspense>
  );
}
