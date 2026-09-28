/* framer-motion, slimmed: the site only uses tween/spring animations, variants, exit animations and
   AnimatePresence — no layout animations, drag or motion hooks. `m` + LazyMotion(domAnimation)
   ships that subset instead of the full `motion` component. Import `motion` from here, not from
   "framer-motion", so every component stays on the light build. */
export { m as motion, AnimatePresence, LazyMotion, domAnimation } from "framer-motion";
