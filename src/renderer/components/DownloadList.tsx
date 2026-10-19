import React from 'react';
import { 
  Play, 
  Pause, 
  Trash2, 
  FolderOpen, 
  BarChart2, 
  Archive, 
  FileText, 
  Music, 
  Film, 
  Binary, 
  File, 
  Inbox 
} from 'lucide-react';
import { DownloadItem, FileCategory } from '../../shared/types';

interface DownloadListProps {
  items: DownloadItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onResume: (id: string) => void;
  onPause: (id: string) => void;
  onDelete: (id: string) => void;
  onInspectSegments: (item: DownloadItem) => void;
  onOpenFile: (filePath: string) => void;
  onShowInFolder: (filePath: string) => void;
}

export const DownloadList: React.FC<DownloadListProps> = ({
  items,
  selectedId,
  onSelect,
  onResume,
  onPause,
  onDelete,
  onInspectSegments,
  onOpenFile,
  onShowInFolder,
}) => {
  const formatBytes = (bytes: number) => {
    if (bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const formatSpeed = (speed: number) => {
    if (speed <= 0) return '--';
    if (speed < 1024 * 1024) {
      return `${(speed / 1024).toFixed(1)} KB/s`;
    }
    return `${(speed / (1024 * 1024)).toFixed(2)} MB/s`;
  };

  const formatEta = (seconds: number) => {
    if (!seconds || seconds <= 0 || !isFinite(seconds)) return '--';
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins < 60) return `${mins}m ${secs}s`;
    const hours = Math.floor(mins / 60);
    return `${hours}h ${mins % 60}m`;
  };

  const getCategoryIcon = (category: FileCategory) => {
    switch (category) {
      case 'Compressed': return <Archive size={18} />;
      case 'Documents': return <FileText size={18} />;
      case 'Music': return <Music size={18} />;
      case 'Video': return <Film size={18} />;
      case 'Programs': return <Binary size={18} />;
      default: return <File size={18} />;
    }
  };

  if (items.length === 0) {
    return (
      <div className="downloads-table-container">
        <div className="empty-state">
          <div className="empty-icon">
            <Inbox size={32} />
          </div>
          <h3>No downloads found</h3>
          <p style={{ fontSize: '13px' }}>Click "Add URL" above or paste a download link to begin.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="downloads-table-container">
      <div className="table-header">
        <div>File Name</div>
        <div>Size</div>
        <div>Progress</div>
        <div>Transfer Rate</div>
        <div>Time Left</div>
        <div style={{ textAlign: 'right' }}>Actions</div>
      </div>

      <div className="downloads-list" style={{ marginTop: '8px' }}>
        {items.map((item) => {
          const percent = item.totalBytes > 0 
            ? Math.min(100, Math.max(0, (item.downloadedBytes / item.totalBytes) * 100))
            : item.status === 'completed' ? 100 : 0;

          const isSelected = selectedId === item.id;

          return (
            <div
              key={item.id}
              className={`download-row ${isSelected ? 'selected' : ''}`}
              onClick={() => onSelect(item.id)}
              onDoubleClick={() => onInspectSegments(item)}
            >
              {/* File Info */}
              <div className="file-col">
                <div className="file-icon-box">
                  {getCategoryIcon(item.category)}
                </div>
                <div className="file-meta">
                  <div className="file-title" title={item.filename}>
                    {item.filename}
                  </div>
                  <div className="file-sub">
                    <span className={`status-badge status-${item.status}`}>
                      {item.status === 'downloading' && <span className="pulse-dot" />}
                      {item.status.toUpperCase()}
                    </span>
                    {item.connections > 1 && (
                      <span className="conns-pill">{item.connections} CONNS</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Size */}
              <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
                {item.totalBytes > 0 ? formatBytes(item.totalBytes) : 'Unknown'}
              </div>

              {/* Progress */}
              <div>
                <div className="progress-container">
                  <div className="progress-track">
                    <div 
                      className={`progress-fill ${item.status === 'completed' ? 'completed' : ''}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <div className="progress-text">
                    <span>{percent.toFixed(1)}%</span>
                    <span>{formatBytes(item.downloadedBytes)}</span>
                  </div>
                </div>
              </div>

              {/* Speed */}
              <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
                {item.status === 'downloading' ? formatSpeed(item.speed) : '--'}
              </div>

              {/* Time Left */}
              <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                {item.status === 'downloading' ? formatEta(item.eta) : '--'}
              </div>

              {/* Actions */}
              <div className="row-actions" onClick={(e) => e.stopPropagation()}>
                {/* Segment Inspector */}
                <button
                  className="action-icon-btn active-cyan"
                  onClick={() => onInspectSegments(item)}
                  title="Inspect Multi-threaded Segments"
                >
                  <BarChart2 size={14} />
                </button>

                {/* Pause / Resume */}
                {item.status === 'downloading' ? (
                  <button
                    className="action-icon-btn"
                    onClick={() => onPause(item.id)}
                    title="Pause Download"
                  >
                    <Pause size={14} />
                  </button>
                ) : item.status !== 'completed' ? (
                  <button
                    className="action-icon-btn"
                    onClick={() => onResume(item.id)}
                    title="Resume Download"
                  >
                    <Play size={14} />
                  </button>
                ) : (
                  <button
                    className="action-icon-btn active-cyan"
                    onClick={() => onOpenFile(item.savePath)}
                    title="Open Downloaded File"
                  >
                    <FolderOpen size={14} />
                  </button>
                )}

                {/* Show in folder */}
                <button
                  className="action-icon-btn"
                  onClick={() => onShowInFolder(item.savePath)}
                  title="Show in Folder"
                >
                  <FolderOpen size={14} />
                </button>

                {/* Delete */}
                <button
                  className="action-icon-btn danger"
                  onClick={() => onDelete(item.id)}
                  title="Delete Download"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
