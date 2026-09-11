import { ChevronDown, Layers, Search, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverButton,
  PopoverPanel,
} from '@headlessui/react';
import { useChat } from '@/lib/hooks/useChat';
import { AnimatePresence, motion } from 'motion/react';

const OptimizationModes = [
  {
    key: 'speed',
    title: 'Rapide',
    description: 'Réponse rapide, ~5-10 sources.',
    icon: <Zap size={14} className="text-amber-500" />,
  },
  {
    key: 'balanced',
    title: 'Standard',
    description: 'Equilibre vitesse/precision, ~15-20 sources.',
    icon: <Search size={14} className="text-emerald-500" />,
  },
  {
    key: 'quality',
    title: 'Approfondie',
    description: 'Investigation complete, 30-100 sources.',
    icon: <Layers size={14} className="text-bokari-500" />,
    badge: 'Pro',
  },
];

const Optimization = () => {
  const { optimizationMode, setOptimizationMode } = useChat();

  return (
    <Popover className="relative w-full max-w-[15rem] md:max-w-md lg:max-w-lg">
      {({ open }) => (
        <>
          <PopoverButton
            type="button"
            className="p-2 text-black/40 dark:text-white/35 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.04] active:scale-[0.97] transition-all duration-200 hover:text-black/60 dark:hover:text-white/50 focus:outline-none"
          >
            <div className="flex items-center gap-1.5">
              {
                OptimizationModes.find((mode) => mode.key === optimizationMode)
                  ?.icon
              }
              <span className="text-[11px] font-medium hidden sm:block">
                {OptimizationModes.find((mode) => mode.key === optimizationMode)?.title}
              </span>
              <ChevronDown
                size={12}
                className={cn(
                  open ? 'rotate-180' : 'rotate-0',
                  'transition-transform duration-200',
                )}
              />
            </div>
          </PopoverButton>
          <AnimatePresence>
            {open && (
              <PopoverPanel
                className="absolute z-10 w-60 md:w-[260px] left-0 bottom-full mb-2"
                static
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 8 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  className="origin-bottom-left flex flex-col gap-0.5 bg-white dark:bg-dark-200 border border-black/[0.08] dark:border-white/[0.08] rounded-xl w-full p-1.5 max-h-[250px] md:max-h-none overflow-y-auto shadow-elevated"
                >
                  <p className="text-[10px] uppercase tracking-wider text-black/30 dark:text-white/25 px-2.5 pt-1.5 pb-1">
                    Mode de recherche
                  </p>
                  {OptimizationModes.map((mode, i) => (
                    <PopoverButton
                      onClick={() => setOptimizationMode(mode.key)}
                      key={i}
                      className={cn(
                        'p-2.5 rounded-lg flex flex-col gap-0.5 text-start transition-all duration-200 cursor-pointer focus:outline-none',
                        optimizationMode === mode.key
                          ? 'bg-black/[0.04] dark:bg-white/[0.04]'
                          : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.03]',
                      )}
                    >
                      <div className="flex justify-between w-full">
                        <div className="flex items-center gap-2">
                          {mode.icon}
                          <span className="text-[12px] font-medium text-black/80 dark:text-white/80">{mode.title}</span>
                        </div>
                        {'badge' in mode && mode.badge && (
                          <span className="bg-bokari-500/10 text-bokari-600 dark:text-bokari-400 px-1.5 py-0.5 rounded-md text-[9px] font-medium">
                            {mode.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-black/40 dark:text-white/35 text-[11px] leading-relaxed pl-[22px]">
                        {mode.description}
                      </p>
                    </PopoverButton>
                  ))}
                </motion.div>
              </PopoverPanel>
            )}
          </AnimatePresence>
        </>
      )}
    </Popover>
  );
};

export default Optimization;
