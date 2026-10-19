/**
 * Deterministic, fictional demo inventory. Everything here is pure data so the
 * shape of a seed can be unit-tested without a deployment.
 *
 * Photos are free-license Unsplash images (https://unsplash.com/license),
 * hotlinked from images.unsplash.com. Each ID was checked to resolve.
 */

export const SEED_LISTING_COUNT = 60;
export const SEED_PUBLISHED_COUNT = 52;
export const SEED_DRAFT_COUNT = 6;

export const SEED_PHOTO_HOST = "https://images.unsplash.com/";

type SeedPhoto = { id: string; alt: string };

const exteriors: SeedPhoto[] = [
  { id: "1570129477492-45c003edd2be", alt: "Grey wooden house" },
  {
    id: "1600596542815-ffad4c1539a9",
    alt: "White modern house under blue sky",
  },
  {
    id: "1781797221329-c3d083ab6d99",
    alt: "Modern grey house with a green lawn",
  },
  { id: "1580587771525-78b9dba3b914", alt: "White and brown modern house" },
  { id: "1568605114967-8130f3a36994", alt: "Brown and black wooden house" },
  {
    id: "1777428762767-e3a797da389a",
    alt: "Large house with a manicured garden",
  },
  {
    id: "1628624747186-a941c476b7ef",
    alt: "White and brown house among trees",
  },
  {
    id: "1512917774080-9991f1c4c750",
    alt: "Modern house with a swimming pool",
  },
  {
    id: "1758158452965-ef267a639880",
    alt: "Farmhouse with a wrap-around porch",
  },
  { id: "1605146769289-440113cc3d00", alt: "Grey and white house" },
  {
    id: "1605276374104-dee2a0ed3cd6",
    alt: "Brown and white house under blue sky",
  },
  { id: "1786550860372-116b871a1697", alt: "Single-story white stucco house" },
  { id: "1511452885600-a3d2c9148a31", alt: "White and black modern building" },
];

const interiors: SeedPhoto[] = [
  {
    id: "1616046229478-9901c5536a45",
    alt: "Living room with white and brown seating",
  },
  { id: "1600210491892-03d54c0aaf87", alt: "Bright modern living area" },
  {
    id: "1583847268964-b28dc8f51f92",
    alt: "Living room with a tan leather sectional",
  },
  { id: "1781794902242-f8578908d640", alt: "Living room with large windows" },
  { id: "1615529182904-14819c35db37", alt: "Living room with a fireplace" },
  { id: "1554995207-c18c203602cb", alt: "Open-plan living and dining room" },
  {
    id: "1586023492125-27b2c045efd7",
    alt: "Living room with a sofa and plants",
  },
  {
    id: "1615873968403-89e068629265",
    alt: "Living room with patterned pillows",
  },
  {
    id: "1770736158887-9a0f3702416e",
    alt: "Spacious living room with rustic decor",
  },
  { id: "1618221195710-dd6b41faaea6", alt: "Living room with a grey sofa" },
  {
    id: "1649083048337-4aeb6dda80bb",
    alt: "Dining and living area with large windows",
  },
  {
    id: "1773578978637-c9771e7a9913",
    alt: "Living room with a fireplace and forest view",
  },
  {
    id: "1649083048770-82e8ffd80431",
    alt: "Modern living room with a fireplace",
  },
  {
    id: "1616047006789-b7af5afb8c20",
    alt: "Dining table and grey sofa in an open-plan room",
  },
  {
    id: "1616137422495-1e9e46e2aa77",
    alt: "Living room with a wooden dining table",
  },
  {
    id: "1774199496664-a9690967be5a",
    alt: "Cozy living room with a sectional sofa",
  },
  {
    id: "1762545078318-8443881c2d83",
    alt: "Living room with a couch and armchair",
  },
  {
    id: "1593696140826-c58b021acf8b",
    alt: "Living room with a grey sofa and rug",
  },
  {
    id: "1616486338812-3dadae4b4ace",
    alt: "Living room with a tan leather sofa",
  },
  {
    id: "1618220179428-22790b461013",
    alt: "Living room with a large green plant",
  },
];

