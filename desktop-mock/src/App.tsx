import { useEffect, useMemo, useRef, useState } from 'react';
import { LeftRail } from './components/LeftRail';
import { MainPane } from './components/MainPane';
import { dcuaFiles, devices, projects, sessions } from './data/mockData';
import { RailSection } from './types';

export default function App() {
  const appWindowRef = useRef<HTMLDivElement | null>(null);

  const [section, setSection] = useState<RailSection>('new-test');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(projects[0]?.id ?? null);
  const [tests, setTests] = useState(dcuaFiles);
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [railWidth, setRailWidth] = useState(300);
  const [isResizing, setIsResizing] = useState(false);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [selectedProjectId]
  );

  const activeDevice = useMemo(() => {
    if (!selectedProject?.activeDeviceId) {
      return devices[0] ?? null;
    }
    return devices.find((device) => device.id === selectedProject.activeDeviceId) ?? null;
  }, [selectedProject]);

  const activeSession = useMemo(() => {
    if (!selectedProjectId) {
      return sessions[0] ?? null;
    }
    return sessions.find((session) => session.projectId === selectedProjectId) ?? sessions[0] ?? null;
  }, [selectedProjectId]);

  const selectedTest = useMemo(() => tests.find((file) => file.id === selectedTestId) ?? null, [tests, selectedTestId]);

  const handleSectionChange = (next: RailSection) => {
    setSection(next);
    if (next === 'new-test') {
      setSelectedTestId(null);
      setIsExecuting(false);
    }
  };

  useEffect(() => {
    if (!isResizing) {
      return;
    }

    const onMouseMove = (event: MouseEvent) => {
      const rect = appWindowRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }
      const next = event.clientX - rect.left;
      setRailWidth(Math.max(260, Math.min(520, next)));
    };

    const onMouseUp = () => setIsResizing(false);

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isResizing]);

  return (
    <div
      ref={appWindowRef}
      className={isResizing ? 'app-window app-window--resizing' : 'app-window'}
      style={{ gridTemplateColumns: `${railWidth}px 1px minmax(0, 1fr)` }}
    >
      <LeftRail
        activeSection={section}
        onChange={handleSectionChange}
        projects={projects}
        focusedProjectId={selectedProjectId}
        tests={tests}
        selectedTestId={selectedTestId}
        onSelectTest={(id) => {
          const found = tests.find((file) => file.id === id);
          if (found) {
            setSelectedProjectId(found.projectId);
          }
          setSection('new-test');
          setSelectedTestId(id);
          setIsExecuting(false);
        }}
        activeDevice={activeDevice}
      />

      <div
        className="panel-divider"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        onMouseDown={() => setIsResizing(true)}
      />

      <MainPane
        section={section}
        project={selectedProject}
        activeSession={activeSession}
        activeDevice={activeDevice}
        selectedTest={selectedTest}
        isExecuting={isExecuting}
        onSaveTest={(testId, content) => {
          setTests((prev) => prev.map((test) => (test.id === testId ? { ...test, content } : test)));
        }}
        onDeleteTest={(testId) => {
          setTests((prev) => prev.filter((test) => test.id !== testId));
          if (selectedTestId === testId) {
            setSelectedTestId(null);
          }
          setIsExecuting(false);
        }}
        onRunTest={() => setIsExecuting(true)}
        onStopExecution={() => setIsExecuting(false)}
      />
    </div>
  );
}
