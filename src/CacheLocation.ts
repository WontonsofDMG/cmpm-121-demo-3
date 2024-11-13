// CacheLocation.ts
import { CoinNFT } from "./CoinNFT.ts";

export class CacheLocation {
  private static locations: Map<string, CacheLocation> = new Map();

  private constructor(
    public i: number,
    public j: number,
    public cacheCoinIds: CoinNFT[] = [],
  ) {}

  public static getLocation(i: number, j: number): CacheLocation {
    const key = `${i},${j}`;
    if (!this.locations.has(key)) {
      this.locations.set(key, new CacheLocation(i, j));
    }
    return this.locations.get(key)!;
  }

  public static saveCache(i: number, j: number, coins: CoinNFT[]) {
    const location = this.getLocation(i, j);
    location.cacheCoinIds = coins;
  }

  public static getCache(i: number, j: number): CoinNFT[] {
    const location = this.getLocation(i, j);
    return location.cacheCoinIds;
  }
}