const bedrooms: SeedPhoto[] = [
  {
    id: "1615874959474-d609969a20ed",
    alt: "Bedroom with grey and white linen",
  },
  {
    id: "1616594039964-ae9021a400a0",
    alt: "Bedroom with a chandelier and city view",
  },
  {
    id: "1757417983938-2c2a931d41aa",
    alt: "Cozy bedroom with a neatly made bed",
  },
  { id: "1522771739844-6a9f6d5f14af", alt: "Bedside table with a lamp" },
  {
    id: "1560185893-a55cbc8c57e8",
    alt: "Bedroom with dark grey walls and a floral rug",
  },
  {
    id: "1505693416388-ac5ce068fe85",
    alt: "Bed with a tufted headboard and cream bench",
  },
  { id: "1781572725438-ac8c41476752", alt: "Bedroom with a garden view" },
  { id: "1784318519037-7ee0b1668e95", alt: "Bedroom with a warm brown wall" },
  {
    id: "1540518614846-7eded433c457",
    alt: "Bedroom with orange pillows and velvet ottomans",
  },
  { id: "1766245456897-5c86726d084d", alt: "Bedroom with neutral bedding" },
  {
    id: "1618221118493-9cfa1a1c00da",
    alt: "Bedroom with blue walls and a woven pendant light",
  },
  { id: "1758060215425-303300b1c7e2", alt: "Bright bedroom with a desk" },
  {
    id: "1616486029423-aaa4789e8c9a",
    alt: "Sunlit bedroom with a leather bench",
  },
  {
    id: "1536349788264-1b816db3cc13",
    alt: "Bed with striped bedding in slatted light",
  },
  {
    id: "1566665797739-1674de7a421a",
    alt: "Bedroom with a blue upholstered headboard",
  },
];

const cabins: SeedPhoto[] = [
  { id: "1449158743715-0a90ebb6d2d8", alt: "Wooden cabin in a forest" },
  { id: "1570793005386-840846445fed", alt: "Wooden cabin among trees" },
  {
    id: "1772454697149-4ead43f7a218",
    alt: "Small wooden cabin on a grassy hill",
  },
  { id: "1631630259742-c0f0b17c6c10", alt: "Cabin room with a wood stove" },
  { id: "1542718610-a1d656d1884c", alt: "Dark cabin among trees" },
  { id: "1470770841072-f978cf4d019e", alt: "House beside a mountain lake" },
  { id: "1772955543023-a6e99819e161", alt: "Log cabin in a foggy forest" },
  { id: "1575403071235-5dcd06cbf169", alt: "Wooden cabin surrounded by trees" },
  {
    id: "1761782791727-3994283faa88",
    alt: "A-frame living room with a forest view",
  },
  { id: "1475087542963-13ab5e611954", alt: "Wooden house below mountains" },
  { id: "1504643039591-52948e3ddb47", alt: "Path to a wooden house" },
  { id: "1525113990976-399835c43838", alt: "A-frame cabin among trees" },
  {
    id: "1610048899906-d8f64bc45464",
    alt: "Wooden house on a lake near mountains",
  },
];

export const seedPhotoLibrary = { exteriors, interiors, bedrooms, cabins };

export function unsplashPhotoUrl(id: string) {
  return `${SEED_PHOTO_HOST}photo-${id}?auto=format&fit=crop&w=1600&q=80`;
}

/** Only seeded photos may use external links, and only from Unsplash. */
export function isAllowedExternalPhotoUrl(url: string) {
  return url.startsWith(`${SEED_PHOTO_HOST}photo-`);
}

