"use client";

// app/(main)/chat/[conversationId]/page.tsx
// Halaman room chat — percakapan antara dua pihak

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import styles from "./room.module.css";

// ─── Types ────────────────────────────────────────────────────

interface UserPreview {
  id: string;
  name: string | null;
  image: string | null;
  username: string | null;
}

interface PropertyPreview {
  id: string;
  title: string;
  imageUrls: string[];
  city: string | null;
  price: number;
  listingType: string;
  category: string;
}

interface MessageData {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  isRead: boolean;
  createdAt: string;
  sender: { id: string; name: string | null; image: string | null };
}

interface ConversationDetail {
  id: string;
  propertyId: string;
  userId: string;
  ownerId: string;
  property: PropertyPreview;
  user: UserPreview;
  owner: UserPreview;
}

// ─── Helpers ─────────────────────────────────────────────────

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

function formatDateLabel(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (diffDays === 0) return "Hari ini";
  if (diffDays === 1) return "Kemarin";
  return date.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" });
}

function isSameDay(a: string, b: string) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

function formatPrice(price: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    notation: "compact",
    maximumFractionDigits: 0,
  }).format(price);
}

function getInitials(name: string | null) {
  if (!name) return "?";
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function Avatar({ src, name, size = 36 }: { src: string | null; name: string | null; size?: number }) {
  if (src) {
    return (
      <div style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden", flexShrink: 0, position: "relative" }}>
        <Image src={src} alt={name ?? "user"} fill style={{ objectFit: "cover" }} />
      </div>
    );
  }
  return (
    <div className={styles.avatarFallback} style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {getInitials(name)}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────

export default function ChatRoomPage() {
  const params = useParams();
  const rawConversationId = (params as Record<string, string | string[] | undefined>)?.conversationId;
  const conversationId = Array.isArray(rawConversationId) ? rawConversationId[0] : rawConversationId;
  const { data: session, status } = useSession();
  const router = useRouter();

  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [fatalError, setFatalError] = useState<string>("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auth guard
  useEffect(() => {
    if (status === "unauthenticated") {
      const backTo = conversationId ? `/chat/${conversationId}` : "/chat";
      router.push(`/login?callbackUrl=${encodeURIComponent(backTo)}`);
    }
  }, [status, router, conversationId]);

  const fetchMessages = useCallback(async (silent = false) => {
    if (!conversationId) {
      setFatalError("Conversation ID tidak valid");
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        if (res.status === 401) {
          router.push(`/login?callbackUrl=${encodeURIComponent(`/chat/${conversationId}`)}`);
        }
        if (res.status === 404) router.push("/chat");
        return;
      }
      const data = await res.json();
      setConversation(data.conversation);
      setMessages(data.messages ?? []);
    } catch (e) {
      console.error(e);
      setFatalError("Gagal memuat chat");
    } finally {
      setLoading(false);
    }
  }, [conversationId, router]);

  useEffect(() => {
    if (status === "authenticated" && conversationId) fetchMessages();
  }, [status, conversationId, fetchMessages]);

  // Scroll ke bawah saat messages berubah
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Polling (lebih cepat biar chat terasa realtime)
  useEffect(() => {
    if (status !== "authenticated") return;
    pollRef.current = setInterval(() => fetchMessages(true), 1500);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [status, fetchMessages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  const sendMessage = async () => {
    if (!conversationId || !input.trim() || sending) return;
    setSending(true);
    const content = input.trim();
    setInput("");

    // Optimistic update
    const tempId = `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const tempMsg: MessageData = {
      id: tempId,
      conversationId,
      senderId: session!.user!.id,
      content,
      isRead: false,
      createdAt: new Date().toISOString(),
      sender: {
        id: session!.user!.id,
        name: session!.user!.name ?? null,
        image: session!.user!.image ?? null,
      },
    };
    setMessages((prev) => [...prev, tempMsg]);

    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        throw new Error(`Gagal mengirim pesan (${res.status})`);
      }

      const saved = (await res.json()) as MessageData;
      setMessages((prev) => prev.map((m) => (m.id === tempId ? saved : m)));

      // Optional: refresh in background to sync read status/order
      fetchMessages(true);
    } catch (e) {
      console.error(e);
      // Kalau gagal, balikin input dan hapus temp message biar nggak bikin bingung
      setInput(content);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const partner = conversation
    ? session?.user?.id === conversation.userId
      ? conversation.owner
      : conversation.user
    : null;

  const isOwner = conversation ? session?.user?.id === conversation.ownerId : false;

  if (status === "loading" || loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingScreen}><div className={styles.spinner} /></div>
      </div>
    );
  }

  if (fatalError) {
    return (
      <div className={styles.page}>        
        <div className={styles.loadingScreen}>
          <div>
            <p style={{ marginBottom: 12 }}>{fatalError}</p>
            <button className={styles.backBtn} onClick={() => router.push("/chat")} aria-label="Kembali">
              Kembali ke daftar chat
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!conversation) return null;

  const { property } = conversation;

  return (
    <div className={styles.page}>      

      <div className={styles.chatLayout}>
        <div className={styles.stickyTop}>
          {/* ── Chat Header ── */}
          <div className={styles.chatHeader}>
            <button className={styles.backBtn} onClick={() => router.push("/chat")} aria-label="Kembali">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="18" height="18" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 5l-7 7 7 7" />
              </svg>
            </button>

            <Avatar src={partner?.image ?? null} name={partner?.name ?? null} size={40} />

            <div className={styles.headerInfo}>
              <span className={styles.headerName}>{partner?.name ?? partner?.username ?? "Pengguna"}</span>
              <span className={styles.headerRole}>
                {isOwner ? "Pencari Properti" : "Pemilik Properti"}
              </span>
            </div>
          </div>

          {/* ── Property Banner ── */}
          <Link href={`/propertyDetail/${property.id}`} className={styles.propertyBanner}>
            <div className={styles.propertyBannerImg}>
              {property.imageUrls?.[0] ? (
                <Image src={property.imageUrls[0]} alt={property.title} fill style={{ objectFit: "cover" }} />
              ) : (
                <div className={styles.propertyBannerImgEmpty}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                </div>
              )}
            </div>

            <div className={styles.propertyBannerInfo}>
              <span className={styles.propertyBannerTitle}>{property.title}</span>
              <span className={styles.propertyBannerSub}>
                {property.city} · {property.listingType === "RENT" ? "Sewa" : "Jual"}
              </span>
              <span className={styles.propertyBannerPrice}>
                {formatPrice(property.price)}
                {property.listingType === "RENT" ? "/bln" : ""}
              </span>
            </div>

            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#b0b8cc", flexShrink: 0 }}>
              <path d="m9 18 6-6-6-6" />
            </svg>
          </Link>
        </div>

        {/* ── Messages ── */}
        <div className={styles.messagesArea}>
          {messages.length === 0 ? (
            <div className={styles.messagesEmpty}>
              <p>Belum ada pesan. Mulai percakapan!</p>
            </div>
          ) : (
            messages.map((msg, i) => {
              const isMine = msg.senderId === session?.user?.id;
              const isFirstOfDay = i === 0 || !isSameDay(msg.createdAt, messages[i - 1].createdAt);
              const isFirstOfGroup = i === 0 || messages[i - 1].senderId !== msg.senderId;
              const isLastOfGroup = i === messages.length - 1 || messages[i + 1].senderId !== msg.senderId;
              const isTemp = msg.id.startsWith("temp-");

              return (
                <div key={msg.id}>
                  {/* Date divider */}
                  {isFirstOfDay && (
                    <div className={styles.dateDivider}>
                      <span>{formatDateLabel(msg.createdAt)}</span>
                    </div>
                  )}

                  <div className={`${styles.msgRow} ${isMine ? styles.msgRowMine : styles.msgRowTheirs}`}>
                    {/* Avatar for partner */}
                    {!isMine && (
                      <div className={styles.msgAvatarSlot}>
                        {isFirstOfGroup ? (
                          <Avatar src={msg.sender.image} name={msg.sender.name} size={30} />
                        ) : (
                          <div style={{ width: 30 }} />
                        )}
                      </div>
                    )}

                    <div className={styles.msgBubbleWrap}>
                      {!isMine && isFirstOfGroup && (
                        <span className={styles.msgSenderLabel}>{msg.sender.name ?? "Pengguna"}</span>
                      )}
                      <div className={`${styles.bubble} ${isMine ? styles.bubbleMine : styles.bubbleTheirs} ${isTemp ? styles.bubbleTemp : ""}`}>
                        <p>{msg.content}</p>
                      </div>
                      {isLastOfGroup && (
                        <span className={styles.msgMeta}>
                          {formatTime(msg.createdAt)}
                          {isMine && !isTemp && (
                            <span className={msg.isRead ? styles.readTick : styles.sentTick}>
                              {msg.isRead ? " · Sudah dibaca" : " · Terkirim"}
                            </span>
                          )}
                          {isTemp && <span className={styles.sentTick}> •••</span>}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* ── Input ── */}
        <div className={styles.inputBar}>
          <textarea
            ref={textareaRef}
            className={styles.inputField}
            placeholder="Tulis pesan..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
          />
          <button
            className={styles.sendBtn}
            onClick={sendMessage}
            disabled={!input.trim() || sending}
            aria-label="Kirim"
          >
            {sending ? (
              <div className={styles.spinnerSmall} />
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor" width="19" height="19">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}