'use client';

import type { DriveProgress } from '@/lib/drive';
import type { Route } from '@/lib/routing';
import { formatArrival, formatDistance, formatDuration } from '@/lib/format';
import { CloseIcon, ManeuverIcon, PauseIcon, PlayIcon } from './icons';

const SPEEDS = [5, 10, 30];

type Props = {
  route: Route;
  progress: DriveProgress;
  playing: boolean;
  speed: number;
  onToggle: () => void;
  onSpeed: (s: number) => void;
  onExit: () => void;
};

export default function DriveHud({ route, progress, playing, speed, onToggle, onSpeed, onExit }: Props) {
  const step = route.steps[progress.stepIndex];
  const then = route.steps[progress.stepIndex + 1];

  return (
    <>
      <div className="hud-banner" role="status" aria-live="polite">
        <span className="hud-maneuver"><ManeuverIcon type={step.type} modifier={step.modifier} width={34} height={34} strokeWidth={2.2} /></span>
        <div className="hud-text">
          <span className="hud-dist">{progress.done ? 'Arrived' : formatDistance(progress.toNextStep)}</span>
          <span className="hud-instr">{progress.done ? 'You have reached your destination' : step.instruction}</span>
        </div>
        {then && !progress.done && (
          <span className="hud-then">Then <ManeuverIcon type={then.type} modifier={then.modifier} width={16} height={16} /></span>
        )}
      </div>

      <div className="hud-bar">
        <div className="hud-stats">
          <span className="hud-eta">{formatArrival(progress.remainingTime)}</span>
          <span className="muted">{formatDuration(progress.remainingTime)} · {formatDistance(progress.remaining)}</span>
        </div>
        <div className="hud-progress"><span style={{ width: `${(progress.travelled / route.path.length) * 100}%` }} /></div>
        <div className="hud-controls">
          <div className="seg" role="group" aria-label="Playback speed">
            {SPEEDS.map((s) => (
              <button key={s} className={s === speed ? 'active' : ''} onClick={() => onSpeed(s)}>{s}×</button>
            ))}
          </div>
          <button className="icon-btn solid" aria-label={playing ? 'Pause' : 'Play'} onClick={onToggle}>
            {playing ? <PauseIcon /> : <PlayIcon />}
          </button>
          <button className="icon-btn danger" aria-label="Exit drive" onClick={onExit}><CloseIcon /></button>
        </div>
      </div>
    </>
  );
}
