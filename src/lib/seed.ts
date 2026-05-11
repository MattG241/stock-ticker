import type { Drink } from "./types";
import { nowIso } from "./time";

// Sensible defaults so the seed list below stays readable.
const DEFAULTS = {
  minPriceMultiplier: 0.5,
  maxPriceMultiplier: 2.5,
  isDynamic: true,
  isActive: true,
  inStock: true,
};

interface SeedRow {
  id: string;
  ticker: string;
  name: string;
  category: Drink["category"];
  emoji: string;
  basePrice: number;
  costPrice: number;
  sortOrder: number;
  minMul?: number;
  maxMul?: number;
  isDynamic?: boolean;
}

const SEED: SeedRow[] = [
  // ─────────── BEERS, CIDERS, RTDs (sort 100-199) ───────────
  { id: "coopers-pale-ale", ticker: "COPA", name: "Coopers Pale Ale", category: "Beer", emoji: "🍺", basePrice: 11, costPrice: 3, sortOrder: 100, maxMul: 1.8 },
  { id: "coopers-sparkling-ale", ticker: "COSP", name: "Coopers Sparkling Ale", category: "Beer", emoji: "🍺", basePrice: 11, costPrice: 3, sortOrder: 101, maxMul: 1.8 },
  { id: "coopers-pacific-pale", ticker: "COPP", name: "Coopers Pacific Pale Ale", category: "Beer", emoji: "🍺", basePrice: 12, costPrice: 3.5, sortOrder: 102, maxMul: 1.8 },
  { id: "coopers-stout", ticker: "COST", name: "Coopers Stout", category: "Beer", emoji: "🍺", basePrice: 12, costPrice: 3.5, sortOrder: 103, maxMul: 1.8 },
  { id: "pirate-life-south-coast", ticker: "PLSC", name: "Pirate Life South Coast Pale Ale", category: "Beer", emoji: "🍺", basePrice: 13, costPrice: 3.5, sortOrder: 110, maxMul: 1.8 },
  { id: "pirate-life-ipa", ticker: "PIPA", name: "Pirate Life IPA", category: "Beer", emoji: "🍺", basePrice: 14, costPrice: 4, sortOrder: 111, maxMul: 1.8 },
  { id: "little-bang-pale", ticker: "LBPA", name: "Little Bang Pale Ale", category: "Beer", emoji: "🍺", basePrice: 13, costPrice: 3.5, sortOrder: 112 },
  { id: "big-shed-californicator", ticker: "BSFK", name: "Big Shed Brewing Californicator IPA", category: "Beer", emoji: "🍺", basePrice: 14, costPrice: 4, sortOrder: 113 },
  { id: "mismatch-lager", ticker: "MMLG", name: "Mismatch Lager", category: "Beer", emoji: "🍺", basePrice: 11, costPrice: 3, sortOrder: 120 },
  { id: "bowden-session-ale", ticker: "BSES", name: "Bowden Brewing Session Ale", category: "Beer", emoji: "🍺", basePrice: 11, costPrice: 3, sortOrder: 121 },
  { id: "prancing-pony-amber", ticker: "PPAM", name: "Prancing Pony Amber Ale", category: "Beer", emoji: "🍺", basePrice: 13, costPrice: 3.5, sortOrder: 122 },
  { id: "swell-brewing-lager", ticker: "SWBL", name: "Swell Brewing Lager", category: "Beer", emoji: "🍺", basePrice: 11, costPrice: 3, sortOrder: 123 },
  { id: "great-northern-super-crisp", ticker: "GNSC", name: "Great Northern Super Crisp", category: "Beer", emoji: "🍺", basePrice: 10, costPrice: 2.5, sortOrder: 130, maxMul: 1.5 },
  { id: "somersby-apple-cider", ticker: "SOMA", name: "Somersby Apple Cider", category: "Beer", emoji: "🍏", basePrice: 11, costPrice: 3, sortOrder: 140 },
  { id: "vodka-lime-soda-rtd", ticker: "VLSR", name: "Vodka Lime Soda (RTD)", category: "Beer", emoji: "🥤", basePrice: 12, costPrice: 3.5, sortOrder: 150 },

  // ─────────── WINES AND SPARKLING (200-299) ───────────
  { id: "barossa-shiraz", ticker: "BSHZ", name: "Barossa Shiraz", category: "Wine", emoji: "🍷", basePrice: 15, costPrice: 4.5, sortOrder: 200 },
  { id: "mclaren-vale-grenache", ticker: "MVGR", name: "McLaren Vale Grenache", category: "Wine", emoji: "🍷", basePrice: 14, costPrice: 4.5, sortOrder: 201 },
  { id: "coonawarra-cabernet-sauvignon", ticker: "CWCS", name: "Coonawarra Cabernet Sauvignon", category: "Wine", emoji: "🍷", basePrice: 15, costPrice: 4.5, sortOrder: 202 },
  { id: "adelaide-hills-pinot-noir", ticker: "AHPN", name: "Adelaide Hills Pinot Noir", category: "Wine", emoji: "🍷", basePrice: 14, costPrice: 4.5, sortOrder: 203 },
  { id: "clare-valley-riesling", ticker: "CVRG", name: "Clare Valley Riesling", category: "Wine", emoji: "🥂", basePrice: 13, costPrice: 4, sortOrder: 210 },
  { id: "adelaide-hills-sauv-blanc", ticker: "AHSB", name: "Adelaide Hills Sauvignon Blanc", category: "Wine", emoji: "🥂", basePrice: 13, costPrice: 4, sortOrder: 211 },
  { id: "mclaren-vale-chardonnay", ticker: "MVCH", name: "McLaren Vale Chardonnay", category: "Wine", emoji: "🥂", basePrice: 14, costPrice: 4.5, sortOrder: 212 },
  { id: "barossa-gsm-blend", ticker: "BGSM", name: "Barossa GSM Blend", category: "Wine", emoji: "🍷", basePrice: 15, costPrice: 4.5, sortOrder: 220 },
  { id: "adelaide-hills-rose", ticker: "AHRS", name: "Adelaide Hills Rosé", category: "Wine", emoji: "🌹", basePrice: 13, costPrice: 4, sortOrder: 221 },
  { id: "prosecco", ticker: "PROS", name: "Prosecco", category: "Wine", emoji: "🍾", basePrice: 13, costPrice: 4, sortOrder: 230 },
  { id: "tasmanian-sparkling", ticker: "TASP", name: "Tasmanian Sparkling", category: "Wine", emoji: "🍾", basePrice: 16, costPrice: 5, sortOrder: 231 },
  { id: "champagne-by-the-glass", ticker: "CHAM", name: "Champagne by the Glass", category: "Wine", emoji: "🍾", basePrice: 22, costPrice: 8, sortOrder: 232, maxMul: 3.0 },
  { id: "moscato", ticker: "MOSC", name: "Moscato", category: "Wine", emoji: "🍷", basePrice: 12, costPrice: 3.5, sortOrder: 240 },
  { id: "pinot-gris", ticker: "PGRS", name: "Pinot Gris", category: "Wine", emoji: "🥂", basePrice: 13, costPrice: 4, sortOrder: 241 },
  { id: "tempranillo", ticker: "TEMP", name: "Tempranillo", category: "Wine", emoji: "🍷", basePrice: 15, costPrice: 4.5, sortOrder: 250 },
  { id: "sangiovese", ticker: "SANG", name: "Sangiovese", category: "Wine", emoji: "🍷", basePrice: 14, costPrice: 4.5, sortOrder: 251 },
  { id: "fiano", ticker: "FIAN", name: "Fiano", category: "Wine", emoji: "🥂", basePrice: 14, costPrice: 4.5, sortOrder: 252 },
  { id: "vermentino", ticker: "VERM", name: "Vermentino", category: "Wine", emoji: "🥂", basePrice: 14, costPrice: 4.5, sortOrder: 253 },
  { id: "botrytis-semillon", ticker: "BSEM", name: "Botrytis Semillon (Dessert)", category: "Wine", emoji: "🍷", basePrice: 16, costPrice: 5, sortOrder: 260, maxMul: 2.0 },
  { id: "premium-reserve-red", ticker: "PREM", name: "Premium Reserve Red by the Glass", category: "Wine", emoji: "🍷", basePrice: 22, costPrice: 7, sortOrder: 270, maxMul: 3.0 },

  // ─────────── SPIRITS AND MIXERS (300-399) ───────────
  { id: "grey-goose-vodka", ticker: "GREY", name: "Grey Goose Vodka", category: "Spirits", emoji: "🥃", basePrice: 16, costPrice: 5, sortOrder: 300 },
  { id: "ketel-one-vodka", ticker: "KETL", name: "Ketel One Vodka", category: "Spirits", emoji: "🥃", basePrice: 15, costPrice: 4.5, sortOrder: 301 },
  { id: "belvedere-vodka", ticker: "BELV", name: "Belvedere Vodka", category: "Spirits", emoji: "🥃", basePrice: 16, costPrice: 5, sortOrder: 302 },
  { id: "four-pillars-gin", ticker: "4PIL", name: "Four Pillars Gin", category: "Spirits", emoji: "🍸", basePrice: 16, costPrice: 5, sortOrder: 310 },
  { id: "never-never-gin", ticker: "NNGN", name: "Never Never Gin", category: "Spirits", emoji: "🍸", basePrice: 16, costPrice: 5, sortOrder: 311 },
  { id: "hendricks-gin", ticker: "HEND", name: "Hendrick's Gin", category: "Spirits", emoji: "🍸", basePrice: 16, costPrice: 5, sortOrder: 312 },
  { id: "tanqueray-ten", ticker: "TANT", name: "Tanqueray No. Ten", category: "Spirits", emoji: "🍸", basePrice: 17, costPrice: 5.5, sortOrder: 313 },
  { id: "patron-silver", ticker: "PATR", name: "Patrón Silver Tequila", category: "Spirits", emoji: "🥃", basePrice: 18, costPrice: 6, sortOrder: 320 },
  { id: "don-julio-blanco", ticker: "DJUL", name: "Don Julio Blanco", category: "Spirits", emoji: "🥃", basePrice: 18, costPrice: 6, sortOrder: 321 },
  { id: "1800-coconut", ticker: "1800", name: "1800 Coconut Tequila", category: "Spirits", emoji: "🥃", basePrice: 15, costPrice: 4.5, sortOrder: 322 },
  { id: "casamigos-reposado", ticker: "CSAM", name: "Casamigos Reposado", category: "Spirits", emoji: "🥃", basePrice: 20, costPrice: 6.5, sortOrder: 323 },
  { id: "bacardi-carta-blanca", ticker: "BACA", name: "Bacardi Carta Blanca Rum", category: "Spirits", emoji: "🥃", basePrice: 13, costPrice: 4, sortOrder: 330 },
  { id: "kraken-spiced", ticker: "KRAK", name: "Kraken Spiced Rum", category: "Spirits", emoji: "🥃", basePrice: 14, costPrice: 4.5, sortOrder: 331 },
  { id: "diplomatico-reserva", ticker: "DIPL", name: "Diplomatico Reserva Rum", category: "Spirits", emoji: "🥃", basePrice: 18, costPrice: 6, sortOrder: 332 },
  { id: "makers-mark", ticker: "MARK", name: "Maker's Mark Bourbon", category: "Spirits", emoji: "🥃", basePrice: 16, costPrice: 5, sortOrder: 340 },
  { id: "woodford-reserve", ticker: "WOOD", name: "Woodford Reserve Bourbon", category: "Spirits", emoji: "🥃", basePrice: 18, costPrice: 6, sortOrder: 341 },
  { id: "jack-daniels", ticker: "JACK", name: "Jack Daniel's Tennessee Whiskey", category: "Spirits", emoji: "🥃", basePrice: 14, costPrice: 4.5, sortOrder: 342 },
  { id: "jameson", ticker: "JAME", name: "Jameson Irish Whiskey", category: "Spirits", emoji: "🥃", basePrice: 14, costPrice: 4.5, sortOrder: 343 },
  { id: "glenfiddich-12", ticker: "GLEN", name: "Glenfiddich 12 Year", category: "Spirits", emoji: "🥃", basePrice: 17, costPrice: 5.5, sortOrder: 344 },
  { id: "johnnie-walker-black", ticker: "JWBL", name: "Johnnie Walker Black Label", category: "Spirits", emoji: "🥃", basePrice: 17, costPrice: 5.5, sortOrder: 345 },

  // ─────────── SIGNATURE COCKTAILS (400-499) ───────────
  { id: "opening-bell-espresso-martini", ticker: "ESPM", name: "Opening Bell Espresso Martini", category: "Cocktails", emoji: "🍸", basePrice: 23, costPrice: 6.5, sortOrder: 400, maxMul: 3.0 },
  { id: "bull-run-margarita", ticker: "BRMA", name: "Bull Run Margarita", category: "Cocktails", emoji: "🍹", basePrice: 21, costPrice: 6, sortOrder: 401, maxMul: 3.0 },
  { id: "market-crash-margarita", ticker: "MCMA", name: "Market Crash Margarita", category: "Cocktails", emoji: "🌶️", basePrice: 22, costPrice: 6, sortOrder: 402, maxMul: 3.0 },
  { id: "wolf-of-hindley-street", ticker: "WOLF", name: "The Wolf of Hindley Street", category: "Cocktails", emoji: "🥃", basePrice: 23, costPrice: 6.5, sortOrder: 403, maxMul: 3.0 },
  { id: "wall-street-sour", ticker: "WSSR", name: "Wall Street Sour", category: "Cocktails", emoji: "🍋", basePrice: 22, costPrice: 6, sortOrder: 404, maxMul: 3.0 },
  { id: "blue-chip-martini", ticker: "BCMA", name: "Blue Chip Martini", category: "Cocktails", emoji: "🫒", basePrice: 24, costPrice: 7, sortOrder: 405, maxMul: 3.0 },
  { id: "dow-jones-daiquiri", ticker: "DJDQ", name: "Dow Jones Daiquiri", category: "Cocktails", emoji: "🍹", basePrice: 20, costPrice: 5.5, sortOrder: 406, maxMul: 3.0 },
  { id: "nasdaq-negroni", ticker: "NEGR", name: "Nasdaq Negroni", category: "Cocktails", emoji: "🍊", basePrice: 21, costPrice: 6, sortOrder: 407, maxMul: 3.0 },
  { id: "short-sell-spritz", ticker: "SHRT", name: "Short Sell Spritz", category: "Cocktails", emoji: "🥂", basePrice: 19, costPrice: 5.5, sortOrder: 408, maxMul: 3.0 },
  { id: "golden-parachute-french-75", ticker: "GP75", name: "Golden Parachute French 75", category: "Cocktails", emoji: "🍾", basePrice: 25, costPrice: 7, sortOrder: 409, maxMul: 3.0 },
  { id: "brokers-old-fashioned", ticker: "BRKR", name: "Broker's Old Fashioned", category: "Cocktails", emoji: "🥃", basePrice: 23, costPrice: 6.5, sortOrder: 410, maxMul: 3.0 },
  { id: "the-closing-bell", ticker: "BELL", name: "The Closing Bell", category: "Cocktails", emoji: "🔔", basePrice: 23, costPrice: 6.5, sortOrder: 411, maxMul: 3.0 },
  { id: "liquidity-mojito", ticker: "LIQM", name: "Liquidity Mojito", category: "Cocktails", emoji: "🌿", basePrice: 20, costPrice: 5.5, sortOrder: 412, maxMul: 3.0 },
  { id: "penny-stock-paloma", ticker: "PNNY", name: "Penny Stock Paloma", category: "Cocktails", emoji: "🍊", basePrice: 20, costPrice: 5.5, sortOrder: 413, maxMul: 3.0 },
  { id: "hostile-takeover-martini", ticker: "HSTL", name: "Hostile Takeover Martini", category: "Cocktails", emoji: "🍸", basePrice: 24, costPrice: 7, sortOrder: 414, maxMul: 3.0 },
  { id: "margin-call-mule", ticker: "MULE", name: "Margin Call Mule", category: "Cocktails", emoji: "🥄", basePrice: 20, costPrice: 5.5, sortOrder: 415, maxMul: 3.0 },
  { id: "black-monday-manhattan", ticker: "BLKM", name: "Black Monday Manhattan", category: "Cocktails", emoji: "🥃", basePrice: 24, costPrice: 7, sortOrder: 416, maxMul: 3.0 },
  { id: "ticker-tape-tom-collins", ticker: "TTTC", name: "Ticker Tape Tom Collins", category: "Cocktails", emoji: "🍋", basePrice: 20, costPrice: 5.5, sortOrder: 417, maxMul: 3.0 },
  { id: "ipo-pornstar-martini", ticker: "IPOM", name: "IPO Pornstar Martini", category: "Cocktails", emoji: "🍸", basePrice: 22, costPrice: 6, sortOrder: 418, maxMul: 3.0 },
  { id: "the-insider-spritz", ticker: "INSR", name: "The Insider Spritz", category: "Cocktails", emoji: "🥂", basePrice: 20, costPrice: 5.5, sortOrder: 419, maxMul: 3.0 },
  { id: "red-candle-negroni-sour", ticker: "REDC", name: "Red Candle Negroni Sour", category: "Cocktails", emoji: "🍷", basePrice: 22, costPrice: 6, sortOrder: 420, maxMul: 3.0 },
  { id: "green-candle-gimlet", ticker: "GRNC", name: "Green Candle Gimlet", category: "Cocktails", emoji: "🍸", basePrice: 20, costPrice: 5.5, sortOrder: 421, maxMul: 3.0 },
  { id: "bailout-pina-colada", ticker: "BAIL", name: "The Bailout Piña Colada", category: "Cocktails", emoji: "🥥", basePrice: 21, costPrice: 6, sortOrder: 422, maxMul: 3.0 },
  { id: "liquid-asset-long-island", ticker: "LISL", name: "Liquid Asset Long Island", category: "Cocktails", emoji: "🥤", basePrice: 24, costPrice: 7, sortOrder: 423, maxMul: 3.0 },
  { id: "the-dividend", ticker: "DIVD", name: "The Dividend", category: "Cocktails", emoji: "🥃", basePrice: 22, costPrice: 6, sortOrder: 424, maxMul: 3.0 },

  // ─────────── SHOTS (500-599) ───────────
  { id: "market-crash-shot", ticker: "MCSH", name: "Market Crash Shot", category: "Shots", emoji: "🌶️", basePrice: 10, costPrice: 2.5, sortOrder: 500, maxMul: 2.5 },
  { id: "green-candle-shot", ticker: "GCSH", name: "Green Candle Shot", category: "Shots", emoji: "🟢", basePrice: 10, costPrice: 2.5, sortOrder: 501 },
  { id: "red-candle-shot", ticker: "RCSH", name: "Red Candle Shot", category: "Shots", emoji: "🔴", basePrice: 10, costPrice: 2.5, sortOrder: 502 },
  { id: "wolf-shot", ticker: "WLSH", name: "Wolf Shot", category: "Shots", emoji: "🔥", basePrice: 11, costPrice: 3, sortOrder: 503 },
  { id: "bell-ringer-shot", ticker: "BRSH", name: "Bell Ringer Shot", category: "Shots", emoji: "🔔", basePrice: 11, costPrice: 3, sortOrder: 504 },
  { id: "ipo-shot", ticker: "IPOS", name: "IPO Shot", category: "Shots", emoji: "🍹", basePrice: 10, costPrice: 2.5, sortOrder: 505 },
  { id: "blue-chip-shot", ticker: "BCSH", name: "Blue Chip Shot", category: "Shots", emoji: "🔵", basePrice: 10, costPrice: 2.5, sortOrder: 506 },
  { id: "bear-market-shot", ticker: "BEAR", name: "Bear Market Shot", category: "Shots", emoji: "🐻", basePrice: 10, costPrice: 2.5, sortOrder: 507 },
  { id: "bull-market-shot", ticker: "BULL", name: "Bull Market Shot", category: "Shots", emoji: "🐂", basePrice: 10, costPrice: 2.5, sortOrder: 508 },
  { id: "margin-call-pickleback", ticker: "MCPB", name: "Margin Call Pickleback", category: "Shots", emoji: "🥒", basePrice: 11, costPrice: 3, sortOrder: 509 },

  // ─────────── NON-ALCOHOLIC (600-699) ───────────
  { id: "zero-proof-opening-bell", ticker: "ZPOB", name: "Zero Proof Opening Bell", category: "Non-Alc", emoji: "☕", basePrice: 14, costPrice: 3.5, sortOrder: 600 },
  { id: "virgin-bull-run-margarita", ticker: "VBRM", name: "Virgin Bull Run Margarita", category: "Non-Alc", emoji: "🍋", basePrice: 13, costPrice: 3, sortOrder: 601 },
  { id: "market-closed-mojito", ticker: "MCMJ", name: "Market Closed Mojito", category: "Non-Alc", emoji: "🌿", basePrice: 12, costPrice: 3, sortOrder: 602 },
  { id: "non-alc-aperol-style", ticker: "NASS", name: "Non-Alc Aperol Spritz Style", category: "Non-Alc", emoji: "🍊", basePrice: 12, costPrice: 3, sortOrder: 603 },
  { id: "brokers-lemon-lime-bitters", ticker: "BLLB", name: "Broker's Lemon Lime Bitters", category: "Non-Alc", emoji: "🍋", basePrice: 7, costPrice: 1.5, sortOrder: 604, isDynamic: false },
  { id: "ticker-tape-iced-tea", ticker: "TTIT", name: "Ticker Tape Iced Tea", category: "Non-Alc", emoji: "🍑", basePrice: 8, costPrice: 2, sortOrder: 605, isDynamic: false },
  { id: "green-candle-cooler", ticker: "GCCL", name: "Green Candle Cooler", category: "Non-Alc", emoji: "🥒", basePrice: 9, costPrice: 2.5, sortOrder: 606 },
  { id: "wall-street-ginger-beer", ticker: "WSGB", name: "Wall Street Ginger Beer", category: "Non-Alc", emoji: "🫚", basePrice: 7, costPrice: 1.5, sortOrder: 607, isDynamic: false },
  { id: "zero-proof-paloma", ticker: "ZPPA", name: "Zero Proof Paloma", category: "Non-Alc", emoji: "🍊", basePrice: 12, costPrice: 3, sortOrder: 608 },
  { id: "market-recovery-smoothie-soda", ticker: "MRSS", name: "Market Recovery Smoothie Soda", category: "Non-Alc", emoji: "🍓", basePrice: 10, costPrice: 2.5, sortOrder: 609 },
];

export function seedDrinks(): Drink[] {
  const ts = nowIso();
  return SEED.map((row) => ({
    id: row.id,
    ticker: row.ticker,
    name: row.name,
    category: row.category,
    emoji: row.emoji,
    basePrice: row.basePrice,
    currentPrice: row.basePrice,
    costPrice: row.costPrice,
    minPriceMultiplier: row.minMul ?? DEFAULTS.minPriceMultiplier,
    maxPriceMultiplier: row.maxMul ?? DEFAULTS.maxPriceMultiplier,
    isDynamic: row.isDynamic ?? DEFAULTS.isDynamic,
    isActive: DEFAULTS.isActive,
    inStock: DEFAULTS.inStock,
    sortOrder: row.sortOrder,
    createdAt: ts,
    updatedAt: ts,
  }));
}
