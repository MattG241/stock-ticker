import type { Drink } from "./types";
import { nowIso } from "./time";

export function seedDrinks(): Drink[] {
  const base: Omit<Drink, "createdAt" | "updatedAt" | "inStock">[] = [
    { id: "espresso-martini", ticker: "ESPM", name: "Espresso Martini", category: "Cocktails", emoji: "🍸", basePrice: 22, currentPrice: 22, costPrice: 6, minPriceMultiplier: 0.5, maxPriceMultiplier: 2.5, isDynamic: true, isActive: true, sortOrder: 1 },
    { id: "negroni", ticker: "NEGR", name: "Negroni", category: "Cocktails", emoji: "🍹", basePrice: 20, currentPrice: 20, costPrice: 5, minPriceMultiplier: 0.5, maxPriceMultiplier: 2.5, isDynamic: true, isActive: true, sortOrder: 2 },
    { id: "old-fashioned", ticker: "OLDF", name: "Old Fashioned", category: "Cocktails", emoji: "🥃", basePrice: 22, currentPrice: 22, costPrice: 6, minPriceMultiplier: 0.5, maxPriceMultiplier: 2.5, isDynamic: true, isActive: true, sortOrder: 3 },
    { id: "margarita", ticker: "MARG", name: "Margarita", category: "Cocktails", emoji: "🍸", basePrice: 19, currentPrice: 19, costPrice: 5, minPriceMultiplier: 0.5, maxPriceMultiplier: 2.5, isDynamic: true, isActive: true, sortOrder: 4 },
    { id: "aperol-spritz", ticker: "APRL", name: "Aperol Spritz", category: "Cocktails", emoji: "🥂", basePrice: 18, currentPrice: 18, costPrice: 5, minPriceMultiplier: 0.5, maxPriceMultiplier: 2.5, isDynamic: true, isActive: true, sortOrder: 5 },
    { id: "pale-ale", ticker: "PALE", name: "Pale Ale (Tap)", category: "Beer", emoji: "🍺", basePrice: 12, currentPrice: 12, costPrice: 3, minPriceMultiplier: 0.6, maxPriceMultiplier: 2.0, isDynamic: true, isActive: true, sortOrder: 10 },
    { id: "house-lager", ticker: "LAGR", name: "House Lager", category: "Beer", emoji: "🍺", basePrice: 10, currentPrice: 10, costPrice: 2.5, minPriceMultiplier: 1.0, maxPriceMultiplier: 1.0, isDynamic: false, isActive: true, sortOrder: 11 },
    { id: "ipa", ticker: "IPA", name: "IPA", category: "Beer", emoji: "🍺", basePrice: 14, currentPrice: 14, costPrice: 3.5, minPriceMultiplier: 0.6, maxPriceMultiplier: 2.0, isDynamic: true, isActive: true, sortOrder: 12 },
    { id: "house-red", ticker: "HRED", name: "House Red", category: "Wine", emoji: "🍷", basePrice: 13, currentPrice: 13, costPrice: 4, minPriceMultiplier: 0.6, maxPriceMultiplier: 2.0, isDynamic: true, isActive: true, sortOrder: 20 },
    { id: "house-white", ticker: "HWHT", name: "House White", category: "Wine", emoji: "🥂", basePrice: 13, currentPrice: 13, costPrice: 4, minPriceMultiplier: 0.6, maxPriceMultiplier: 2.0, isDynamic: true, isActive: true, sortOrder: 21 },
    { id: "prosecco", ticker: "PROS", name: "Prosecco", category: "Wine", emoji: "🍾", basePrice: 16, currentPrice: 16, costPrice: 5, minPriceMultiplier: 0.6, maxPriceMultiplier: 2.0, isDynamic: true, isActive: true, sortOrder: 22 },
    { id: "gin-tonic", ticker: "GANT", name: "Gin and Tonic", category: "Spirits", emoji: "🍸", basePrice: 16, currentPrice: 16, costPrice: 4, minPriceMultiplier: 0.5, maxPriceMultiplier: 2.5, isDynamic: true, isActive: true, sortOrder: 30 },
    { id: "tequila-shot", ticker: "TEQS", name: "Tequila Shot", category: "Shots", emoji: "🥃", basePrice: 9, currentPrice: 9, costPrice: 2, minPriceMultiplier: 0.5, maxPriceMultiplier: 2.5, isDynamic: true, isActive: true, sortOrder: 40 },
    { id: "soda-lime", ticker: "SODA", name: "Soda and Lime", category: "Non-Alc", emoji: "🥤", basePrice: 5, currentPrice: 5, costPrice: 1, minPriceMultiplier: 1.0, maxPriceMultiplier: 1.0, isDynamic: false, isActive: true, sortOrder: 50 },
  ];
  const ts = nowIso();
  return base.map((d) => ({ ...d, inStock: true, createdAt: ts, updatedAt: ts }));
}
