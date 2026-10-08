  import { NextResponse } from 'next/server';
  import { prisma } from '@/lib/prisma';

  type RouteContext = {
    params: Promise<{ id: string }>;
  };

  export async function GET(_request: Request, { params }: RouteContext) {
    const { id } = await params;

    const property = await prisma.property.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            username: true,
            image: true,
          },
        },
        facilities: {
          include: {
            facility: {
              select: {
                code: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!property) {
      return NextResponse.json({ message: 'Properti tidak ditemukan.' }, { status: 404 });
    }

    const now = new Date();
    const isDiscountActive =
      typeof property.discountPercentage === 'number' &&
      property.discountPercentage > 0 &&
      (property.discountActiveUntil === null ||
        (property.discountActiveUntil && property.discountActiveUntil > now));

    return NextResponse.json({
      message: 'Properti berhasil diambil.',
      data: {
        ...property,
        price: property.price.toString(),
        lat: property.latitude,
        lng: property.longitude,
        discountPercentage: property.discountPercentage ?? null,
        discountActiveUntil: property.discountActiveUntil
          ? property.discountActiveUntil.toISOString()
          : null,
        isDiscountActive: Boolean(isDiscountActive),
        facilities: property.facilities.map((entry) => ({
          code: entry.facility.code,
          name: entry.facility.name,
        })),
      },
    });
  }
