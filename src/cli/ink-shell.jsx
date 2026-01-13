import React from 'react';
import { render } from 'ink';
import { App } from './app.jsx';
import { parseInput } from './command-parser.js';
import { routeCommand } from '../commands/index.js';

/**
 * Start the Ink-based conversational shell
 * @param {Object} session - Session object with device info
 * @param {Object} executionEngine - Execution engine instance
 * @returns {Promise<void>}
 */
export async function startInkShell(session, executionEngine) {
  let shouldExit = false;

  const handleInput = async (input, context) => {
    // Check if there's an active design mode - route input to it
    if (context.activeDesignMode) {
      context.activeDesignMode.handleUserInput(input);
      return;
    }

    // Parse input
    const parsed = parseInput(input);

    // During execution mode, only allow commands (not free text)
    if (context.isExecutionMode && parsed.type !== 'command') {
      context.addOutput({
        type: 'error',
        text: 'Cannot interrupt test execution with instructions. Use /stop or /exit to stop the test.',
      });
      return;
    }

    if (parsed.type === 'command') {
      // Route to command handler
      const shouldContinue = await routeCommand(
        parsed.command,
        parsed.args,
        session,
        { ...context, engine: executionEngine }
      );

      if (!shouldContinue) {
        shouldExit = true;
        context.exit();
      }
    } else {
      // In command mode, instructions aren't supported
      if (context.getMode() === 'command') {
        context.addOutput({
          type: 'error',
          text: 'Direct instructions only work in execution or design mode. Use /run or /create commands.',
        });
      }
    }
  };

  const handleExit = () => {
    shouldExit = true;
  };

  // Render the Ink app
  const { unmount, waitUntilExit } = render(
    <App
      session={session}
      initialMode="command"
      onInput={handleInput}
      onExit={handleExit}
    />
  );

  // Wait for exit
  await waitUntilExit();

  return { unmount };
}
