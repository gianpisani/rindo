import { motion } from "framer-motion";

const LANDING_BANKS = [
  { value: "bchile", label: "Banco de Chile" },
  { value: "bci", label: "BCI" },
  { value: "santander", label: "Santander" },
  { value: "bestado", label: "BancoEstado" },
  { value: "scotiabank", label: "Scotiabank" },
  { value: "itau", label: "Itaú" },
  { value: "falabella", label: "Falabella" },
  { value: "bice", label: "BICE" },
  { value: "bancosecurity", label: "Security" },
  { value: "edwards", label: "Edwards" },
];

export function BankStrip() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 1.5, duration: 1 }}
      className="flex flex-col items-center gap-3"
    >
      <p className="text-xs text-white/15 font-medium">
        Sincroniza con tu banco
      </p>
      <div className="flex items-center gap-1 justify-center">
        {LANDING_BANKS.map((bank) => (
          <img
            key={bank.value}
            src={`/banks/${bank.value}.png`}
            alt={bank.label}
            title={bank.label}
            className="w-6 h-6 rounded-card object-contain opacity-40 hover:opacity-60 transition-opacity duration-300"
          />
        ))}
      </div>
    </motion.div>
  );
}
