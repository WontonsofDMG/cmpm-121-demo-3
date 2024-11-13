// CoinNFT.ts
export class CoinNFT {
  private static idCounter = 0;
  public readonly id: string;

  constructor(public i: number, public j: number, public serial: number) {
    this.id = `${i}:${j}#${serial}`;
  }

  public toString(): string {
    return this.id;
  }
}
