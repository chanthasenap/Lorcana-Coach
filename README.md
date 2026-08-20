# Lorcana Coach

An AI competitive practice coach for your Disney Lorcana team, built into
Discord. Run `/practice` in your team's server to get an AI-generated
scenario built from your team's own match history, make a decision, and get
coached on it. A web dashboard shows the deeper stats.

This guide assumes no coding experience. Everything below is copy/paste. It
should take about 30-45 minutes the first time.

## What this costs

- **Vercel** (hosting): $0/month (Hobby plan)
- **Neon** (database): $0/month (free tier)
- **Discord**: $0
- **Anthropic** (the AI): pay-per-use. For a small team practicing regularly,
  expect roughly a few dollars a month, billed directly by Anthropic to
  whatever API key you provide.

Nothing here needs a credit card except, eventually, Anthropic if you want to
raise your usage limits.

## Overview of the one-time setup

1. Create a Discord Application (this becomes your bot).
2. Create a free Neon database.
3. Deploy this code to Vercel and fill in environment variables.
4. Run three one-time setup links in your browser (create database tables,
   load demo data, register the `/practice` etc. commands).
5. Point Discord at your new Vercel URL and invite the bot to your server.

Once this is done, it stays done - every future `git push` to this repo
automatically redeploys, and you never repeat these steps.

---

## Step 1: Create the Discord Application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) and log in with the Discord account that manages your team's server.
2. Click **New Application**, name it (e.g. "Lorcana Coach"), and accept the terms.
3. On the **General Information** page, copy the **Application ID** and **Public Key** - you'll paste these into Vercel later.
4. In the left sidebar, click **Bot**. Click **Reset Token** (or **Copy** if a token is already shown) and save the **Bot Token** somewhere safe - Discord only shows it once.
   - Under **Privileged Gateway Intents**, you don't need to enable anything - this bot doesn't need them.
5. In the left sidebar, click **OAuth2**. Copy the **Client ID** (same as Application ID) and **Client Secret** - you'll need both for "Sign in with Discord" on the web dashboard.
   - Under **Redirects**, leave this blank for now - you'll add the real URL in Step 5 once you know your Vercel domain.
6. Find your **Discord Server ID** (used for instant command registration during setup): in Discord, go to **User Settings -> Advanced** and turn on **Developer Mode**, then right-click your server's icon and choose **Copy Server ID**.

You should now have five values saved: Application ID, Public Key, Bot Token, Client ID, Client Secret, and your Server ID.

## Step 2: Create a free Neon database

