import React from 'react';
import { 
  Layers, 
  ArrowDownCircle, 
  CheckCircle2, 
  PauseCircle, 
  AlertCircle, 
  Archive, 
  FileText, 
  Music, 
  Film, 
  Binary, 
  HelpCircle 
} from 'lucide-react';
import { DownloadItem, FileCategory } from '../../shared/types';

export type StatusFilter = 'all' | 'downloading' | 'completed' | 'paused' | 'error';

interface SidebarProps {
  items: DownloadItem[];
  statusFilter: StatusFilter;
  categoryFilter: FileCategory;
  onSelectStatus: (filter: StatusFilter) => void;
  onSelectCategory: (cat: FileCategory) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  items,
  statusFilter,
  categoryFilter,
  onSelectStatus,
  onSelectCategory,
}) => {
  const getStatusCount = (status: StatusFilter) => {
    if (status === 'all') return items.length;
    return items.filter((i) => i.status === status).length;
  };

  const getCategoryCount = (cat: FileCategory) => {
    if (cat === 'All') return items.length;
    return items.filter((i) => i.category === cat).length;
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-section">
        <h3>Downloads</h3>
        <ul className="sidebar-menu">
          <li 
            className={`sidebar-item ${statusFilter === 'all' && categoryFilter === 'All' ? 'active' : ''}`}
            onClick={() => { onSelectStatus('all'); onSelectCategory('All'); }}
          >
            <div className="item-left">
              <Layers size={16} />
              <span>All Downloads</span>
            </div>
            <span className="badge">{getStatusCount('all')}</span>
          </li>

          <li 
            className={`sidebar-item ${statusFilter === 'downloading' ? 'active' : ''}`}
            onClick={() => onSelectStatus('downloading')}
          >
            <div className="item-left">
              <ArrowDownCircle size={16} color="#38bdf8" />
              <span>Downloading</span>
            </div>
            <span className="badge">{getStatusCount('downloading')}</span>
          </li>

          <li 
            className={`sidebar-item ${statusFilter === 'completed' ? 'active' : ''}`}
            onClick={() => onSelectStatus('completed')}
          >
            <div className="item-left">
              <CheckCircle2 size={16} color="#34d399" />
              <span>Finished</span>
            </div>
            <span className="badge">{getStatusCount('completed')}</span>
          </li>

          <li 
            className={`sidebar-item ${statusFilter === 'paused' ? 'active' : ''}`}
            onClick={() => onSelectStatus('paused')}
          >
            <div className="item-left">
              <PauseCircle size={16} color="#fbbf24" />
              <span>Paused</span>
            </div>
            <span className="badge">{getStatusCount('paused')}</span>
          </li>

          <li 
            className={`sidebar-item ${statusFilter === 'error' ? 'active' : ''}`}
            onClick={() => onSelectStatus('error')}
          >
            <div className="item-left">
              <AlertCircle size={16} color="#fb7185" />
              <span>Incomplete / Error</span>
            </div>
            <span className="badge">{getStatusCount('error')}</span>
          </li>
        </ul>
      </div>

      <div className="sidebar-section">
        <h3>Categories</h3>
        <ul className="sidebar-menu">
          <li 
            className={`sidebar-item ${categoryFilter === 'Compressed' ? 'active' : ''}`}
            onClick={() => onSelectCategory('Compressed')}
          >
            <div className="item-left">
              <Archive size={16} />
              <span>Compressed</span>
            </div>
            <span className="badge">{getCategoryCount('Compressed')}</span>
          </li>

          <li 
            className={`sidebar-item ${categoryFilter === 'Documents' ? 'active' : ''}`}
            onClick={() => onSelectCategory('Documents')}
          >
            <div className="item-left">
              <FileText size={16} />
              <span>Documents</span>
            </div>
            <span className="badge">{getCategoryCount('Documents')}</span>
          </li>

          <li 
            className={`sidebar-item ${categoryFilter === 'Music' ? 'active' : ''}`}
            onClick={() => onSelectCategory('Music')}
          >
            <div className="item-left">
              <Music size={16} />
              <span>Music</span>
            </div>
            <span className="badge">{getCategoryCount('Music')}</span>
          </li>

          <li 
            className={`sidebar-item ${categoryFilter === 'Video' ? 'active' : ''}`}
            onClick={() => onSelectCategory('Video')}
          >
            <div className="item-left">
              <Film size={16} />
              <span>Video</span>
            </div>
            <span className="badge">{getCategoryCount('Video')}</span>
          </li>

          <li 
            className={`sidebar-item ${categoryFilter === 'Programs' ? 'active' : ''}`}
            onClick={() => onSelectCategory('Programs')}
          >
            <div className="item-left">
              <Binary size={16} />
              <span>Programs</span>
            </div>
            <span className="badge">{getCategoryCount('Programs')}</span>
          </li>

          <li 
            className={`sidebar-item ${categoryFilter === 'Other' ? 'active' : ''}`}
            onClick={() => onSelectCategory('Other')}
          >
            <div className="item-left">
              <HelpCircle size={16} />
              <span>Other</span>
            </div>
            <span className="badge">{getCategoryCount('Other')}</span>
          </li>
        </ul>
      </div>
    </aside>
  );
};
