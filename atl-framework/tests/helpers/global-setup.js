import { seedAtl } from "./seed.js";

export default async function globalSetup() {
  seedAtl();
  console.log("ATL seed complete.");
}
