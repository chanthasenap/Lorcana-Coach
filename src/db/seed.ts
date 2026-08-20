/**
 * Idempotent demo/seed data for local development.
 *
 * Re-running this script wipes and recreates the "Ink Well Collective" demo
 * team so the whole app (scenario generation, /coach, dashboard) has
 * realistic-looking historical data to work with immediately.
 *
 * IMPORTANT re: card data — `cardReferences` here only seeds structural
 * fields (name / ink color / cost / type) using publicly known Disney
 * Lorcana card names. `text` / `rulesNotes` are intentionally left null:
 * per the app's AI-safety design (spec section 15), we do not fabricate
 * official card text and label it "verified." Wire up a real card data
 * source before the Rules Agent should answer anything as `verified_rule`.
 *
 * Run locally with: npm run db:seed
 * Run against production via: GET /api/admin/seed?secret=...
 */
import { db, schema } from "./index";

const {
  teams,
  players,
  teamMembers,
  decks,
  matches,
  games,
  aiObservations,
  cardReferences,
} = schema;

async function reset() {
  // Delete in FK-safe (child-first) order so re-running this script is safe.
  await db.delete(schema.scenarioAttempts);
  await db.delete(schema.practiceScenarios);
  await db.delete(aiObservations);
  await db.delete(games);
  await db.delete(matches);
  await db.delete(decks);
  await db.delete(teamMembers);
  await db.delete(players);
  await db.delete(teams);
  await db.delete(cardReferences);
  await db.delete(schema.rulesAnswers);
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Weighted coin flip: returns "win" with probability p, else "loss".
function weightedResult(p: number): "win" | "loss" {
  return Math.random() < p ? "win" : "loss";
}

export async function seedDemoData() {
  console.log("Resetting demo data...");
  await reset();

  console.log("Seeding team + players...");
  const [team] = await db
    .insert(teams)
    .values({
      name: "Ink Well Collective",
      // If DISCORD_DEV_GUILD_ID is set (see .env.example), tie the demo
      // team straight to your real Discord server so /practice etc. work
      // immediately without a separate "first interaction" linking step.
      discordGuildId: process.env.DISCORD_DEV_GUILD_ID || undefined,
    })
    .returning();

  const [alex, jordan, sam, riley] = await db
    .insert(players)
    .values([
      { discordUserId: "100000000000000001", displayName: "Alex" },
      { discordUserId: "100000000000000002", displayName: "Jordan" },
      { discordUserId: "100000000000000003", displayName: "Sam" },
      { discordUserId: "100000000000000004", displayName: "Riley" },
    ])
    .returning();

  await db.insert(teamMembers).values([
    { teamId: team.id, playerId: alex.id, role: "admin" },
    { teamId: team.id, playerId: jordan.id, role: "coach" },
    { teamId: team.id, playerId: sam.id, role: "player" },
    { teamId: team.id, playerId: riley.id, role: "player" },
  ]);

  console.log("Seeding decks...");
  const [rubySapphire, amethystSteel, amberEmerald] = await db
    .insert(decks)
    .values([
      {
        teamId: team.id,
        name: "Ruby/Sapphire Aggro",
        inkColors: ["Ruby", "Sapphire"],
        version: "v3",
        ownerPlayerId: alex.id,
        decklist: [
          { card: "Aladdin - Heroic Outlaw", count: 4, type: "Character" },
          { card: "Captain Hook - Forceful Duelist", count: 3, type: "Character" },
          { card: "Be Prepared", count: 2, type: "Action" },
          { card: "Friends on the Other Side", count: 2, type: "Action" },
          { card: "Ariel - Spectacular Singer", count: 4, type: "Character" },
        ],
      },
      {
        teamId: team.id,
        name: "Amethyst/Steel Control",
        inkColors: ["Amethyst", "Steel"],
        version: "v2",
        ownerPlayerId: jordan.id,
        decklist: [
          { card: "Hades - King of Olympus", count: 2, type: "Character" },
          { card: "Merlin - Goat", count: 3, type: "Character" },
          { card: "Let the Storm Rage On", count: 3, type: "Action" },
          { card: "Elsa - Snow Queen", count: 4, type: "Character" },
        ],
      },
      {
        teamId: team.id,
        name: "Amber/Emerald Midrange",
        inkColors: ["Amber", "Emerald"],
        version: "v1",
        ownerPlayerId: sam.id,
        decklist: [
          { card: "Mickey Mouse - Brave Little Tailor", count: 3, type: "Character" },
          { card: "Cruella De Vil - Miserable as Usual", count: 2, type: "Character" },
          { card: "Fire the Cannons!", count: 4, type: "Action" },
          { card: "Belle - Strange but Special", count: 3, type: "Character" },
        ],
      },
    ])
    .returning();

  const [amberSteel, amberEmeraldOpp, rubyAmethyst, sapphireSteel] = await db
    .insert(decks)
    .values([
      {
        teamId: team.id,
        name: "Amber/Steel Aggro",
        inkColors: ["Amber", "Steel"],
        version: "meta",
        isOpponentArchetype: true,
        decklist: [
          { card: "Mickey Mouse - Detective", count: 4, type: "Character" },
          { card: "Gaston - Arrogant Hunter", count: 3, type: "Character" },
          { card: "The Sword in the Stone", count: 2, type: "Action" },
        ],
      },
      {
        teamId: team.id,
        name: "Amber/Emerald Control",
        inkColors: ["Amber", "Emerald"],
        version: "meta",
        isOpponentArchetype: true,
        decklist: [
          { card: "Cinderella - Gentle and Kind", count: 3, type: "Character" },
          { card: "Maleficent - Monstrous Dragon", count: 2, type: "Character" },
          { card: "Grab Your Sword", count: 2, type: "Action" },
        ],
      },
      {
        teamId: team.id,
        name: "Ruby/Amethyst Songs",
        inkColors: ["Ruby", "Amethyst"],
        version: "meta",
        isOpponentArchetype: true,
        decklist: [
          { card: "Ursula - Deceiver of All", count: 2, type: "Character" },
          { card: "Part of Your World", count: 3, type: "Action" },
          { card: "Hercules - True Hero", count: 3, type: "Character" },
        ],
      },
      {
        teamId: team.id,
        name: "Sapphire/Steel Control",
        inkColors: ["Sapphire", "Steel"],
        version: "meta",
        isOpponentArchetype: true,
        decklist: [
          { card: "Kuzco - Temperamental Emperor", count: 3, type: "Character" },
          { card: "Dr. Facilier - Villainous Charlatan", count: 2, type: "Character" },
          { card: "Reflection", count: 2, type: "Action" },
        ],
      },
    ])
    .returning();

  console.log("Seeding matches + games...");

  // matchupPlan: [ourDeck, opponentDeck, opponentLabel, winProbability]
  // Amber/Steel is deliberately our worst matchup (~40% WR) to make
  // /coach and the dashboard's "weakest matchup" surfacing meaningful.
  const matchupPlan: {
    deck: typeof rubySapphire;
    opponentDeck: typeof amberSteel;
    label: string;
    winProb: number;
    count: number;
    players: (typeof alex)[];
  }[] = [
    { deck: rubySapphire, opponentDeck: amberEmeraldOpp, label: "Amber/Emerald", winProb: 0.68, count: 9, players: [alex, riley] },
    { deck: rubySapphire, opponentDeck: amberSteel, label: "Amber/Steel", winProb: 0.4, count: 8, players: [alex, riley] },
    { deck: amethystSteel, opponentDeck: rubyAmethyst, label: "Ruby/Amethyst", winProb: 0.6, count: 6, players: [jordan] },
    { deck: amethystSteel, opponentDeck: amberSteel, label: "Amber/Steel", winProb: 0.42, count: 6, players: [jordan] },
    { deck: amberEmerald, opponentDeck: sapphireSteel, label: "Sapphire/Steel", winProb: 0.55, count: 5, players: [sam] },
    { deck: amberEmerald, opponentDeck: amberSteel, label: "Amber/Steel", winProb: 0.38, count: 5, players: [sam, riley] },
  ];

  const mistakeBank = [
    "Overcommitted board into a boardwipe-shaped opponent hand.",
    "Challenged into a bigger body instead of questing for lore.",
    "Kept a slow hand on the draw against an aggro deck.",
    "Missed a lethal quest line by miscounting available lore.",
    "Used removal on a low-impact character instead of the win condition.",
    "Sequenced ink before playing a card that needed to bank first.",
    "Didn't hold up interaction and got blown out by a tempo swing.",
  ];

  const greatLineBank = [
    "Held removal until the opponent overextended, then swept the board.",
    "Sandbagged a quester to bait a challenge, then punished it.",
    "Played around the known boardwipe by spreading damage across turns.",
  ];

  let matchDate = daysAgo(60);
  for (const plan of matchupPlan) {
    for (let i = 0; i < plan.count; i++) {
      matchDate = new Date(matchDate.getTime() + 1000 * 60 * 60 * 20); // ~20h apart
      const result = weightedResult(plan.winProb);
      const player = pick(plan.players);
      const isMistakeGame = Math.random() < 0.5;

      const [match] = await db
        .insert(matches)
        .values({
          teamId: team.id,
          playerId: player.id,
          deckId: plan.deck.id,
          opponentDeckId: plan.opponentDeck.id,
          opponentDeckLabel: plan.label,
          result,
          gameCount: 1,
          kind: Math.random() < 0.2 ? "tournament" : "practice",
          playedAt: matchDate,
          notes: isMistakeGame ? pick(mistakeBank) : pick(greatLineBank),
        })
        .returning();

      await db.insert(games).values({
        matchId: match.id,
        gameNumber: 1,
        result,
        playDraw: Math.random() < 0.5 ? "play" : "draw",
        mulliganInfo: { note: "Kept a 3-lander with early curve." },
        notes: match.notes,
        importantDecisions: [match.notes ?? ""],
        mistakes: result === "loss" && isMistakeGame ? [match.notes ?? ""] : [],
        turningPoints: isMistakeGame
          ? `Turn ${4 + Math.floor(Math.random() * 4)}: ${match.notes}`
          : null,
        noteTag: isMistakeGame ? "misplay" : "great_line",
        noteDetail: match.notes,
      });
    }
  }

  console.log("Seeding AI observations (team knowledge base)...");
  await db.insert(aiObservations).values([
    {
      teamId: team.id,
      matchupKey: `${rubySapphire.id}:Amber/Emerald`,
      observation:
        "Your team has encountered this board state 14 times. Players who removed the opposing lore-generating character before developing their own board won 71% of these games. Players who developed first won 39%.",
      category: "sequencing",
      confidence: 0.71,
    },
    {
      teamId: team.id,
      matchupKey: `*:Amber/Steel`,
      observation:
        "Across all decks, the team overcommits its board by turn 5 against Amber/Steel far more often than against any other matchup, then loses to a tempo swing the following turn.",
      category: "board_control",
      confidence: 0.66,
    },
    {
      teamId: team.id,
      matchupKey: `${amethystSteel.id}:Ruby/Amethyst`,
      observation:
        "Holding removal until turn 6+ against Ruby/Amethyst Songs correlates with a much higher win rate than using it proactively on turns 3-4.",
      category: "removal",
      confidence: 0.58,
    },
    {
      teamId: team.id,
      matchupKey: `*:*`,
      observation:
        "Lore-race miscounts (misjudging lethal or the opponent's lethal window) are the single most common mistake tagged across all recorded games this month.",
      category: "lore_race",
      confidence: 0.62,
    },
    {
      teamId: team.id,
      playerId: sam.id,
      matchupKey: `${amberEmerald.id}:Amber/Steel`,
      observation:
        "Sam mulligans too aggressively for a curve-out hand against Amber/Steel, keeping hands with no turn-2 play more often than the rest of the team.",
      category: "mulligan",
      confidence: 0.55,
    },
    {
      teamId: team.id,
      matchupKey: `*:*`,
      observation:
        "Games where the winning player challenged only when it removed a lore-threat (rather than on-curve by default) show a markedly higher win rate.",
      category: "challenge_decisions",
      confidence: 0.6,
    },
  ]);

  console.log("Seeding card reference (structural fields only)...");
  await db.insert(cardReferences).values([
    { name: "Mickey Mouse - Brave Little Tailor", inkColor: "Amber", cost: 4, type: "Character" },
    { name: "Elsa - Snow Queen", inkColor: "Amethyst", cost: 6, type: "Character" },
    { name: "Aladdin - Heroic Outlaw", inkColor: "Ruby", cost: 4, type: "Character" },
    { name: "Ariel - Spectacular Singer", inkColor: "Sapphire", cost: 3, type: "Character" },
    { name: "Hades - King of Olympus", inkColor: "Amethyst", cost: 7, type: "Character" },
    { name: "Belle - Strange but Special", inkColor: "Emerald", cost: 2, type: "Character" },
    { name: "Be Prepared", inkColor: "Ruby", cost: 7, type: "Action" },
    { name: "Friends on the Other Side", inkColor: "Ruby", cost: 8, type: "Action" },
    { name: "Let the Storm Rage On", inkColor: "Amethyst", cost: 4, type: "Action" },
    { name: "Fire the Cannons!", inkColor: "Emerald", cost: 2, type: "Action" },
  ]);

  console.log("Done.");
  console.log(`Team: ${team.name} (${team.id})`);
  return { teamId: team.id, teamName: team.name };
}
