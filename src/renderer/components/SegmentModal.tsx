import React from 'react';
import { X, Cpu, CheckCircle2, Play, Pause, Folder } from 'lucide-react';
import { DownloadItem } from '../../shared/types';

interface SegmentModalProps {
  item: DownloadItem | null;
  onClose: () => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onOpenFile: (filePath: string) => void;
}

export const SegmentModal: React.FC<SegmentModalProps> = ({
  item,
  onClose,
  onPause,
  onResume,
  onOpenFile,
}) => {
  if (!item) return null;

  const formatBytes = (bytes: number) => {
    if (bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatSpeed = (speed: number) => {
    if (speed <= 0) return '0 KB/s';
    if (speed < 1024 * 1024) {
      return `${(speed / 1024).toFixed(1)} KB/s`;
    }
    return `${(speed / (1024 * 1024)).toFixed(2)} MB/s`;
  };

  const percent = item.totalBytes > 0 
    ? Math.min(100, Math.max(0, (item.downloadedBytes / item.totalBytes) * 100))
    : item.status === 'completed' ? 100 : 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content" 
        style={{ width: '740px' }} 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>
            <Cpu size={18} color="var(--accent-cyan)" />
            Connection & Segment Monitor
          </h2>
          <button className="close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {/* File summary */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
              {item.filename}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', wordBreak: 'break-all' }}>
              {item.url}
            </div>
          </div>

          {/* Stats Grid */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(4, 1fr)', 
            gap: '10px', 
            background: 'rgba(0, 0, 0, 0.25)', 
            padding: '12px', 
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)'
          }}>
            <div>
              <div className="stat-label">File Size</div>
              <div style={{ fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                {item.totalBytes > 0 ? formatBytes(item.totalBytes) : 'Unknown'}
              </div>
            </div>
            <div>
              <div className="stat-label">Downloaded</div>
              <div style={{ fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
                {formatBytes(item.downloadedBytes)} ({percent.toFixed(1)}%)
              </div>
            </div>
            <div>
              <div className="stat-label">Transfer Rate</div>
              <div style={{ fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>
                {formatSpeed(item.speed)}
              </div>
            </div>
            <div>
              <div className="stat-label">Resumable</div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: item.resumable ? '#34d399' : '#fb7185' }}>
                {item.resumable ? 'Yes (Byte Ranges)' : 'No (Single Stream)'}
              </div>
            </div>
          </div>

          {/* IDM Segment Visualizer Bar */}
          <div className="segment-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Dynamic Byte Range Allocation ({item.segments?.length || 1} Threads)
              </span>
              <span style={{ fontSize: '11px', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
                Direct-to-Disk Sparse Write
              </span>
            </div>

            {/* Visual multi-segment bar */}
            <div className="segment-visual-bar">
              {item.segments && item.segments.length > 0 ? (
                item.segments.map((seg) => {
                  const segTotal = seg.end > seg.start ? (seg.end - seg.start + 1) : 1;
                  const segRatio = item.totalBytes > 0 ? (segTotal / item.totalBytes) * 100 : (100 / item.segments.length);
                  const segDonePercent = seg.status === 'completed' 
                    ? 100 
                    : Math.min(100, Math.max(0, (seg.downloaded / segTotal) * 100));

                  return (
                    <div 
                      key={seg.id} 
                      className={`segment-chunk ${seg.status}`}
                      style={{ width: `${segRatio}%` }}
                      title={`Thread #${seg.id + 1}: ${formatBytes(seg.downloaded)} / ${formatBytes(segTotal)} (${segDonePercent.toFixed(1)}%)`}
                    >
                      <div 
                        className="segment-chunk-fill" 
                        style={{ width: `${segDonePercent}%` }}
                      />
                    </div>
                  );
                })
              ) : (
                <div style={{ width: '100%', height: '100%', background: 'rgba(6, 182, 212, 0.4)' }} />
              )}
            </div>

            {/* Segments Table */}
            <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
              <table className="segment-table">
                <thead>
                  <tr>
                    <th>Thread</th>
                    <th>Status</th>
                    <th>Range (Bytes)</th>
                    <th>Downloaded</th>
                    <th>Speed</th>
                  </tr>
                </thead>
                <tbody>
                  {item.segments && item.segments.map((seg) => {
                    const totalChunk = seg.end > seg.start ? (seg.end - seg.start + 1) : 0;
                    const chunkPercent = totalChunk > 0 ? ((seg.downloaded / totalChunk) * 100).toFixed(1) : '--';

                    return (
                      <tr key={seg.id}>
                        <td style={{ color: 'var(--accent-purple)', fontWeight: 600 }}>
                          #{seg.id + 1}
                        </td>
                        <td>
                          <span style={{ 
                            color: seg.status === 'completed' ? '#34d399' : seg.status === 'downloading' ? '#38bdf8' : '#fbbf24',
                            fontWeight: 500
                          }}>
                            {seg.status.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-muted)' }}>
                          {seg.start.toLocaleString()} — {seg.end > 0 ? seg.end.toLocaleString() : 'EOF'}
                        </td>
                        <td>
                          {formatBytes(seg.downloaded)} ({chunkPercent}%)
                        </td>
                        <td style={{ color: 'var(--accent-cyan)' }}>
                          {seg.status === 'downloading' ? formatSpeed(seg.speed) : '--'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          {item.status === 'downloading' ? (
            <button className="btn btn-secondary" onClick={() => onPause(item.id)}>
              <Pause size={14} /> Pause
            </button>
          ) : item.status !== 'completed' ? (
            <button className="btn btn-primary" onClick={() => onResume(item.id)}>
              <Play size={14} /> Resume
            </button>
          ) : (
            <button className="btn btn-primary" onClick={() => onOpenFile(item.savePath)}>
              <Folder size={14} /> Open File
            </button>
          )}

          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
