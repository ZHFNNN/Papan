import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { invalidatePropertyListCache } from '@/lib/property-list-cache';
import { getBoostEndsAt } from '@/lib/booster';
import { getMidtransSignatureKey } from '@/lib/midtrans';

type MidtransWebhookBody = {
  order_id?: string;
  transaction_status?: string;
  payment_type?: string;
  transaction_id?: string;
  status_code?: string;
  gross_amount?: string;
  fraud_status?: string;
  settlement_time?: string;
  expiry_time?: string;
  signature_key?: string;
};

function getPaymentStatus(transactionStatus?: string, fraudStatus?: string) {
  switch (transactionStatus) {
    case 'settlement':
      return 'PAID' as const;
    case 'capture':
      return fraudStatus === 'challenge' ? ('PROCESSING' as const) : ('PAID' as const);
    case 'pending':
      return 'PENDING' as const;
    case 'expire':
      return 'EXPIRED' as const;
    case 'cancel':
      return 'CANCELLED' as const;
    case 'deny':
    case 'failure':
      return 'FAILED' as const;
    default:
      return 'PROCESSING' as const;
  }
}

export async function POST(req: Request) {
  const payload = (await req.json().catch(() => null)) as MidtransWebhookBody | null;
  if (!payload?.order_id || !payload?.status_code || !payload?.gross_amount) {
    return NextResponse.json({ message: 'Payload webhook tidak valid.' }, { status: 400 });
  }

  if (!payload.signature_key) {
    return NextResponse.json({ message: 'Signature webhook tidak valid.' }, { status: 401 });
  }

  const expectedSignature = getMidtransSignatureKey({
    orderId: payload.order_id,
    statusCode: payload.status_code,
    grossAmount: payload.gross_amount,
  });

  if (payload.signature_key !== expectedSignature) {
    return NextResponse.json({ message: 'Signature webhook tidak valid.' }, { status: 401 });
  }

  const payment = await prisma.boostPayment.findUnique({
    where: { orderId: payload.order_id },
    include: {
      items: true,
      boosts: true,
    },
  });

  if (!payment) {
    return NextResponse.json({ message: 'Transaksi tidak ditemukan.' }, { status: 404 });
  }

  const grossAmount = Number(payload.gross_amount);
  if (Number.isNaN(grossAmount) || grossAmount !== payment.grossAmount) {
    return NextResponse.json({ message: 'Gross amount tidak cocok.' }, { status: 400 });
  }

  const nextStatus = getPaymentStatus(payload.transaction_status, payload.fraud_status);
  const settledAt = payload.settlement_time ? new Date(payload.settlement_time) : new Date();

  if (nextStatus !== 'PAID') {
    await prisma.boostPayment.update({
      where: { id: payment.id },
      data: {
        status: nextStatus,
        paymentMethod: payload.payment_type ?? payment.paymentMethod,
        paymentType: payload.payment_type ?? payment.paymentType,
        providerTransactionId: payload.transaction_id ?? payment.providerTransactionId,
        expiredAt: payload.expiry_time ? new Date(payload.expiry_time) : payment.expiredAt,
        rawResponse: payload,
      },
    });

    return NextResponse.json({ success: true });
  }

  if (payment.boosts.length > 0) {
    await prisma.boostPayment.update({
      where: { id: payment.id },
      data: {
        status: 'PAID',
        paymentMethod: payload.payment_type ?? payment.paymentMethod,
        paymentType: payload.payment_type ?? payment.paymentType,
        providerTransactionId: payload.transaction_id ?? payment.providerTransactionId,
        settledAt,
        rawResponse: payload,
      },
    });

    return NextResponse.json({ success: true });
  }

  const propertyIds = [...new Set(payment.items.map((item) => item.propertyId))];
  const properties = await prisma.property.findMany({
    where: { id: { in: propertyIds } },
    select: {
      id: true,
      boosts: {
        where: {
          startsAt: {
            lte: settledAt,
          },
          endsAt: {
            gt: settledAt,
          },
        },
        orderBy: {
          endsAt: 'desc',
        },
        take: 1,
      },
    },
  });

  const propertyById = new Map(properties.map((property) => [property.id, property]));

  await prisma.$transaction(async (tx) => {
    for (const item of payment.items) {
      const property = propertyById.get(item.propertyId);
      const activeBoost = property?.boosts[0] ?? null;
      const startAt = activeBoost ? activeBoost.endsAt : settledAt;
      const endsAt = getBoostEndsAt(startAt, item.days);

      await tx.propertyBoost.create({
        data: {
          paymentId: payment.id,
          propertyId: item.propertyId,
          ownerId: payment.ownerId,
          packageId: item.packageId,
          packageTitle: item.packageTitle,
          days: item.days,
          price: item.price,
          startsAt: startAt,
          endsAt,
        },
      });
    }

    await tx.boostPayment.update({
      where: { id: payment.id },
      data: {
        status: 'PAID',
        paymentMethod: payload.payment_type ?? payment.paymentMethod,
        paymentType: payload.payment_type ?? payment.paymentType,
        providerTransactionId: payload.transaction_id ?? payment.providerTransactionId,
        settledAt,
        rawResponse: payload,
      },
    });
  });
  // Boost baru aktif -> urutan daftar properti publik berubah
  invalidatePropertyListCache();

  return NextResponse.json({ success: true });
}