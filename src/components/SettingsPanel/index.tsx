import { memo } from 'react';
import type { ThemeMode } from '../../hooks/useTheme';
import { IconMonitor, IconSun, IconMoon, IconX } from '../Icons';
import './styles.css';

interface SettingsPanelProps {
  open: boolean;
  themeMode: ThemeMode;
  onSetTheme: (mode: ThemeMode) => void;
  onClose: () => void;
}

const THEME_OPTIONS: { value: ThemeMode; label: string; Icon: typeof IconSun }[] = [
  { value: 'system', label: 'Sistema', Icon: IconMonitor },
  { value: 'light', label: 'Claro', Icon: IconSun },
  { value: 'dark', label: 'Noturno', Icon: IconMoon },
];

const SettingsPanel = memo(function SettingsPanel({
  open,
  themeMode,
  onSetTheme,
  onClose,
}: SettingsPanelProps) {
  if (!open) return null;

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-handle" />

        <div className="settings-header">
          <h2 className="settings-title">Ajustes</h2>
          <button className="settings-close" onClick={onClose} id="settings-close-btn">
            <IconX size={16} />
          </button>
        </div>

        <div className="settings-section">
          <div className="settings-section-label">Aparência</div>
          <div className="settings-theme-picker">
            {THEME_OPTIONS.map(({ value, label, Icon }) => (
              <button
                key={value}
                className={`settings-theme-option ${themeMode === value ? 'active' : ''}`}
                onClick={() => onSetTheme(value)}
                id={`theme-${value}`}
              >
                <span className="settings-theme-icon"><Icon size={20} /></span>
                <span className="settings-theme-label">{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="settings-section">
          <div className="settings-section-label">Informações</div>
          <div className="settings-info-row">
            <span>Versão</span>
            <span className="settings-info-value">1.0.0</span>
          </div>
          <div className="settings-info-row">
            <span>Dados</span>
            <span className="settings-info-value">SPPO Rio</span>
          </div>
          <div className="settings-info-row">
            <span>Atualização</span>
            <span className="settings-info-value">15 segundos</span>
          </div>
        </div>
      </div>
    </div>
  );
});

export default SettingsPanel;