/** Keep in step with lib/search/seeded-destinations.ts so map fallbacks find stays. */
export const seedCities = [
  {
    city: "Lisbon",
    region: "Lisbon District",
    countryCode: "PT",
    timezone: "Europe/Lisbon",
    latitude: 38.7223,
    longitude: -9.1393,
    neighbourhoods: ["Alfama", "Príncipe Real", "Belém", "Cais do Sodré"],
    categories: ["Design stays", "City stays", "Beachfront"],
  },
  {
    city: "Kyoto",
    region: "Kyoto Prefecture",
    countryCode: "JP",
    timezone: "Asia/Tokyo",
    latitude: 35.0116,
    longitude: 135.7681,
    neighbourhoods: ["Gion", "Higashiyama", "Arashiyama", "Nakagyo"],
    categories: ["Design stays", "City stays", "Tiny homes"],
  },
  {
    city: "Austin",
    region: "Texas",
    countryCode: "US",
    timezone: "America/Chicago",
    latitude: 30.2672,
    longitude: -97.7431,
    neighbourhoods: ["Travis Heights", "East Austin", "Zilker", "Hill Country"],
    categories: ["Countryside", "Tiny homes", "City stays"],
  },
  {
    city: "Reykjavik",
    region: "Capital Region",
    countryCode: "IS",
    timezone: "Atlantic/Reykjavik",
    latitude: 64.1466,
    longitude: -21.9426,
    neighbourhoods: ["Vesturbær", "Þingholt", "Laugardalur", "Grótta"],
    categories: ["Cabins", "Countryside", "Design stays"],
  },
  {
    city: "Melbourne",
    region: "Victoria",
    countryCode: "AU",
    timezone: "Australia/Melbourne",
    latitude: -37.8136,
    longitude: 144.9631,
    neighbourhoods: ["Fitzroy", "St Kilda", "Brighton", "Carlton"],
    categories: ["Beachfront", "City stays", "Design stays"],
  },
] as const;

export const seedHosts = [
  "Marta Silva",
  "Kenji Mori",
  "Dana Whitfield",
  "Sigrún Jónsdóttir",
  "Liam O'Connell",
  "Priya Raman",
] as const;

export const seedGuests = [
  "Ava Thompson",
  "Noah Becker",
  "Sofia Rossi",
  "Mateo García",
  "Hana Kim",
  "Oliver Novak",
  "Chloé Martin",
  "Ethan Brooks",
  "Zara Ahmed",
  "Lucas Ferreira",
] as const;

type Category =
  | "Design stays"
  | "City stays"
  | "Beachfront"
  | "Tiny homes"
  | "Countryside"
  | "Cabins";
type PropertyType = "entire_home" | "private_room" | "shared_room";

const categoryProfiles: Record<
  Category,
  {
    nouns: readonly string[];
    adjectives: readonly string[];
    priceRange: readonly [number, number];
    amenities: readonly string[];
    types: readonly PropertyType[];
  }
> = {
  "Design stays": {
    nouns: ["loft", "townhouse", "studio", "residence"],
    adjectives: ["Sunlit", "Architect's", "Minimalist", "Gallery"],
    priceRange: [160, 340],
    amenities: ["Wifi", "Kitchen", "Workspace", "Air conditioning", "Washer"],
    types: ["entire_home", "entire_home", "private_room"],
  },
  "City stays": {
    nouns: ["apartment", "flat", "studio", "room"],
    adjectives: ["Central", "Quiet", "Rooftop", "Corner"],
    priceRange: [70, 190],
    amenities: ["Wifi", "Kitchen", "Workspace", "Washer"],
    types: ["entire_home", "private_room", "shared_room"],
  },
  Beachfront: {
    nouns: ["beach house", "villa", "bungalow", "cottage"],
    adjectives: ["Oceanview", "Salt-air", "Dune", "Tidewater"],
    priceRange: [190, 420],
    amenities: ["Wifi", "Kitchen", "Pool", "Free parking", "Air conditioning"],
    types: ["entire_home", "entire_home", "private_room"],
  },
  "Tiny homes": {
    nouns: ["tiny house", "cabin pod", "micro-home", "garden studio"],
    adjectives: ["Cozy", "Clever", "Hidden", "Little"],
    priceRange: [60, 140],
    amenities: ["Wifi", "Kitchen", "Free parking"],
    types: ["entire_home", "private_room"],
  },
  Countryside: {
    nouns: ["farmhouse", "cottage", "ranch house", "barn conversion"],
    adjectives: ["Rolling", "Meadow", "Orchard", "Stone"],
    priceRange: [110, 260],
    amenities: ["Wifi", "Kitchen", "Free parking", "Washer", "Hot tub"],
    types: ["entire_home", "entire_home", "private_room"],
  },
  Cabins: {
    nouns: ["cabin", "A-frame", "lodge", "hut"],
    adjectives: ["Fjord", "Northern lights", "Lava-field", "Birchwood"],
    priceRange: [140, 300],
    amenities: ["Wifi", "Kitchen", "Hot tub", "Free parking"],
    types: ["entire_home", "entire_home", "private_room"],
  },
};

