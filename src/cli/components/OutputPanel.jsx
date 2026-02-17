import React from 'react';
import { Box, Text } from 'ink';

/**
 * @typedef {Object} CliExecutionOutputItem
 * @property {string} [type]
 * @property {string} [text]
 * @property {string} [eventType]
 * @property {string} [actionType]
 * @property {string} [runId]
 * @property {string} [stepId]
 * @property {number} [instructionIndex]
 * @property {Record<string, unknown>} [payload]
 * @property {unknown} [metadata]
 */

/**
 * Scrollable output panel for agent actions and reasoning
 * @param {{ items: CliExecutionOutputItem[] }} props
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

/**
 * @param {{ item: CliExecutionOutputItem }} props
 */
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
        <Box flexDirection="column" marginTop={1}>
          <Text color="green" bold>[Assistant]</Text>
          <Text>{item.text}</Text>
        </Box>
      );

    case 'user':
      return (
        <Box marginTop={1}>
          <Text bold>You: </Text>
          <Text>{item.text}</Text>
        </Box>
      );

    case 'system':
      return (
        <Box marginTop={1}>
          <Text color="yellow">{item.text}</Text>
        </Box>
      );

    case 'error':
      return (
        <Box>
          <Text color="red">⚠️  {item.text}</Text>
        </Box>
      );

    case 'success':
      return (
        <Box>
          <Text color="green">✓ {item.text}</Text>
        </Box>
      );

    case 'test-name':
      return (
        <Box>
          <Text color="cyan">{item.text}</Text>
          <Text dimColor>  {item.metadata}</Text>
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
