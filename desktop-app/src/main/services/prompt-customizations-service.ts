import { getSettings } from './settings-service';

export interface PromptCustomizations {
  basePromptInstructions: string;
  designModeInstructions: string;
  executionModeInstructions: string;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export async function getPromptCustomizations(): Promise<PromptCustomizations> {
  const settings = await getSettings();
  const raw =
    settings && typeof settings === 'object' && settings.promptCustomizations && typeof settings.promptCustomizations === 'object'
      ? (settings.promptCustomizations as Record<string, unknown>)
      : {};

  return {
    basePromptInstructions: asString(raw.basePromptInstructions),
    designModeInstructions: asString(raw.designModeInstructions),
    executionModeInstructions: asString(raw.executionModeInstructions)
  };
}
