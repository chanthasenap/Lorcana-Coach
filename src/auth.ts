import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";

/**
 * Web dashboard login. Reuses the same Discord Application created for the
 * bot (Developer Portal -> OAuth2), so "Sign in with Discord" is the only
 * account system this app needs - no separate password/email flow.
 *
 * We deliberately do NOT use a database adapter here: Player/Team records
 * are already the source of truth (created by the Discord bot the first
 * time someone interacts with a slash command in their server), so the web
 * session just needs to carry the Discord user id. `getDashboardContext()`
 * (src/lib/dashboard/context.ts) resolves that id to a Player/Team.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Discord],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, profile }) {
      if (profile && typeof profile.id === "string") {
        token.discordUserId = profile.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (typeof token.discordUserId === "string") {
        session.discordUserId = token.discordUserId;
      }
      return session;
    },
  },
});
