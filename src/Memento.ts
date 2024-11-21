// Memento.ts
export class Memento {
  constructor(
    public playerPosition: { lat: number; lng: number },
    public playerCoins: number,
    public cacheStates: Map<string, string>
  ) {}

  toString(): string {
    return JSON.stringify({
      playerPosition: this.playerPosition,
      playerCoins: this.playerCoins,
      cacheStates: Array.from(this.cacheStates.entries()),
    });
  }

  static fromString(state: string): Memento {
    const parsed = JSON.parse(state);
    return new Memento(
      parsed.playerPosition,
      parsed.playerCoins,
      new Map(parsed.cacheStates)
    );
  }
}