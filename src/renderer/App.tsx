import React, { useState, useEffect, useMemo } from 'react';
import { Toolbar } from './components/Toolbar';
import { Sidebar, StatusFilter } from './components/Sidebar';
import { DownloadList } from './components/DownloadList';
import { AddDownloadModal } from './components/AddDownloadModal';
import { SegmentModal } from './components/SegmentModal';
import { SettingsModal } from './components/SettingsModal';
import { api } from './api';
import { DownloadItem, DownloadStats, AppSettings, FileCategory, NewDownloadOptions } from '../shared/types';

export const App: React.FC = () => {
  const [items, setItems] = useState<DownloadItem[]>([]);
  const [stats, setStats] = useState<DownloadStats>({
    totalSpeed: 0,
    activeCount: 0,
    queuedCount: 0,
    completedCount: 0,
  });
  const [settings, setSettings] = useState<AppSettings>({
    defaultDownloadDir: '',
    maxConcurrentDownloads: 3,
    defaultConnections: 8,
    speedLimitBytesPerSec: 0,
    clipboardWatch: true,
    notifyOnComplete: true,
    soundOnComplete: true,
    theme: 'dark',
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<FileCategory>('All');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addModalInitialUrl, setAddModalInitialUrl] = useState('');
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [inspectingItem, setInspectingItem] = useState<DownloadItem | null>(null);

  // Initial Load
  useEffect(() => {
    loadData();

    // Setup real-time listeners
    const unsubProgress = api.onDownloadProgress((updatedItem) => {
      setItems((prev) => {
        const index = prev.findIndex((i) => i.id === updatedItem.id);
        if (index === -1) return [updatedItem, ...prev];
        const next = [...prev];
        next[index] = updatedItem;
        return next;
      });

      // Update inspector modal in real-time if open
      setInspectingItem((curr) => (curr && curr.id === updatedItem.id ? updatedItem : curr));

      // Update quick stats
      updateStatsDirectly();
    });

    const unsubState = api.onStateChange((newList) => {
      setItems(newList);
      api.getStats().then(setStats).catch(() => {});
    });

    const unsubClipboard = api.onClipboardUrl((url) => {
      setAddModalInitialUrl(url);
      setIsAddModalOpen(true);
    });

    return () => {
      unsubProgress();
      unsubState();
      unsubClipboard();
    };
  }, []);

  const loadData = async () => {
    try {
      const [allDownloads, currentStats, currentSettings] = await Promise.all([
        api.getDownloads(),
        api.getStats(),
        api.getSettings(),
      ]);
      setItems(allDownloads);
      setStats(currentStats);
      setSettings(currentSettings);
    } catch (err) {
      console.warn('Failed to load initial data:', err);
    }
  };

  const updateStatsDirectly = () => {
    setItems((currItems) => {
      let totalSpeed = 0;
      let activeCount = 0;
      let queuedCount = 0;
      let completedCount = 0;

      for (const item of currItems) {
        if (item.status === 'downloading') {
          activeCount++;
          totalSpeed += item.speed;
        } else if (item.status === 'idle') {
          queuedCount++;
        } else if (item.status === 'completed') {
          completedCount++;
        }
      }

      setStats({ totalSpeed, activeCount, queuedCount, completedCount });
      return currItems;
    });
  };

  // Filtered Items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchStatus = statusFilter === 'all' || item.status === statusFilter;
      const matchCategory = categoryFilter === 'All' || item.category === categoryFilter;
      return matchStatus && matchCategory;
    });
  }, [items, statusFilter, categoryFilter]);

  // Actions
  const handleAddDownload = async (options: NewDownloadOptions) => {
    try {
      const newItem = await api.addDownload(options);
      setItems((prev) => [newItem, ...prev]);
      setSelectedId(newItem.id);
    } catch (err: any) {
      alert(`Download failed to start: ${err.message}`);
    }
  };

  const handleResume = async (id: string) => {
    await api.resumeDownload(id);
    loadData();
  };

  const handlePause = async (id: string) => {
    await api.pauseDownload(id);
    loadData();
  };

  const handleDelete = async (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    const confirmDelete = window.confirm(`Remove "${item.filename}" from the download list?`);
    if (!confirmDelete) return;

    await api.deleteDownload(id, false);
    if (selectedId === id) setSelectedId(null);
    loadData();
  };

  const handleResumeSelected = () => {
    if (selectedId) handleResume(selectedId);
  };

  const handlePauseSelected = () => {
    if (selectedId) handlePause(selectedId);
  };

  const handleDeleteSelected = () => {
    if (selectedId) handleDelete(selectedId);
  };

  const handleResumeAll = async () => {
    await api.resumeAll();
    loadData();
  };

  const handlePauseAll = async () => {
    await api.pauseAll();
    loadData();
  };

  const handleSaveSettings = async (newSettings: Partial<AppSettings>) => {
    const updated = await api.saveSettings(newSettings);
    setSettings(updated);
  };

  return (
    <div className="app-container">
      {/* Top Toolbar */}
      <Toolbar
        stats={stats}
        selectedId={selectedId}
        onAddClick={() => {
          setAddModalInitialUrl('');
          setIsAddModalOpen(true);
        }}
        onResumeSelected={handleResumeSelected}
        onPauseSelected={handlePauseSelected}
        onResumeAll={handleResumeAll}
        onPauseAll={handlePauseAll}
        onDeleteSelected={handleDeleteSelected}
        onSpeedLimitClick={() => setIsSettingsModalOpen(true)}
        onSettingsClick={() => setIsSettingsModalOpen(true)}
      />

      {/* Main Workspace */}
      <div className="main-layout">
        {/* Left Categories Sidebar */}
        <Sidebar
          items={items}
          statusFilter={statusFilter}
          categoryFilter={categoryFilter}
          onSelectStatus={(filter) => {
            setStatusFilter(filter);
            setSelectedId(null);
          }}
          onSelectCategory={(cat) => {
            setCategoryFilter(cat);
            setSelectedId(null);
          }}
        />

        {/* Center Downloads Table */}
        <main className="content-area">
          <DownloadList
            items={filteredItems}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onResume={handleResume}
            onPause={handlePause}
            onDelete={handleDelete}
            onInspectSegments={(item) => setInspectingItem(item)}
            onOpenFile={(path) => api.openFile(path)}
            onShowInFolder={(path) => api.showInFolder(path)}
          />
        </main>
      </div>

      {/* Add Download Modal */}
      <AddDownloadModal
        isOpen={isAddModalOpen}
        initialUrl={addModalInitialUrl}
        defaultDir={settings.defaultDownloadDir}
        defaultConnections={settings.defaultConnections}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleAddDownload}
      />

      {/* Segment Inspector Modal (The IDM Visualization) */}
      <SegmentModal
        item={inspectingItem}
        onClose={() => setInspectingItem(null)}
        onPause={handlePause}
        onResume={handleResume}
        onOpenFile={(path) => api.openFile(path)}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        settings={settings}
        onClose={() => setIsSettingsModalOpen(false)}
        onSave={handleSaveSettings}
      />
    </div>
  );
};

export default App;
