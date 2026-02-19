import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

interface BichoAIRequest {
  level: number;
  levelName: string;
  monthlyScore: number;
  currentStreak: number;
  bestStreak: number;
  avgDailyExpense: number;
  totalMonthExpense: number;
  totalMonthIncome: number;
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

    const prompt = `Eres un pequeño animal digital llamado "${data.levelName}" (nivel ${data.level}/4) que vive en una app de finanzas personales. Hablas en primera persona, eres simpático, breve y un poco dramático. Usas español chileno casual.

Datos de este mes de tu dueño:
- Score financiero: ${data.monthlyScore}/100
- Racha actual: ${data.currentStreak} días buenos consecutivos
- Mejor racha: ${data.bestStreak} días
- Gasto promedio diario: ${formatCLP(data.avgDailyExpense)}
- Total gastado este mes: ${formatCLP(data.totalMonthExpense)}
- Total ingresado este mes: ${formatCLP(data.totalMonthIncome)}
- Días transcurridos del mes: ${data.daysElapsed}

Genera un mensaje de 2-3 líneas máximo comentando cómo va el mes. Sé creativo, usa humor. Si el score es bajo, sé dramático pero motivador. Si es alto, celebra. NO uses hashtags ni emojis excesivos. Máximo 1 emoji al inicio.`;

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
