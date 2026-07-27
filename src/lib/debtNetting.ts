// Neteo de deudas por persona.
//
// Cuando alguien aparece en los dos lados —Cata me debe $10.000 y yo le debo
// $15.000— lo que realmente se mueve son $5.000: el resto se compensa. Este
// módulo traduce un conjunto de deudas en un plan de cierre: qué filas se cierran
// con plata, cuáles quedan compensadas, y cuánto se transfiere.
//
// Es puro a propósito (sin React ni Supabase) porque lo consumen tanto la página
// de Deudas como el panel de vinculación del modal de transacción, y así las dos
// formas de conciliar producen exactamente el mismo resultado.

import type { SharedExpenseWithTransaction } from "@/hooks/useSharedExpenses";

/**
 * Espejo en TS de public.normalize_person_name. Tiene que dar el mismo resultado
 * que la columna generada person_key: si divergen, la UI agrupa distinto que el
 * balance que devuelve la RPC.
 */
export const personKey = (name: string) =>
  (name ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ");

export interface PersonDebts {
  key: string;
  displayName: string;
  owedToMe: SharedExpenseWithTransaction[];
  iOwe: SharedExpenseWithTransaction[];
  owedToMeTotal: number;
  iOweTotal: number;
  /** > 0 me deben, < 0 yo debo, 0 al día. */
  net: number;
  /** Lo que se cancela entre ambos lados y nunca se transfiere. */
  offsetAmount: number;
  hasBothSides: boolean;
}

export type NetDirection = "in" | "out" | "none";

export interface SettlementPlan {
  /** Filas que se cierran con plata, contra la transacción vinculada. */
  cashIds: string[];
  /** Filas compensadas contra el otro lado. */
  offsetIds: string[];
  offsetAmount: number;
  /** Lo que efectivamente se mueve. */
  netAmount: number;
  /** 'in' entra plata, 'out' sale plata, 'none' compensación pura. */
  netDirection: NetDirection;
}

export const EMPTY_PLAN: SettlementPlan = {
  cashIds: [],
  offsetIds: [],
  offsetAmount: 0,
  netAmount: 0,
  netDirection: "none",
};

const sum = (rows: SharedExpenseWithTransaction[]) =>
  rows.reduce((acc, r) => acc + Number(r.amount_owed), 0);

/**
 * Agrupa deudas pendientes por persona normalizada. El displayName es la grafía
 * de la deuda más reciente, igual criterio que get_balances_by_person.
 */
export function groupByPerson(rows: SharedExpenseWithTransaction[]): PersonDebts[] {
  const byKey = new Map<string, SharedExpenseWithTransaction[]>();

  for (const row of rows) {
    const key = personKey(row.debtor_name);
    const bucket = byKey.get(key);
    if (bucket) bucket.push(row);
    else byKey.set(key, [row]);
  }

  const people: PersonDebts[] = [];

  for (const [key, group] of byKey) {
    const newestFirst = [...group].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    const owedToMe = group.filter((r) => r.direction === "they_owe_me");
    const iOwe = group.filter((r) => r.direction === "i_owe_them");
    const owedToMeTotal = sum(owedToMe);
    const iOweTotal = sum(iOwe);

    people.push({
      key,
      displayName: newestFirst[0].debtor_name,
      owedToMe,
      iOwe,
      owedToMeTotal,
      iOweTotal,
      net: owedToMeTotal - iOweTotal,
      offsetAmount: Math.min(owedToMeTotal, iOweTotal),
      hasBothSides: owedToMe.length > 0 && iOwe.length > 0,
    });
  }

  return people.sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
}

/**
 * Plan a partir de un conjunto arbitrario de filas seleccionadas, que es lo que
 * habilita el caso "me pagaron todo por separado": si sólo hay filas de un lado
 * no hay compensación y se cierran todas con plata.
 *
 * Con filas de ambos lados, y dado que cada deuda se salda entera (no hay
 * abonos parciales), el lado de menor total se cierra completo como compensado y
 * el de mayor total con plata, moviendo la diferencia.
 */
export function planFromSelection(rows: SharedExpenseWithTransaction[]): SettlementPlan {
  if (rows.length === 0) return EMPTY_PLAN;

  const owedToMe = rows.filter((r) => r.direction === "they_owe_me");
  const iOwe = rows.filter((r) => r.direction === "i_owe_them");
  const owedToMeTotal = sum(owedToMe);
  const iOweTotal = sum(iOwe);
  const net = owedToMeTotal - iOweTotal;
  const offsetAmount = Math.min(owedToMeTotal, iOweTotal);

  const ids = (list: SharedExpenseWithTransaction[]) => list.map((r) => r.id);

  // Sin filas del otro lado no hay nada que compensar.
  if (owedToMe.length === 0) {
    return { cashIds: ids(iOwe), offsetIds: [], offsetAmount: 0, netAmount: iOweTotal, netDirection: "out" };
  }
  if (iOwe.length === 0) {
    return { cashIds: ids(owedToMe), offsetIds: [], offsetAmount: 0, netAmount: owedToMeTotal, netDirection: "in" };
  }

  // Se compensan entero: nadie transfiere nada.
  if (net === 0) {
    return {
      cashIds: [],
      offsetIds: [...ids(owedToMe), ...ids(iOwe)],
      offsetAmount,
      netAmount: 0,
      netDirection: "none",
    };
  }

  const meOwedMore = net > 0;
  return {
    cashIds: ids(meOwedMore ? owedToMe : iOwe),
    offsetIds: ids(meOwedMore ? iOwe : owedToMe),
    offsetAmount,
    netAmount: Math.abs(net),
    netDirection: meOwedMore ? "in" : "out",
  };
}

/** Plan de saldar todo lo pendiente con una persona en una sola operación. */
export function planNetSettlement(person: PersonDebts): SettlementPlan {
  return planFromSelection([...person.owedToMe, ...person.iOwe]);
}

export const planSize = (plan: SettlementPlan) => plan.cashIds.length + plan.offsetIds.length;

/** Tipo de transacción que corresponde al neto, para validar contra el formulario. */
export const expectedTransactionType = (plan: SettlementPlan) =>
  plan.netDirection === "in" ? "Reembolso" : plan.netDirection === "out" ? "Gasto" : null;
