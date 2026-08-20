CREATE TYPE "public"."match_kind" AS ENUM('practice', 'tournament');--> statement-breakpoint
CREATE TYPE "public"."match_result" AS ENUM('win', 'loss', 'draw');--> statement-breakpoint
CREATE TYPE "public"."note_tag" AS ENUM('mulligan', 'misplay', 'great_line', 'opponent_strategy', 'nothing');--> statement-breakpoint
CREATE TYPE "public"."play_draw" AS ENUM('play', 'draw', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."practice_category" AS ENUM('mulligan', 'sequencing', 'resource_management', 'board_control', 'lore_race', 'removal', 'character_management', 'challenge_decisions', 'ink_decisions', 'timing', 'win_condition', 'misplay', 'matchup_strategy');--> statement-breakpoint
CREATE TYPE "public"."rule_answer_kind" AS ENUM('verified_rule', 'strategic_recommendation', 'ai_inference');--> statement-breakpoint
CREATE TYPE "public"."scenario_kind" AS ENUM('matchup', 'mulligan', 'decision', 'random');--> statement-breakpoint
CREATE TYPE "public"."scenario_source" AS ENUM('historical', 'generic');--> statement-breakpoint
CREATE TYPE "public"."team_role" AS ENUM('admin', 'coach', 'player', 'guest');--> statement-breakpoint
CREATE TABLE "ai_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"source_game_id" uuid,
	"matchup_key" varchar(160),
	"player_id" uuid,
	"observation" text NOT NULL,
	"category" "practice_category" NOT NULL,
	"confidence" real DEFAULT 0.5 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "card_references" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(160) NOT NULL,
	"set_code" varchar(20),
	"ink_color" varchar(20),
	"cost" integer,
	"type" varchar(40),
	"text" text,
	"rules_notes" text,
	"source_url" text,
	"last_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "decks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"ink_colors" text[] NOT NULL,
	"version" varchar(40) DEFAULT 'v1' NOT NULL,
	"owner_player_id" uuid,
	"decklist" jsonb,
	"is_opponent_archetype" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"game_number" integer DEFAULT 1 NOT NULL,
	"result" "match_result" NOT NULL,
	"play_draw" "play_draw" DEFAULT 'unknown' NOT NULL,
	"mulligan_info" jsonb,
	"notes" text,
	"important_decisions" jsonb,
	"mistakes" jsonb,
	"turning_points" text,
	"note_tag" "note_tag",
	"note_detail" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"deck_id" uuid NOT NULL,
	"opponent_deck_id" uuid,
	"opponent_deck_label" varchar(120),
	"opponent_player_id" uuid,
	"result" "match_result" NOT NULL,
	"game_count" integer DEFAULT 1 NOT NULL,
	"kind" "match_kind" DEFAULT 'practice' NOT NULL,
	"played_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discord_user_id" varchar(32) NOT NULL,
	"display_name" varchar(120) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "practice_scenarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"kind" "scenario_kind" DEFAULT 'matchup' NOT NULL,
	"deck_id" uuid,
	"opponent_deck_label" varchar(120),
	"matchup_key" varchar(160) NOT NULL,
	"situation" jsonb NOT NULL,
	"question" text NOT NULL,
	"options" jsonb NOT NULL,
	"correct_answer" varchar(1) NOT NULL,
	"ai_explanation" text NOT NULL,
	"alternative_line" text,
	"coach_note" text,
	"category" "practice_category" NOT NULL,
	"difficulty" integer DEFAULT 2 NOT NULL,
	"source_type" "scenario_source" DEFAULT 'generic' NOT NULL,
	"generated_for_player_id" uuid,
	"target_weakness_category" "practice_category",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rules_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"kind" "rule_answer_kind" NOT NULL,
	"source_card_ids" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scenario_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scenario_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"chosen_answer" varchar(1) NOT NULL,
	"correct" boolean NOT NULL,
	"ai_evaluation" text,
	"category" "practice_category" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"role" "team_role" DEFAULT 'player' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"discord_guild_id" varchar(32),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teams_discord_guild_id_unique" UNIQUE("discord_guild_id")
);
--> statement-breakpoint
ALTER TABLE "ai_observations" ADD CONSTRAINT "ai_observations_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_observations" ADD CONSTRAINT "ai_observations_source_game_id_games_id_fk" FOREIGN KEY ("source_game_id") REFERENCES "public"."games"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_observations" ADD CONSTRAINT "ai_observations_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decks" ADD CONSTRAINT "decks_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decks" ADD CONSTRAINT "decks_owner_player_id_players_id_fk" FOREIGN KEY ("owner_player_id") REFERENCES "public"."players"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_opponent_deck_id_decks_id_fk" FOREIGN KEY ("opponent_deck_id") REFERENCES "public"."decks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_opponent_player_id_players_id_fk" FOREIGN KEY ("opponent_player_id") REFERENCES "public"."players"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_scenarios" ADD CONSTRAINT "practice_scenarios_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_scenarios" ADD CONSTRAINT "practice_scenarios_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_scenarios" ADD CONSTRAINT "practice_scenarios_generated_for_player_id_players_id_fk" FOREIGN KEY ("generated_for_player_id") REFERENCES "public"."players"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_attempts" ADD CONSTRAINT "scenario_attempts_scenario_id_practice_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."practice_scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_attempts" ADD CONSTRAINT "scenario_attempts_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "observations_team_idx" ON "ai_observations" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "observations_matchup_idx" ON "ai_observations" USING btree ("matchup_key");--> statement-breakpoint
CREATE INDEX "card_references_name_idx" ON "card_references" USING btree ("name");--> statement-breakpoint
CREATE INDEX "decks_team_idx" ON "decks" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "games_match_idx" ON "games" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "matches_team_idx" ON "matches" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "matches_player_idx" ON "matches" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "matches_deck_matchup_idx" ON "matches" USING btree ("deck_id","opponent_deck_label");--> statement-breakpoint
CREATE UNIQUE INDEX "players_discord_user_id_idx" ON "players" USING btree ("discord_user_id");--> statement-breakpoint
CREATE INDEX "scenarios_team_idx" ON "practice_scenarios" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "scenarios_matchup_idx" ON "practice_scenarios" USING btree ("matchup_key");--> statement-breakpoint
CREATE INDEX "attempts_player_idx" ON "scenario_attempts" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "attempts_category_idx" ON "scenario_attempts" USING btree ("category");--> statement-breakpoint
CREATE UNIQUE INDEX "team_members_team_player_idx" ON "team_members" USING btree ("team_id","player_id");