const rules = [
  ["No smoking", "No parties or events"],
  ["No smoking", "Quiet hours after 22:00"],
  ["No parties or events", "Pets allowed on request"],
  ["No smoking", "No parties or events", "Shoes off indoors"],
] as const;

/** Small deterministic PRNG so every seed produces the same inventory. */
function createRandom(seed: number) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
  return {
    next,
    int: (min: number, max: number) =>
      min + Math.floor(next() * (max - min + 1)),
    pick: <T>(items: readonly T[]) => items[Math.floor(next() * items.length)],
  };
}

export type SeedListingSpec = {
  index: number;
  hostIndex: number;
  status: "published" | "draft" | "archived";
  title: string;
  description: string;
  propertyType: PropertyType;
  category: Category;
  maxGuests: number;
  bedrooms: number;
  beds: number;
  bathrooms: number;
  amenities: string[];
  rules: string[];
  cityIndex: number;
  latitude: number;
  longitude: number;
  nightlyPriceCents: number;
  cleaningFeeCents: number;
  bookingMode: "instant" | "request";
  photos: Array<{ url: string; alt: string }>;
};

function rotate<T>(items: readonly T[], start: number, count: number) {
  return Array.from(
    { length: count },
    (_, offset) => items[(start + offset) % items.length],
  );
}

export function buildSeedListings(): SeedListingSpec[] {
  const random = createRandom(20_261_019);
  return Array.from({ length: SEED_LISTING_COUNT }, (_, index) => {
    const cityIndex = index % seedCities.length;
    const city = seedCities[cityIndex];
    const category = city.categories[
      Math.floor(index / seedCities.length) % city.categories.length
    ] as Category;
    const profile = categoryProfiles[category];
    const propertyType = random.pick(profile.types);
    const bedroomsCount =
      propertyType === "entire_home"
        ? random.int(1, category === "Tiny homes" ? 1 : 4)
        : 1;
    const maxGuests =
      propertyType === "shared_room"
        ? random.int(1, 2)
        : propertyType === "private_room"
          ? 2
          : Math.min(16, bedroomsCount * 2 + random.int(0, 2));
    const [minPrice, maxPrice] = profile.priceRange;
    const roomDiscount =
      propertyType === "entire_home"
        ? 1
        : propertyType === "private_room"
          ? 0.6
          : 0.4;
    const nightlyDollars =
      Math.round((random.int(minPrice, maxPrice) * roomDiscount) / 5) * 5;
    const extraAmenities = random.next() > 0.5 ? ["Washer"] : [];
    const amenities = [
      ...new Set([
        ...profile.amenities.filter(() => random.next() > 0.2),
        "Wifi",
        ...extraAmenities,
      ]),
    ].sort((left, right) => left.localeCompare(right));
    const status: SeedListingSpec["status"] =
      index < SEED_PUBLISHED_COUNT
        ? "published"
        : index < SEED_PUBLISHED_COUNT + SEED_DRAFT_COUNT
          ? "draft"
          : "archived";
    const neighbourhood =
      city.neighbourhoods[index % city.neighbourhoods.length];
    const noun = random.pick(profile.nouns);
    const title = `${random.pick(profile.adjectives)} ${noun} in ${neighbourhood}`;

    const cover =
      category === "Cabins"
        ? cabins[index % cabins.length]
        : category === "City stays"
          ? interiors[index % interiors.length]
          : exteriors[index % exteriors.length];
    const photos = [
      cover,
      ...rotate(category === "Cabins" ? cabins : interiors, index * 3 + 1, 2),
      ...rotate(bedrooms, index * 2, Math.max(1, Math.min(bedroomsCount, 2))),
    ].filter(
      (photo, position, all) =>
        all.findIndex((other) => other.id === photo.id) === position,
    );

    return {
      index,
      hostIndex: index % seedHosts.length,
      status,
      title,
      description: `A fictional Checkin demo stay: a ${noun} in ${neighbourhood}, ${city.city}. Bookings and payments here are simulated.`,
      propertyType,
      category,
      maxGuests,
      bedrooms: bedroomsCount,
      beds: Math.max(1, bedroomsCount + random.int(0, 1)),
      bathrooms: Math.max(1, Math.ceil(bedroomsCount / 2)),
      amenities,
      rules: [...rules[index % rules.length]],
      cityIndex,
      latitude: city.latitude + (random.next() - 0.5) * 0.08,
      longitude: city.longitude + (random.next() - 0.5) * 0.1,
      nightlyPriceCents: Math.max(40, nightlyDollars) * 100,
      cleaningFeeCents:
        (propertyType === "entire_home" ? random.int(4, 9) : random.int(1, 3)) *
        500,
      bookingMode: random.next() > 0.4 ? "instant" : "request",
      photos: photos.map((photo) => ({
        url: unsplashPhotoUrl(photo.id),
        alt: photo.alt,
      })),
    };
  });
}

