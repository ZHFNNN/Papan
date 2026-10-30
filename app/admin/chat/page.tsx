"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from 'next/navigation';
import styles from './page.module.css';
import { signOut } from 'next-auth/react';


type Person = {
	id: string;
	name: string | null;
	username: string | null;
	image: string | null;
};

type ConversationItem = {
	id: string;
	updatedAt: string;
	createdAt: string;
	property: {
		id: string;
		title: string;
		imageUrls: string[];
		city: string | null;
		price: string;
		listingType: string;
	};
	user: Person;
	owner: Person;
	messages: Array<{
		id: string;
		content: string;
		createdAt: string;
		sender: Person;
	}>;
	_count: { messages: number };
};

type AdminConversationsResponse = {
	items: ConversationItem[];
	total: number;
	page: number;
	perPage: number;
	q: string;
};

type Message = {
	id: string;
	content: string;
	createdAt: string;
	sender: Person;
};

type ConversationDetail = {
	id: string;
	createdAt: string;
	updatedAt: string;
	property: {
		id: string;
		title: string;
		imageUrls: string[];
		city: string | null;
		price: string;
		listingType: string;
		category: string;
	};
	user: Person;
	owner: Person;
};

function formatDateTime(iso: string) {
	const d = new Date(iso);
	return new Intl.DateTimeFormat("id-ID", {
		day: "2-digit",
		month: "short",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	}).format(d);
}

function displayName(p: Person) {
	return p.name ?? p.username ?? "(tanpa nama)";
}

