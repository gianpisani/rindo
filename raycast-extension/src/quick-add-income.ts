import { showHUD, showToast, Toast, LaunchProps } from "@raycast/api";
import { getAuthenticatedClient } from "./lib/supabase";

interface Arguments {
  text: string;
}

function parseInput(input: string): { amount: number; detail: string | null } | null {
  const cleaned = input.trim();
  const match = cleaned.match(/^\$?\s*([\d.,]+)\s*(.*)/);
  if (!match) return null;

  const amountStr = match[1].replace(/[.,]/g, "");
  const amount = parseInt(amountStr, 10);
  if (isNaN(amount) || amount <= 0) return null;

  const detail = match[2]?.trim() || null;
  return { amount, detail };
}

function formatCLP(amount: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
  }).format(amount);
}

export default async function Command(props: LaunchProps<{ arguments: Arguments }>) {
  const { text } = props.arguments;

  const auth = await getAuthenticatedClient();
  if (!auth) {
    await showToast({
      style: Toast.Style.Failure,
      title: "No has iniciado sesión",
      message: "Usa el comando 'Iniciar Sesión' primero",
    });
    return;
  }

  const parsed = parseInput(text);
  if (!parsed) {
    await showToast({
      style: Toast.Style.Failure,
      title: "Formato inválido",
      message: "Usa: 1500000 sueldo, $500000 freelance",
    });
    return;
  }

  const formatted = formatCLP(parsed.amount);

  try {
    await showToast({
      style: Toast.Style.Animated,
      title: "Guardando...",
      message: `${formatted} ${parsed.detail ?? ""}`.trim(),
    });

    let categoryNames: string[] = [];
    const willAnalyze = parsed.detail && parsed.detail.length >= 3;

    if (willAnalyze) {
      const { data: categories } = await auth.client
        .from("categories")
        .select("name")
        .eq("user_id", auth.userId);
      categoryNames = categories?.map((c: { name: string }) => c.name) ?? [];
    }

    const { data: transaction, error: insertError } = await auth.client
      .from("transactions")
      .insert({
        amount: parsed.amount,
        type: "Ingreso",
        category_name: willAnalyze ? "⚡ Analizando..." : "Sin categoría",
        detail: parsed.detail,
        date: new Date().toISOString(),
        user_id: auth.userId,
        card_id: null,
        installment_id: null,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    if (willAnalyze && transaction?.id) {
      try {
        const preferences = await import("@raycast/api").then((m) => m.getPreferenceValues());
        const response = await fetch(
          `${(preferences as { supabaseUrl: string }).supabaseUrl}/functions/v1/auto-categorize`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${auth.session.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              transactionId: transaction.id,
              detail: parsed.detail,
              userId: auth.userId,
              existingCategories: categoryNames,
            }),
          }
        );

        const result = await response.json();
        if (result.success && result.category && result.category !== "Sin categoría") {
          await showHUD(`✅ ${formatted} · ${parsed.detail} → ${result.category}`);
          return;
        }
      } catch (e) {
        console.error("Auto-categorize error:", e);
      }
    }

    const detail = parsed.detail ? ` · ${parsed.detail}` : "";
    await showHUD(`✅ Ingreso guardado: ${formatted}${detail}`);
  } catch (error) {
    console.error("Error:", error);
    await showToast({
      style: Toast.Style.Failure,
      title: "Error al guardar",
      message: error instanceof Error ? error.message : "Error desconocido",
    });
  }
}