export type SeedStaySpec = {
  listingIndex: number;
  guestIndex: number;
  /** Day offsets from the seed's "today"; check-out is exclusive. */
  checkInOffset: number;
  nights: number;
  guests: number;
  kind: "completed" | "upcoming";
  review?: {
    guestRatings: {
      overall: number;
      cleanliness: number;
      accuracy: number;
      checkIn: number;
      communication: number;
      location: number;
      value: number;
    };
    hostRatings: {
      communication: number;
      cleanliness: number;
      ruleObservance: number;
    };
    guestComment: string;
    hostComment: string;
  };
};

const guestComments = [
  "Exactly as pictured and spotless. We'd stay again.",
  "Great location and a very responsive host.",
  "Comfortable beds and a well-stocked kitchen.",
  "Lovely light in the mornings. A little street noise at night.",
  "Easy check-in and thoughtful touches throughout.",
  "Good value for the area. The photos undersell it.",
] as const;
const hostComments = [
  "Considerate guests who left the place tidy.",
  "Clear communication and followed every house rule.",
  "Welcome back any time.",
] as const;

/**
 * Past completed stays (reviewed by both sides) and a few upcoming confirmed
 * stays for published listings. Stays on one listing never overlap.
 */
export function buildSeedStays(listings: SeedListingSpec[]): SeedStaySpec[] {
  const random = createRandom(7_331);
  const stays: SeedStaySpec[] = [];
  for (const listing of listings) {
    if (listing.status !== "published") continue;
    const pastCount = random.int(0, 4);
    let cursor = -random.int(20, 40);
    for (let stay = 0; stay < pastCount; stay += 1) {
      const nights = random.int(2, 6);
      const checkInOffset = cursor - nights;
      const score = () =>
        Math.min(5, Math.max(3, Math.round(4.6 + (random.next() - 0.4) * 1.4)));
      stays.push({
        listingIndex: listing.index,
        guestIndex: random.int(0, seedGuests.length - 1),
        checkInOffset,
        nights,
        guests: random.int(1, listing.maxGuests),
        kind: "completed",
        review: {
          guestRatings: {
            overall: score(),
            cleanliness: score(),
            accuracy: score(),
            checkIn: score(),
            communication: score(),
            location: score(),
            value: score(),
          },
          hostRatings: {
            communication: score(),
            cleanliness: score(),
            ruleObservance: score(),
          },
          guestComment: random.pick(guestComments),
          hostComment: random.pick(hostComments),
        },
      });
      cursor = checkInOffset - random.int(10, 40);
    }
    if (random.next() < 0.35) {
      stays.push({
        listingIndex: listing.index,
        guestIndex: random.int(0, seedGuests.length - 1),
        checkInOffset: random.int(40, 80),
        nights: random.int(2, 5),
        guests: random.int(1, listing.maxGuests),
        kind: "upcoming",
      });
    }
  }
  return stays;
}

/** Day offsets (from today) blocked by hosts, chosen clear of upcoming stays. */
export const seedBlockedDayOffsets = [14, 15, 16] as const;
/** Day offsets with a weekend price bump. */
export const seedPriceOverrideDayOffsets = [5, 6, 12, 13] as const;
