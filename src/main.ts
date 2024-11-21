// @deno-types="npm:@types/leaflet@^1.9.14"
import leaflet from "leaflet";
import { CacheLocation } from "./CacheLocation.ts";
import { CoinNFT } from "./CoinNFT.ts";
import { Memento } from "./Memento.ts";

// Style sheets
import "leaflet/dist/leaflet.css";
import "./style.css";

// Fix missing marker images
import "./leafletWorkaround.ts";

// Deterministic random number generator
import luck from "./luck.ts";

// Location of our classroom (as identified on Google Maps)
const OAKES_CLASSROOM = leaflet.latLng(36.98949379578401, -122.06277128548504);

// Tunable gameplay parameters
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const NEIGHBORHOOD_SIZE = 8;
const CACHE_SPAWN_PROBABILITY = 0.1;

// Create the map (element with id "map" is defined in index.html)
const map = leaflet.map(document.getElementById("map")!, {
  center: OAKES_CLASSROOM,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
});

// Populate the map with a background tile layer
leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

// Inventory class to manage coins
class Inventory {
  public coins: CoinNFT[] = [];

  addCoin(coin: CoinNFT) {
    this.coins.push(coin);
    this.displayInventory();
  }

  removeCoinById(coinId: string) {
    this.coins = this.coins.filter((coin) => coin.id !== coinId);
    this.displayInventory();
  }

  displayInventory() {
    const inventoryPanel = document.getElementById("inventoryPanel");
    if (inventoryPanel) {
      inventoryPanel.innerHTML =
        `Coin Inventory (${this.coins.length} coins):<br>` +
        this.coins.map((coin) => `Coin ID: ${coin.id}`).join("<br>");
    }
  }
}

const inventory = new Inventory();

// Add a marker to represent the player
const playerMarker = leaflet.marker(OAKES_CLASSROOM);
playerMarker.bindTooltip("That's you!");
playerMarker.addTo(map);

let playerPosition = OAKES_CLASSROOM;
let playerCoins = 0;

// Display the player's points
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
statusPanel.innerHTML = "No points yet...";

// Display the player's inventory
const inventoryPanel = document.querySelector<HTMLDivElement>("#inventoryPanel")!;
inventoryPanel.innerHTML = "Coin Inventory (0 coins)";

// Function to update player position
function updatePlayerPosition(lat: number, lng: number) {
  playerPosition = leaflet.latLng(lat, lng);
  playerMarker.setLatLng(playerPosition);
  map.panTo(playerPosition);
  regenerateCaches();
}

// Function to save the current state
function saveState(): string {
  const cacheStates = new Map<string, string>();
  CacheLocation.locations.forEach((location, key) => {
    cacheStates.set(key, location.toMemento());
  });
  const memento = new Memento(
    { lat: playerPosition.lat, lng: playerPosition.lng },
    playerCoins,
    cacheStates
  );
  return memento.toString();
}

// Function to restore a saved state
function restoreState(state: string) {
  const memento = Memento.fromString(state);
  playerPosition = leaflet.latLng(memento.playerPosition.lat, memento.playerPosition.lng);
  playerMarker.setLatLng(playerPosition);
  playerCoins = memento.playerCoins;
  memento.cacheStates.forEach((value, key) => {
    const [i, j] = key.split(",").map(Number);
    const cache = CacheLocation.getLocation(i, j);
    cache.fromMemento(value);
  });
  inventory.displayInventory();
}

// Function to regenerate caches around the player's position
function regenerateCaches() {
  map.eachLayer((layer) => {
    if (layer instanceof leaflet.Rectangle) {
      map.removeLayer(layer);
    }
  });

  for (let i = -NEIGHBORHOOD_SIZE; i < NEIGHBORHOOD_SIZE; i++) {
    for (let j = -NEIGHBORHOOD_SIZE; j < NEIGHBORHOOD_SIZE; j++) {
      const cell = latLngToCell(
        playerPosition.lat + i * TILE_DEGREES,
        playerPosition.lng + j * TILE_DEGREES,
      );
      const cache = CacheLocation.getLocation(cell.i, cell.j);
      if (cache.cacheCoinIds.length > 0) {
        spawnCache(playerPosition.lat, playerPosition.lng, i, j);
      } else if (luck([cell.i, cell.j].toString()) < CACHE_SPAWN_PROBABILITY) {
        spawnCache(playerPosition.lat, playerPosition.lng, i, j);
      }
    }
  }
}

