import {
  pgTable,
  uuid,
  text,
  varchar,
  boolean,
  timestamp,
  integer,
  real,
  jsonb,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const teamRoleEnum = pgEnum("team_role", [
  "admin",
  "coach",
  "player",
  "guest",
]);

export const matchResultEnum = pgEnum("match_result", ["win", "loss", "draw"]);

export const matchKindEnum = pgEnum("match_kind", ["practice", "tournament"]);

export const playDrawEnum = pgEnum("play_draw", ["play", "draw", "unknown"]);

export const scenarioSourceEnum = pgEnum("scenario_source", [
  "historical",
  "generic",
]);

export const scenarioKindEnum = pgEnum("scenario_kind", [
  "matchup",
  "mulligan",
  "decision",
  "random",
]);

// Practice / decision categories used across ScenarioAttempt + AIObservation
export const practiceCategoryEnum = pgEnum("practice_category", [
  "mulligan",
  "sequencing",
  "resource_management",
  "board_control",
  "lore_race",
  "removal",
  "character_management",
  "challenge_decisions",
  "ink_decisions",
  "timing",
  "win_condition",
  "misplay",
  "matchup_strategy",
]);

export const noteTagEnum = pgEnum("note_tag", [
  "mulligan",
  "misplay",
  "great_line",
  "opponent_strategy",
  "nothing",
]);

export const ruleAnswerKindEnum = pgEnum("rule_answer_kind", [
  "verified_rule",
  "strategic_recommendation",
  "ai_inference",
]);

// ---------------------------------------------------------------------------
// Team & identity
// ---------------------------------------------------------------------------

export const teams = pgTable("teams", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  discordGuildId: varchar("discord_guild_id", { length: 32 }).unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const players = pgTable(
  "players",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    discordUserId: varchar("discord_user_id", { length: 32 }).notNull(),
    displayName: varchar("display_name", { length: 120 }).notNull(),
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("players_discord_user_id_idx").on(t.discordUserId)],
);

export const teamMembers = pgTable(
  "team_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teamId: uuid("team_id")
      .references(() => teams.id, { onDelete: "cascade" })
      .notNull(),
    playerId: uuid("player_id")
      .references(() => players.id, { onDelete: "cascade" })
      .notNull(),
    role: teamRoleEnum("role").default("player").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("team_members_team_player_idx").on(t.teamId, t.playerId)],
);

// ---------------------------------------------------------------------------
// Decks
// ---------------------------------------------------------------------------

export const decks = pgTable(
  "decks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teamId: uuid("team_id")
      .references(() => teams.id, { onDelete: "cascade" })
      .notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    inkColors: text("ink_colors").array().notNull(),
    version: varchar("version", { length: 40 }).default("v1").notNull(),
    ownerPlayerId: uuid("owner_player_id").references(() => players.id, {
      onDelete: "set null",
    }),
    decklist: jsonb("decklist").$type<
      { card: string; count: number; type?: "Character" | "Action" | "Item" | "Song" | "Location" }[]
    >(),
    isOpponentArchetype: boolean("is_opponent_archetype").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("decks_team_idx").on(t.teamId)],
);

// ---------------------------------------------------------------------------
// Matches & Games
// ---------------------------------------------------------------------------

export const matches = pgTable(
  "matches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teamId: uuid("team_id")
      .references(() => teams.id, { onDelete: "cascade" })
      .notNull(),
    playerId: uuid("player_id")
      .references(() => players.id, { onDelete: "cascade" })
      .notNull(),
    deckId: uuid("deck_id")
      .references(() => decks.id, { onDelete: "restrict" })
      .notNull(),
    opponentDeckId: uuid("opponent_deck_id").references(() => decks.id, {
      onDelete: "set null",
    }),
    opponentDeckLabel: varchar("opponent_deck_label", { length: 120 }),
    opponentPlayerId: uuid("opponent_player_id").references(() => players.id, {
      onDelete: "set null",
    }),
    result: matchResultEnum("result").notNull(),
    gameCount: integer("game_count").default(1).notNull(),
    kind: matchKindEnum("kind").default("practice").notNull(),
    playedAt: timestamp("played_at", { withTimezone: true }).defaultNow().notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("matches_team_idx").on(t.teamId),
    index("matches_player_idx").on(t.playerId),
    index("matches_deck_matchup_idx").on(t.deckId, t.opponentDeckLabel),
  ],
);

