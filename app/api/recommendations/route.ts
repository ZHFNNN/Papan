import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/require-user";
import { personalizationBooleanCodes } from "@/lib/dss/facility-mapping";
import {
  FIXED_CRITERIA_WEIGHTS,
  normalizeBudgetScore,
  normalizeFacilityScore,
  normalizeGenderScore,
  normalizeLocationScore,
} from "@/lib/dss/scoring";

export async function GET() {
  const auth = await requireAuth();
  if ("error" in auth) {
    return auth.error;
  }

  const userId = auth.session.user.id;
  const now = new Date();

  const [personalization, preferenceFacilities] = await Promise.all([
    prisma.userPersonalization.findUnique({
      where: { userId },
      select: {
        location: true,
        gender: true,
        budgetMin: true,
        budgetMax: true,
        prefFurnished: true,
        prefUnfurnished: true,
        prefPetFriendly: true,
        prefParkirMobil: true,
        prefAc: true,
        prefWaterHeater: true,
        prefDekatTransportasi: true,
      },
    }),
    prisma.userPreferenceFacility.findMany({
      where: { userId },
      select: {
        isRequired: true,
        facility: {
          select: {
            code: true,
          },
        },
      },
    }),
  ]);

  if (!personalization) {
    return Response.json(
      {
        message: "Personalisasi belum diisi.",
        data: [],
      },
      { status: 200 }
    );
  }

  const properties = await prisma.property.findMany({
    select: {
      id: true,
      title: true,
      category: true,
      genderTarget: true,
      address: true,
      city: true,
      district: true,
      neighbourhood: true,
      imageUrls: true,
      description: true,
      price: true,
      listingType: true,
      createdAt: true,
      facilities: {
        include: {
          facility: {
            select: {
              code: true,
            },
          },
        },
      },
      boosts: {
        where: {
          startsAt: {
            lte: now,
          },
          endsAt: {
            gt: now,
          },
        },
        select: {
          id: true,
          packageId: true,
          packageTitle: true,
          endsAt: true,
        },
        orderBy: {
          endsAt: "desc",
        },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const relationalPreferredCodes = preferenceFacilities.map((pref) => pref.facility.code);
  const fallbackPreferredCodes = personalizationBooleanCodes({
    prefFurnished: personalization.prefFurnished,
    prefUnfurnished: personalization.prefUnfurnished,
    prefPetFriendly: personalization.prefPetFriendly,
    prefParkirMobil: personalization.prefParkirMobil,
    prefAc: personalization.prefAc,
    prefWaterHeater: personalization.prefWaterHeater,
    prefDekatTransportasi: personalization.prefDekatTransportasi,
  });
  const selectedFacilityCodes = relationalPreferredCodes.length > 0 ? relationalPreferredCodes : fallbackPreferredCodes;

  const scoredCandidates = properties.map((property) => {
    const priceNumber = Number(property.price);
    const text = `${property.title} ${property.description ?? ""} ${property.address ?? ""} ${property.neighbourhood ?? ""} ${property.district ?? ""} ${property.city ?? ""}`.toLowerCase();

    // Cek kecocokan gender (khusus KOSAN)
    const genderScore = normalizeGenderScore(
      personalization.gender,
      property.genderTarget,
      property.category,
      `${property.title} ${property.description ?? ""}`
    );

    // Jika kosan dilarang untuk gender pengguna (skor 0), eliminasi dari rekomendasi
    if (genderScore === 0) {
      return null;
    }

    const budgetScore = normalizeBudgetScore(priceNumber, personalization.budgetMin, personalization.budgetMax);
    const locationScore = normalizeLocationScore(personalization.location, text);
    const propertyFacilityCodes = property.facilities.map((item) => item.facility.code);
    const facilityResult = normalizeFacilityScore(selectedFacilityCodes, propertyFacilityCodes);

    const totalScore =
      budgetScore * FIXED_CRITERIA_WEIGHTS.budget +
      locationScore * FIXED_CRITERIA_WEIGHTS.location +
      facilityResult.score * FIXED_CRITERIA_WEIGHTS.facilities;

    const activeBoost = property.boosts[0] ?? null;
    const isBoosted = Boolean(activeBoost);

    return {
      id: property.id,
      title: property.title,
      category: property.category,
      genderTarget: property.genderTarget,
      listingType: property.listingType,
      coverImageUrl: property.imageUrls[0] ?? null,
      images: property.imageUrls,
      address: property.address,           
      neighbourhood: property.neighbourhood, 
      district: property.district,         
      city: property.city,                 
      price: priceNumber,
      score: Number(totalScore.toFixed(4)),
      isBoosted,
      boost: activeBoost
        ? {
            id: activeBoost.id,
            packageId: activeBoost.packageId,
            packageTitle: activeBoost.packageTitle,
            endDate: activeBoost.endsAt.toISOString(),
          }
        : null,
      breakdown: {
        budgetScore: Number(budgetScore.toFixed(4)),
        locationScore: Number(locationScore.toFixed(4)),
        facilityScore: Number(facilityResult.score.toFixed(4)),
        genderScore: Number(genderScore.toFixed(4)),
        matchedFacilityCodes: facilityResult.matched,
        selectedFacilityCodes,
        propertyFacilityCodes,
      },
    };
  });

  const scored = scoredCandidates.filter((item): item is NonNullable<typeof item> => item !== null);

  scored.sort((a, b) => {
    if (a.isBoosted !== b.isBoosted) {
      return a.isBoosted ? -1 : 1;
    }

    if (b.score !== a.score) {
      return b.score - a.score;
    }

    return a.price - b.price;
  });

  return Response.json({
    message: "Rekomendasi berhasil dihitung.",
    data: scored.slice(0, 20),
    meta: {
      algorithm: "SAW-like weighted scoring (fixed balanced weights)",
      weights: FIXED_CRITERIA_WEIGHTS,
      totalCandidates: properties.length,
      selectedFacilitySource: relationalPreferredCodes.length > 0 ? "user_preference_facility" : "user_personalization_booleans",
      boosterRule: "Active booster always first, then by DSS score",
    },
  });
}
