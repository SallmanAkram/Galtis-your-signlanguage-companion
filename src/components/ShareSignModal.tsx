import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Share2,
  Download,
  Scissors,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Film,
  Image as ImageIcon,
  CheckCircle2,
  Loader2,
  Video,
} from 'lucide-react';
import {
  RecordedSignData,
  convertVideoToGif,
  trimVideo,
  downloadMediaBlob,
  shareOrDownloadMedia,
} from '../utils/mediaExporter';

interface ShareSignModalProps {
  isOpen: boolean;
  onClose: () => void;
  recording: RecordedSignData | null;
  onRecordSign?: (word: string) => void;
  isRecordingActive?: boolean;
}

export const ShareSignModal: React.FC<ShareSignModalProps> = ({
  isOpen,
  onClose,
  recording,
  onRecordSign,
  isRecordingActive = false,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Video playback & trim state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);

  // Export settings & status
  const [format, setFormat] = useState<'video' | 'gif'>('gif');
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);

  // Initialize duration and trim boundaries when recording changes
  useEffect(() => {
    if (recording) {
      const d = recording.duration || 3.0;
      setDuration(d);
      setTrimStart(0);
      setTrimEnd(d);
      setCurrentTime(0);
      setIsPlaying(false);
      setStatusMessage(null);
    }
  }, [recording]);

  // Handle video loaded metadata
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const d = videoRef.current.duration && isFinite(videoRef.current.duration)
        ? videoRef.current.duration
        : recording?.duration || 3.0;
      setDuration(d);
      setTrimEnd(d);
    }
  };

  // Video time update - loop within trim range
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const cur = videoRef.current.currentTime;
    setCurrentTime(cur);

    if (cur >= trimEnd) {
      videoRef.current.currentTime = trimStart;
      videoRef.current.play().catch(() => {});
    }
  };

  // Play / Pause toggle
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      if (videoRef.current.currentTime < trimStart || videoRef.current.currentTime >= trimEnd) {
        videoRef.current.currentTime = trimStart;
      }
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  // Start Trim slider changed
  const handleStartTrimChange = (val: number) => {
    const newStart = Math.min(val, Math.max(0, trimEnd - 0.2));
    setTrimStart(newStart);
    if (videoRef.current) {
      videoRef.current.currentTime = newStart;
      setCurrentTime(newStart);
    }
  };

  // End Trim slider changed
  const handleEndTrimChange = (val: number) => {
    const newEnd = Math.max(val, trimStart + 0.2);
    setTrimEnd(newEnd);
    if (videoRef.current) {
      videoRef.current.currentTime = newEnd;
      setCurrentTime(newEnd);
    }
  };

  // Reset trim to full range
  const handleResetTrim = () => {
    setTrimStart(0);
    setTrimEnd(duration);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      setCurrentTime(0);
    }
  };

  // Export: Prepare Blob (trimmed video or converted GIF)
  const prepareExportBlob = async (): Promise<{ blob: Blob; filename: string }> => {
    if (!recording) throw new Error('No recording available');
    const cleanWord = (recording.words || 'sign').toLowerCase().replace(/[^a-z0-9]+/g, '-');

    if (format === 'gif') {
      setIsExporting(true);
      setExportProgress(5);
      setStatusMessage({ type: 'info', text: 'Converting recording to animated GIF...' });

      const gifResult = await convertVideoToGif(recording.blob, {
        startTime: trimStart,
        endTime: trimEnd,
        fps: 12,
        onProgress: (p) => setExportProgress(p),
      });

      return {
        blob: gifResult.blob,
        filename: `galtis-${cleanWord}.gif`,
      };
    } else {
      // Video format
      setIsExporting(true);
      setExportProgress(30);
      setStatusMessage({ type: 'info', text: 'Preparing video clip...' });

      const isUntrimmed = trimStart <= 0.05 && Math.abs(trimEnd - duration) <= 0.1;
      let finalBlob = recording.blob;

      if (!isUntrimmed) {
        const trimmed = await trimVideo(recording.blob, trimStart, trimEnd, duration);
        finalBlob = trimmed.blob;
      }

      setExportProgress(100);
      const isMp4 = finalBlob.type.includes('mp4');
      const ext = isMp4 ? 'mp4' : 'webm';
      return {
        blob: finalBlob,
        filename: `galtis-${cleanWord}.${ext}`,
      };
    }
  };

  // Action: Share via native device sheet
  const handleShare = async () => {
    if (!recording || isExporting) return;
    try {
      const { blob, filename } = await prepareExportBlob();
      const title = `Sign Language: ${recording.words || 'Sign'}`;
      const text = `Avatar performing sign "${recording.words || 'Sign'}" via Galtis`;

      const result = await shareOrDownloadMedia(blob, filename, title, text);
      setIsExporting(false);

      if (result.shared) {
        setStatusMessage({ type: 'success', text: 'Shared successfully!' });
      } else if (result.downloaded) {
        setStatusMessage({ type: 'success', text: 'File downloaded (share sheet not supported on this browser).' });
      }
    } catch (err: any) {
      console.error('Share failed:', err);
      setIsExporting(false);
      setStatusMessage({ type: 'error', text: err?.message || 'Failed to share clip.' });
    }
  };

  // Action: Direct Download
  const handleDownload = async () => {
    if (!recording || isExporting) return;
    try {
      const { blob, filename } = await prepareExportBlob();
      downloadMediaBlob(blob, filename);
      setIsExporting(false);
      setStatusMessage({ type: 'success', text: `Saved "${filename}" to downloads!` });
    } catch (err: any) {
      console.error('Download failed:', err);
      setIsExporting(false);
      setStatusMessage({ type: 'error', text: err?.message || 'Failed to download clip.' });
    }
  };

  if (!isOpen) return null;

  const cleanTitle = recording?.words || 'Avatar Sign';
  const trimmedDuration = Math.max(0.1, trimEnd - trimStart);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-md bg-[#18082e]/95 border border-purple-500/30 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] flex flex-col max-h-[92vh] overflow-hidden text-white backdrop-blur-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-white/[0.03]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-purple-500/20 border border-purple-400/30 flex items-center justify-center shrink-0">
              <Share2 className="w-4 h-4 text-purple-300" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-white tracking-wide truncate">
                Share Sign Recording
              </h3>
              {recording && (
                <div className="flex items-center gap-1.5 text-xs text-purple-300/80 font-medium">
                  <span>Sign:</span>
                  <span className="font-bold text-teal-300 uppercase tracking-wide truncate">
                    {cleanTitle}
                  </span>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white/70 hover:text-white transition-all shrink-0 ml-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs sm:text-sm">
          {recording ? (
            <>
              {/* Video Player Display */}
              <div className="relative rounded-2xl overflow-hidden bg-black/60 border border-white/10 aspect-square sm:aspect-[4/3] flex items-center justify-center shadow-inner group">
                <video
                  ref={videoRef}
                  src={recording.url}
                  playsInline
                  muted
                  onLoadedMetadata={handleLoadedMetadata}
                  onTimeUpdate={handleTimeUpdate}
                  onEnded={() => setIsPlaying(false)}
                  onClick={togglePlay}
                  className="w-full h-full object-contain cursor-pointer"
                />

                {/* Big Center Play/Pause Overlay */}
                {!isPlaying && (
                  <button
                    onClick={togglePlay}
                    aria-label="Play recording"
                    className="absolute inset-0 m-auto w-14 h-14 rounded-full bg-purple-600/80 hover:bg-purple-500 border border-white/30 text-white flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95 backdrop-blur-sm"
                  >
                    <Play className="w-6 h-6 fill-current ml-0.5" />
                  </button>
                )}

                {/* Bottom Overlay Pill: Word & Trim Duration */}
                <div className="absolute bottom-2 left-2 right-2 px-3 py-1.5 rounded-xl bg-black/60 border border-white/10 backdrop-blur-md flex items-center justify-between pointer-events-none text-[11px]">
                  <span className="font-semibold text-white/90 truncate mr-2">
                    {cleanTitle}
                  </span>
                  <span className="font-mono text-purple-300 font-bold shrink-0">
                    {trimmedDuration.toFixed(1)}s clip
                  </span>
                </div>
              </div>

              {/* Trimming Section */}
              <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/10 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-semibold text-white/90">
                    <Scissors className="w-3.5 h-3.5 text-teal-400" />
                    <span>Trim Clip</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-teal-300 bg-teal-500/10 px-2 py-0.5 rounded-md border border-teal-500/20">
                      {trimStart.toFixed(1)}s — {trimEnd.toFixed(1)}s
                    </span>
                    <button
                      onClick={handleResetTrim}
                      title="Reset trim"
                      className="p-1 rounded-md text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Scrubbing Sliders */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-white/60 w-10 shrink-0 font-medium">Start:</span>
                    <input
                      type="range"
                      min={0}
                      max={duration}
                      step={0.05}
                      value={trimStart}
                      onChange={(e) => handleStartTrimChange(parseFloat(e.target.value))}
                      className="w-full accent-teal-400 cursor-pointer h-1.5 bg-white/15 rounded-lg appearance-none"
                    />
                    <span className="text-[11px] font-mono text-white/80 w-10 text-right shrink-0">
                      {trimStart.toFixed(1)}s
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-white/60 w-10 shrink-0 font-medium">End:</span>
                    <input
                      type="range"
                      min={0}
                      max={duration}
                      step={0.05}
                      value={trimEnd}
                      onChange={(e) => handleEndTrimChange(parseFloat(e.target.value))}
                      className="w-full accent-purple-400 cursor-pointer h-1.5 bg-white/15 rounded-lg appearance-none"
                    />
                    <span className="text-[11px] font-mono text-white/80 w-10 text-right shrink-0">
                      {trimEnd.toFixed(1)}s
                    </span>
                  </div>
                </div>
              </div>

              {/* Format Selection: Video vs GIF */}
              <div className="space-y-2">
                <span className="text-[11px] font-semibold text-white/70 tracking-wide uppercase">
                  Choose Format:
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setFormat('gif')}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all ${
                      format === 'gif'
                        ? 'bg-purple-600/40 border-purple-400 text-white shadow-[0_0_15px_rgba(168,85,247,0.35)] ring-1 ring-purple-400'
                        : 'bg-white/[0.05] border-white/10 text-white/70 hover:bg-white/[0.1] hover:text-white'
                    }`}
                  >
                    <ImageIcon className="w-4 h-4 text-purple-300" />
                    <span>Animated GIF</span>
                  </button>

                  <button
                    onClick={() => setFormat('video')}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all ${
                      format === 'video'
                        ? 'bg-purple-600/40 border-purple-400 text-white shadow-[0_0_15px_rgba(168,85,247,0.35)] ring-1 ring-purple-400'
                        : 'bg-white/[0.05] border-white/10 text-white/70 hover:bg-white/[0.1] hover:text-white'
                    }`}
                  >
                    <Video className="w-4 h-4 text-teal-300" />
                    <span>Video Clip</span>
                  </button>
                </div>
              </div>

              {/* Export Progress Bar */}
              {isExporting && (
                <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-500/30 space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between text-xs text-purple-200">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-300" />
                      {format === 'gif' ? 'Converting frames to GIF...' : 'Processing video clip...'}
                    </span>
                    <span className="font-mono font-bold text-teal-300">{exportProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden border border-white/10">
                    <div
                      className="h-full bg-gradient-to-r from-teal-400 via-purple-500 to-pink-500 transition-all duration-150"
                      style={{ width: `${exportProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Status feedback message */}
              {statusMessage && !isExporting && (
                <div
                  className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 ${
                    statusMessage.type === 'success'
                      ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200'
                      : statusMessage.type === 'error'
                      ? 'bg-rose-500/15 border-rose-400/40 text-rose-200'
                      : 'bg-purple-500/15 border-purple-400/40 text-purple-200'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{statusMessage.text}</span>
                </div>
              )}

              {/* Share & Download Action Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={handleShare}
                  disabled={isExporting}
                  className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-neutral-950 font-bold text-xs sm:text-sm shadow-lg shadow-teal-500/25 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
                >
                  <Share2 className="w-4 h-4 text-neutral-950" />
                  <span>Share</span>
                </button>

                <button
                  onClick={handleDownload}
                  disabled={isExporting}
                  className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-purple-600/30 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none border border-purple-400/30"
                >
                  <Download className="w-4 h-4" />
                  <span>Download</span>
                </button>
              </div>
            </>
          ) : (
            /* Empty State: No recording yet */
            <div className="py-8 px-4 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-purple-500/15 border border-purple-400/30 flex items-center justify-center mx-auto text-purple-300">
                <Film className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-white">No Sign Recording Yet</h4>
                <p className="text-xs text-white/60 max-w-xs mx-auto">
                  Perform any sign using the microphone or click below to record the avatar signing "HELLO".
                </p>
              </div>

              {onRecordSign && (
                <button
                  onClick={() => onRecordSign('HELLO')}
                  disabled={isRecordingActive}
                  className="inline-flex items-center justify-center gap-2 py-2.5 px-5 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-xs shadow-lg shadow-purple-500/30 active:scale-95 transition-all"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Record "HELLO" Now</span>
                </button>
              )}
            </div>
          )}

          {/* Quick Signs to Re-record */}
          {onRecordSign && (
            <div className="pt-2 border-t border-white/10 space-y-2">
              <span className="text-[10px] uppercase tracking-wider text-white/50 font-bold">
                Quick Record Another Sign:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {['HELLO', 'THANK YOU', 'PLEASE', 'WHERE', 'YOU'].map((word) => (
                  <button
                    key={word}
                    onClick={() => onRecordSign(word)}
                    disabled={isRecordingActive}
                    className="px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.14] border border-white/10 text-[11px] font-medium text-white/80 hover:text-white transition-all active:scale-95 disabled:opacity-40"
                  >
                    {word}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
