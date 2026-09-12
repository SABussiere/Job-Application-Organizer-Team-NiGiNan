// src/config.js
//
// The mobile app can't use "localhost" — on a physical device or a
// simulator that isn't sharing the host's network stack, "localhost" means
// the device itself, not your computer. Point this at your computer's LAN
// IP (e.g. run `ipconfig getifaddr en0` on Mac, `ipconfig` on Windows, or
// `hostname -I` on Linux) while `npm run dev` is running in /server.
//
// iOS Simulator only: "http://localhost:3000" works because the simulator
// shares the Mac's network stack.
// Android Emulator only: use "http://10.0.2.2:3000" (its alias for host
// localhost).

export const API_BASE_URL = "http://192.168.1.100:3000";
