// @deno-types="npm:@types/leaflet@^1.9.14"
import leaflet from "leaflet";

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

// Add a marker to represent the player
const playerMarker = leaflet.marker(OAKES_CLASSROOM);
playerMarker.bindTooltip("That's you!");
playerMarker.addTo(map);

let playerPosition = OAKES_CLASSROOM;
let playerCoins = 0;

// Display the player's points
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!; // element `statusPanel` is defined in index.html
statusPanel.innerHTML = "No points yet...";

// Display the player's inventory
const inventoryPanel = document.querySelector<HTMLDivElement>(
  "#inventoryPanel",
)!; // element `inventoryPanel` is defined in index.html
inventoryPanel.innerHTML = "Inventory: 0 coins";

function updatePlayerPosition(lat: number, lng: number) {
  playerPosition = leaflet.latLng(lat, lng);
  playerMarker.setLatLng(playerPosition);
  map.setView(playerPosition);
}

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
  inventoryPanel.innerHTML = "Inventory: 0 coins";
});

// Add caches to the map by cell numbers
function spawnCache(i: number, j: number) {
  // Convert cell numbers into lat/lng bounds
  const origin = OAKES_CLASSROOM;
  const bounds = leaflet.latLngBounds([
    [origin.lat + i * TILE_DEGREES, origin.lng + j * TILE_DEGREES],
    [origin.lat + (i + 1) * TILE_DEGREES, origin.lng + (j + 1) * TILE_DEGREES],
  ]);

  // Add a rectangle to the map to represent the cache
  const rect = leaflet.rectangle(bounds);
  rect.addTo(map);

  // Handle interactions with the cache
  rect.bindPopup(() => {
    // Each cache has a random point value, mutable by the player
    let pointValue = Math.floor(luck([i, j, "initialValue"].toString()) * 10); // Fewer coins per cache

    // The popup offers a description and button
    const popupDiv = document.createElement("div");
    popupDiv.innerHTML = `
      <div>There is a cache here at "${i},${j}". It has value <span id="value">${pointValue}</span>.</div>
      <button id="collect">Collect</button>
      <button id="deposit">Deposit</button>`;

    // Clicking the collect button decrements the cache's value and increments the player's coins
    popupDiv.querySelector<HTMLButtonElement>("#collect")!.addEventListener(
      "click",
      () => {
        if (pointValue > 0) {
          pointValue--;
          playerCoins++;
          popupDiv.querySelector<HTMLSpanElement>("#value")!.innerHTML =
            pointValue.toString();
          inventoryPanel.innerHTML = `Inventory: ${playerCoins} coins`;
        }
      },
    );

    // Clicking the deposit button increments the cache's value and decrements the player's coins
    popupDiv.querySelector<HTMLButtonElement>("#deposit")!.addEventListener(
      "click",
      () => {
        if (playerCoins > 0) {
          pointValue++;
          playerCoins--;
          popupDiv.querySelector<HTMLSpanElement>("#value")!.innerHTML =
            pointValue.toString();
          inventoryPanel.innerHTML = `Inventory: ${playerCoins} coins`;
        }
      },
    );

    return popupDiv;
  });
}

// Look around the player's neighborhood for caches to spawn
for (let i = -NEIGHBORHOOD_SIZE; i < NEIGHBORHOOD_SIZE; i++) {
  for (let j = -NEIGHBORHOOD_SIZE; j < NEIGHBORHOOD_SIZE; j++) {
    // If location i,j is lucky enough, spawn a cache!
    if (luck([i, j].toString()) < CACHE_SPAWN_PROBABILITY) {
      spawnCache(i, j);
    }
  }
}
