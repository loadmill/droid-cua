import React from 'react';
import { Box, Text } from 'ink';

/**
 * Scrollable output panel for agent actions and reasoning
 */
export function OutputPanel({ items }) {
  if (items.length === 0) {
    return (
      <Box flexDirection="column" paddingX={1} paddingY={1}>
        <Text dimColor>Waiting for input...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={1} paddingY={1}>
      {items.map((item, index) => (
        <OutputItem key={index} item={item} />
      ))}
    </Box>
  );
}

function OutputItem({ item }) {
  switch (item.type) {
    case 'reasoning':
      return (
        <Box>
          <Text color="magenta">[Reasoning]</Text>
          <Text> {item.text}</Text>
        </Box>
      );

    case 'action':
      return (
        <Box>
          <Text color="blue">{item.text}</Text>
        </Box>
      );

    case 'assistant':
      return (
        <Box flexDirection="column" marginY={1}>
          <Text color="green" bold>[Assistant]</Text>
          <Text>{item.text}</Text>
        </Box>
      );

    case 'user':
      return (
        <Box marginY={1}>
          <Text bold>You: </Text>
          <Text>{item.text}</Text>
        </Box>
      );

    case 'system':
      return (
        <Box marginY={1}>
          <Text color="yellow">{item.text}</Text>
        </Box>
      );

    case 'error':
      return (
        <Box marginY={1}>
          <Text color="red">⚠️  {item.text}</Text>
        </Box>
      );

    case 'success':
      return (
        <Box marginY={1}>
          <Text color="green">✓ {item.text}</Text>
        </Box>
      );

    case 'info':
      return (
        <Box>
          <Text dimColor>{item.text}</Text>
        </Box>
      );

    default:
      return (
        <Box>
          <Text>{item.text || ''}</Text>
        </Box>
      );
  }
}
