import { useEffect, useState } from 'react';
import { DcuaFile, Device, Project, RailSection, SessionLine, TestSession } from '../types';

interface MainPaneProps {
  section: RailSection;
  project: Project | null;
  activeSession: TestSession | null;
  activeDevice: Device | null;
  selectedTest: DcuaFile | null;
  isExecuting: boolean;
  onSaveTest: (testId: string, content: string) => void;
  onDeleteTest: (testId: string) => void;
  onRunTest: () => void;
  onStopExecution: () => void;
}

const deviceLogLines = [
  'Platform: ios',
  'Appium server is already running',
  'Found simulator "iPhone 16" with UDID: 8E4CBB17-0142-40C7-8061-79A85FDEE542',
  'Simulator "iPhone 16" is already booted',
  'Creating Appium session...',
  'Connected to simulator "iPhone 16" (8E4CBB17-0142-40C7-8061-79A85FDEE542)',
  'Device pixel ratio: 3x (1178x2556 pixels, 393x852 points)',
  'Using real resolution: 1178x2556',
  'Model sees resolution: 400x868'
];

const designModeEntries: Array<
  | { id: string; type: 'system'; text: string }
  | { id: string; type: 'assistant'; text: string }
  | { id: string; type: 'reasoning'; text: string }
  | { id: string; type: 'action'; text: string }
  | { id: string; type: 'user'; text: string }
> = [
  {
    id: 'usr-1',
    type: 'user',
    text: 'Open the reminders app, create a new reminder titled demo, then swipe and delete it.'
  },
  { id: 'ast-1', type: 'assistant', text: 'Capturing screen...' },
  { id: 'rea-1', type: 'reasoning', text: 'Accessing Reminders app for reminder flow.' },
  { id: 'act-1', type: 'action', text: 'Scrolling by (0, 236) points' },
  { id: 'act-2', type: 'action', text: 'Tapping at (187, 708) points' },
  { id: 'rea-2', type: 'reasoning', text: 'Creating new reminder titled "demo".' },
  { id: 'act-3', type: 'action', text: 'Typing text: demo' },
  { id: 'rea-3', type: 'reasoning', text: 'Saving reminder by clicking Done.' },
  { id: 'act-4', type: 'action', text: 'Tapping at (358, 78) points' },
  { id: 'assistant-end', type: 'assistant', text: 'Agent is exploring autonomously...' }
];

function formatUserText(text: string) {
  return text.replace(/^You:\s*/i, '');
}

function lineClassName(kind: SessionLine['kind']) {
  if (kind === 'assistant') {
    return 'message message--assistant';
  }
  if (kind === 'reasoning') {
    return 'message message--reasoning';
  }
  if (kind === 'warning') {
    return 'message message--warning';
  }
  if (kind === 'action') {
    return 'message message--action';
  }
  if (kind === 'muted') {
    return 'message message--muted';
  }
  return 'message';
}

