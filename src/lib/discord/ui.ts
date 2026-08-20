import {
  InteractionResponseType,
  InteractionResponseFlags,
  MessageComponentTypes,
  ButtonStyleTypes,
  type ActionRow,
  type Button,
  type StringSelect,
  type StringSelectOption,
} from "discord-interactions";

// Esports-y accent color used across every embed for visual consistency.
export const BRAND_COLOR = 0x7c5cff;
export const SUCCESS_COLOR = 0x2ecc71;
export const WARN_COLOR = 0xf5a623;
export const DANGER_COLOR = 0xe74c3c;

export type Embed = {
  title?: string;
  description?: string;
  color?: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
  timestamp?: string;
};

export function button(
  customId: string,
  label: string,
  style: ButtonStyleTypes = ButtonStyleTypes.SECONDARY,
  disabled = false,
): Button {
  return {
    type: MessageComponentTypes.BUTTON,
    custom_id: customId,
    label,
    style,
    disabled,
  } as Button;
}

export function actionRow(components: ActionRow["components"]): ActionRow {
  return { type: MessageComponentTypes.ACTION_ROW, components };
}

export function stringSelect(
  customId: string,
  placeholder: string,
  options: StringSelectOption[],
): StringSelect {
  return {
    type: MessageComponentTypes.STRING_SELECT,
    custom_id: customId,
    placeholder,
    options,
  };
}

/** A normal, immediate channel message (used for direct replies). */
export function messageResponse(
  content: string | undefined,
  embeds: Embed[] = [],
  components: ActionRow[] = [],
  ephemeral = false,
) {
  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content,
      embeds,
      components,
      flags: ephemeral ? InteractionResponseFlags.EPHEMERAL : undefined,
    },
  };
}

/** Acknowledges immediately, tells Discord more content is coming via the follow-up webhook. */
export function deferredResponse(ephemeral = false) {
  return {
    type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
    data: { flags: ephemeral ? InteractionResponseFlags.EPHEMERAL : undefined },
  };
}

/** Edits the message a button/select is attached to, in place. */
export function updateMessageResponse(
  content: string | undefined,
  embeds: Embed[] = [],
  components: ActionRow[] = [],
) {
  return {
    type: InteractionResponseType.UPDATE_MESSAGE,
    data: { content, embeds, components },
  };
}

/** Acknowledges a component click with no visible change yet (edit comes later via `after()`). */
export function deferredUpdateResponse() {
  return { type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE };
}

export function modalResponse(
  customId: string,
  title: string,
  fields: { customId: string; label: string; style: 1 | 2; placeholder?: string; required?: boolean; value?: string }[],
) {
  return {
    type: InteractionResponseType.MODAL,
    data: {
      custom_id: customId,
      title,
      components: fields.map((f) => ({
        type: MessageComponentTypes.LABEL,
        label: f.label,
        component: {
          type: MessageComponentTypes.INPUT_TEXT,
          custom_id: f.customId,
          style: f.style,
          placeholder: f.placeholder,
          required: f.required ?? false,
          value: f.value,
        },
      })),
    },
  };
}

export { ButtonStyleTypes, MessageComponentTypes };