export default function AdminChatPage() {
    const router = useRouter();
	const [q, setQ] = useState("");
	const [debouncedQ, setDebouncedQ] = useState("");

	const [list, setList] = useState<AdminConversationsResponse | null>(null);
	const [listLoading, setListLoading] = useState(true);
	const [listError, setListError] = useState<string | null>(null);
	const [page, setPage] = useState(1);

	const [activeId, setActiveId] = useState<string | null>(null);
	const [detail, setDetail] = useState<ConversationDetail | null>(null);
	const [messages, setMessages] = useState<Message[]>([]);
	const [detailLoading, setDetailLoading] = useState(false);
	const [detailError, setDetailError] = useState<string | null>(null);

	useEffect(() => {
		const t = setTimeout(() => setDebouncedQ(q.trim()), 250);
		return () => clearTimeout(t);
	}, [q]);

	useEffect(() => {
		let cancelled = false;
		const load = async () => {
			setListLoading(true);
			setListError(null);
			try {
				const params = new URLSearchParams();
				if (debouncedQ) params.set("q", debouncedQ);
				params.set("page", String(page));
				params.set("perPage", String(30));

				const res = await fetch(`/api/admin/chat/conversations?${params.toString()}`, {
					credentials: "include",
				});
				const json = (await res.json().catch(() => ({}))) as Partial<AdminConversationsResponse> & {
					message?: string;
				};
				if (!res.ok) {
					throw new Error(json.message ?? (res.status === 401 ? "Unauthorized" : res.status === 403 ? "Forbidden" : "Gagal memuat data"));
				}
				if (!cancelled) {
					setList(json as AdminConversationsResponse);
					setListError(null);
				}
			} catch (e) {
				if (!cancelled) setListError(e instanceof Error ? e.message : "Terjadi kesalahan");
			} finally {
				if (!cancelled) setListLoading(false);
			}
		};
		load();
		return () => {
			cancelled = true;
		};
	}, [debouncedQ, page]);

	useEffect(() => {
		if (!list?.items?.length) return;
		// Auto select the first conversation when nothing is selected.
		if (!activeId) setActiveId(list.items[0].id);
	}, [list, activeId]);

	useEffect(() => {
		if (!activeId) return;
		let cancelled = false;
		const load = async () => {
			setDetailLoading(true);
			setDetailError(null);
			try {
				const res = await fetch(`/api/admin/chat/conversations/${encodeURIComponent(activeId)}/messages`, {
					credentials: "include",
				});
				const json = (await res.json().catch(() => ({}))) as {
					conversation?: ConversationDetail;
					messages?: Message[];
					message?: string;
				};
				if (!res.ok) {
					throw new Error(json.message ?? "Gagal memuat isi chat");
				}
				if (!cancelled) {
					setDetail(json.conversation ?? null);
					setMessages(json.messages ?? []);
				}
			} catch (e) {
				if (!cancelled) setDetailError(e instanceof Error ? e.message : "Terjadi kesalahan");
			} finally {
				if (!cancelled) setDetailLoading(false);
			}
		};
		load();
		return () => {
			cancelled = true;
		};
	}, [activeId]);

	const totalPages = useMemo(() => {
		if (!list) return 1;
		return Math.max(1, Math.ceil(list.total / list.perPage));
	}, [list]);

	const activeConversationPreview = useMemo(() => {
		if (!list || !activeId) return null;
		return list.items.find((c) => c.id === activeId) ?? null;
	}, [list, activeId]);

	return (
		<div className={styles.page}>
            {/* Sidebar */}
            <aside className={styles.sidebar}>
                <div className={styles.brand}>
                <span className={styles.brandIcon}>🏠</span>
                <span className={styles.brandName}>PAPAN Admin</span>
                </div>

                <nav className={styles.nav}>
                <button className={styles.navItem} onClick={() => router.push('/admin/kyc')}>
					<span>📋</span> Verifikasi KYC
                </button>
                <button className={styles.navItem} onClick={() => router.push('/admin/notifications')}>
					<span>🔔</span> Kirim Notifikasi
                </button>
				<button className={`${styles.navItem} ${styles.navItemActive}`}>
					<span>💬</span> Monitoring Chat
                </button>
				<button className={styles.navItem} onClick={() => router.push('/admin/reviews')}>
				  <span>⭐</span> Moderasi Review
				</button>
                </nav>

                <button className={styles.sidebarLogout} onClick={() => signOut({ callbackUrl: '/login' })}>
                Log Out
                </button>
            </aside>

			<main className={styles.main}>
			<div className={styles.header}>
				<div>
					<h1 className={styles.title}>Monitoring Chat</h1>
					<p className={styles.subtitle}>Admin hanya bisa melihat (read-only).</p>
				</div>

				<div className={styles.searchWrap}>
					<input
						value={q}
						onChange={(e) => {
							setQ(e.target.value);
							setPage(1);
							setActiveId(null);
						}}
						placeholder="Cari: judul properti / owner / pencari…"
						className={styles.searchInput}
					/>
				</div>
			</div>

			<div className={styles.grid}>
				{/* Left: conversation list */}
				<div className={styles.leftPanel}>
					<div className={styles.panelHeader}>
						<span className={styles.panelTitle}>Room Chat</span>
						<span className={styles.panelMeta}>{list ? `${list.total} room` : ""}</span>
					</div>

					{listLoading ? (
						<div className={styles.stateBox}>Memuat daftar chat…</div>
					) : listError ? (
						<div className={styles.stateBoxError}>{listError}</div>
					) : !list?.items?.length ? (
						<div className={styles.stateBox}>Belum ada room chat.</div>
					) : (
						<div className={styles.list}>
							{list.items.map((c) => {
								const last = c.messages[0];
								const isActive = c.id === activeId;
								return (
									<button
										key={c.id}
										type="button"
										className={`${styles.listItem} ${isActive ? styles.listItemActive : ""}`}
										onClick={() => setActiveId(c.id)}
										title={c.property.title}
									>
										<div className={styles.listTopRow}>
											<span className={styles.propertyTitle}>{c.property.title}</span>
											<span className={styles.updatedAt}>{formatDateTime(c.updatedAt)}</span>
										</div>
										<div className={styles.participants}>
											<span className={styles.badgeOwner}>Owner: {displayName(c.owner)}</span>
											<span className={styles.badgeUser}>Pencari: {displayName(c.user)}</span>
										</div>
										<div className={styles.previewRow}>
											<span className={styles.previewText}>
												{last ? `${displayName(last.sender)}: ${last.content}` : "(belum ada pesan)"}
											</span>
											<span className={styles.count}>{c._count.messages}</span>
										</div>
									</button>
								);
							})}
						</div>
					)}

					<div className={styles.pagination}>
						<button
							type="button"
							className={styles.pageBtn}
							onClick={() => setPage((p) => Math.max(1, p - 1))}
							disabled={page <= 1 || listLoading}
						>
							Prev
						</button>
						<span className={styles.pageInfo}>
							{list ? `Page ${page} / ${totalPages}` : ""}
						</span>
						<button
							type="button"
							className={styles.pageBtn}
							onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
							disabled={page >= totalPages || listLoading}
						>
							Next
						</button>
					</div>
				</div>

				{/* Right: messages */}
				<div className={styles.rightPanel}>
					{!activeId ? (
						<div className={styles.stateBox}>Pilih room chat untuk melihat isi pesan.</div>
					) : detailLoading ? (
						<div className={styles.stateBox}>Memuat isi chat…</div>
					) : detailError ? (
						<div className={styles.stateBoxError}>{detailError}</div>
					) : !detail ? (
						<div className={styles.stateBox}>Room chat tidak ditemukan.</div>
					) : (
						<>
							<div className={styles.chatHeader}>
								<div className={styles.chatHeaderMain}>
									<div className={styles.chatTitle}>{detail.property.title}</div>
									<div className={styles.chatMeta}>
										<span>Owner: {displayName(detail.owner)}</span>
										<span>•</span>
										<span>Pencari: {displayName(detail.user)}</span>
										<span>•</span>
										<span>Update: {formatDateTime(detail.updatedAt)}</span>
									</div>
								</div>
								<div className={styles.chatHeaderAside}>
									<div className={styles.readOnlyPill}>Read-only</div>
								</div>
							</div>

							<div className={styles.messages}>
								{messages.length === 0 ? (
									<div className={styles.emptyMessages}>(Belum ada pesan)</div>
								) : (
									messages.map((m) => {
										const isOwner = m.sender.id === detail.owner.id;
										const sideClass = isOwner ? styles.msgOwner : styles.msgUser;
										return (
											<div key={m.id} className={`${styles.msgRow} ${sideClass}`}>
												<div className={styles.msgBubble}>
													<div className={styles.msgTop}>
														<span className={styles.msgSender}>{displayName(m.sender)}</span>
														<span className={styles.msgTime}>{formatDateTime(m.createdAt)}</span>
													</div>
													<div className={styles.msgContent}>{m.content}</div>
												</div>
											</div>
										);
									})
								)}
							</div>

							<div className={styles.footerNote}>
								Admin tidak dapat mengirim / menghapus pesan dari halaman ini.
							</div>
						</>
					)}
				</div>
			</div>

			{/* Small helper when the selected item disappears after filtering */}
			{activeId && list && !activeConversationPreview ? (
				<div className={styles.toastLike}>Room yang dipilih tidak ada di hasil pencarian.</div>
			) : null}
			</main>
		</div>
	);
}

