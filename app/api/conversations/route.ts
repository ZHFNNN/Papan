// app/api/conversations/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/conversations
// Ambil semua conversation milik user yang sedang login
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    const conversations = await prisma.conversation.findMany({
      where: {
        OR: [{ userId }, { ownerId: userId }],
      },
      include: {
        property: {
          select: {
            id: true,
            title: true,
            imageUrls: true,
            city: true,
            price: true,
            listingType: true,
          },
        },
        user: {
          select: { id: true, name: true, image: true, username: true },
        },
        owner: {
          select: { id: true, name: true, image: true, username: true },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1, // hanya ambil pesan terakhir sebagai preview
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    // Hitung unread messages untuk masing-masing conversation
    const conversationsWithUnread = await Promise.all(
      conversations.map(async (conv) => {
        const unreadCount = await prisma.message.count({
          where: {
            conversationId: conv.id,
            isRead: false,
            senderId: { not: userId }, // pesan yang bukan dari user ini
          },
        });
        return { ...conv, unreadCount };
      })
    );

    return NextResponse.json(conversationsWithUnread);
  } catch (error) {
    console.error("[GET /api/conversations]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// POST /api/conversations
// Buat conversation baru atau return yang sudah ada
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { propertyId, initialMessage } = await req.json();

    if (!propertyId || !initialMessage?.trim()) {
      return NextResponse.json(
        { error: "propertyId dan initialMessage wajib diisi" },
        { status: 400 }
      );
    }

    // Cek property ada dan ambil ownerId
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true, ownerId: true },
    });

    if (!property) {
      return NextResponse.json({ error: "Property tidak ditemukan" }, { status: 404 });
    }

    if (property.ownerId === session.user.id) {
      return NextResponse.json(
        { error: "Owner tidak bisa chat dengan dirinya sendiri" },
        { status: 400 }
      );
    }

    // Cek apakah conversation sudah ada
    let conversation = await prisma.conversation.findUnique({
      where: {
        propertyId_userId: {
          propertyId,
          userId: session.user.id,
        },
      },
    });

    if (!conversation) {
      // Buat conversation baru beserta pesan pertama
      conversation = await prisma.conversation.create({
        data: {
          propertyId,
          userId: session.user.id,
          ownerId: property.ownerId,
          messages: {
            create: {
              senderId: session.user.id,
              content: initialMessage.trim(),
            },
          },
        },
      });
    } else {
      // Conversation sudah ada, langsung tambah pesan
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderId: session.user.id,
          content: initialMessage.trim(),
        },
      });

      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { updatedAt: new Date() },
      });
    }

    return NextResponse.json(conversation, { status: 201 });
  } catch (error) {
    console.error("[POST /api/conversations]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}