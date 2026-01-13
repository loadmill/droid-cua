import React from 'react';
import { Box, Text } from 'ink';

/**
 * Command suggestions shown when user types "/"
 */
export function CommandSuggestions({ input, commands }) {
  // Only show suggestions if input starts with /
  if (!input.startsWith('/')) {
    return null;
  }

  // Extract the command part (without the /)
  const commandPart = input.slice(1).toLowerCase();

  // Filter commands that match
  const suggestions = Object.entries(commands)
    .filter(([cmd]) => cmd.toLowerCase().startsWith(commandPart))
    .sort();

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <Box flexDirection="column" marginTop={1} paddingX={1}>
      <Text dimColor>Available commands:</Text>
      {suggestions.map(([cmd, description]) => (
        <Box key={cmd}>
          <Text color="cyan">  /{cmd}</Text>
          <Text dimColor> - {description}</Text>
        </Box>
      ))}
    </Box>
  );
}
