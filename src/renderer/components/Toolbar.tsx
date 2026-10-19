import React from 'react';
import { 
  Zap, 
  Plus, 
  Play, 
  Pause, 
  Square, 
  RotateCw, 
  Trash2, 
  Gauge, 
  Settings as SettingsIcon 
} from 'lucide-react';
import { DownloadStats } from '../../shared/types';

interface ToolbarProps {
  stats: DownloadStats;
  selectedId: string | null;
  onAddClick: () => void;
  onResumeSelected: () => void;
  onPauseSelected: () => void;
  onResumeAll: () => void;
  onPauseAll: () => void;
  onDeleteSelected: () => void;
  onSpeedLimitClick: () => void;
  onSettingsClick: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  stats,
  selectedId,
  onAddClick,
  onResumeSelected,
  onPauseSelected,
  onResumeAll,
  onPauseAll,
  onDeleteSelected,
  onSpeedLimitClick,
  onSettingsClick,
}) => {
  const formatSpeed = (bytesPerSec: number) => {
    if (bytesPerSec <= 0) return '0 KB/s';
    if (bytesPerSec < 1024 * 1024) {
      return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
    }
    return `${(bytesPerSec / (1024 * 1024)).toFixed(2)} MB/s`;
  };

  return (
    <header className="toolbar">
      <div className="toolbar-brand">
        <div className="brand-icon">
          <Zap size={22} fill="currentColor" />
        </div>
        <div className="brand-info">
          <h1>HyperFetch</h1>
          <span>Dynamic Accelerator</span>
        </div>
      </div>

      <div className="toolbar-actions">
        <button className="btn btn-primary" onClick={onAddClick} id="add-download-btn">
          <Plus size={16} strokeWidth={2.5} />
          Add URL
        </button>

        <button 
          className="btn btn-secondary" 
          onClick={onResumeSelected} 
          disabled={!selectedId}
          title="Resume Selected Download"
        >
          <Play size={15} />
          Resume
        </button>

        <button 
          className="btn btn-secondary" 
          onClick={onPauseSelected} 
          disabled={!selectedId}
          title="Pause Selected Download"
        >
          <Pause size={15} />
          Pause
        </button>

        <button 
          className="btn btn-secondary" 
          onClick={onResumeAll} 
          title="Resume All Downloads"
        >
          <RotateCw size={15} />
          Resume All
        </button>

        <button 
          className="btn btn-secondary" 
          onClick={onPauseAll} 
          title="Stop All Downloads"
        >
          <Square size={15} />
          Stop All
        </button>

        <button 
          className="btn btn-danger" 
          onClick={onDeleteSelected} 
          disabled={!selectedId}
          title="Delete Selected Download"
        >
          <Trash2 size={15} />
          Delete
        </button>
      </div>

      <div className="toolbar-stats">
        <button 
          className="btn btn-secondary" 
          style={{ padding: '6px 10px', fontSize: '12px' }}
          onClick={onSpeedLimitClick}
          title="Speed Limiter Settings"
        >
          <Gauge size={14} />
          Limiter
        </button>

        <div className="stat-item">
          <span className="stat-label">Total Speed</span>
          <span className="stat-val">{formatSpeed(stats.totalSpeed)}</span>
        </div>

        <div className="stat-item">
          <span className="stat-label">Active / Queue</span>
          <span className="stat-val">{stats.activeCount} / {stats.queuedCount}</span>
        </div>

        <button 
          className="action-icon-btn" 
          onClick={onSettingsClick}
          title="Application Settings"
        >
          <SettingsIcon size={16} />
        </button>
      </div>
    </header>
  );
};
