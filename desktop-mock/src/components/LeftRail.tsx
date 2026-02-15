import { useEffect, useMemo, useState } from 'react';
import { DcuaFile, Device, Project, RailSection } from '../types';

interface LeftRailProps {
  activeSection: RailSection;
  onChange: (section: RailSection) => void;
  projects: Project[];
  focusedProjectId: string | null;
  tests: DcuaFile[];
  selectedTestId: string | null;
  onSelectTest: (id: string) => void;
  activeDevice: Device | null;
}

function Icon({ name }: { name: 'new-test' | 'devices' | 'projects' | 'settings' | 'caret' }) {
  if (name === 'new-test') {
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M3 8.2V4.8A1.8 1.8 0 0 1 4.8 3h6.4A1.8 1.8 0 0 1 13 4.8v3.4" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <path d="M8 7v6M5 10h6" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === 'devices') {
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <rect x="4" y="2.8" width="8" height="10.4" rx="1.6" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="8" cy="10.5" r="0.7" fill="currentColor" />
      </svg>
    );
  }
  if (name === 'projects') {
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M2.5 5.5h4l1-1.5h6v7.2a1.3 1.3 0 0 1-1.3 1.3H3.8a1.3 1.3 0 0 1-1.3-1.3V5.5Z" fill="none" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    );
  }
  if (name === 'settings') {
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="2.1" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <path d="M8 2.4v1.3M8 12.3v1.3M13.6 8h-1.3M3.7 8H2.4M11.9 4.1l-.9.9M5 11l-.9.9M11.9 11.9l-.9-.9M5 5l-.9-.9" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="m4.5 6 3.5 4 3.5-4" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function LeftRail({
  activeSection,
  onChange,
  projects,
  focusedProjectId,
  tests,
  selectedTestId,
  onSelectTest,
  activeDevice
}: LeftRailProps) {
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(() => new Set(focusedProjectId ? [focusedProjectId] : []));

  useEffect(() => {
    if (!focusedProjectId) {
      return;
    }
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      next.add(focusedProjectId);
      return next;
    });
  }, [focusedProjectId]);

  const testsByProject = useMemo(() => {
    const grouped = new Map<string, DcuaFile[]>();
    for (const test of tests) {
      const arr = grouped.get(test.projectId) ?? [];
      arr.push(test);
      grouped.set(test.projectId, arr);
    }
    return grouped;
  }, [tests]);

  const isNewTestActive = activeSection === 'new-test' && !selectedTestId;

  return (
    <aside className="rail">
      {/* Web mock: emulate macOS traffic lights inside the sidebar header area.
          Real Electron app: use a frameless/hidden title bar and native controls
          (for example BrowserWindow with titleBarStyle "hiddenInset") so these are OS-native. */}
      <div className="rail__mac-controls" aria-hidden="true">
        <span className="rail__mac-dot rail__mac-dot--close" />
        <span className="rail__mac-dot rail__mac-dot--minimize" />
        <span className="rail__mac-dot rail__mac-dot--zoom" />
      </div>

      <nav className="rail__nav" aria-label="Primary">
        <button
          className={isNewTestActive ? 'rail__item rail__item--active' : 'rail__item'}
          onClick={() => onChange('new-test')}
          type="button"
        >
          <span className="rail__icon"><Icon name="new-test" /></span>
          <span className="rail__label">New Test</span>
        </button>

        <button
          className={activeSection === 'devices' ? 'rail__item rail__item--active' : 'rail__item'}
          onClick={() => onChange('devices')}
          type="button"
        >
          <span className="rail__icon"><Icon name="devices" /></span>
          <span className="rail__label">Devices</span>
          <span className="rail__meta">{activeDevice?.status ?? 'none'}</span>
        </button>
      </nav>

      <div className="rail__projects">
        <button className="rail__projects-header" type="button">
          <span className="rail__icon"><Icon name="projects" /></span>
          <span className="rail__label">Projects</span>
        </button>

        <div className="rail__project-groups">
          {projects.map((project) => {
            const isExpanded = expandedProjects.has(project.id);
            const projectTests = testsByProject.get(project.id) ?? [];
            return (
              <div key={project.id} className="rail__project-group">
                <button
                  type="button"
                  className="rail__project-toggle"
                  onClick={() => {
                    setExpandedProjects((prev) => {
                      const next = new Set(prev);
                      if (next.has(project.id)) {
                        next.delete(project.id);
                      } else {
                        next.add(project.id);
                      }
                      return next;
                    });
                  }}
                >
                  <span className={isExpanded ? 'rail__triangle rail__triangle--open' : 'rail__triangle'}>
                    <Icon name="caret" />
                  </span>
                  <span className="rail__project-name">{project.name}</span>
                  <span className="rail__project-count">{project.testCount}</span>
                </button>

                {isExpanded ? (
                  <div className="rail__test-list">
                    {projectTests.map((test) => (
                      <button
                        key={test.id}
                        type="button"
                        onClick={() => onSelectTest(test.id)}
                        className={test.id === selectedTestId ? 'rail__test rail__test--active' : 'rail__test'}
                      >
                        {test.name.replace(/\.dcua$/i, '')}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <button className="rail__settings" type="button">
        <span className="rail__icon"><Icon name="settings" /></span>
        <span className="rail__label">Settings</span>
      </button>
    </aside>
  );
}
