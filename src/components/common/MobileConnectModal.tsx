import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Copy,
  Check,
  Smartphone,
  Monitor,
  Wifi,
  ExternalLink,
} from 'lucide-react';
import { getQrSvg } from '../../utils/qrCode';

interface ServerInfo {
  lanIp: string;
  port: number;
  hostUrl: string;
  displayUrl: string;
}

interface MobileConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileConnectModal: React.FC<MobileConnectModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [activeTab, setActiveTab] = useState<'admin' | 'display'>('admin');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    fetch('/api/server-info')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ServerInfo | null) => {
        if (isMounted && data) {
          setServerInfo(data);
        }
      })
      .catch(() => {
        // Fallback handled in computed targetUrl
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const targetUrl = useMemo(() => {
    if (serverInfo) {
      return activeTab === 'admin' ? serverInfo.hostUrl : serverInfo.displayUrl;
    }
    const host =
      typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1';
    const port =
      typeof window !== 'undefined' && window.location.port
        ? window.location.port
        : '5173';
    const proto =
      typeof window !== 'undefined' ? window.location.protocol : 'http:';
    const param = activeTab === 'admin' ? 'view=admin' : 'view=display';
    return `${proto}//${host}:${port}/?${param}`;
  }, [serverInfo, activeTab]);

  const qrSvg = useMemo(() => {
    if (!targetUrl) return '';
    try {
      return getQrSvg(targetUrl, 3);
    } catch {
      return '';
    }
  }, [targetUrl]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(targetUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      className={
        'fixed inset-0 z-50 flex items-center justify-center ' +
        'bg-black/85 backdrop-blur-md p-3 sm:p-4 select-none'
      }
      onClick={onClose}
    >
      <div
        className={
          'bg-[#060c18] border border-blue-900/80 rounded-2xl w-full ' +
          'max-w-lg flex flex-col shadow-2xl overflow-hidden'
        }
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header
          className={
            'px-5 py-3.5 border-b border-blue-900/60 bg-[#091224] flex ' +
            'items-center justify-between'
          }
        >
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-blue-600/20 text-yellow-400">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h2
                className={
                  'text-sm font-black uppercase tracking-wider text-white ' +
                  'flex items-center gap-2'
                }
              >
                <span>Mobile Pairing</span>
                <span
                  className={
                    'text-[10px] px-2 py-0.5 rounded-full bg-blue-950 ' +
                    'border border-blue-700/60 text-blue-300 font-mono'
                  }
                >
                  LAN Connect
                </span>
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className={
              'p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 ' +
              'hover:text-white transition-colors cursor-pointer'
            }
            title="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Tab Selection */}
        <div
          className={
            'flex items-center gap-2 px-5 pt-4 pb-2 border-b ' +
            'border-blue-900/40 bg-[#060c18]'
          }
        >
          <button
            onClick={() => setActiveTab('admin')}
            className={
              'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs ' +
              'font-bold transition-all cursor-pointer ' +
              (activeTab === 'admin'
                ? 'bg-blue-600 text-white shadow'
                : 'text-gray-400 hover:text-white bg-blue-950/40')
            }
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Host Console (Phone)</span>
          </button>
          <button
            onClick={() => setActiveTab('display')}
            className={
              'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs ' +
              'font-bold transition-all cursor-pointer ' +
              (activeTab === 'display'
                ? 'bg-blue-600 text-white shadow'
                : 'text-gray-400 hover:text-white bg-blue-950/40')
            }
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Player Board (TV/Display)</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 flex flex-col items-center gap-4">
          {/* QR Code Container */}
          <div
            className={
              'p-3 bg-white rounded-2xl shadow-xl w-56 h-56 sm:w-60 sm:h-60 ' +
              'flex items-center justify-center border-4 border-yellow-400/80'
            }
          >
            {qrSvg ? (
              <div
                className="w-full h-full"
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
            ) : (
              <div className="text-gray-400 text-xs text-center">
                Generating QR code...
              </div>
            )}
          </div>

          {/* URL & Copy Row */}
          <div className="w-full flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={targetUrl}
              className={
                'flex-1 bg-black/60 border border-blue-900/70 rounded-lg ' +
                'px-3 py-2 text-xs font-mono text-blue-200 select-all ' +
                'focus:outline-none focus:border-yellow-400/80 truncate'
              }
            />
            <button
              onClick={handleCopy}
              className={
                'px-3 py-2 bg-blue-950 hover:bg-blue-900 border ' +
                'border-blue-700/60 hover:border-yellow-400/60 text-white ' +
                'rounded-lg text-xs font-bold flex items-center gap-1.5 ' +
                'transition-all cursor-pointer shrink-0'
              }
              title="Copy link to clipboard"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-yellow-400" />
                  <span>Copy</span>
                </>
              )}
            </button>
            <a
              href={targetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={
                'p-2 bg-blue-950 hover:bg-blue-900 border ' +
                'border-blue-700/60 hover:border-yellow-400/60 text-white ' +
                'rounded-lg text-xs font-bold flex items-center ' +
                'justify-center transition-all cursor-pointer shrink-0'
              }
              title="Open link in new tab"
            >
              <ExternalLink className="w-3.5 h-3.5 text-blue-300" />
            </a>
          </div>

          {/* Wi-Fi Instructions */}
          <div
            className={
              'w-full p-3 rounded-xl bg-blue-950/30 border ' +
              'border-blue-900/50 flex items-start gap-2.5 text-left'
            }
          >
            <Wifi className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
            <div className="text-[11px] text-blue-200/90 leading-relaxed">
              <span className="font-semibold text-white">
                Same Wi-Fi network required:
              </span>{' '}
              Ensure your mobile device is connected to the same local network
              as this machine. Scan the code with your phone camera to control
              the game.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
