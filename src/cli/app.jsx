import React, { useState, useEffect } from 'react';
import { Box } from 'ink';
import { StatusBar } from './components/StatusBar.jsx';
import { OutputPanel } from './components/OutputPanel.jsx';
import { InputPanel } from './components/InputPanel.jsx';
import { AgentStatus } from './components/AgentStatus.jsx';
import { CommandSuggestions } from './components/CommandSuggestions.jsx';
import { COMMANDS } from './command-parser.js';

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
  const [activeExecutionMode, setActiveExecutionMode] = useState(null);
  const [isExecutionMode, setIsExecutionMode] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [inputResolver, setInputResolver] = useState(null); // For waiting on user input

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

    // Execution mode flag (to restrict inputs during test execution)
    isExecutionMode: isExecutionMode,
    setExecutionMode: (executing) => setIsExecutionMode(executing),

    // Session access
    session,

    // Design mode reference (for routing inputs)
    activeDesignMode: activeDesignMode,
    setActiveDesignMode: (mode) => setActiveDesignMode(mode),

    // Execution mode reference (for /stop command)
    activeExecutionMode: activeExecutionMode,
    setActiveExecutionMode: (mode) => setActiveExecutionMode(mode),

    // Exit
    exit: () => {
      if (onExit) {
        onExit();
      }
    },

    // Wait for user input (for prompts during execution)
    waitForUserInput: () => {
      return new Promise((resolve) => {
        setInputResolver(() => resolve);
      });
    },
  };

  // Make context available globally for modes
  useEffect(() => {
    if (typeof global !== 'undefined') {
      global.inkContext = context;
    }
  }, [context]);

  // Show welcome banner on mount
  useEffect(() => {
    const banner = `
 _                    _           _ _ _       _           _     _
| |    ___   __ _  __| |_ __ ___ (_) | |   __| |_ __ ___ (_) __| |       ___ _   _  __ _
| |   / _ \\ / _\` |/ _\` | '_ \` _ \\| | | |  / _\` | '__/ _ \\| |/ _\` |_____ / __| | | |/ _\` |
| |__| (_) | (_| | (_| | | | | | | | | | | (_| | | | (_) | | (_| |_____| (__| |_| | (_| |
|_____\\___/ \\__,_|\\__,_|_| |_| |_|_|_|_|  \\__,_|_|  \\___/|_|\\__,_|      \\___|\\__,_|\\__,_|
`;
    context.addOutput({ type: 'system', text: banner });
    context.addOutput({ type: 'info', text: 'Type /help for available commands.' });
    context.addOutput({ type: 'info', text: '' });
  }, []); // Empty deps = run once on mount

  const handleInput = async (input) => {
    // Check if we're waiting for user input (e.g., assertion failure prompt)
    if (inputResolver) {
      // Resolve the waiting promise with the user's input
      inputResolver(input);
      setInputResolver(null);
      setInputValue('');
      return;
    }

    // Add user input to output
    context.addOutput({ type: 'user', text: input });

    // Clear input value
    setInputValue('');

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

      <Box flexDirection="column">
        <InputPanel
          value={inputValue}
          onChange={setInputValue}
          onSubmit={handleInput}
          placeholder={inputPlaceholder}
          disabled={inputDisabled}
        />
        <CommandSuggestions input={inputValue} commands={COMMANDS} />
      </Box>
    </Box>
  );
}