function DeviceSetupPane() {
  return (
    <section className="device-flow" aria-label="Device management flow">
      <div className="device-flow__scroll">
        <div className="device-controls">
          <div className="device-row">
            <div className="device-row__text">
              <strong>Platform</strong>
              <span>Choose target runtime</span>
            </div>
            <div className="segmented">
              <button type="button" className="segmented__item">
                Android
              </button>
              <button type="button" className="segmented__item segmented__item--active">
                iOS
              </button>
            </div>
          </div>

          <div className="device-row">
            <div className="device-row__text">
              <strong>Simulator</strong>
              <span>Select and connect a booted device</span>
            </div>
            <button type="button" className="device-select">
              <span>iPhone 16 (running) - iOS 18.6</span>
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="m4.5 6 3.5 4 3.5-4" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          <div className="device-row device-row--compact">
            <div className="device-actions">
              <button type="button" className="action-btn action-btn--ghost">
                Refresh
              </button>
              <button type="button" className="action-btn action-btn--primary">
                Connect
              </button>
            </div>
          </div>
        </div>

        <div className="device-log">
          <div className="device-log__header">
            <strong>Connection Log</strong>
            <button type="button" className="action-btn action-btn--ghost">
              Clear
            </button>
          </div>
          {deviceLogLines.map((line) => (
            <p key={line} className="device-log__line">
              {line}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}

function SessionExecutionPane({ activeSession }: { activeSession: TestSession | null }) {
  return (
    <section className="terminal" aria-label="Current droid-cua session output">
      <div className="terminal__scroll">
        {activeSession?.lines.map((line) => {
          if (line.kind === 'plain') {
            return <div key={line.id} className="message-spacer" aria-hidden="true" />;
          }

          if (!line.text.trim()) {
            return null;
          }

          if (line.kind === 'user') {
            return (
              <div key={line.id} className="message-row message-row--user">
                <div className="message message--user">{formatUserText(line.text)}</div>
              </div>
            );
          }

          return (
            <div key={line.id} className="message-row">
              <p className={lineClassName(line.kind)}>{line.text}</p>
            </div>
          );
        })}
      </div>

      <ComposerBar placeholder="Ask about this run or suggest the next step..." />
    </section>
  );
}

function DesignModePane() {
  return (
    <section className="terminal" aria-label="Design mode output">
      <div className="terminal__scroll">
        <div className="design-intro">
          <p className="design-intro__title">Design Mode: Creating test "new-ios-demo"</p>
          <p className="design-intro__desc">Describe what you want to test. The agent will explore autonomously.</p>
          <p className="design-intro__prompt">What do you want to test?</p>
        </div>
        {designModeEntries.map((entry) => {
          if (entry.type === 'user') {
            return (
              <div key={entry.id} className="message-row message-row--user">
                <div className="design-user-group">
                  <div className="message message--user">{entry.text}</div>
                </div>
              </div>
            );
          }

          if (entry.type === 'system') {
            return (
              <div key={entry.id} className="message-row">
                <p className="plain-line plain-line--system">{entry.text}</p>
              </div>
            );
          }

          const klass =
            entry.type === 'assistant'
              ? 'message message--assistant'
              : entry.type === 'reasoning'
                ? 'message message--reasoning'
                : 'message message--action';

          return (
            <div key={entry.id} className="message-row">
              <p className={klass}>{entry.text}</p>
            </div>
          );
        })}
      </div>
      <ComposerBar placeholder="Describe what you want to test..." />
    </section>
  );
}

function TestCodePane({
  selectedTest,
  onSaveTest,
  onDeleteTest,
  onRunTest
}: {
  selectedTest: DcuaFile;
  onSaveTest: (testId: string, content: string) => void;
  onDeleteTest: (testId: string) => void;
  onRunTest: () => void;
}) {
  const [draft, setDraft] = useState(selectedTest.content);

  useEffect(() => {
    setDraft(selectedTest.content);
  }, [selectedTest.id, selectedTest.content]);

  const isDirty = draft !== selectedTest.content;

  return (
    <section className="terminal" aria-label="Selected test code">
      <div className="terminal__scroll terminal__scroll--plain">
        <p className="plain-line plain-line--title">Test: {selectedTest.name.replace(/\.dcua$/i, '')}</p>
        <div className="editor-actions">
          <button type="button" className="action-btn action-btn--ghost" onClick={() => onSaveTest(selectedTest.id, draft)} disabled={!isDirty}>
            Save
          </button>
          <button type="button" className="action-btn action-btn--danger" onClick={() => onDeleteTest(selectedTest.id)}>
            Delete
          </button>
          <button type="button" className="action-btn action-btn--primary" onClick={onRunTest}>
            Run Test
          </button>
        </div>
        <textarea
          className="test-editor"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          spellCheck={false}
          aria-label="Test script editor"
        />
        <p className="plain-line plain-line--muted">{draft.split('\n').length} lines total</p>
      </div>
      <ComposerBar placeholder="Edit test steps, then save or run..." />
    </section>
  );
}

function ComposerBar({ placeholder }: { placeholder: string }) {
  return (
    <div className="composer-wrap">
      <div className="composer">
        <div className="composer__input">{placeholder}</div>
        <div className="composer__bottom">
          <div className="composer__left" />
          <div className="composer__right">
            <button type="button" className="icon-btn" aria-label="Mic">
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <rect x="5.6" y="2.4" width="4.8" height="7.2" rx="2.4" fill="none" stroke="currentColor" strokeWidth="1.2" />
                <path d="M4.2 7.9c0 2 1.7 3.6 3.8 3.6s3.8-1.6 3.8-3.6M8 11.5v2.1M6 13.6h4" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </button>
            <button type="button" className="send-btn" aria-label="Send">
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M8 12.8V4.6M4.5 8.2 8 4.6l3.5 3.6" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MainPane({
  section,
  project,
  activeSession,
  activeDevice,
  selectedTest,
  isExecuting,
  onSaveTest,
  onDeleteTest,
  onRunTest,
  onStopExecution
}: MainPaneProps) {
  const newTestTitle = isExecuting
    ? `Execution: ${selectedTest?.name.replace(/\.dcua$/i, '') ?? 'current test'}`
    : selectedTest
      ? `Test Code: ${selectedTest.name.replace(/\.dcua$/i, '')}`
      : 'Design Mode: new-ios-demo';

  return (
    <main className="session-pane">
      <header className="session-header">
        <div className="session-header__title">
          <strong>{section === 'devices' ? 'Device Setup' : newTestTitle}</strong>
          <span>{project?.name ?? 'No project selected'}</span>
        </div>
        <div className="session-header__meta">
          <span className="chip">{section === 'devices' ? 'Device management mode' : isExecuting ? 'Execution mode' : 'Design mode'}</span>
          <span className="chip">{activeDevice ? `${activeDevice.name} · ${activeDevice.osVersion}` : 'No device selected'}</span>
          {section !== 'devices' && isExecuting ? (
            <button type="button" className="action-btn action-btn--ghost" onClick={onStopExecution}>
              Stop
            </button>
          ) : null}
        </div>
      </header>

      {section === 'devices' ? (
        <DeviceSetupPane />
      ) : isExecuting ? (
        <SessionExecutionPane activeSession={activeSession} />
      ) : selectedTest ? (
        <TestCodePane selectedTest={selectedTest} onSaveTest={onSaveTest} onDeleteTest={onDeleteTest} onRunTest={onRunTest} />
      ) : (
        <DesignModePane />
      )}
    </main>
  );
}
