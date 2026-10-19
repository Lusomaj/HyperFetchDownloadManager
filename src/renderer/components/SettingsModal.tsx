import React, { useState, useEffect } from 'react';
import { X, Settings as SettingsIcon, Folder, Gauge } from 'lucide-react';
import { AppSettings } from '../../shared/types';
import { api } from '../api';

interface SettingsModalProps {
  isOpen: boolean;
  settings: AppSettings;
  onClose: () => void;
  onSave: (newSettings: Partial<AppSettings>) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  settings,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState<AppSettings>(settings);

  useEffect(() => {
    setFormData(settings);
  }, [settings, isOpen]);

  if (!isOpen) return null;

  const handleSelectFolder = async () => {
    const selected = await api.selectDirectory();
    if (selected) {
      setFormData((prev) => ({ ...prev, defaultDownloadDir: selected }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  const speedPresets = [
    { label: 'Unlimited', val: 0 },
    { label: '500 KB/s', val: 500 * 1024 },
    { label: '1 MB/s', val: 1024 * 1024 },
    { label: '5 MB/s', val: 5 * 1024 * 1024 },
    { label: '15 MB/s', val: 15 * 1024 * 1024 },
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            <SettingsIcon size={18} color="var(--accent-cyan)" />
            Application Preferences
          </h2>
          <button className="close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* Default Directory */}
            <div className="form-group">
              <label className="form-label">Default Download Directory</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  className="input-text"
                  value={formData.defaultDownloadDir}
                  onChange={(e) => setFormData({ ...formData, defaultDownloadDir: e.target.value })}
                  required
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleSelectFolder}
                  style={{ flexShrink: 0 }}
                >
                  <Folder size={15} />
                  Browse
                </button>
              </div>
            </div>

            {/* Concurrency and Connections */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label">Max Concurrent Downloads</label>
                <select
                  className="input-text"
                  value={formData.maxConcurrentDownloads}
                  onChange={(e) => setFormData({ ...formData, maxConcurrentDownloads: Number(e.target.value) })}
                >
                  <option value={1}>1 download at a time</option>
                  <option value={2}>2 downloads</option>
                  <option value={3}>3 downloads (Standard)</option>
                  <option value={5}>5 downloads</option>
                  <option value={10}>10 downloads</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Default Connections per File</label>
                <select
                  className="input-text"
                  value={formData.defaultConnections}
                  onChange={(e) => setFormData({ ...formData, defaultConnections: Number(e.target.value) })}
                >
                  <option value={1}>1 (Single Stream)</option>
                  <option value={4}>4 Connections</option>
                  <option value={8}>8 Connections (Default)</option>
                  <option value={16}>16 Connections (Fast)</option>
                  <option value={32}>32 Connections (Aggressive)</option>
                </select>
              </div>
            </div>

            {/* Speed Limiter */}
            <div className="form-group">
              <label className="form-label">
                <Gauge size={14} style={{ display: 'inline', marginRight: '6px' }} />
                Global Speed Limiter
              </label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {speedPresets.map((preset) => (
                  <button
                    key={preset.val}
                    type="button"
                    className={`btn ${formData.speedLimitBytesPerSec === preset.val ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '12px', padding: '6px 12px' }}
                    onClick={() => setFormData({ ...formData, speedLimitBytesPerSec: preset.val })}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Automation & Toggles */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formData.clipboardWatch}
                  onChange={(e) => setFormData({ ...formData, clipboardWatch: e.target.checked })}
                  style={{ accentColor: 'var(--accent-cyan)' }}
                />
                Watch Windows Clipboard for downloadable file links automatically
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formData.notifyOnComplete}
                  onChange={(e) => setFormData({ ...formData, notifyOnComplete: e.target.checked })}
                  style={{ accentColor: 'var(--accent-cyan)' }}
                />
                Show desktop notification when download completes
              </label>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Save Preferences
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
