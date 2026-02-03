import React, { useState, useEffect } from 'react';
import { Box, useInput } from 'ink';
import { StatusBar } from './components/StatusBar.js';
import { OutputPanel } from './components/OutputPanel.js';
import { InputPanel } from './components/InputPanel.js';
import { AgentStatus } from './components/AgentStatus.js';
import { CommandSuggestions } from './components/CommandSuggestions.js';
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
  const [commandHistory, setCommandHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [tempInput, setTempInput] = useState(''); // Store current typing when navigating history

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

  // Handle up/down arrow keys for command history
  useInput((input, key) => {
    if (inputDisabled) return;

    if (key.upArrow && commandHistory.length > 0) {
      const newIndex = historyIndex === -1
        ? commandHistory.length - 1
        : Math.max(0, historyIndex - 1);

      if (historyIndex === -1) {
        setTempInput(inputValue); // Save current input
      }
      setHistoryIndex(newIndex);
      setInputValue(commandHistory[newIndex]);
    }

    if (key.downArrow) {
      if (historyIndex === -1) return;

      const newIndex = historyIndex + 1;
      if (newIndex >= commandHistory.length) {
        setHistoryIndex(-1);
        setInputValue(tempInput); // Restore saved input
      } else {
        setHistoryIndex(newIndex);
        setInputValue(commandHistory[newIndex]);
      }
    }
  });

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

    // Add to command history (avoid duplicates of last command)
    if (input && input !== commandHistory[commandHistory.length - 1]) {
      setCommandHistory(prev => [...prev, input]);
    }
    setHistoryIndex(-1);
    setTempInput('');

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
