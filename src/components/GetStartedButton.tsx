'use client'

import { motion, AnimatePresence } from 'framer-motion'

interface GetStartedButtonProps {
  visible: boolean
  onClick?: () => void
}

/**
 * The ONLY call-to-action on the page. It does not exist until the user has
 * scrolled through every animation to the very end — then it pops in with a
 * springy "Boomplay" overshoot.
 */
export default function GetStartedButton({ visible, onClick }: GetStartedButtonProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="absolute inset-x-0 bottom-[14vh] z-40 flex flex-col items-center gap-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.2 } }}
        >
          <motion.div
            className="text-center font-display text-5xl tracking-wide text-white sm:text-6xl"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.05, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            READY?
          </motion.div>

          <motion.button
            onClick={onClick}
            className="pointer-events-auto rounded-full bg-acid px-12 py-4 font-mono text-sm uppercase tracking-[0.25em] text-black shadow-acid"
            // Boomplay-style pop: scale from 0 with a bouncy spring overshoot.
            initial={{ scale: 0, y: 50, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 280, damping: 13, mass: 0.9, delay: 0.18 }}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.94 }}
          >
            Get Started
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
