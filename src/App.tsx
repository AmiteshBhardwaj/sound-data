import { useState, useEffect } from 'react';
import { PortalLanding } from './components/PortalLanding';
import { ModeSelector } from './components/ModeSelector';
import { VisualizerContainer } from './components/Visualizer/VisualizerContainer';
import { TransmitterPanel } from './components/Transmitter/TransmitterPanel';
import { ReceiverPanel } from './components/Receiver/ReceiverPanel';
import { DeviceShareModal } from './components/Network/DeviceShareModal';
import { MissionInfoModal } from './components/MissionInfoModal';
import { AudioEngine } from './audio/AudioEngine';
import type { AppMode, AudioBand, AudioStats, DecodedPacket, ReceiverState, SpeedPreset } from './types/protocol';

export type AppView = 'portal' | 'transmit' | 'receive';

export function App() {
  const engine = AudioEngine.getInstance();

  const [view, setView] = useState<AppView>('portal');
  const [band, setBand] = useState<AudioBand>('audible');
  const [preset, setPreset] = useState<SpeedPreset>('balanced');
  const [isListening, setIsListening] = useState(false);
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [transmissionProgress, setTransmissionProgress] = useState(0);
  const [receiverState, setReceiverState] = useState<ReceiverState>('idle');
  const [packets, setPackets] = useState<DecodedPacket[]>([]);

  // Real-time progressive transcription
  const [partialText, setPartialText] = useState('');
  const [partialProgress, setPartialProgress] = useState(0);

  const [stats, setStats] = useState<AudioStats>({
    volumeRms: 0,
    noiseFloor: -80,
    snrDb: 0,
    peakFrequency: 0,
    isSignalPresent: false,
    activeSymbol: null
  });

  const [isQrOpen, setIsQrOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);

  useEffect(() => {
    engine.onStateChange((state) => {
      setReceiverState(state);
      if (state === 'idle' || state === 'listening') {
        setPartialProgress(0);
      }
    });

    engine.onPacketReceived((packet) => {
      setPackets((prev) => [packet, ...prev]);
      setPartialText(packet.payloadText);
      setPartialProgress(1.0);
    });

    engine.onStatsUpdate((newStats) => {
      setStats(newStats);
    });

    engine.onTransmissionProgress((progress) => {
      setTransmissionProgress(progress);
      setIsTransmitting(progress > 0 && progress < 1);
    });

    engine.onPartialTranscription((text, progress) => {
      setPartialText(text);
      setPartialProgress(progress);
    });
  }, [engine]);

  // Reset scroll position to top whenever switching between portal, transmit, and receive
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  const [sensitivity, setSensitivity] = useState(6);

  const handleSensitivityChange = (newSens: number) => {
    setSensitivity(newSens);
    engine.setSensitivity(newSens);
  };

  const handleBandChange = (newBand: AudioBand) => {
    setBand(newBand);
    engine.setBand(newBand);
  };

  const handlePresetChange = (newPreset: SpeedPreset) => {
    setPreset(newPreset);
    engine.setPreset(newPreset);
  };

  const handleToggleListening = async () => {
    if (isListening) {
      engine.stopListening();
      setIsListening(false);
    } else {
      const ok = await engine.startListening();
      if (ok) {
        setIsListening(true);
      }
    }
  };

  const handleSelectMode = async (selected: AppMode) => {
    setView(selected);
    if (selected === 'receive' && !isListening) {
      const ok = await engine.startListening();
      if (ok) {
        setIsListening(true);
      }
    }
  };


  const handleClearPackets = () => {
    setPackets([]);
    setPartialText('');
    setPartialProgress(0);
  };

  return (
    <div className="min-h-screen flex flex-col text-slate-100">
      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {view === 'portal' ? (
          <PortalLanding
            onSelectMode={handleSelectMode}
            isTransmitting={isTransmitting}
            isListening={isListening}
            receiverState={receiverState}
          />
        ) : (
          <div className="space-y-6 animate-fade-in">
            {/* Top Workspace Navigation Bar */}
            <ModeSelector
              mode={view as AppMode}
              onBackToPortal={() => setView('portal')}
              isTransmitting={isTransmitting}
              isListening={isListening}
              receiverState={receiverState}
            />

            {/* Focused Workspace View */}
            {view === 'transmit' && (
              <TransmitterPanel
                band={band}
                onBandChange={handleBandChange}
                preset={preset}
                onPresetChange={handlePresetChange}
                isTransmitting={isTransmitting}
                transmissionProgress={transmissionProgress}
              />
            )}

            {view === 'receive' && (
              <div className="space-y-6">
                {/* Real-time Acoustic Visualizer (Waterfall / Bins / Oscilloscope) */}
                <VisualizerContainer band={band} stats={stats} />

                <ReceiverPanel
                  isListening={isListening}
                  receiverState={receiverState}
                  packets={packets}
                  onClearPackets={handleClearPackets}
                  onToggleListening={handleToggleListening}
                  partialText={partialText}
                  partialProgress={partialProgress}
                  band={band}
                  onBandChange={handleBandChange}
                  preset={preset}
                  onPresetChange={handlePresetChange}
                  sensitivity={sensitivity}
                  onSensitivityChange={handleSensitivityChange}
                  stats={stats}
                />
              </div>
            )}
          </div>
        )}
      </main>


      {/* Modals */}
      <DeviceShareModal isOpen={isQrOpen} onClose={() => setIsQrOpen(false)} />
      <MissionInfoModal isOpen={isInfoOpen} onClose={() => setIsInfoOpen(false)} />
    </div>
  );
}

export default App;
