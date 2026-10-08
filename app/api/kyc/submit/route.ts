// app/api/kyc/submit/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, invalidateRoleCache } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { kycSubmission: true },
    });

    if (!user) {
      return NextResponse.json({ message: 'User tidak ditemukan.' }, { status: 404 });
    }

    // Jika sudah APPROVED, tidak perlu submit lagi
    if (user.kycStatus === 'APPROVED') {
      return NextResponse.json({ message: 'Akun sudah terverifikasi.' }, { status: 400 });
    }

    // Jika sedang PENDING, tidak bisa submit lagi
    if (user.kycStatus === 'PENDING') {
      return NextResponse.json({ message: 'Pengajuan sedang ditinjau.' }, { status: 400 });
    }

    const body = await req.json();
    const {
      nik, fullName, phoneNumber,
      province, cityOrRegency, district,
      rt, rw, postalCode,
      ktpImageUrl, selfieImageUrl,
    } = body;

    // Validasi field wajib
    if (!nik || !fullName || !phoneNumber || !province || !cityOrRegency ||
        !district || !rt || !rw || !postalCode || !ktpImageUrl || !selfieImageUrl) {
      return NextResponse.json({ message: 'Semua field wajib diisi.' }, { status: 400 });
    }

    // Upsert KycSubmission (buat baru atau update jika REJECTED)
    await prisma.$transaction([
      prisma.kycSubmission.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          nik, fullName, phoneNumber,
          province, cityOrRegency, district,
          rt, rw, postalCode,
          ktpImageUrl, selfieImageUrl,
          status: 'PENDING',
        },
        update: {
          nik, fullName, phoneNumber,
          province, cityOrRegency, district,
          rt, rw, postalCode,
          ktpImageUrl, selfieImageUrl,
          status: 'PENDING',
          adminNotes: null,
          reviewedBy: null,
          reviewedAt: null,
        },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: { kycStatus: 'PENDING' },
      }),
    ]);
    invalidateRoleCache(user.id);

    return NextResponse.json({ message: 'Pengajuan berhasil dikirim.' });
  } catch (error) {
    console.error('POST /api/kyc/submit error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}