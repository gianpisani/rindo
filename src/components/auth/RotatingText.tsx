import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const ROTATING_WORDS = [
  "Ordena tus finanzas",
  "Sincroniza tu banco",
  "Controla tu presupuesto",
  "Proyecta tu futuro",
  "Maneja tus deudas",
  "Trackea cada peso",
];

export function RotatingText() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((i) => (i + 1) % ROTATING_WORDS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-7 overflow-hidden relative">
      <AnimatePresence mode="wait">
        <motion.p
          key={index}
          initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -16, filter: "blur(4px)" }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="text-sm text-white/30 absolute inset-0 text-center"
        >
          {ROTATING_WORDS[index]}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
