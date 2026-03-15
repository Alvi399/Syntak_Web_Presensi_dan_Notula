import { CheckCircle2, Radio } from 'lucide-react';
import { BroadcastProgress } from '@/hooks/useNotifications';

interface BroadcastProgressBarProps {
  progress: BroadcastProgress;
}

export default function BroadcastProgressBar({ progress }: BroadcastProgressBarProps) {
  const isVisible = progress.active || progress.percent === 100;
  if (!isVisible) return null;

  const isDone = !progress.active && progress.percent === 100;

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 transition-all duration-500 ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
      }`}
    >
      <div
        className={`mx-4 mb-4 rounded-xl shadow-2xl border backdrop-blur-sm overflow-hidden ${
          isDone
            ? 'bg-green-50/95 border-green-300'
            : 'bg-white/95 border-blue-200'
        }`}
      >
        {/* Progress fill */}
        <div className="h-1 bg-gray-100">
          <div
            className={`h-full transition-all duration-300 ease-out ${
              isDone ? 'bg-green-500' : 'bg-blue-500'
            }`}
            style={{ width: `${progress.percent}%` }}
          />
        </div>

        <div className="flex items-center gap-3 px-4 py-3">
          {isDone ? (
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
          ) : (
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Radio className="w-5 h-5 text-blue-600 animate-pulse" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold truncate ${isDone ? 'text-green-800' : 'text-gray-900'}`}>
              {isDone
                ? `✅ Broadcast selesai — ${progress.judulKegiatan}`
                : `📢 Broadcasting undangan: ${progress.judulKegiatan}`}
            </p>
            <p className={`text-xs ${isDone ? 'text-green-600' : 'text-gray-500'}`}>
              {isDone
                ? `${progress.sent} dari ${progress.total} peserta berhasil dikirim`
                : `Mengirim ke ${progress.sent} / ${progress.total} peserta...`}
            </p>
          </div>

          <div className={`text-2xl font-bold tabular-nums flex-shrink-0 ${isDone ? 'text-green-600' : 'text-blue-600'}`}>
            {progress.percent}%
          </div>
        </div>
      </div>
    </div>
  );
}
