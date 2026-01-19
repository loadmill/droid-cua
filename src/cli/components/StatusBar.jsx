import React from 'react';
import { Box, Text } from 'ink';

/**
 * Status bar showing current mode and device info
 */
export function StatusBar({ mode, deviceInfo, testName }) {
  const modeDisplay = mode === 'design'
    ? `Design Mode${testName ? `: ${testName}` : ''}`
    : mode === 'execution'
    ? `Execution Mode${testName ? `: ${testName}` : ''}`
    : 'Command Mode';

  const deviceDisplay = deviceInfo
    ? `${deviceInfo.scaled_width}x${deviceInfo.scaled_height}`
    : '';

  return (
    <Box borderStyle="single" borderColor="cyan" paddingX={1}>
      <Text bold color="cyan">
        droid-cua
      </Text>
      <Text dimColor> - </Text>
      <Text color="green">{modeDisplay}</Text>
      {deviceDisplay && (
        <>
          <Text dimColor> | </Text>
          <Text dimColor>{deviceDisplay}</Text>
        </>
      )}
    </Box>
  );
}