export const games = pgTable(
  "games",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    matchId: uuid("match_id")
      .references(() => matches.id, { onDelete: "cascade" })
      .notNull(),
    gameNumber: integer("game_number").default(1).notNull(),
    result: matchResultEnum("result").notNull(),
    playDraw: playDrawEnum("play_draw").default("unknown").notNull(),
    mulliganInfo: jsonb("mulligan_info").$type<{
      kept?: string[];
      mulliganed?: string[];
      note?: string;
    }>(),
    notes: text("notes"),
    importantDecisions: jsonb("important_decisions").$type<string[]>(),
    mistakes: jsonb("mistakes").$type<string[]>(),
    turningPoints: text("turning_points"),
    noteTag: noteTagEnum("note_tag"),
    noteDetail: text("note_detail"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("games_match_idx").on(t.matchId)],
);

// ---------------------------------------------------------------------------
// Practice scenarios & attempts
// ---------------------------------------------------------------------------

export type ScenarioBoardState = {
  turn: number;
  yourLore: number;
  opponentLore: number;
  availableInk: number;
  yourBoard: string[];
  opponentBoard: string[];
  hand: string[];
};

export type ScenarioOption = {
  key: "A" | "B" | "C" | "D";
  label: string;
};

export const practiceScenarios = pgTable(
  "practice_scenarios",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teamId: uuid("team_id")
      .references(() => teams.id, { onDelete: "cascade" })
      .notNull(),
    kind: scenarioKindEnum("kind").default("matchup").notNull(),
    deckId: uuid("deck_id").references(() => decks.id, { onDelete: "set null" }),
    opponentDeckLabel: varchar("opponent_deck_label", { length: 120 }),
    matchupKey: varchar("matchup_key", { length: 160 }).notNull(),
    situation: jsonb("situation").$type<ScenarioBoardState>().notNull(),
    question: text("question").notNull(),
    options: jsonb("options").$type<ScenarioOption[]>().notNull(),
    correctAnswer: varchar("correct_answer", { length: 1 }).notNull(),
    aiExplanation: text("ai_explanation").notNull(),
    teamLearning: text("team_learning"),
    alternativeLine: text("alternative_line"),
    coachNote: text("coach_note"),
    category: practiceCategoryEnum("category").notNull(),
    difficulty: integer("difficulty").default(2).notNull(),
    sourceType: scenarioSourceEnum("source_type").default("generic").notNull(),
    generatedForPlayerId: uuid("generated_for_player_id").references(() => players.id, {
      onDelete: "set null",
    }),
    targetWeaknessCategory: practiceCategoryEnum("target_weakness_category"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("scenarios_team_idx").on(t.teamId),
    index("scenarios_matchup_idx").on(t.matchupKey),
  ],
);

export const scenarioAttempts = pgTable(
  "scenario_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    scenarioId: uuid("scenario_id")
      .references(() => practiceScenarios.id, { onDelete: "cascade" })
      .notNull(),
    playerId: uuid("player_id")
      .references(() => players.id, { onDelete: "cascade" })
      .notNull(),
    chosenAnswer: varchar("chosen_answer", { length: 1 }).notNull(),
    correct: boolean("correct").notNull(),
    aiEvaluation: text("ai_evaluation"),
    category: practiceCategoryEnum("category").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("attempts_player_idx").on(t.playerId),
    index("attempts_category_idx").on(t.category),
  ],
);

// ---------------------------------------------------------------------------
// AI observations (team knowledge base)
// ---------------------------------------------------------------------------

