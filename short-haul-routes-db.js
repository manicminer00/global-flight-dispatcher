/**
 * Curated short-haul pair boosts — high-frequency routes people actually fly.
 * Only list pairs where both ICAOs exist in the airport databases.
 * Applied when picking among routes that already match block-time / distance bands.
 */
const SHORT_HAUL_CURATED_PAIR_BOOST = [
    { from: "LEMD", to: "LPPT", weight: 8 },
    { from: "LPPT", to: "LEMD", weight: 8 },
    { from: "LEBL", to: "LEPA", weight: 8 },
    { from: "LEPA", to: "LEBL", weight: 8 },
    { from: "LEMD", to: "LEPA", weight: 7 },
    { from: "LEPA", to: "LEMD", weight: 7 },
    { from: "LEMD", to: "LEBL", weight: 6 },
    { from: "LEBL", to: "LEMD", weight: 6 },
    { from: "EGLL", to: "EIDW", weight: 7 },
    { from: "EIDW", to: "EGLL", weight: 7 },
    { from: "LFPG", to: "EIDW", weight: 6 },
    { from: "EIDW", to: "LFPG", weight: 6 },
    { from: "EHAM", to: "EGLL", weight: 6 },
    { from: "EGLL", to: "EHAM", weight: 6 },
    { from: "EHAM", to: "LEBL", weight: 6 },
    { from: "LEBL", to: "EHAM", weight: 6 },
    { from: "GCLP", to: "LEMD", weight: 5 },
    { from: "LEMD", to: "GCLP", weight: 5 },
    { from: "GCLP", to: "GCXO", weight: 9 },
    { from: "GCXO", to: "GCLP", weight: 9 },
    { from: "GCLP", to: "GCTS", weight: 7 },
    { from: "GCTS", to: "GCLP", weight: 7 },
    { from: "GCXO", to: "GCTS", weight: 6 },
    { from: "GCTS", to: "GCXO", weight: 6 },
    { from: "KLAX", to: "KSFO", weight: 8 },
    { from: "KSFO", to: "KLAX", weight: 8 },
    { from: "KJFK", to: "KLGA", weight: 5 },
    { from: "KLGA", to: "KJFK", weight: 5 },
    { from: "KJFK", to: "KORD", weight: 5 },
    { from: "KORD", to: "KJFK", weight: 5 }
];