1. Go to [neon.tech](https://neon.tech) and sign up (GitHub sign-in is easiest).
2. Create a new project (any name/region is fine - pick a region close to where your team plays).
3. On the project dashboard, click **Connect** and copy the **connection string** for the **pooled connection** (looks like `postgresql://user:password@ep-xxxx-pooler.region.aws.neon.tech/neondb?sslmode=require`). Save it - this is your `DATABASE_URL`.

## Step 3: Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign up with GitHub.
2. Click **Add New -> Project** and import this repository from your GitHub account.
3. Before clicking Deploy, open **Environment Variables** and add the following (values from Steps 1-2, plus a couple you generate yourself):

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | Your Neon pooled connection string |
   | `DISCORD_APPLICATION_ID` | From Step 1 |
   | `DISCORD_PUBLIC_KEY` | From Step 1 |
   | `DISCORD_BOT_TOKEN` | From Step 1 |
   | `DISCORD_CLIENT_ID` | From Step 1 (same as Application ID) |
   | `DISCORD_CLIENT_SECRET` | From Step 1 |
   | `DISCORD_DEV_GUILD_ID` | Your Discord Server ID from Step 1 |
   | `AUTH_SECRET` | Any random 32+ character string (e.g. generate one at [generate-secret.vercel.app/32](https://generate-secret.vercel.app/32)) |
   | `NEXTAUTH_URL` | Your Vercel URL, e.g. `https://your-project.vercel.app` (Vercel shows this after your first deploy - you can add/edit this variable afterward and redeploy) |
   | `ANTHROPIC_API_KEY` | Your Anthropic API key ([console.anthropic.com](https://console.anthropic.com)) |
   | `ADMIN_SETUP_SECRET` | Any random string you make up (e.g. `openssl rand -hex 24` on a Mac, or just mash the keyboard) - this protects the one-time setup links in Step 4 |

   The AI routing variables (`AI_TASK_SCENARIO_GENERATION`, etc.) and `DISCORD_RESULTS_WEBHOOK_URL` are optional - sensible defaults are already baked in via `.env.example` if you want to see what they do, but you don't need to set them to get started.

4. Click **Deploy**. After a minute or two you'll get a live URL like `https://your-project.vercel.app`.
5. Go back into **Project Settings -> Environment Variables** and make sure `NEXTAUTH_URL` matches that exact URL (no trailing slash), then redeploy from the **Deployments** tab if you had to change it.

## Step 4: One-time database + command setup

With the app deployed, visit these three URLs in your browser (replace `your-project.vercel.app` and `YOUR_SECRET` with your real values - `YOUR_SECRET` is whatever you set `ADMIN_SETUP_SECRET` to):

1. **Create the database tables:**
   `https://your-project.vercel.app/api/admin/migrate?secret=YOUR_SECRET`
   You should see `{"status":"ok","message":"Migrations applied."}`.

2. **Load demo data** (optional but recommended the first time, so `/coach` and `/practice` have something to work with immediately - your team's real matches will replace this over time as you use `/record`):
   `https://your-project.vercel.app/api/admin/seed?secret=YOUR_SECRET`

3. **Register the slash commands with Discord:**
   `https://your-project.vercel.app/api/admin/register-commands?secret=YOUR_SECRET`
   Because `DISCORD_DEV_GUILD_ID` is set, commands show up in your server within seconds instead of the ~1 hour global rollout.

If any of these return an error, see Troubleshooting below.

## Step 5: Connect Discord to your deployment

1. Back in the [Discord Developer Portal](https://discord.com/developers/applications), open your application -> **General Information**.
2. Set **Interactions Endpoint URL** to:
   `https://your-project.vercel.app/api/discord/interactions`
   Discord will send a test request immediately - if your env vars from Step 3 are correct, it should save without an error.
3. Go to **OAuth2 -> Redirects** and add:
   `https://your-project.vercel.app/api/auth/callback/discord`
   (this is what makes "Sign in with Discord" work on the web dashboard).
4. Go to **OAuth2 -> URL Generator**. Under **Scopes**, check `bot` and `applications.commands`. Under **Bot Permissions**, check `Send Messages`, `Embed Links`, and `Use Slash Commands`. Copy the generated URL at the bottom, open it in your browser, and invite the bot to your team's server.

## Step 6: Try it out

In your Discord server, run `/help` to confirm the bot responds, then `/practice` to try the full scenario loop. Visit `https://your-project.vercel.app/dashboard` and click **Sign in with Discord** - after you've run at least one command in Discord (which creates your player profile), the dashboard will show your team's stats.

---

## Commands

- **`/practice`** - Start a practice session: pick your deck, an opponent archetype, and a practice type. AI-generated scenarios are built from your team's real match history and get harder to dodge the categories you keep missing.
- **`/coach`** - Personalized training priorities: your worst matchup and weakest decision category, each with a one-tap "practice this" button.
- **`/record`** - Log a match you just played in a few taps (deck, opponent, result, play/draw), with an optional "anything notable?" note.
- **`/analyze`** - Deeper game/matchup analysis (coming in a future update).
- **`/help`** - Shows this list, in Discord.

## Updating the bot later

Any change pushed to this repository's `main` branch on GitHub automatically triggers a new Vercel deployment - there's nothing else to do. If you ever change the database schema, re-run the migrate link from Step 4 after the new deploy finishes.

## Local development (optional, for anyone editing the code)

1. Install [Node.js](https://nodejs.org) 22+ and a local Postgres server.
2. `npm install`
3. Copy `.env.example` to `.env` and fill in the values described above (point `DATABASE_URL` at your local Postgres).
4. `npm run db:migrate` to create tables, then `npm run db:seed` to load demo data.
5. `npm run discord:register` to register commands to your dev server (`DISCORD_DEV_GUILD_ID`).
6. `npm run dev` starts the app at `http://localhost:3000` - but Discord needs a public HTTPS URL to deliver interactions to, so for live Discord testing you'll still want a real deployment (or a tunneling tool like `ngrok`, not covered here).
7. `npm test` runs the automated test suite; `npm run build` runs a production build check.

## Troubleshooting

- **A `/api/admin/*` link returns `{"error":"Unauthorized"}`** - the `secret` in the URL doesn't match `ADMIN_SETUP_SECRET` in your Vercel environment variables. Double check for typos/trailing spaces in both places.
- **Discord rejects the Interactions Endpoint URL** - almost always means `DISCORD_PUBLIC_KEY` in Vercel doesn't match the one shown in the Developer Portal, or the deploy hasn't finished yet. Re-check the value and redeploy.
- **Slash commands don't show up in Discord** - re-run the `register-commands` link from Step 4, and make sure the bot was actually invited to your server (Step 5.4). If `DISCORD_DEV_GUILD_ID` isn't set, global commands can take up to an hour to appear.
- **"Sign in with Discord" fails on the dashboard** - check that the OAuth2 redirect URL in the Developer Portal exactly matches `https://your-project.vercel.app/api/auth/callback/discord`, and that `NEXTAUTH_URL` and `AUTH_SECRET` are set correctly in Vercel.
- **Dashboard says "Not linked yet"** - the signed-in Discord account hasn't run a command in the team's server yet. Run `/help` there first, then refresh the dashboard.
