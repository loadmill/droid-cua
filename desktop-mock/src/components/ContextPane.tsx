import { DcuaFile, Device, Project, RailSection, TestSession } from '../types';

interface ContextPaneProps {
  section: RailSection;
  projects: Project[];
  devices: Device[];
  sessions: TestSession[];
  files: DcuaFile[];
  selectedProjectId: string | null;
  selectedSessionId: string | null;
  selectedFileId: string | null;
  onSelectProject: (id: string) => void;
  onSelectSession: (id: string) => void;
  onSelectFile: (id: string) => void;
  onSelectDevice: (id: string) => void;
}

export function ContextPane({ section }: ContextPaneProps) {
  return (
    <section className="context-pane" aria-hidden="true">
      <h2>{section === 'devices' ? 'Devices' : 'New Test'}</h2>
      <p className="context-pane__sub">Legacy component kept for compatibility while mock evolves.</p>
    </section>
  );
}
