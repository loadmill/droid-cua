import React from 'react';
import { Box, Text } from 'ink';

/**
 * Command suggestions shown when user types "/"
 */
export function CommandSuggestions({ input, commands }) {
  const MAX_VISIBLE = 6;
  const HEADER_LINES = 1;
  const PANEL_HEIGHT = HEADER_LINES + MAX_VISIBLE;

  // Only show suggestions if input starts with /
  if (!input.startsWith('/')) {
    return null;
  }

  // Extract the command part (without the /)
  const commandPart = input.slice(1).toLowerCase();

  // Filter commands that match
  const suggestions = Object.entries(commands)
    .filter(([cmd]) => cmd.toLowerCase().startsWith(commandPart))
    .sort()
    .slice(0, MAX_VISIBLE);

  const usedLines = HEADER_LINES + suggestions.length;
  const padLines = Math.max(0, PANEL_HEIGHT - usedLines);

  return (
    <Box flexDirection="column" paddingX={1} height={PANEL_HEIGHT}>
      <Text dimColor>Available commands:</Text>
      {suggestions.map(([cmd, description]) => (
        <Box key={cmd}>
          <Text color="cyan">  /{cmd}</Text>
          <Text dimColor> - {description}</Text>
        </Box>
      ))}
      {Array.from({ length: padLines }).map((_, i) => (
        <Text key={`pad-${i}`}> </Text>
      ))}
    </Box>
  );
}
