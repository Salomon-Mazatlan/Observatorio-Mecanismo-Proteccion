// Only makes the site installable so phones can share links to it; nothing is cached, every request goes to the network
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
