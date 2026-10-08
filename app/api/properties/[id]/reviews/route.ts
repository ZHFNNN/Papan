import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/require-user';
import { MAX_REVIEW_PHOTOS, isReviewPhotoUrl } from '@/lib/review-photos';

type RouteContext = {
  params: Promise<{ id: string }>;
};

// Foto harus URL hasil POST /api/uploads/review (bukan base64 / URL sembarang)
const createReviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().optional(),
  photos: z
    .array(
      z.string().refine((url) => isReviewPhotoUrl(url, process.env.CLOUDINARY_CLOUD_NAME), {
        message: 'Foto ulasan tidak valid. Unggah ulang foto.',
      }),
    )
    .max(MAX_REVIEW_PHOTOS)
    .optional(),
});

// GET /api/properties/:id/reviews
export async function GET(_request: Request, { params }: RouteContext) {
  const { id: propertyId } = await params;

  const reviews = await prisma.review.findMany({
    where: { propertyId },
    orderBy: { createdAt: 'desc' },
  });

  const reviewIds = reviews.map((review) => review.id);
  const userIds = Array.from(new Set(reviews.map((review) => review.userId)));
  const prismaAny = prisma as unknown as {
    reviewReply: {
      findMany: (args: unknown) => Promise<Array<{
        id: string;
        reviewId: string;
        ownerId: string;
        comment: string;
        createdAt: Date;
      }>>;
    };
  };

  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, username: true, image: true },
      })
    : [];

  const userMap = new Map(users.map((user) => [user.id, user]));

  const replies = reviewIds.length
    ? await prismaAny.reviewReply.findMany({
        where: { reviewId: { in: reviewIds } },
        orderBy: { createdAt: 'asc' },
      })
    : [];

  const replyOwnerIds = Array.from(new Set(replies.map((reply) => reply.ownerId)));
  const replyOwners = replyOwnerIds.length
    ? await prisma.user.findMany({
        where: { id: { in: replyOwnerIds } },
        select: { id: true, name: true, username: true, image: true },
      })
    : [];

  const ownerMap = new Map(replyOwners.map((owner) => [owner.id, owner]));
  const repliesByReview = new Map<string, typeof replies>();
  replies.forEach((reply) => {
    const list = repliesByReview.get(reply.reviewId) ?? [];
    list.push(reply);
    repliesByReview.set(reply.reviewId, list);
  });

  const totalReviews = reviews.length;
  const avgRating = totalReviews
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
    : 0;

  return Response.json({
    message: 'Review berhasil diambil.',
    data: {
      totalReviews,
      avgRating: Math.round(avgRating * 10) / 10,
      reviews: reviews.map((review) => ({
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt.toISOString(),
        photos: (review.imageUrls ?? []).map((data, idx) => ({
          id: `${review.id}-${idx}`,
          data,
        })),
        replies: (repliesByReview.get(review.id) ?? []).map((reply) => ({
          id: reply.id,
          comment: reply.comment,
          createdAt: reply.createdAt.toISOString(),
          owner: ownerMap.get(reply.ownerId) ?? { id: reply.ownerId, name: null, username: null, image: null },
        })),
        user: userMap.get(review.userId) ?? { id: review.userId, name: null, username: null, image: null },
      })),
    },
  });
}

// POST /api/properties/:id/reviews
export async function POST(request: Request, { params }: RouteContext) {
  try {
    const auth = await requireAuth();
    if ('error' in auth) return auth.error;

    const userId = auth.session.user.id;
    const { id: propertyId } = await params;

    const body = await request.json().catch(() => ({}));
    const parsed = createReviewSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { message: 'Payload tidak valid.', errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { rating, comment, photos = [] } = parsed.data;

    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { ownerId: true },
    });

    if (!property) {
      return Response.json({ message: 'Properti tidak ditemukan.' }, { status: 404 });
    }

    if (property.ownerId === userId) {
      return Response.json(
        { message: 'Owner tidak bisa memberi review pada propertinya sendiri.' },
        { status: 403 }
      );
    }

    const existingReview = await prisma.review.findUnique({
      where: { userId_propertyId: { userId, propertyId } },
    });

    if (existingReview) {
      return Response.json(
        { message: 'Kamu sudah pernah memberikan ulasan untuk properti ini.' },
        { status: 409 }
      );
    }

    const newReview = await prisma.review.create({
      data: {
        rating,
        comment: comment || null,
        userId,
        propertyId,
        imageUrls: photos,
      },
    });

    return Response.json({ message: 'Review berhasil disimpan.', data: newReview }, { status: 201 });
  } catch (error: unknown) {
    console.error('Error creating review:', error);
    return Response.json({ message: 'Terjadi kesalahan saat menyimpan review.' }, { status: 500 });
  }
}