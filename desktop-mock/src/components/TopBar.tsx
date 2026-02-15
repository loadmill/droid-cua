import { Device, Project, SessionState } from '../types';

interface TopBarProps {
  project: Project | null;
  device: Device | null;
  sessionState: SessionState;
}

function StateBadge({ state }: { state: SessionState }) {
  return <span className={`badge badge--${state}`}>{state}</span>;
}

export function TopBar({ project, device, sessionState }: TopBarProps) {
  return (
    <header className="topbar">
      <div className="topbar__left">
        <strong>{project?.name ?? 'No project selected'}</strong>
        <span className="topbar__meta">{project?.path ?? 'Link a project folder to continue'}</span>
      </div>
      <div className="topbar__right">
        <span className="topbar__chip">{device ? `${device.name} (${device.status})` : 'No device selected'}</span>
        <StateBadge state={sessionState} />
        <button className="cmdk-btn" type="button">
          Command Menu
        </button>
      </div>
    </header>
  );
}
