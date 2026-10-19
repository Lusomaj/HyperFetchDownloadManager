import React, { useState, useEffect } from 'react';
import { X, Globe, Folder, Search, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { api } from '../api';
import { NewDownloadOptions, ProbeResult } from '../../shared/types';

interface AddDownloadModalProps {
  isOpen: boolean;
  initialUrl?: string;
  defaultDir: string;
  defaultConnections: number;
  onClose: () => void;
  onSubmit: (options: NewDownloadOptions) => void;
}

export const AddDownloadModal: React.FC<AddDownloadModalProps> = ({
  isOpen,
  initialUrl = '',
  defaultDir,
  defaultConnections,
  onClose,
  onSubmit,
}) => {
  const [url, setUrl] = useState(initialUrl);
  const [filename, setFilename] = useState('');
  const [savePath, setSavePath] = useState(defaultDir);
  const [connections, setConnections] = useState(defaultConnections || 8);
  const [startImmediately, setStartImmediately] = useState(true);
  const [isProbing, setIsProbing] = useState(false);
  const [probeResult, setProbeResult] = useState<ProbeResult | null>(null);
  const [probeError, setProbeError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [referer, setReferer] = useState('');
  const [cookie, setCookie] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (initialUrl) {
        setUrl(initialUrl);
        handleProbe(initialUrl);
      } else {
        setUrl('');
        setFilename('');
        setProbeResult(null);
        setProbeError(null);
      }
      setSavePath(defaultDir);
    }
  }, [isOpen, initialUrl, defaultDir]);

  if (!isOpen) return null;

  const handleProbe = async (targetUrl: string) => {
    if (!targetUrl || !targetUrl.startsWith('http')) return;
    setIsProbing(true);
    setProbeError(null);

    try {
      const headers: Record<string, string> = {};
      if (referer) headers['Referer'] = referer;
      if (cookie) headers['Cookie'] = cookie;

      const result = await api.probeUrl(targetUrl, Object.keys(headers).length ? headers : undefined);
      setProbeResult(result);
      setFilename(result.filename);
    } catch (err: any) {
      setProbeError(err.message || 'Could not reach server or inspect URL');
    } finally {
      setIsProbing(false);
    }
  };

  const handleSelectFolder = async () => {
    const selected = await api.selectDirectory();
    if (selected) {
      setSavePath(selected);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    const headers: Record<string, string> = {};
    if (referer) headers['Referer'] = referer;
    if (cookie) headers['Cookie'] = cookie;

    onSubmit({
      url,
      filename: filename || probeResult?.filename,
      savePath: savePath?.trim() || undefined,
      connections: Number(connections),
      startImmediately,
      headers: Object.keys(headers).length ? headers : undefined,
    });
    onClose();
  };

  const formatBytes = (bytes: number) => {
    if (bytes <= 0) return 'Unknown size';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            <Globe size={18} color="var(--accent-cyan)" />
            Add New Download
          </h2>
          <button className="close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* URL Input */}
            <div className="form-group">
              <label className="form-label">Download URL (HTTP / HTTPS)</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  className="input-text"
                  placeholder="https://example.com/file.zip"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onBlur={() => !probeResult && handleProbe(url)}
                  required
                  autoFocus
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => handleProbe(url)}
                  disabled={isProbing || !url}
                  style={{ flexShrink: 0 }}
                >
                  {isProbing ? <Loader2 size={15} className="pulse-dot" /> : <Search size={15} />}
                  Probe
                </button>
              </div>
            </div>

            {/* Probe Result Card */}
            {probeResult && (
              <div style={{
                background: 'rgba(6, 182, 212, 0.08)',
                border: '1px solid rgba(6, 182, 212, 0.25)',
                borderRadius: 'var(--radius-sm)',
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <CheckCircle2 size={18} color="#34d399" />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600 }}>{probeResult.filename}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Size: {formatBytes(probeResult.totalBytes)} • Category: {probeResult.category}
                    </div>
                  </div>
                </div>
                <div style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: probeResult.resumable ? '#34d399' : '#fbbf24',
                  background: 'rgba(0, 0, 0, 0.3)',
                  padding: '4px 8px',
                  borderRadius: '4px'
                }}>
                  {probeResult.resumable ? '✓ Multi-Thread Resumable' : 'Single Stream Only'}
                </div>
              </div>
            )}

            {probeError && (
              <div style={{
                background: 'rgba(244, 63, 94, 0.1)',
                border: '1px solid rgba(244, 63, 94, 0.3)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: '#fb7185',
                fontSize: '12px',
              }}>
                <AlertTriangle size={16} />
                <span>{probeError} (Download may still proceed as single stream)</span>
              </div>
            )}

            {/* Filename Override */}
            <div className="form-group">
              <label className="form-label">Save As (File Name)</label>
              <input
                type="text"
                className="input-text"
                placeholder="Enter filename..."
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
              />
            </div>

            {/* Save Directory */}
            <div className="form-group">
              <label className="form-label">Save Directory (Leave empty for standard Downloads folder)</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  className="input-text"
                  placeholder="Downloads folder"
                  value={savePath}
                  onChange={(e) => setSavePath(e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleSelectFolder}
                  style={{ flexShrink: 0 }}
                  title="Browse Directory"
                >
                  <Folder size={15} />
                  Browse
                </button>
              </div>
            </div>

            {/* Connection count & options */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label">Max Connections (Threads)</label>
                <select
                  className="input-text"
                  value={connections}
                  onChange={(e) => setConnections(Number(e.target.value))}
                >
                  <option value={1}>1 (Single Connection)</option>
                  <option value={2}>2 Threads</option>
                  <option value={4}>4 Threads</option>
                  <option value={8}>8 Threads (Recommended)</option>
                  <option value={16}>16 Threads (High Speed)</option>
                  <option value={32}>32 Threads (Maximum Throughput)</option>
                </select>
              </div>

              <div className="form-group" style={{ justifyContent: 'center' }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '13px',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  marginTop: '22px'
                }}>
                  <input
                    type="checkbox"
                    checked={startImmediately}
                    onChange={(e) => setStartImmediately(e.target.checked)}
                    style={{ accentColor: 'var(--accent-cyan)' }}
                  />
                  Start downloading immediately
                </label>
              </div>
            </div>

            {/* Advanced Options Toggle */}
            <div>
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-cyan)',
                  fontSize: '12px',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                {showAdvanced ? '− Hide Custom HTTP Headers' : '+ Show Custom HTTP Headers (Referer, Cookie)'}
              </button>

              {showAdvanced && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                  <div className="form-group">
                    <label className="form-label">Referer Header</label>
                    <input
                      type="text"
                      className="input-text"
                      placeholder="https://example.com/download-page"
                      value={referer}
                      onChange={(e) => setReferer(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Cookie Header</label>
                    <input
                      type="text"
                      className="input-text"
                      placeholder="session_id=...; token=..."
                      value={cookie}
                      onChange={(e) => setCookie(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" id="confirm-download-btn">
              {startImmediately ? 'Download Now' : 'Add to Queue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
