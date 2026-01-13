import React, { useState, useEffect } from 'react';
import { Box } from 'ink';
import { StatusBar } from './components/StatusBar.jsx';
import { OutputPanel } from './components/OutputPanel.jsx';
import { InputPanel } from './components/InputPanel.jsx';
import { AgentStatus } from './components/AgentStatus.jsx';

/**
 * Main Ink App component - conversational split-pane UI
 */
export function App({ session, initialMode = 'command', onInput, onExit }) {
  const [mode, setMode] = useState(initialMode);
  const [testName, setTestName] = useState(null);
  const [output, setOutput] = useState([]);
  const [agentWorking, setAgentWorking] = useState(false);
  const [agentMessage, setAgentMessage] = useState('');
  const [inputDisabled, setInputDisabled] = useState(false);
  const [inputPlaceholder, setInputPlaceholder] = useState('Type a command or message...');
  const [activeDesignMode, setActiveDesignMode] = useState(null);

  // Context object passed to modes and commands
  const context = {
    // Output methods
    addOutput: (item) => {
      setOutput((prev) => [...prev, item]);
    },
    clearOutput: () => {
      setOutput([]);
    },

    // Agent status
    setAgentWorking: (working, message = '') => {
      setAgentWorking(working);
      setAgentMessage(message || (working ? 'Agent is working...' : ''));
    },

    // Mode management
    setMode: (newMode) => setMode(newMode),
    setTestName: (name) => setTestName(name),
    getMode: () => mode,

    // Input control
    setInputDisabled: (disabled) => setInputDisabled(disabled),
    setInputPlaceholder: (placeholder) => setInputPlaceholder(placeholder),

    // Session access
    session,

    // Design mode reference (for routing inputs)
    activeDesignMode: activeDesignMode,
    setActiveDesignMode: (mode) => setActiveDesignMode(mode),

    // Exit
    exit: () => {
      if (onExit) {
        onExit();
      }
    },
  };

  // Make context available globally for modes
  useEffect(() => {
    if (typeof global !== 'undefined') {
      global.inkContext = context;
    }
  }, [context]);

  // Show welcome message on mount
  useEffect(() => {
    context.addOutput({
      type: 'system',
      text: 'Welcome to droid-cua! Type /help for available commands.',
    });
  }, []); // Empty deps = run once on mount

  const handleInput = async (input) => {
    // Add user input to output
    context.addOutput({ type: 'user', text: input });

    // Call input handler
    if (onInput) {
      await onInput(input, context);
    }
  };

  return (
    <Box flexDirection="column" height="100%">
      <StatusBar mode={mode} deviceInfo={session?.deviceInfo} testName={testName} />

      <Box flexGrow={1} flexDirection="column" paddingBottom={1}>
        <OutputPanel items={output} />
        <AgentStatus isWorking={agentWorking} message={agentMessage} />
      </Box>

      <InputPanel
        onSubmit={handleInput}
        placeholder={inputPlaceholder}
        disabled={inputDisabled}
      />
    </Box>
  );
}
