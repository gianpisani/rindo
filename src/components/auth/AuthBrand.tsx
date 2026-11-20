import { motion } from "framer-motion";
import { RindoLogo } from "../layout/RindoLogo";
import { RotatingText } from "./RotatingText";

export function AuthBrand() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className="text-center mb-8"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="mb-4"
      >
        <RindoLogo size={56} className="text-white mx-auto" />
      </motion.div>

      <h1 className="text-hero font-medium text-white">
        rindo<span className="text-primary">.</span>
      </h1>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.8 }}
        className="mt-3"
      >
        <RotatingText />
      </motion.div>
    </motion.div>
  );
}
