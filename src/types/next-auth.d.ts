import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    discordUserId?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    discordUserId?: string;
  }
}

// Re-export so this file is treated as a module by TS.
export type { DefaultSession };
