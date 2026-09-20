// Ambient declaration for the "server-app" alias (see vite.config.ts).
// Keeps the strict frontend tsconfig from pulling the server's less-strict
// TypeScript files into this program; the server's own tsconfig checks them.
declare module "server-app" {
  import type { Server } from "node:http";

  export function createApp(): {
    listen(port: number, hostname: string, callback?: () => void): Server;
  };
}
