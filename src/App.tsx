import React, { useState, useEffect } from 'react';
import { useGameState } from './hooks/useGameState';
import { PlayerDisplay } from './views/PlayerDisplay';
import { AdminHost } from './views/AdminHost';
import { GameBuilder } from './components/builder/GameBuilder';
import { GameConfig } from './types/game';
import { serializeGameConfigToYaml } from './utils/gameYaml';
import { DebugTraceModal } from './components/common/DebugTraceModal';

export const App: React.FC = () => {
  const {
    state,
    dispatch,
    openDisplayWindow,
    toggleDisplayFullScreen,
    openGameFile,
    saveGameFile,
    selectMediaFile,
    toMediaUrl,
  } = useGameState();

  const [currentView, setCurrentView] = useState<'admin' | 'display'>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('view') === 'display' ? 'display' : 'admin';
  });

  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [isDebugModalOpen, setIsDebugModalOpen] = useState(false);
  const [lastSavedYaml, setLastSavedYaml] = useState<string | null>(null);

  // Clear save tracking if game is unloaded
  useEffect(() => {
    if (!state.config) {
      setLastSavedYaml(null);
    }
  }, [state.config]);

  // Synchronize view query param changes
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      setCurrentView(params.get('view') === 'display' ? 'display' : 'admin');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Keyboard shortcuts:
  // - Ctrl/Cmd+Shift+D: toggle debug trace modal
  // - 'F': toggle fullscreen in Player Display
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        (e.key === 'D' || e.key === 'd')
      ) {
        e.preventDefault();
        setIsDebugModalOpen((prev) => !prev);
        return;
      }

      if (e.key === 'f' || e.key === 'F') {
        if (
          document.activeElement?.tagName !== 'INPUT' &&
          document.activeElement?.tagName !== 'TEXTAREA'
        ) {
          toggleDisplayFullScreen();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleDisplayFullScreen]);

  // In web browser mode: advertise display window presence over BroadcastChannel
  useEffect(() => {
    if (
      currentView === 'display' &&
      typeof window !== 'undefined' &&
      !window.electronAPI
    ) {
      const channel = new BroadcastChannel('jeopardy_broadcast_channel');
      // Announce display presence immediately
      channel.postMessage({ type: 'DISPLAY_STATUS', isOpen: true });

      const handleMsg = (event: MessageEvent) => {
        if (event.data?.type === 'PING_DISPLAY') {
          channel.postMessage({ type: 'DISPLAY_STATUS', isOpen: true });
        }
      };
      channel.addEventListener('message', handleMsg);

      const heartbeat = setInterval(() => {
        channel.postMessage({ type: 'DISPLAY_STATUS', isOpen: true });
      }, 2000);

      const handleBeforeUnload = () => {
        channel.postMessage({ type: 'DISPLAY_STATUS', isOpen: false });
      };
      window.addEventListener('beforeunload', handleBeforeUnload);

      return () => {
        clearInterval(heartbeat);
        window.removeEventListener('beforeunload', handleBeforeUnload);
        channel.removeEventListener('message', handleMsg);
        channel.postMessage({ type: 'DISPLAY_STATUS', isOpen: false });
        channel.close();
      };
    }
  }, [currentView]);

  // Wrapped file loader to track disk save state
  const handleOpenGameFile = async (): Promise<GameConfig | null> => {
    const loaded = await openGameFile();
    if (loaded) {
      setLastSavedYaml(serializeGameConfigToYaml(loaded));
    }
    return loaded;
  };

  return (
    <>
      {currentView === 'display' ? (
        <PlayerDisplay
          state={state}
          toMediaUrl={toMediaUrl}
          onToggleFullScreen={toggleDisplayFullScreen}
        />
      ) : isBuilderOpen ? (
        <GameBuilder
          key={
            state.config?.title
              ? `${state.config.title}_` +
                `${state.config.rounds?.[0]?.categories?.length}`
              : 'builder-empty'
          }
          currentConfig={state.config}
          lastSavedYaml={lastSavedYaml}
          onSaveSuccess={(savedYaml) => setLastSavedYaml(savedYaml)}
          onSaveAndPlay={(updatedConfig: GameConfig) => {
            dispatch({ type: 'LOAD_GAME', payload: updatedConfig });
            setIsBuilderOpen(false);
          }}
          onCloseGame={() => {
            dispatch({ type: 'UNLOAD_GAME' });
            setIsBuilderOpen(false);
            setLastSavedYaml(null);
          }}
          saveGameFile={saveGameFile}
          selectMediaFile={selectMediaFile}
        />
      ) : (
        <AdminHost
          state={state}
          dispatch={dispatch}
          openDisplayWindow={openDisplayWindow}
          onOpenBuilder={() => setIsBuilderOpen(true)}
          openGameFile={handleOpenGameFile}
          toMediaUrl={toMediaUrl}
          onGameCreated={() => setLastSavedYaml(null)}
        />
      )}

      <DebugTraceModal
        isOpen={isDebugModalOpen}
        onClose={() => setIsDebugModalOpen(false)}
      />
    </>
  );
};

export default App;
