import React, { useState } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';

/**
 * Always-active input panel at the bottom
 */
export function InputPanel({ onSubmit, placeholder, disabled }) {
  const [value, setValue] = useState('');

  const handleSubmit = (submittedValue) => {
    if (submittedValue.trim().length === 0) {
      return;
    }

    onSubmit(submittedValue.trim());
    setValue('');
  };

  if (disabled) {
    return (
      <Box borderStyle="single" borderColor="gray" paddingX={1}>
        <Text dimColor>Input disabled...</Text>
      </Box>
    );
  }

  return (
    <Box borderStyle="single" borderColor="cyan" paddingX={1}>
      <Text color="cyan" bold>&gt; </Text>
      <TextInput
        value={value}
        onChange={setValue}
        onSubmit={handleSubmit}
        placeholder={placeholder || 'Type a command or message...'}
        placeholderColor="gray"
      />
    </Box>
  );
}
