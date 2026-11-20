import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface ActivityItem {
  icon: string;
  text: string;
  detail?: string;
  color: string;
  side: "left" | "right";
}

const ACTIVITY_ITEMS: ActivityItem[] = [
  { icon: "🏦", text: "Sync Banco de Chile", detail: "12 movimientos importados", color: "text-blue-400", side: "left" },
  { icon: "🏦", text: "Sync Santander", detail: "8 movimientos importados", color: "text-white", side: "right" },
  { icon: "🏦", text: "Sync BancoEstado", detail: "5 movimientos importados", color: "text-orange-400", side: "left" },
  { icon: "🤖", text: "IA categorizó 8 gastos", detail: "Comida, Transporte, Hogar...", color: "text-purple-400", side: "right" },
  { icon: "📈", text: "Proyección 12 meses", detail: "Tendrás ahorrado $15.820.000", color: "text-success", side: "left" },
  { icon: "⚠️", text: "Presupuesto excedido", detail: "Transporte +$15k", color: "text-destructive", side: "right" },
  { icon: "📱", text: "Categorizado con IA", detail: "Spotify → Suscripciones", color: "text-purple-400", side: "left" },
  { icon: "🔔", text: "Cuota 3/12 detectada", detail: "Bicicleta · −$133.250", color: "text-orange-400", side: "right" },
  { icon: "📊", text: "Presupuesto comida", detail: "78% usado · quedan 11 días", color: "text-amber-400", side: "left" },
  { icon: "🍔", text: "Pago Uber Eats", detail: "−$12.500 · Comida", color: "text-white", side: "right" },
  { icon: "💰", text: "Ingreso sueldo", detail: "+$1.850.000", color: "text-success", side: "left" },
  { icon: "🏠", text: "Pago arriendo", detail: "−$450.000 · Hogar", color: "text-white", side: "left" },
  { icon: "📋", text: "Conciliación rápida", detail: "3 pendientes", color: "text-blue-400", side: "right" },
];

const MAX_VISIBLE_CARDS = 6;

interface FloatingCard {
  id: number;
  item: ActivityItem;
  x: number;
  duration: number;
}

export function FloatingActivity() {
  const [cards, setCards] = useState<FloatingCard[]>([]);
  const counterRef = useRef(0);
  const lastSideRef = useRef<"left" | "right">("right");
  const usedIndexes = useRef<Set<number>>(new Set());

  useEffect(() => {
    function spawnCard() {
      const targetSide = lastSideRef.current === "left" ? "right" : "left";
      lastSideRef.current = targetSide;

      const candidates = ACTIVITY_ITEMS
        .map((item, i) => ({ item, i }))
        .filter(({ item, i }) => item.side === targetSide && !usedIndexes.current.has(i));

      const pool = candidates.length > 0
        ? candidates
        : ACTIVITY_ITEMS.map((item, i) => ({ item, i })).filter(({ i }) => !usedIndexes.current.has(i));

      if (pool.length === 0) {
        usedIndexes.current.clear();
        return;
      }

      const pick = pool[Math.floor(Math.random() * pool.length)];
      usedIndexes.current.add(pick.i);
      if (usedIndexes.current.size > ACTIVITY_ITEMS.length * 0.6) {
        usedIndexes.current.clear();
      }

      const card: FloatingCard = {
        id: counterRef.current++,
        item: pick.item,
        x: 3 + Math.random() * 12,
        duration: 14 + Math.random() * 4,
      };

      setCards((prev) => [...prev.slice(-(MAX_VISIBLE_CARDS - 1)), card]);
    }

    const initialTimers = [
      setTimeout(() => spawnCard(), 2000),
      setTimeout(() => spawnCard(), 6000),
    ];

    const spawn = () => {
      spawnCard();
      const nextDelay = 4500 + Math.random() * 2500;
      timerId = setTimeout(spawn, nextDelay);
    };
    let timerId = setTimeout(spawn, 10000);

    return () => {
      initialTimers.forEach(clearTimeout);
      clearTimeout(timerId);
    };
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none hidden lg:block">
      <AnimatePresence>
        {cards.map((card) => (
          <motion.div
            key={card.id}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: [0, 0.5, 0.5, 0.3, 0], y: ["0%", "85vh"] }}
            exit={{ opacity: 0 }}
            transition={{
              duration: card.duration,
              ease: [0.25, 0.1, 0.25, 1],
              opacity: { duration: card.duration, times: [0, 0.08, 0.6, 0.85, 1] },
            }}
            className="absolute select-none"
            style={{
              [card.item.side === "left" ? "left" : "right"]: `${card.x}%`,
              top: "-50px",
            }}
          >
            <div className="flex items-center gap-2 pl-2 pr-3 py-2 rounded-card border border-white/[0.08] bg-gradient-to-r from-white/[0.04] to-white/[0.02] backdrop-blur-md">
              <span className="text-sm leading-none shrink-0">{card.item.icon}</span>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-white/50 font-medium leading-none whitespace-nowrap">
                  {card.item.text}
                </span>
                {card.item.detail && (
                  <span className={`text-xs leading-none whitespace-nowrap ${card.item.color} opacity-50`}>
                    {card.item.detail}
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
