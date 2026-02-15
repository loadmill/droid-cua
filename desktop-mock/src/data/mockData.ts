import { DcuaFile, Device, NewTestDraft, Project, TestSession } from '../types';

export const projects: Project[] = [
  {
    id: 'proj-mobile-shop',
    name: 'cua-example',
    path: '/Users/idoco/Code/droid-cua',
    testCount: 14,
    activeDeviceId: 'device-pixel-8'
  },
  {
    id: 'proj-banking',
    name: 'banking-app',
    path: '/Users/idoco/Code/banking-tests',
    testCount: 31,
    activeDeviceId: null
  },
  {
    id: 'proj-retail',
    name: 'retail-android',
    path: '/Users/idoco/Code/retail-android-tests',
    testCount: 21,
    activeDeviceId: 'device-galaxy-s23'
  }
];

export const devices: Device[] = [
  {
    id: 'device-pixel-8',
    name: 'Pixel 8 Emulator',
    platform: 'android',
    osVersion: 'Android 15',
    status: 'connected',
    lastSeen: 'just now'
  },
  {
    id: 'device-galaxy-s23',
    name: 'Galaxy S23',
    platform: 'android',
    osVersion: 'Android 14',
    status: 'pairing',
    lastSeen: '1m ago'
  },
  {
    id: 'device-iphone-15',
    name: 'iPhone 15 Pro',
    platform: 'ios',
    osVersion: 'iOS 18.3',
    status: 'disconnected',
    lastSeen: '2h ago'
  }
];

export const sessions: TestSession[] = [
  {
    id: 'session-reminders-demo',
    title: 'Current droid-cua session',
    projectId: 'proj-mobile-shop',
    state: 'running',
    startedAt: '09:41',
    lines: [
      { id: '1', kind: 'user', text: 'You: Open Reminders app' },
      { id: '2', kind: 'muted', text: 'Capturing screen...' },
      { id: '3', kind: 'action', text: 'Scrolling by (0, -366) points' },
      { id: '4', kind: 'action', text: 'Tapping at (71, 151) points' },
      { id: '5', kind: 'assistant', text: '[Assistant] Opened.' },
      { id: '6', kind: 'plain', text: '' },
      { id: '7', kind: 'user', text: 'You: Click on "New Reminder"' },
      { id: '8', kind: 'action', text: 'Tapping at (102, 796) points' },
      { id: '9', kind: 'assistant', text: '[Assistant] Opened.' },
      { id: '10', kind: 'plain', text: '' },
      { id: '11', kind: 'user', text: 'You: Type "demo"' },
      { id: '12', kind: 'action', text: 'Typing text: demo' },
      { id: '13', kind: 'assistant', text: '[Assistant] Entered.' },
      { id: '14', kind: 'plain', text: '' },
      { id: '15', kind: 'user', text: 'You: assert: demo reminder is visible' },
      { id: '16', kind: 'muted', text: 'Connection issue. Retrying... (1/3)' },
      { id: '17', kind: 'reasoning', text: '[Reasoning] Accessing reminder content for verification' },
      { id: '18', kind: 'reasoning', text: '[Reasoning] Selecting reminder to confirm details' },
      { id: '19', kind: 'assistant', text: '[Assistant] ASSERTION RESULT: FAIL' },
      { id: '20', kind: 'warning', text: 'ASSERTION FAILED: reminder label mismatch' },
      { id: '21', kind: 'warning', text: 'Details: Expected "demo reminder", found "demo"' },
      { id: '22', kind: 'muted', text: '' },
      { id: '23', kind: 'muted', text: 'What would you like to do? (retry/skip/stop)' }
    ]
  }
];

export const dcuaFiles: DcuaFile[] = [
  {
    id: 'dcua-checkout',
    projectId: 'proj-mobile-shop',
    name: 'ios-demo.dcua',
    updatedAt: 'Today 09:10',
    content: `Open Reminders app
Click "New Reminder"
Type "demo"
Click "Done"
Swipe left on "demo" reminder
Click "Delete"
assert: "demo" reminder is not present
exit`
  }
];

export const newTestDraft: NewTestDraft = {
  id: 'draft-create-payment',
  name: 'Payment flow basic',
  targetDeviceId: 'device-pixel-8',
  scenario: 'User can pay with a saved card from checkout screen.',
  assertions: ['Payment sheet opens', 'Success toast appears'],
  generatedDcua: `name: payment_flow_basic\nplatform: android`
};
