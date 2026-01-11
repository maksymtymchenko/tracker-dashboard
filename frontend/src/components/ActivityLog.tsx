import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { ActivityItem, Paginated, ProcessContext } from 'src/types';
import { fetchScreenshots } from 'src/api/client';

type ViewMode = 'table' | 'card' | 'timeline';
type SortField = 'time' | 'username' | 'domain' | 'type' | 'duration';
type SortDirection = 'asc' | 'desc';

const blockedProcessNames = ['windows activity tracker', 'msmpeng', 'msmpeng.exe'];

interface Props {
  data: Paginated<ActivityItem> | null;
  loading: boolean;
  error?: string;
  onPageChange?(page: number): void;
  onUserClick?(username: string): void;
  searchQuery?: string;
  dateRange?: { start?: string; end?: string };
  defaultSortByDuration?: boolean;
  defaultSortByUser?: boolean;
  onNotify?(message: string, tone?: 'info' | 'success' | 'error'): void;
}

/** Renders the activity log list with sorting, filtering, and detail views. */
export function ActivityLog({
  data,
  loading,
  error,
  onPageChange,
  onUserClick,
  searchQuery: externalSearchQuery = '',
  dateRange,
  defaultSortByDuration = false,
  defaultSortByUser = false,
  onNotify,
}: Props): JSX.Element {
  const [open, setOpen] = useState<ActivityItem | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [sortField, setSortField] = useState<SortField>(
    defaultSortByDuration ? 'duration' : defaultSortByUser ? 'username' : 'time'
  );
  const [sortDirection, setSortDirection] = useState<SortDirection>(
    defaultSortByDuration ? 'desc' : defaultSortByUser ? 'asc' : 'desc'
  );
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  
  // Use external search query if provided, otherwise use local one
  const searchQuery = externalSearchQuery || localSearchQuery;
  const [screenshotOpen, setScreenshotOpen] = useState<string | null>(null);
  const [screenshotItems, setScreenshotItems] = useState<Array<{ filename: string; url?: string; username: string; domain?: string; mtime?: number }>>([]);
  const [loadingScreenshot, setLoadingScreenshot] = useState<string | null>(null);
  const [screenshotZoom, setScreenshotZoom] = useState(1);
  const [screenshotPan, setScreenshotPan] = useState({ x: 0, y: 0 });
  const [isScreenshotPanning, setIsScreenshotPanning] = useState(false);
  const screenshotPanStartRef = useRef({ startX: 0, startY: 0, clientX: 0, clientY: 0 });
  const screenshotContainerRef = useRef<HTMLDivElement | null>(null);
  const screenshotImageRef = useRef<HTMLImageElement | null>(null);
  const [screenshotContainerSize, setScreenshotContainerSize] = useState({ width: 0, height: 0 });
  const [screenshotImageSize, setScreenshotImageSize] = useState({ width: 0, height: 0 });

  // Disable body scroll when modal is open
  useEffect(() => {
    if (!open) return;

    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (screenshotOpen) {
      setScreenshotZoom(1);
      setScreenshotPan({ x: 0, y: 0 });
      setIsScreenshotPanning(false);
      setScreenshotImageSize({ width: 0, height: 0 });
    }
  }, [screenshotOpen]);

  useEffect(() => {
    if (!screenshotOpen) return;
    const container = screenshotContainerRef.current;
    if (!container) return;

    const updateSize = () => {
      setScreenshotContainerSize({ width: container.clientWidth, height: container.clientHeight });
    };

    updateSize();
    window.addEventListener('resize', updateSize);

    let resizeObserver: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => updateSize());
      resizeObserver.observe(container);
    }

    return () => {
      window.removeEventListener('resize', updateSize);
      resizeObserver?.disconnect();
    };
  }, [screenshotOpen]);

  const clampScreenshotPan = useCallback((nextPan: { x: number; y: number }, zoomValue = screenshotZoom) => {
    const { width: containerWidth, height: containerHeight } = screenshotContainerSize;
    const { width: imgWidth, height: imgHeight } = screenshotImageSize;
    if (!containerWidth || !containerHeight || !imgWidth || !imgHeight) return nextPan;

    const fitScale = Math.min(containerWidth / imgWidth, containerHeight / imgHeight);
    const scaledWidth = imgWidth * fitScale * zoomValue;
    const scaledHeight = imgHeight * fitScale * zoomValue;
    const maxX = Math.max(0, (scaledWidth - containerWidth) / 2);
    const maxY = Math.max(0, (scaledHeight - containerHeight) / 2);

    return {
      x: Math.max(-maxX, Math.min(maxX, nextPan.x)),
      y: Math.max(-maxY, Math.min(maxY, nextPan.y)),
    };
  }, [screenshotContainerSize, screenshotImageSize, screenshotZoom]);

  useEffect(() => {
    if (!screenshotOpen) return;
    setScreenshotPan((prev) => clampScreenshotPan(prev, screenshotZoom));
  }, [screenshotOpen, screenshotZoom, screenshotContainerSize, screenshotImageSize, clampScreenshotPan]);

  const formatDuration = (ms: number): string => {
    if (!Number.isFinite(ms) || ms < 0) return String(ms);
    if (ms < 1000) return `${Math.round(ms)} ms`;
    const seconds = ms / 1000;
    if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)} s`;
    const minutes = Math.floor(seconds / 60);
    const remSec = Math.round(seconds % 60);
    if (minutes < 60) return `${minutes}m ${remSec}s`;
    const hours = Math.floor(minutes / 60);
    const remMin = minutes % 60;
    return `${hours}h ${remMin}m`;
  };

  const formatTime = (time: string): string => {
    const date = new Date(time);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Format timestamp (number) for screenshots - same as Screenshots component
  const formatScreenshotTime = (mtime?: number): string => {
    if (!mtime) return 'Unknown';
    const date = new Date(mtime);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getActivityTypeIcon = (type: string): string => {
    switch (type) {
      case 'window_activity':
        return '🪟';
      case 'form_interaction':
        return '📝';
      case 'click':
        return '🖱️';
      case 'keypress':
        return '⌨️';
      case 'scroll':
        return '📜';
      case 'screenshot':
        return '📸';
      case 'clipboard':
        return '📋';
      default:
        return '•';
    }
  };

  const getActivityTypeColor = (type: string): string => {
    switch (type) {
      case 'window_activity':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300';
      case 'form_interaction':
        return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
      case 'click':
        return 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300';
      case 'keypress':
        return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300';
      case 'scroll':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300';
      case 'screenshot':
        return 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300';
      case 'clipboard':
        return 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300';
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300';
    }
  };

  const getProcessContext = (details: unknown): ProcessContext | null => {
    if (!details || typeof details !== 'object') return null;
    const record = details as Record<string, unknown>;
    if (!record.process || typeof record.process !== 'object') return null;
    return record.process as ProcessContext;
  };

  const isBlockedName = (value?: string | null): boolean => {
    if (!value || typeof value !== 'string') return false;
    return blockedProcessNames.includes(value.trim().toLowerCase());
  };

  const isBlockedActivity = (item: ActivityItem): boolean => {
    if (isBlockedName(item.application) || isBlockedName(item.domain)) {
      return true;
    }

    const process = getProcessContext(item.details);
    if (process && (isBlockedName(process.processName) || isBlockedName(process.parentName))) {
      return true;
    }

    if (item.details && typeof item.details === 'object') {
      const details = item.details as Record<string, unknown>;
      const detailCandidates = [
        details.title,
        details.application,
        details.app,
        details.appName,
        details.app_name,
      ];
      if (detailCandidates.some((value) => (typeof value === 'string' ? isBlockedName(value) : false))) {
        return true;
      }
    }

    return false;
  };

  const getOriginLabel = (origin?: ProcessContext['origin']): string => {
    if (!origin) return 'Unknown';
    return origin.charAt(0).toUpperCase() + origin.slice(1);
  };

  const getOriginBadgeClass = (origin?: ProcessContext['origin']): string => {
    switch (origin) {
      case 'user':
        return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-200';
      case 'system':
        return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200';
      case 'security':
        return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200';
      case 'background':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  const formatSessionLabel = (process: ProcessContext | null): string => {
    if (!process) return '—';
    if (process.sessionName && process.sessionId != null) {
      return `${process.sessionName} (${process.sessionId})`;
    }
    if (process.sessionName) return process.sessionName;
    if (process.sessionId != null) return String(process.sessionId);
    return '—';
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Sort and filter items
  const processedItems = useMemo(() => {
    if (!data?.items) return [];

    let filtered = data.items.filter((item) => !isBlockedActivity(item));

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((item) => {
        // Search in basic fields
        if (
          item.username.toLowerCase().includes(query) ||
          (item.displayName && item.displayName.toLowerCase().includes(query)) ||
          item.domain?.toLowerCase().includes(query) ||
          item.application?.toLowerCase().includes(query) ||
          item.type.toLowerCase().includes(query) ||
          item.url?.toLowerCase().includes(query)
        ) {
          return true;
        }
        
        // Search in details object (e.g., reason field)
        if (item.details && typeof item.details === 'object') {
          const details = item.details as Record<string, unknown>;
          // Check reason field
          if (typeof details.reason === 'string' && details.reason.toLowerCase().includes(query)) {
            return true;
          }
          const process = getProcessContext(item.details);
          if (process) {
            const processFields = [
              process.origin,
              process.launchTrigger,
              process.processName,
              process.parentName,
              process.sessionName,
              process.originReason,
              process.executablePath,
              process.user,
            ];
            if (process.sessionId != null && String(process.sessionId).includes(query)) {
              return true;
            }
            if (process.pid != null && String(process.pid).includes(query)) {
              return true;
            }
            if (process.ppid != null && String(process.ppid).includes(query)) {
              return true;
            }
            for (const value of processFields) {
              if (typeof value === 'string' && value.toLowerCase().includes(query)) {
                return true;
              }
            }
          }
          // Also search in other string fields in details
          for (const value of Object.values(details)) {
            if (typeof value === 'string' && value.toLowerCase().includes(query)) {
              return true;
            }
          }
        }
        
        return false;
      });
    }

    // Sort
    filtered.sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (sortField) {
        case 'time':
          aVal = new Date(a.time).getTime();
          bVal = new Date(b.time).getTime();
          break;
        case 'username':
          aVal = a.username.toLowerCase();
          bVal = b.username.toLowerCase();
          break;
        case 'domain':
          aVal = (a.domain || '').toLowerCase();
          bVal = (b.domain || '').toLowerCase();
          break;
        case 'type':
          aVal = a.type.toLowerCase();
          bVal = b.type.toLowerCase();
          break;
        case 'duration':
          aVal = a.duration ?? 0;
          bVal = b.duration ?? 0;
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [data?.items, searchQuery, sortField, sortDirection]);

  // Keyboard support for screenshot lightbox (same as Screenshots component)
  useEffect(() => {
    if (!screenshotOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setScreenshotOpen(null);
        return;
      }

      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        setScreenshotZoom((z) => Math.min(3, Number((z + 0.2).toFixed(2))));
        return;
      }

      if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        setScreenshotZoom((z) => {
          const next = Math.max(1, Number((z - 0.2).toFixed(2)));
          if (next === 1) {
            setScreenshotPan({ x: 0, y: 0 });
          }
          return next;
        });
        return;
      }

      if (e.key === '0') {
        e.preventDefault();
        setScreenshotZoom(1);
        setScreenshotPan({ x: 0, y: 0 });
        return;
      }

      if (screenshotZoom > 1 && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault();
        const step = 40;
        const dx = e.key === 'ArrowLeft' ? step : e.key === 'ArrowRight' ? -step : 0;
        const dy = e.key === 'ArrowUp' ? step : e.key === 'ArrowDown' ? -step : 0;
        setScreenshotPan((prev) => clampScreenshotPan({ x: prev.x + dx, y: prev.y + dy }, screenshotZoom));
        return;
      }

      if (e.key === 'ArrowLeft') {
        const currentIdx = screenshotItems.findIndex((s) => s.filename === screenshotOpen);
        if (currentIdx > 0) {
          setScreenshotOpen(screenshotItems[currentIdx - 1].filename);
        }
      } else if (e.key === 'ArrowRight') {
        const currentIdx = screenshotItems.findIndex((s) => s.filename === screenshotOpen);
        if (currentIdx < screenshotItems.length - 1) {
          setScreenshotOpen(screenshotItems[currentIdx + 1].filename);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [screenshotOpen, screenshotItems, screenshotZoom, clampScreenshotPan]);

  const renderDetailValue = (key: string, value: unknown): JSX.Element => {
    if (key === 'url' && typeof value === 'string') {
      return (
        <a
          href={value}
          target="_blank"
          rel="noreferrer"
          className="text-blue-600 dark:text-blue-400 break-all underline"
        >
          {value}
        </a>
      );
    }
    if (key === 'title' && typeof value === 'string') {
      return <span className="font-medium break-words">{value}</span>;
    }
    if (key === 'reason' && typeof value === 'string') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-xs">
          {value}
        </span>
      );
    }
    if (key === 'deviceId' && typeof value === 'string') {
      return <code className="text-xs break-all">{value}</code>;
    }
    if (key === 'clipboard' && typeof value === 'string') {
      return (
        <pre className="text-xs whitespace-pre-wrap break-words bg-gray-50 dark:bg-gray-900 p-2 rounded border border-gray-200 dark:border-gray-800">
          {value}
        </pre>
      );
    }

    if (typeof value === 'object' && value !== null) {
      try {
        return <span className="break-words">{JSON.stringify(value, null, 2)}</span>;
      } catch {
        return <span className="break-words">{String(value)}</span>;
      }
    }
    return <span className="break-words">{String(value)}</span>;
  };

  /**
   * Extract just the filename from a path (handles Windows/Unix paths)
   */
  const extractFilenameFromPath = (pathOrFilename: string): string => {
    // Handle Windows paths (C:\... or C:/...)
    const windowsMatch = pathOrFilename.match(/[\/\\]([^\/\\]+\.png)$/i);
    if (windowsMatch) {
      return windowsMatch[1];
    }
    // Handle Unix paths
    const unixMatch = pathOrFilename.match(/\/([^\/]+\.png)$/);
    if (unixMatch) {
      return unixMatch[1];
    }
    // If no path separators, assume it's already just a filename
    return pathOrFilename;
  };

  /**
   * Extract screenshot filename or URL from event details
   */
  const getScreenshotInfo = (event: ActivityItem): { filename?: string; url?: string } | null => {
    if (event.type !== 'screenshot') return null;

    // Check if details contain screenshot information
    if (event.details && typeof event.details === 'object') {
      const details = event.details as Record<string, unknown>;
      // Check for common field names
      if (typeof details.filename === 'string') {
        // Normalize filename - extract just the filename from any path
        const normalizedFilename = extractFilenameFromPath(details.filename);
        return { filename: normalizedFilename };
      }
      if (typeof details.screenshot === 'string') {
        const normalizedFilename = extractFilenameFromPath(details.screenshot);
        return { filename: normalizedFilename };
      }
      if (typeof details.url === 'string' && details.url.includes('.png')) {
        // If URL contains a path, extract filename
        if (details.url.includes('/') || details.url.includes('\\')) {
          const normalizedFilename = extractFilenameFromPath(details.url);
          return { filename: normalizedFilename };
        }
        return { url: details.url };
      }
      if (typeof details.screenshotUrl === 'string') {
        // If URL contains a path, extract filename
        if (details.screenshotUrl.includes('/') || details.screenshotUrl.includes('\\')) {
          const normalizedFilename = extractFilenameFromPath(details.screenshotUrl);
          return { filename: normalizedFilename };
        }
        return { url: details.screenshotUrl };
      }
      // Check nested objects
      if (details.screenshot && typeof details.screenshot === 'object') {
        const screenshot = details.screenshot as Record<string, unknown>;
        if (typeof screenshot.filename === 'string') {
          const normalizedFilename = extractFilenameFromPath(screenshot.filename);
          return { filename: normalizedFilename };
        }
        if (typeof screenshot.url === 'string') {
          // If URL contains a path, extract filename
          if (screenshot.url.includes('/') || screenshot.url.includes('\\')) {
            const normalizedFilename = extractFilenameFromPath(screenshot.url);
            return { filename: normalizedFilename };
          }
          return { url: screenshot.url };
        }
      }
    }

    return null;
  };

  /**
   * Extract timestamp from screenshot filename
   * Filenames are typically: {timestamp}_{deviceId}_{hostname}_{platform}.png
   */
  const extractTimestampFromFilename = (filename: string): number | null => {
    const match = filename.match(/^(\d+)_/);
    if (match && match[1]) {
      const timestamp = parseInt(match[1], 10);
      if (!isNaN(timestamp) && timestamp > 0) {
        return timestamp;
      }
    }
    return null;
  };

  /**
   * Get unique identifier for an activity item
   */
  const getActivityItemId = (item: ActivityItem): string => {
    return `${item._id}_${item.time}`;
  };

  /**
   * Find screenshot by matching username and time
   * Returns the screenshot item and all screenshots for navigation
   */
  const findScreenshotByTime = async (event: ActivityItem, itemId: string): Promise<{
    screenshot: { filename: string; url?: string; username: string; domain?: string; mtime?: number } | null;
    allScreenshots: Array<{ filename: string; url?: string; username: string; domain?: string; mtime?: number }>;
  }> => {
    try {
      setLoadingScreenshot(itemId);
      const eventTime = new Date(event.time).getTime();
      // Search within a 30 minute window (more lenient)
      const timeWindow = 30 * 60 * 1000;
      
      // Fetch screenshots for this user
      const result = await fetchScreenshots({
        user: event.username,
        limit: 100, // Get more screenshots to increase chances of finding a match
        startDate: dateRange?.start,
        endDate: dateRange?.end,
      });

      if (!result.items || result.items.length === 0) {
        console.log('No screenshots found for user:', event.username);
        return { screenshot: null, allScreenshots: [] };
      }

      // Find screenshot closest to event time
      let closestScreenshot: { url?: string; filename: string; username: string; domain?: string; mtime?: number } | null = null;
      let minTimeDiff = Infinity;

      for (const screenshot of result.items) {
        let screenshotTime: number | null = null;

        // Try to get time from mtime first
        if (screenshot.mtime) {
          // Handle both Date objects and timestamps
          screenshotTime = typeof screenshot.mtime === 'number' 
            ? screenshot.mtime 
            : new Date(screenshot.mtime).getTime();
        } else {
          // Fallback: extract timestamp from filename
          screenshotTime = extractTimestampFromFilename(screenshot.filename);
        }

        if (screenshotTime && !isNaN(screenshotTime)) {
          const timeDiff = Math.abs(screenshotTime - eventTime);
          
          // Also check if domain matches (if available)
          const domainMatches = !event.domain || !screenshot.domain || 
                                screenshot.domain === event.domain;

          // Only consider screenshots within the time window
          if (timeDiff <= timeWindow && timeDiff < minTimeDiff && domainMatches) {
            minTimeDiff = timeDiff;
            closestScreenshot = screenshot;
          }
        }
      }

      // If no match found within time window, try to get the most recent screenshot
      // that matches the domain (if available)
      if (!closestScreenshot && result.items.length > 0) {
        for (const screenshot of result.items) {
          const domainMatches = !event.domain || !screenshot.domain || 
                                screenshot.domain === event.domain;
          if (domainMatches) {
            closestScreenshot = screenshot;
            break; // Take the first one (they're sorted by mtime desc)
          }
        }
      }

      // If still no match, just take the most recent screenshot for this user
      if (!closestScreenshot && result.items.length > 0) {
        closestScreenshot = result.items[0];
      }

      if (closestScreenshot) {
        console.log('Found screenshot:', closestScreenshot.filename);
        return { screenshot: closestScreenshot, allScreenshots: result.items };
      }

      console.log('No matching screenshot found for event:', event);
      return { screenshot: null, allScreenshots: result.items };
    } catch (error) {
      console.error('Failed to find screenshot:', error);
      return { screenshot: null, allScreenshots: [] };
    } finally {
      setLoadingScreenshot(null);
    }
  };

  /**
   * Handle clicking View button - opens screenshot if type is screenshot, otherwise opens details modal
   */
  const handleViewClick = async (row: ActivityItem) => {
    if (row.type === 'screenshot') {
      await handleViewScreenshot(row);
    } else {
      setOpen(row);
    }
  };

  /**
   * Handle viewing screenshot for a screenshot event
   */
  const handleViewScreenshot = async (event: ActivityItem) => {
    const itemId = getActivityItemId(event);
    // First try to get screenshot info from event details
    const screenshotInfo = getScreenshotInfo(event);
    if (screenshotInfo && screenshotInfo.filename) {
      // If we have a filename, fetch all screenshots for navigation and find this one
      try {
        setLoadingScreenshot(itemId);
        const result = await fetchScreenshots({
          user: event.username,
          limit: 100,
          startDate: dateRange?.start,
          endDate: dateRange?.end,
        });
        
        const foundScreenshot = result.items.find(s => s.filename === screenshotInfo.filename);
        if (foundScreenshot) {
          setScreenshotItems(result.items);
          setScreenshotOpen(foundScreenshot.filename);
          return;
        }
      } catch (error) {
        console.error('Failed to fetch screenshots:', error);
      } finally {
        setLoadingScreenshot(null);
      }
    }

    // If not found in details, try to find by username and time
    const { screenshot, allScreenshots } = await findScreenshotByTime(event, itemId);
    if (screenshot) {
      setScreenshotItems(allScreenshots);
      setScreenshotOpen(screenshot.filename);
    } else {
      onNotify?.(
        'Screenshot not found. It may have been deleted, outside the time range, or not associated with this user.',
        'error',
      );
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <span className="text-gray-400">↕</span>;
    }
    return sortDirection === 'asc' ? <span>↑</span> : <span>↓</span>;
  };

  const openProcess = open ? getProcessContext(open.details) : null;

  return (
    <div>
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        {!externalSearchQuery && (
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search activities..."
              value={localSearchQuery}
              onChange={(e) => setLocalSearchQuery(e.target.value)}
              className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent flex-1 min-w-[200px]"
            />
          </div>
        )}
        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex rounded-lg border border-gray-300 dark:border-gray-700 overflow-hidden">
            <button
              className={`px-3 py-1.5 text-sm transition-colors ${
                viewMode === 'table'
                  ? 'bg-blue-600 text-white'
                  : 'bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
              onClick={() => setViewMode('table')}
              title="Table view"
            >
              Table
            </button>
            <button
              className={`px-3 py-1.5 text-sm transition-colors ${
                viewMode === 'card'
                  ? 'bg-blue-600 text-white'
                  : 'bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
              onClick={() => setViewMode('card')}
              title="Card view"
            >
              Cards
            </button>
            <button
              className={`px-3 py-1.5 text-sm transition-colors ${
                viewMode === 'timeline'
                  ? 'bg-blue-600 text-white'
                  : 'bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
              onClick={() => setViewMode('timeline')}
              title="Timeline view"
            >
              Timeline
            </button>
          </div>
        </div>
      </div>

      {error && <div className="text-sm text-red-600 mb-2">{error}</div>}

      {/* Table View */}
      {viewMode === 'table' && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th
                  className="py-3 px-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                  onClick={() => handleSort('time')}
                >
                  <div className="flex items-center gap-2">
                    Time
                    <SortIcon field="time" />
                  </div>
                </th>
                <th
                  className="py-3 px-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                  onClick={() => handleSort('username')}
                >
                  <div className="flex items-center gap-2">
                    User
                    <SortIcon field="username" />
                  </div>
                </th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Application</th>
                <th
                  className="py-3 px-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                  onClick={() => handleSort('domain')}
                >
                  <div className="flex items-center gap-2">
                    Domain/URL
                    <SortIcon field="domain" />
                  </div>
                </th>
                <th
                  className="py-3 px-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                  onClick={() => handleSort('type')}
                >
                  <div className="flex items-center gap-2">
                    Type
                    <SortIcon field="type" />
                  </div>
                </th>
                <th className="py-3 px-4">Origin</th>
                <th className="py-3 px-4">Session</th>
                <th
                  className="py-3 px-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                  onClick={() => handleSort('duration')}
                >
                  <div className="flex items-center gap-2">
                    Duration
                    <SortIcon field="duration" />
                  </div>
                </th>
                <th className="py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {!loading && processedItems.length
                ? processedItems.map((row) => {
                    const process = getProcessContext(row.details);
                    return (
                      <tr
                        key={String(row._id) + row.time}
                        className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50/70 dark:hover:bg-gray-900/60 transition-colors"
                      >
                      <td className="py-3 px-4">
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {formatTime(row.time)}
                        </div>
                        <div className="text-xs text-gray-400 dark:text-gray-500">
                          {new Date(row.time).toLocaleString()}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {onUserClick ? (
                          <button
                            onClick={() => onUserClick(row.username)}
                            className="text-blue-600 dark:text-blue-400 hover:underline font-medium block text-left"
                          >
                            {row.displayName || row.username}
                          </button>
                        ) : (
                          <span className="font-medium block">
                            {row.displayName || row.username}
                          </span>
                        )}
                        {row.displayName && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {row.username}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">{row.department || '—'}</td>
                      <td className="py-3 px-4">{row.application || '—'}</td>
                      <td className="py-3 px-4">
                        {row.url ? (
                          <a
                            href={row.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 dark:text-blue-400 hover:underline break-all text-xs"
                          >
                            {row.domain || row.url}
                          </a>
                        ) : (
                          <span className="text-xs">{row.domain || '—'}</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${getActivityTypeColor(
                            row.type,
                          )}`}
                        >
                          <span>{getActivityTypeIcon(row.type)}</span>
                          {row.type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getOriginBadgeClass(process?.origin)}`}>
                          {getOriginLabel(process?.origin)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-gray-600 dark:text-gray-300">
                        {formatSessionLabel(process)}
                      </td>
                      <td className="py-3 px-4">
                        {row.duration != null ? (
                          <span className="text-xs">{formatDuration(row.duration)}</span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                          onClick={() => handleViewClick(row)}
                          disabled={row.type === 'screenshot' && loadingScreenshot === getActivityItemId(row)}
                        >
                          {row.type === 'screenshot' && loadingScreenshot === getActivityItemId(row) ? 'Loading…' : 'View'}
                        </button>
                      </td>
                    </tr>
                  );
                })
                : (
                  <tr>
                    <td className="py-8 px-4 text-center text-gray-500 dark:text-gray-400" colSpan={10}>
                      {loading ? 'Loading…' : searchQuery ? 'No results found' : 'No data'}
                    </td>
                  </tr>
                )}
            </tbody>
          </table>
        </div>
      )}

      {/* Card View */}
      {viewMode === 'card' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {!loading && processedItems.length
            ? processedItems.map((row) => {
                const process = getProcessContext(row.details);
                return (
                  <div
                    key={String(row._id) + row.time}
                    className="p-4 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between mb-3 gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${getActivityTypeColor(
                            row.type,
                          )}`}
                        >
                          <span>{getActivityTypeIcon(row.type)}</span>
                          {row.type.replace('_', ' ')}
                        </span>
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getOriginBadgeClass(process?.origin)}`}>
                          {getOriginLabel(process?.origin)}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {formatTime(row.time)}
                      </span>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">User: </span>
                        {onUserClick ? (
                          <button
                            onClick={() => onUserClick(row.username)}
                            className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                          >
                            {row.displayName || row.username}
                          </button>
                        ) : (
                          <span className="font-medium">
                            {row.displayName || row.username}
                          </span>
                        )}
                        {row.displayName && (
                          <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">
                            ({row.username})
                          </span>
                        )}
                      </div>
                      {row.department && (
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Department: </span>
                          <span>{row.department}</span>
                        </div>
                      )}
                      {process && (
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Session: </span>
                          <span>{formatSessionLabel(process)}</span>
                        </div>
                      )}
                      {row.domain && (
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Domain: </span>
                          <span className="break-all">{row.domain}</span>
                        </div>
                      )}
                      {row.url && (
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">URL: </span>
                          <a
                            href={row.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 dark:text-blue-400 hover:underline break-all text-xs"
                          >
                            {row.url}
                          </a>
                        </div>
                      )}
                      {row.duration != null && (
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Duration: </span>
                          <span>{formatDuration(row.duration)}</span>
                        </div>
                      )}
                    </div>
                    <button
                      className="mt-3 w-full text-xs px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                      onClick={() => handleViewClick(row)}
                      disabled={row.type === 'screenshot' && loadingScreenshot === getActivityItemId(row)}
                    >
                      {row.type === 'screenshot' && loadingScreenshot === getActivityItemId(row) ? 'Loading…' : row.type === 'screenshot' ? 'View Screenshot' : 'View Details'}
                    </button>
                  </div>
                );
              })
            : Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-48 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
              ))}
        </div>
      )}

      {/* Timeline View */}
      {viewMode === 'timeline' && (
        <div className="relative">
          <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-800" />
          <div className="space-y-4">
            {!loading && processedItems.length
              ? processedItems.map((row) => {
                  const process = getProcessContext(row.details);
                  return (
                  <div key={String(row._id) + row.time} className="relative flex gap-4">
                    <div className="flex-shrink-0 w-16 text-right">
                      <div className="sticky top-4">
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {formatTime(row.time)}
                        </div>
                      </div>
                    </div>
                    <div className="flex-shrink-0 w-4 h-4 rounded-full bg-blue-600 border-4 border-white dark:border-gray-900 mt-1 relative z-10" />
                    <div className="flex-1 pb-4">
                      <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:shadow-md transition-all">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${getActivityTypeColor(
                                row.type,
                              )}`}
                            >
                              <span>{getActivityTypeIcon(row.type)}</span>
                              {row.type.replace('_', ' ')}
                            </span>
                            <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getOriginBadgeClass(process?.origin)}`}>
                              {getOriginLabel(process?.origin)}
                            </span>
                          </div>
                        </div>
                        <div className="space-y-1 text-sm">
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">User: </span>
                            {onUserClick ? (
                              <button
                                onClick={() => onUserClick(row.username)}
                                className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                              >
                                {row.displayName || row.username}
                              </button>
                            ) : (
                              <span className="font-medium">
                                {row.displayName || row.username}
                              </span>
                            )}
                            {row.displayName && (
                              <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">
                                ({row.username})
                              </span>
                            )}
                            {row.department && (
                              <span className="text-gray-400 dark:text-gray-500">
                                {' '}
                                • {row.department}
                              </span>
                            )}
                          </div>
                          {process && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              Session: {formatSessionLabel(process)}
                            </div>
                          )}
                          {row.domain && (
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">Domain: </span>
                              <span>{row.domain}</span>
                            </div>
                          )}
                          {row.url && (
                            <div>
                              <a
                                href={row.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-600 dark:text-blue-400 hover:underline break-all text-xs"
                              >
                                {row.url}
                              </a>
                            </div>
                          )}
                          {row.duration != null && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              Duration: {formatDuration(row.duration)}
                            </div>
                          )}
                        </div>
                        <button
                          className="mt-3 text-xs px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                          onClick={() => handleViewClick(row)}
                          disabled={row.type === 'screenshot' && loadingScreenshot === getActivityItemId(row)}
                        >
                          {row.type === 'screenshot' && loadingScreenshot === getActivityItemId(row) ? 'Loading…' : row.type === 'screenshot' ? 'View Screenshot' : 'View Details'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
              : Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-32 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
                ))}
          </div>
        </div>
      )}

      {/* Pagination */}
      {data && (
        <div className="mt-4 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <div>
            Showing {processedItems.length} of {data.total} activities • Page {data.page}
          </div>
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
              disabled={loading || data.page <= 1}
              onClick={() => onPageChange && onPageChange(Math.max(1, data.page - 1))}
            >
              Previous
            </button>
            <button
              className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
              disabled={loading || data.page * data.limit >= data.total}
              onClick={() => onPageChange && onPageChange(data.page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={() => setOpen(null)}
        >
          <div 
            className="absolute inset-0 bg-black/60"
            onWheel={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onTouchMove={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          />
          <div
            className="relative max-w-4xl w-[95vw] max-h-[90vh] bg-white dark:bg-gray-900 rounded-xl overflow-hidden shadow-2xl border border-gray-200 dark:border-white/10 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${getActivityTypeColor(
                    open.type,
                  )}`}
                >
                  <span>{getActivityTypeIcon(open.type)}</span>
                  {open.type.replace('_', ' ')}
                </span>
                <div className="text-sm font-medium">Activity Details</div>
              </div>
              <button
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                onClick={() => setOpen(null)}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="p-6 text-sm overflow-y-auto space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs uppercase text-gray-500 dark:text-gray-400 mb-1">
                    Time
                  </div>
                  <div className="font-medium">{new Date(open.time).toLocaleString()}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {formatTime(open.time)}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase text-gray-500 dark:text-gray-400 mb-1">User</div>
                  <div className="font-medium">
                    {onUserClick ? (
                      <button
                        onClick={() => {
                          setOpen(null);
                          onUserClick(open.username);
                        }}
                        className="text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {open.displayName || open.username}
                      </button>
                    ) : (
                      open.displayName || open.username
                    )}
                  </div>
                  {open.displayName && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {open.username}
                    </div>
                  )}
                </div>
                {open.department && (
                  <div>
                    <div className="text-xs uppercase text-gray-500 dark:text-gray-400 mb-1">
                      Department
                    </div>
                    <div>{open.department}</div>
                  </div>
                )}
                {open.application && (
                  <div>
                    <div className="text-xs uppercase text-gray-500 dark:text-gray-400 mb-1">
                      Application
                    </div>
                    <div>{open.application}</div>
                  </div>
                )}
                {(open.domain || open.url) && (
                  <div className="sm:col-span-2">
                    <div className="text-xs uppercase text-gray-500 dark:text-gray-400 mb-1">
                      Domain / URL
                    </div>
                    {open.url ? (
                      <a
                        href={open.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 dark:text-blue-400 break-all underline"
                      >
                        {open.url}
                      </a>
                    ) : (
                      <div className="break-all">{open.domain}</div>
                    )}
                  </div>
                )}
                {typeof open.duration === 'number' && (
                  <div>
                    <div className="text-xs uppercase text-gray-500 dark:text-gray-400 mb-1">
                      Duration
                    </div>
                    <div>{formatDuration(open.duration)}</div>
                  </div>
                )}
              </div>

              <div>
                <div className="text-xs uppercase text-gray-500 dark:text-gray-400 mb-2">
                  Process Origin
                </div>
                {openProcess ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-xs uppercase text-gray-500 dark:text-gray-400 mb-1">
                        Origin
                      </div>
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getOriginBadgeClass(openProcess.origin)}`}>
                        {getOriginLabel(openProcess.origin)}
                      </span>
                      {openProcess.isSecurityProcess && (
                        <span className="ml-2 text-xs text-red-600 dark:text-red-300">Security</span>
                      )}
                    </div>
                    {openProcess.launchTrigger && (
                      <div>
                        <div className="text-xs uppercase text-gray-500 dark:text-gray-400 mb-1">
                          Trigger
                        </div>
                        <div>{openProcess.launchTrigger}</div>
                      </div>
                    )}
                    {(openProcess.sessionId != null || openProcess.sessionName) && (
                      <div>
                        <div className="text-xs uppercase text-gray-500 dark:text-gray-400 mb-1">
                          Session
                        </div>
                        <div>{formatSessionLabel(openProcess)}</div>
                      </div>
                    )}
                    {(openProcess.pid != null || openProcess.ppid != null) && (
                      <div>
                        <div className="text-xs uppercase text-gray-500 dark:text-gray-400 mb-1">
                          PID / PPID
                        </div>
                        <div>
                          {openProcess.pid != null ? openProcess.pid : '—'} / {openProcess.ppid != null ? openProcess.ppid : '—'}
                        </div>
                      </div>
                    )}
                    {(openProcess.processName || openProcess.parentName) && (
                      <div>
                        <div className="text-xs uppercase text-gray-500 dark:text-gray-400 mb-1">
                          Process
                        </div>
                        <div>{openProcess.processName || '—'}</div>
                        {openProcess.parentName && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            Parent: {openProcess.parentName}
                          </div>
                        )}
                      </div>
                    )}
                    {openProcess.user && (
                      <div>
                        <div className="text-xs uppercase text-gray-500 dark:text-gray-400 mb-1">
                          User
                        </div>
                        <div>{openProcess.user}</div>
                      </div>
                    )}
                    {openProcess.executablePath && (
                      <div className="sm:col-span-2">
                        <div className="text-xs uppercase text-gray-500 dark:text-gray-400 mb-1">
                          Executable Path
                        </div>
                        <div className="text-xs break-all">{openProcess.executablePath}</div>
                      </div>
                    )}
                    {openProcess.detectionSource && (
                      <div>
                        <div className="text-xs uppercase text-gray-500 dark:text-gray-400 mb-1">
                          Detection Source
                        </div>
                        <div>{openProcess.detectionSource}</div>
                      </div>
                    )}
                    {openProcess.originReason && (
                      <div className="sm:col-span-2">
                        <div className="text-xs uppercase text-gray-500 dark:text-gray-400 mb-1">
                          Origin Reason
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-300">
                          {openProcess.originReason}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 dark:text-gray-400">Unknown origin</div>
                )}
              </div>

              {open.details && (
                <div>
                  <div className="text-xs uppercase text-gray-500 dark:text-gray-400 mb-2">
                    Details
                  </div>
                  <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-4 bg-gray-50 dark:bg-gray-950/50">
                    {typeof open.details === 'object' ? (
                      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                        {Object.entries(open.details as Record<string, unknown>)
                          .filter(([k]) => k !== 'process')
                          .map(([k, v]) => (
                            <div key={k} className="flex flex-col">
                              <dt className="text-xs uppercase text-gray-500 dark:text-gray-400 mb-1">
                                {k}
                              </dt>
                              <dd className="break-words">{renderDetailValue(k, v)}</dd>
                            </div>
                          ))}
                      </dl>
                    ) : (
                      <div className="text-sm break-words">{String(open.details)}</div>
                    )}
                  </div>
                </div>
              )}

              {/* View Screenshot Button for Screenshot Events */}
              {open.type === 'screenshot' && (
                <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
                  <button
                    onClick={() => handleViewScreenshot(open)}
                    disabled={loadingScreenshot === getActivityItemId(open)}
                    className="w-full px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    {loadingScreenshot === getActivityItemId(open) ? (
                      <>
                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Loading...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        View Screenshot
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Screenshot Lightbox - Same as Screenshots component */}
      {screenshotOpen && screenshotItems.length > 0 && (() => {
        const currentScreenshot = screenshotItems.find((s) => s.filename === screenshotOpen);
        const currentIndex = screenshotItems.findIndex((s) => s.filename === screenshotOpen);
        
        if (!currentScreenshot) return null;

        const handleZoomIn = () => setScreenshotZoom((z) => Math.min(3, Number((z + 0.2).toFixed(2))));
        const handleZoomOut = () => {
          setScreenshotZoom((z) => {
            const next = Math.max(1, Number((z - 0.2).toFixed(2)));
            if (next === 1) {
              setScreenshotPan({ x: 0, y: 0 });
            }
            return next;
          });
        };
        const handleZoomReset = () => {
          setScreenshotZoom(1);
          setScreenshotPan({ x: 0, y: 0 });
        };
        
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            onClick={() => {
              setScreenshotOpen(null);
              setScreenshotZoom(1);
              setScreenshotPan({ x: 0, y: 0 });
            }}
          >
            <div className="absolute inset-0 bg-black/80" />
            <div
              className="relative max-w-7xl w-[95vw] h-[95vh] bg-black/90 rounded-xl overflow-hidden shadow-2xl border border-white/10"
              ref={screenshotContainerRef}
              onClick={(e) => e.stopPropagation()}
              onWheel={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (e.deltaY < 0) {
                  handleZoomIn();
                } else {
                  handleZoomOut();
                }
              }}
              onMouseMove={(e) => {
                if (!isScreenshotPanning) return;
                setScreenshotPan(
                  clampScreenshotPan({
                    x: screenshotPanStartRef.current.startX + (e.clientX - screenshotPanStartRef.current.clientX),
                    y: screenshotPanStartRef.current.startY + (e.clientY - screenshotPanStartRef.current.clientY),
                  }, screenshotZoom),
                );
              }}
              onMouseUp={() => setIsScreenshotPanning(false)}
              onMouseLeave={() => setIsScreenshotPanning(false)}
              onTouchMove={(e) => {
                if (!isScreenshotPanning || e.touches.length !== 1) return;
                const touch = e.touches[0];
                setScreenshotPan(
                  clampScreenshotPan({
                    x: screenshotPanStartRef.current.startX + (touch.clientX - screenshotPanStartRef.current.clientX),
                    y: screenshotPanStartRef.current.startY + (touch.clientY - screenshotPanStartRef.current.clientY),
                  }, screenshotZoom),
                );
              }}
              onTouchEnd={() => setIsScreenshotPanning(false)}
            >
              <div
                className={`w-full h-full flex items-center justify-center ${
                  screenshotZoom > 1 ? (isScreenshotPanning ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'
                }`}
                onMouseDown={(e) => {
                  if (screenshotZoom <= 1) return;
                  e.preventDefault();
                  setIsScreenshotPanning(true);
                  screenshotPanStartRef.current = {
                    startX: screenshotPan.x,
                    startY: screenshotPan.y,
                    clientX: e.clientX,
                    clientY: e.clientY,
                  };
                }}
                onTouchStart={(e) => {
                  if (screenshotZoom <= 1 || e.touches.length !== 1) return;
                  const touch = e.touches[0];
                  setIsScreenshotPanning(true);
                  screenshotPanStartRef.current = {
                    startX: screenshotPan.x,
                    startY: screenshotPan.y,
                    clientX: touch.clientX,
                    clientY: touch.clientY,
                  };
                }}
              >
                <img
                  ref={screenshotImageRef}
                  src={currentScreenshot.url || `/screenshots/${currentScreenshot.filename}`}
                  alt={currentScreenshot.filename}
                  className="max-w-full max-h-full object-contain transition-transform duration-150"
                  style={{ transform: `translate(${screenshotPan.x}px, ${screenshotPan.y}px) scale(${screenshotZoom})` }}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    if (currentScreenshot.url && currentScreenshot.url !== `/screenshots/${currentScreenshot.filename}`) {
                      target.src = `/screenshots/${currentScreenshot.filename}`;
                    }
                  }}
                  onLoad={(e) => {
                    const target = e.currentTarget;
                    setScreenshotImageSize({ width: target.naturalWidth, height: target.naturalHeight });
                  }}
                />
              </div>

              {/* Navigation Arrows */}
              {screenshotItems.length > 1 && (
                <>
                  {currentIndex > 0 && (
                    <button
                      className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm transition-all"
                      onClick={(e) => {
                        e.stopPropagation();
                        setScreenshotOpen(screenshotItems[currentIndex - 1].filename);
                      }}
                    >
                      ←
                    </button>
                  )}
                  {currentIndex < screenshotItems.length - 1 && (
                    <button
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm transition-all"
                      onClick={(e) => {
                        e.stopPropagation();
                        setScreenshotOpen(screenshotItems[currentIndex + 1].filename);
                      }}
                    >
                      →
                    </button>
                  )}
                </>
              )}

              {/* Info Panel */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-6">
                <div className="max-w-4xl mx-auto">
                  <div className="text-white mb-2 font-medium">{currentScreenshot.filename}</div>
                  <div className="flex flex-wrap gap-4 text-sm text-white/80">
                    <div>
                      <span className="text-white/60">User:</span> {currentScreenshot.username}
                    </div>
                    {currentScreenshot.mtime && (
                      <div>
                        <span className="text-white/60">Time:</span> {formatScreenshotTime(currentScreenshot.mtime)}
                      </div>
                    )}
                    {currentScreenshot.domain && (
                      <div>
                        <span className="text-white/60">Domain:</span> {currentScreenshot.domain}
                      </div>
                    )}
                    {screenshotItems.length > 1 && (
                      <div>
                        <span className="text-white/60">
                          {currentIndex + 1} of {screenshotItems.length}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Top Controls */}
              <div className="absolute top-4 right-4 flex gap-2">
                <button
                  className="px-4 py-2 rounded bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm text-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setScreenshotOpen(null);
                  }}
                >
                  Close (Esc)
                </button>
              </div>

              {/* Top Controls */}
              <div className="absolute top-4 right-4 flex gap-2">
                <div className="flex gap-1 bg-black/40 rounded-lg p-1">
                  <button
                    className="px-3 py-2 rounded bg-white/20 hover:bg-white/30 text-white text-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleZoomOut();
                    }}
                  >
                    −
                  </button>
                  <button
                    className="px-3 py-2 rounded bg-white/20 hover:bg-white/30 text-white text-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleZoomReset();
                    }}
                  >
                    {Math.round(screenshotZoom * 100)}%
                  </button>
                  <button
                    className="px-3 py-2 rounded bg-white/20 hover:bg-white/30 text-white text-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleZoomIn();
                    }}
                  >
                    +
                  </button>
                </div>
                <button
                  className="px-4 py-2 rounded bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm text-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setScreenshotOpen(null);
                    setScreenshotZoom(1);
                    setScreenshotPan({ x: 0, y: 0 });
                  }}
                >
                  Close (Esc)
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
