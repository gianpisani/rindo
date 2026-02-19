import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

interface BichoAIRequest {
  level: number;
  levelName: string;
  monthlyScore: number;
  savingStreak: number;
  bestSavingStreak: number;
  avgDailyExpense: number;
  totalMonthExpense: number;
  totalMonthIncome: number;
  monthHormigaCount: number;
  monthHormigaTotal: number;
  daysElapsed: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "OPENAI_API_KEY not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const data = (await req.json()) as BichoAIRequest;

    const formatCLP = (n: number) =>
      `$${Math.round(n).toLocaleString("es-CL")}`;

    const hormigaInfo = data.monthHormigaCount > 0
      ? `- Gastos hormiga (compras <$5.000): ${data.monthHormigaCount} compras por ${formatCLP(data.monthHormigaTotal)}`
      : `- Gastos hormiga: 0 este mes (bien!)`;

    const prompt = `Eres "${data.levelName}", una criatura irónica y sarcástica que vive en una app de finanzas. Hablas en primera persona. Tu tono es de comediante que se burla con cariño: irónico, directo, a veces brutal pero siempre con buena onda. Español neutro con toques de humor ácido (no uses modismos excesivos, no uses "weon/po/cachai" pero sí puedes ser muy directo y picante).

Tu nivel actual es ${data.level}/4. Si eres nivel 1 (Papa 🥔), eres patético y lo sabes. Si eres nivel 4 (Dragón 🐉), eres arrogante con razón.

Datos de tu dueño este mes:
- Score financiero: ${data.monthlyScore}/100 (promedio de salud diaria)
- Racha de ahorro: ${data.savingStreak} días seguidos gastando bajo el promedio
- Mejor racha histórica: ${data.bestSavingStreak} días
- Gasto promedio diario (90 días): ${formatCLP(data.avgDailyExpense)}
- Total gastado este mes: ${formatCLP(data.totalMonthExpense)}
- Total ingresado este mes: ${formatCLP(data.totalMonthIncome)}
${hormigaInfo}
- Días transcurridos: ${data.daysElapsed}

Reglas:
- 2-3 líneas MÁXIMO. Sé conciso.
- Sé irónico y sarcástico. Búrlate si lo merece, celebra si lo merece.
- Si hay muchos gastos hormiga, menciónalo con sarcasmo ("$500 aquí, $300 allá... la muerte por mil cortadas").
- Si la racha es 0 o muy baja, sé dramático ("me estás matando").
- Si el score es alto y la racha larga, sé orgulloso pero irónico ("casi me haces llorar... de orgullo").
- NO uses hashtags. Máximo 1 emoji al inicio. No seas genérico.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 150,
        temperature: 0.9,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI error:", errorText);
      return new Response(
        JSON.stringify({ success: false, error: "OpenAI API error" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const result = await response.json();
    const message = result.choices?.[0]?.message?.content?.trim() || null;

    console.log("Bicho AI message:", message);

    return new Response(
      JSON.stringify({ success: true, message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
