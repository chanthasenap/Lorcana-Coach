// Slash command definitions registered with Discord (see scripts/register-commands.ts).
// Discord option type numbers: SUB_COMMAND=1, STRING=3, INTEGER=4.

export const commandDefinitions = [
  {
    name: "practice",
    description: "Start a Lorcana competitive practice session",
    options: [],
  },
  {
    name: "coach",
    description: "Get your personalized training priorities",
    options: [],
  },
  {
    name: "record",
    description: "Quickly record a match you just played",
    options: [],
  },
  {
    name: "analyze",
    description: "Analyze recent games or a specific matchup",
    options: [
      {
        name: "last",
        description: "Analyze your last N games",
        type: 1, // SUB_COMMAND
        options: [
          {
            name: "count",
            description: "How many recent games to analyze (default 20)",
            type: 4, // INTEGER
            required: false,
            min_value: 1,
            max_value: 100,
          },
        ],
      },
      {
        name: "matchup",
        description: "Analyze a specific matchup",
        type: 1,
        options: [
          {
            name: "opponent",
            description: "Opponent deck / archetype label, e.g. amber-emerald",
            type: 3, // STRING
            required: true,
          },
        ],
      },
    ],
  },
  {
    name: "help",
    description: "Show what the Lorcana Coach bot can do",
    options: [],
  },
] as const;
