import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';

/**
 * Live status indicator for agent activity
 */
export function AgentStatus({ isWorking, message }) {
  if (!isWorking && !message) {
    return null;
  }

  if (isWorking) {
    return (
      <Box marginTop={1}>
        <Text color="yellow">
          <Spinner type="dots" />
        </Text>
        <Text dimColor> {message || 'Agent is working...'}</Text>
      </Box>
    );
  }

  return (
    <Box marginTop={1}>
      <Text dimColor>{message}</Text>
    </Box>
  );
}