export const aiObservations = pgTable(
  "ai_observations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teamId: uuid("team_id")
      .references(() => teams.id, { onDelete: "cascade" })
      .notNull(),
    sourceGameId: uuid("source_game_id").references(() => games.id, {
      onDelete: "set null",
    }),
    matchupKey: varchar("matchup_key", { length: 160 }),
    playerId: uuid("player_id").references(() => players.id, { onDelete: "set null" }),
    observation: text("observation").notNull(),
    category: practiceCategoryEnum("category").notNull(),
    confidence: real("confidence").default(0.5).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("observations_team_idx").on(t.teamId),
    index("observations_matchup_idx").on(t.matchupKey),
  ],
);

// ---------------------------------------------------------------------------
// Card reference (source-of-truth layer for the Rules Agent)
// ---------------------------------------------------------------------------

export const cardReferences = pgTable(
  "card_references",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 160 }).notNull(),
    setCode: varchar("set_code", { length: 20 }),
    inkColor: varchar("ink_color", { length: 20 }),
    cost: integer("cost"),
    type: varchar("type", { length: 40 }),
    text: text("text"),
    rulesNotes: text("rules_notes"),
    sourceUrl: text("source_url"),
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("card_references_name_idx").on(t.name)],
);

export const rulesAnswers = pgTable("rules_answers", {
  id: uuid("id").defaultRandom().primaryKey(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  kind: ruleAnswerKindEnum("kind").notNull(),
  sourceCardIds: jsonb("source_card_ids").$type<string[]>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Relations (for query API ergonomics)
// ---------------------------------------------------------------------------

export const teamsRelations = relations(teams, ({ many }) => ({
  members: many(teamMembers),
  decks: many(decks),
  matches: many(matches),
  observations: many(aiObservations),
  scenarios: many(practiceScenarios),
}));

export const playersRelations = relations(players, ({ many }) => ({
  teamMemberships: many(teamMembers),
  matches: many(matches),
  scenarioAttempts: many(scenarioAttempts),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, { fields: [teamMembers.teamId], references: [teams.id] }),
  player: one(players, { fields: [teamMembers.playerId], references: [players.id] }),
}));

export const decksRelations = relations(decks, ({ one, many }) => ({
  team: one(teams, { fields: [decks.teamId], references: [teams.id] }),
  owner: one(players, { fields: [decks.ownerPlayerId], references: [players.id] }),
  matches: many(matches),
}));

export const matchesRelations = relations(matches, ({ one, many }) => ({
  team: one(teams, { fields: [matches.teamId], references: [teams.id] }),
  player: one(players, { fields: [matches.playerId], references: [players.id] }),
  deck: one(decks, { fields: [matches.deckId], references: [decks.id] }),
  opponentDeck: one(decks, {
    fields: [matches.opponentDeckId],
    references: [decks.id],
  }),
  games: many(games),
}));

export const gamesRelations = relations(games, ({ one }) => ({
  match: one(matches, { fields: [games.matchId], references: [matches.id] }),
}));

export const practiceScenariosRelations = relations(practiceScenarios, ({ one, many }) => ({
  team: one(teams, { fields: [practiceScenarios.teamId], references: [teams.id] }),
  deck: one(decks, { fields: [practiceScenarios.deckId], references: [decks.id] }),
  attempts: many(scenarioAttempts),
}));

export const scenarioAttemptsRelations = relations(scenarioAttempts, ({ one }) => ({
  scenario: one(practiceScenarios, {
    fields: [scenarioAttempts.scenarioId],
    references: [practiceScenarios.id],
  }),
  player: one(players, { fields: [scenarioAttempts.playerId], references: [players.id] }),
}));

export const aiObservationsRelations = relations(aiObservations, ({ one }) => ({
  team: one(teams, { fields: [aiObservations.teamId], references: [teams.id] }),
  sourceGame: one(games, { fields: [aiObservations.sourceGameId], references: [games.id] }),
  player: one(players, { fields: [aiObservations.playerId], references: [players.id] }),
}));
