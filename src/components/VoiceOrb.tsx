import { motion, useReducedMotion } from 'motion/react';
import { VoiceState } from '../types';

interface VoiceOrbProps {
  state: VoiceState;
  size?: 'sm' | 'lg';
}

export function VoiceOrb({ state, size = 'lg' }: VoiceOrbProps) {
  const prefersReducedMotion = useReducedMotion();
  const isLarge = size === 'lg';
  const dim = isLarge ? 'w-36 h-36' : 'w-12 h-12';

  const ringColor =
    state === 'listening'
      ? 'border-sky-400/70'
      : state === 'thinking'
      ? 'border-amber-400/70'
      : state === 'speaking'
      ? 'border-emerald-400/70'
      : 'border-slate-500/40';

  const coreGradient =
    state === 'listening'
      ? 'from-sky-400/35 via-sky-500/20 to-transparent'
      : state === 'thinking'
      ? 'from-amber-400/35 via-amber-500/20 to-transparent'
      : state === 'speaking'
      ? 'from-emerald-400/35 via-sky-400/20 to-transparent'
      : 'from-slate-500/20 via-slate-700/10 to-transparent';

  const scaleAnim = prefersReducedMotion
    ? { scale: 1, opacity: 0.9 }
    : state === 'listening'
    ? { scale: [1, 1.12, 1], opacity: [0.75, 1, 0.75] }
    : state === 'speaking'
    ? { scale: [1, 1.16, 0.96, 1.1, 1], opacity: [0.8, 1, 0.85, 1, 0.8] }
    : state === 'thinking'
    ? { scale: [1, 1.05, 1], opacity: [0.65, 0.95, 0.65] }
    : { scale: 1, opacity: 0.65 };

  const duration =
    state === 'speaking' ? 1.1 : state === 'listening' ? 1.5 : state === 'thinking' ? 1.8 : 2.5;

  return (
    <div className={`relative flex items-center justify-center ${dim} select-none`}>
      <motion.div
        animate={scaleAnim}
        transition={{
          duration,
          repeat: state === 'idle' || prefersReducedMotion ? 0 : Infinity,
          ease: 'easeInOut',
        }}
        className={`absolute inset-0 rounded-full border ${ringColor}`}
      />

      {isLarge && (
        <motion.div
          animate={
            prefersReducedMotion || state === 'idle'
              ? { rotate: 0 }
              : { rotate: state === 'thinking' ? 360 : 180 }
          }
          transition={{
            duration: state === 'thinking' ? 2.4 : 6,
            repeat: state === 'idle' || prefersReducedMotion ? 0 : Infinity,
            ease: 'linear',
          }}
          className="absolute inset-3 rounded-full border border-dashed border-sky-400/30"
        />
      )}

      <motion.div
        animate={scaleAnim}
        transition={{
          duration: duration * 0.85,
          repeat: state === 'idle' || prefersReducedMotion ? 0 : Infinity,
          ease: 'easeInOut',
        }}
        className={`rounded-full bg-radial ${coreGradient} border border-white/15 flex items-center justify-center ${
          isLarge ? 'w-24 h-24' : 'w-8 h-8'
        }`}
      >
        <div
          className={`rounded-full ${
            state === 'listening'
              ? 'bg-sky-400'
              : state === 'thinking'
              ? 'bg-amber-400'
              : state === 'speaking'
              ? 'bg-emerald-400'
              : 'bg-slate-400'
          } ${isLarge ? 'w-3.5 h-3.5' : 'w-2 h-2'}`}
        />
      </motion.div>
    </div>
  );
}
