import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  // CORS
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  try {
    const { subject, content, from, date } = await req.json();
    
    console.log("📧 Email recibido:", { subject, from, date });
    
    // Usar la fecha de hoy si no viene o está en formato inesperado
    const transactionDate = date || new Date().toISOString().split('T')[0];

    // Extraer monto del email
    const text = `${subject || ''} ${content || ''}`;
    const amountMatch = text.match(/\$\s*([0-9]{1,3}(?:\.[0-9]{3})*)/);
    const amount = amountMatch 
      ? parseFloat(amountMatch[1].replace(/\./g, '')) 
      : 1000; // default si no encuentra

    console.log("💰 Monto detectado:", amount);

    // Detectar si es gasto o ingreso
    const isGasto = /transferencia a terceros|transferencia a|compra|cargo|pago|débito|debito|retiro/i.test(text);
    const isIngreso = /transferencia recibida|abono|depósito|deposito|ingreso|crédito|credito/i.test(text);
    
    let type = "Gasto"; // default
    if (isIngreso) type = "Ingreso";
    else if (isGasto) type = "Gasto";

    console.log("📊 Tipo detectado:", type);

    // Detectar banco
    let bank = "Banco desconocido";
    if (from.toLowerCase().includes("bci")) bank = "BCI";
    else if (from.toLowerCase().includes("santander")) bank = "Santander";
    else if (from.toLowerCase().includes("estado")) bank = "BancoEstado";
    else if (from.toLowerCase().includes("chile")) bank = "Banco de Chile";
    else if (from.toLowerCase().includes("itau")) bank = "Itaú";
    else if (from.toLowerCase().includes("scotiabank")) bank = "Scotiabank";

    console.log("🏦 Banco detectado:", bank);

    // Crear transacción
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error } = await supabase
      .from("transactions")
      .insert({
        user_id: "3e4ea0ad-2f99-478c-aff7-7605b4f2d0c3",
        date: transactionDate,
        detail: `📧 ${bank} - ${subject?.substring(0, 40) || 'Email bancario'} (${from.split('@')[0]})`,
        category_name: "Otros gastos",
        type: type,
        amount: amount,
      })
      .select()
      .single();

    if (error) {
      console.error("❌ Error al crear transacción:", error);
      throw error;
    }

    console.log("✅ Transacción creada:", data.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        transaction_id: data.id,
        parsed: { 
          amount, 
          type, 
          bank,
          detail: data.detail
        }
      }),
      {
        status: 200,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    console.error("❌ Error general:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorDetails = error instanceof Error ? error.toString() : String(error);
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: errorDetails
      }),
      {
        status: 500,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
});