function latLngToCell(lat: number, lng: number): { i: number; j: number } {
  return {
    i: Math.floor(lat * 1e4),
    j: Math.floor(lng * 1e4),
  };
}

function spawnCache(
  playerLat: number,
  playerLng: number,
  i: number,
  j: number,
) {
  const cell = latLngToCell(
    playerLat + i * TILE_DEGREES,
    playerLng + j * TILE_DEGREES,
  );
  const bounds = leaflet.latLngBounds([
    [cell.i / 1e4, cell.j / 1e4],
    [(cell.i + 1) / 1e4, (cell.j + 1) / 1e4],
  ]);
  const rect = leaflet.rectangle(bounds);
  rect.addTo(map);

  const cacheCoinIds: CoinNFT[] = [];
  const initialCoins = Math.floor(
    luck([cell.i, cell.j, "initialCoins"].toString()) * 10,
  );
  for (let k = 0; k < initialCoins; k++) {
    const coin = new CoinNFT(cell.i, cell.j, k);
    cacheCoinIds.push(coin);
  }
  CacheLocation.saveCache(cell.i, cell.j, cacheCoinIds);

  rect.bindPopup(() => {
    let pointValue = cacheCoinIds.length;
    const popupDiv = document.createElement("div");
    popupDiv.innerHTML = `
      <div>There is a cache here at "${cell.i},${cell.j}". It has value <span id="value">${pointValue}</span>.</div>
      <button id="collect">Collect</button>
      <button id="deposit">Deposit</button>`;
    popupDiv.querySelector<HTMLButtonElement>("#collect")!.addEventListener(
      "click",
      () => {
        if (pointValue > 0) {
          pointValue--;
          playerCoins++;
          const coin = cacheCoinIds.pop();
          if (coin) {
            inventory.addCoin(coin);
          }
          popupDiv.querySelector<HTMLSpanElement>("#value")!.innerHTML =
            pointValue.toString();
          CacheLocation.saveCache(cell.i, cell.j, cacheCoinIds);
        }
      },
    );
    popupDiv.querySelector<HTMLButtonElement>("#deposit")!.addEventListener(
      "click",
      () => {
        if (playerCoins > 0) {
          pointValue++;
          playerCoins--;
          const coin = inventory.coins.pop();
          if (coin) {
            cacheCoinIds.push(coin);
          }
          popupDiv.querySelector<HTMLSpanElement>("#value")!.innerHTML =
            pointValue.toString();
          CacheLocation.saveCache(cell.i, cell.j, cacheCoinIds);
          inventory.displayInventory();
        }
      },
    );
    return popupDiv;
  });
}

// Add event listeners for movement buttons
document.getElementById("north")!.addEventListener("click", () => {
  updatePlayerPosition(playerPosition.lat + TILE_DEGREES, playerPosition.lng);
});

document.getElementById("south")!.addEventListener("click", () => {
  updatePlayerPosition(playerPosition.lat - TILE_DEGREES, playerPosition.lng);
});

document.getElementById("west")!.addEventListener("click", () => {
  updatePlayerPosition(playerPosition.lat, playerPosition.lng - TILE_DEGREES);
});

document.getElementById("east")!.addEventListener("click", () => {
  updatePlayerPosition(playerPosition.lat, playerPosition.lng + TILE_DEGREES);
});

document.getElementById("reset")!.addEventListener("click", () => {
  updatePlayerPosition(OAKES_CLASSROOM.lat, OAKES_CLASSROOM.lng);
  playerCoins = 0;
  inventoryPanel.innerHTML = "Coin Inventory (0 coins)";
});

// Look around the player's neighborhood for caches to spawn
for (let i = -NEIGHBORHOOD_SIZE; i < NEIGHBORHOOD_SIZE; i++) {
  for (let j = -NEIGHBORHOOD_SIZE; j < NEIGHBORHOOD_SIZE; j++) {
    if (luck([i, j].toString()) < CACHE_SPAWN_PROBABILITY) {
      spawnCache(playerPosition.lat, playerPosition.lng, i, j);
    }
  }
}