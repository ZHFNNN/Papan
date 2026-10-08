import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/require-user";
import { personalizationBooleanCodes } from "@/lib/dss/facility-mapping";
import { normalizeGenderScore, resolveCriteriaWeights, scoreProperty } from "@/lib/dss/scoring";

export async function GET() {
  const auth = await requireAuth();
  if ("error" in auth) {
    return auth.error;
  }

  const userId = auth.session.user.id;
  const now = new Date();

  const [personalization, preferenceFacilities, criteriaWeightRows] = await Promise.all([
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
    prisma.userCriteriaWeight.findMany({
      where: { userId },
      select: {
        criteria: true,
        weight: true,
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
      discountPercentage: true,
      discountActiveUntil: true,
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
  const { weights, source: weightsSource } = resolveCriteriaWeights(criteriaWeightRows);

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
    const propertyFacilityCodes = property.facilities.map((item) => item.facility.code);

    const result = scoreProperty(
      {
        price: priceNumber,
        discountPercentage: property.discountPercentage,
        discountActiveUntil: property.discountActiveUntil,
        searchText: text,
        facilityCodes: propertyFacilityCodes,
      },
      {
        budgetMin: personalization.budgetMin,
        budgetMax: personalization.budgetMax,
        location: personalization.location,
        facilityCodes: selectedFacilityCodes,
      },
      weights,
      now,
    );

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
      score: Number(result.score.toFixed(4)),
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
        budgetScore: Number(result.budgetScore.toFixed(4)),
        locationScore: Number(result.locationScore.toFixed(4)),
        facilityScore: Number(result.facilityScore.toFixed(4)),
        genderScore: Number(genderScore.toFixed(4)),
        matchedFacilityCodes: result.matchedFacilityCodes,
        selectedFacilityCodes,
        propertyFacilityCodes,
        effectivePrice: result.effectivePrice,
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

    return a.breakdown.effectivePrice - b.breakdown.effectivePrice;
  });

  return Response.json({
    message: "Rekomendasi berhasil dihitung.",
    data: scored.slice(0, 20),
    meta: {
      algorithm: "SAW-like weighted scoring (per-user criteria weights, discount-aware budget)",
      weights,
      weightsSource,
      totalCandidates: properties.length,
      selectedFacilitySource: relationalPreferredCodes.length > 0 ? "user_preference_facility" : "user_personalization_booleans",
      boosterRule: "Active booster always first, then by DSS score",
    },
  });
}
