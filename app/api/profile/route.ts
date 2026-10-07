// app/api/profile/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth'; // sesuaikan path auth config kamu
import { prisma } from '@/lib/prisma';

// GET /api/profile — ambil data user yang sedang login
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        image: true,
        phoneNumber: true,
        role: true,
        kycStatus: true,
        createdAt: true,
        _count: {
          select: {
            properties: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('GET /api/profile error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/profile — update data user yang sedang login
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { name, username, phoneNumber, image } = body;

    // Validasi minimal
    if (!name || !username || !phoneNumber) {
      return NextResponse.json(
        { message: 'Name, username, dan phoneNumber wajib diisi.' },
        { status: 400 }
      );
    }

    // Cek username sudah dipakai user lain
    const existingUsername = await prisma.user.findFirst({
      where: {
        username,
        NOT: { email: session.user.email },
      },
    });

    if (existingUsername) {
      return NextResponse.json(
        { message: 'Username sudah digunakan.' },
        { status: 409 }
      );
    }

    // Cek phone sudah dipakai user lain
    const existingPhone = await prisma.user.findFirst({
      where: {
        phoneNumber,
        NOT: { email: session.user.email },
      },
    });

    if (existingPhone) {
      return NextResponse.json(
        { message: 'Nomor handphone sudah digunakan.' },
        { status: 409 }
      );
    }

    const imageValue = typeof image === 'string' && image.trim().length > 0 ? image.trim() : null;

    const updatedUser = await prisma.user.update({
      where: { email: session.user.email },
      data: { name, username, phoneNumber, image: imageValue },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        image: true,
        phoneNumber: true,
        role: true,
        kycStatus: true,
        _count: {
          select: {
            properties: true,
          },
        },
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error('PATCH /api/profile error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}