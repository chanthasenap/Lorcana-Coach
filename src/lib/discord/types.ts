// Minimal typing for the subset of the Discord Interactions payload this app
// uses. Not exhaustive - extend as new fields are needed.
// https://discord.com/developers/docs/interactions/receiving-and-responding

export type DiscordUser = {
  id: string;
  username: string;
  global_name?: string | null;
};

export type DiscordInteractionOption = {
  name: string;
  type: number;
  value?: string | number | boolean;
  options?: DiscordInteractionOption[];
  focused?: boolean;
};

export type DiscordInteractionData = {
  id?: string;
  name?: string; // command name, or component custom_id is separate
  custom_id?: string; // for buttons / selects / modal submits
  component_type?: number;
  values?: string[]; // select menu chosen values
  options?: DiscordInteractionOption[]; // command options
  components?: {
    type: number;
    component?: { custom_id: string; value?: string };
    id?: number;
  }[]; // modal submit fields (label/text input wrapper)
};

export type DiscordInteraction = {
  id: string;
  application_id: string;
  type: number;
  token: string;
  guild_id?: string;
  channel_id?: string;
  member?: { user: DiscordUser; nick?: string | null };
  user?: DiscordUser;
  data?: DiscordInteractionData;
  message?: { id: string; interaction_metadata?: { id: string } };
};

export function interactionUser(interaction: DiscordInteraction): DiscordUser | undefined {
  return interaction.member?.user ?? interaction.user;
}

/** Reads a top-level string/number/boolean option by name from a slash command invocation. */
export function getOption<T extends string | number | boolean = string>(
  interaction: DiscordInteraction,
  name: string,
): T | undefined {
  return interaction.data?.options?.find((o) => o.name === name)?.value as T | undefined;
}

/** Reads a subcommand's options, e.g. `/analyze last count:20` -> subcommand "last", option "count". */
export function getSubcommand(
  interaction: DiscordInteraction,
): { name: string; options: DiscordInteractionOption[] } | undefined {
  const sub = interaction.data?.options?.find((o) => o.type === 1 || o.type === 2);
  if (!sub) return undefined;
  return { name: sub.name, options: sub.options ?? [] };
}

/** Reads modal submit text-input values, keyed by custom_id. */
export function getModalValues(interaction: DiscordInteraction): Record<string, string> {
  const values: Record<string, string> = {};
  // Modal submits come through as an array of "label" wrapper components in
  // newer payloads, or action-row-wrapped text inputs in older ones - handle
  // both by walking components recursively.
  function walk(components: DiscordInteractionData["components"]) {
    for (const c of components ?? []) {
      const anyC = c as unknown as {
        custom_id?: string;
        value?: string;
        components?: DiscordInteractionData["components"];
        component?: { custom_id?: string; value?: string };
      };
      if (anyC.custom_id && typeof anyC.value === "string") {
        values[anyC.custom_id] = anyC.value;
      }
      // Newer "Label" wrapper format (what `modalResponse()` builds): the
      // actual text input - with its own custom_id/value - is nested one
      // level down under `component`, not spread onto the wrapper itself.
      if (anyC.component?.custom_id && typeof anyC.component.value === "string") {
        values[anyC.component.custom_id] = anyC.component.value;
      }
      if (anyC.components) walk(anyC.components);
    }
  }
  walk(interaction.data?.components);
  return values;
}
