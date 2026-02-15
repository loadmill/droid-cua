import React from 'react';
import { Box, Text } from 'ink';

/**
 * Command and test suggestions shown when user types "/" or "/run "
 */
export function CommandSuggestions({ input, commands, tests = [] }) {
  const MAX_VISIBLE = 6;
  const HEADER_LINES = 1;
  const PANEL_HEIGHT = HEADER_LINES + MAX_VISIBLE;

  // Only show suggestions if input starts with /
  if (!input.startsWith('/')) {
    return null;
  }

  const parts = input.slice(1).split(' ');
  const commandPart = parts[0].toLowerCase();
  const hasSpace = input.includes(' ');

  // Check if we should show test suggestions
  const testCommands = ['run', 'view', 'edit'];
  if (hasSpace && testCommands.includes(commandPart)) {
    const testPart = parts.slice(1).join(' ').toLowerCase();

    // Filter tests that match
    const suggestions = tests
      .filter(t => t.toLowerCase().startsWith(testPart))
      .sort()
      .slice(0, MAX_VISIBLE);

    if (suggestions.length === 0 && testPart.length === 0) {
      // Show all tests if nothing typed yet
      const allTests = tests.slice(0, MAX_VISIBLE);
      const usedLines = HEADER_LINES + allTests.length;
      const padLines = Math.max(0, PANEL_HEIGHT - usedLines);

      return (
        <Box flexDirection="column" paddingX={1} height={PANEL_HEIGHT}>
          <Text dimColor>Available tests: <Text color="gray">(Tab to complete)</Text></Text>
          {allTests.map((test) => (
            <Box key={test}>
              <Text color="green">  {test}</Text>
            </Box>
          ))}
          {allTests.length === 0 && (
            <Text dimColor>  No tests found. Use /create to make one.</Text>
          )}
          {Array.from({ length: padLines }).map((_, i) => (
            <Text key={`pad-${i}`}> </Text>
          ))}
        </Box>
      );
    }

    const usedLines = HEADER_LINES + suggestions.length;
    const padLines = Math.max(0, PANEL_HEIGHT - usedLines);

    return (
      <Box flexDirection="column" paddingX={1} height={PANEL_HEIGHT}>
        <Text dimColor>Matching tests: <Text color="gray">(Tab to complete)</Text></Text>
        {suggestions.map((test) => (
          <Box key={test}>
            <Text color="green">  {test}</Text>
          </Box>
        ))}
        {Array.from({ length: padLines }).map((_, i) => (
          <Text key={`pad-${i}`}> </Text>
        ))}
      </Box>
    );
  }

  // Show command suggestions
  const suggestions = Object.entries(commands)
    .filter(([cmd]) => cmd.toLowerCase().startsWith(commandPart))
    .sort()
    .slice(0, MAX_VISIBLE);

  const usedLines = HEADER_LINES + suggestions.length;
  const padLines = Math.max(0, PANEL_HEIGHT - usedLines);

  return (
    <Box flexDirection="column" paddingX={1} height={PANEL_HEIGHT}>
      <Text dimColor>Available commands: <Text color="gray">(Tab to complete)</Text></Text>
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
