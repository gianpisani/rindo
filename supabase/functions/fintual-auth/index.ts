// Edge Function para autenticar con Fintual y guardar token
// Recibe email y password, obtiene token read-only de Fintual API

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders } from '../_shared/cors.ts'

interface FintualAuthRequest {
  email: string
  password: string
}

interface FintualTokenResponse {
  data: {
    id: string
    type: string
    attributes: {
      token: string
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { email, password } = await req.json() as FintualAuthRequest

    if (!email || !password) {
      return new Response(
        JSON.stringify({ success: false, error: 'Email y contraseña requeridos' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    console.log('Autenticando con Fintual para:', email)

    // Obtener el user_id desde el JWT (RLS lo maneja automáticamente)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Usuario no autenticado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    // Decodificar JWT para obtener user_id
    const jwt = authHeader.replace('Bearer ', '')
    const payload = JSON.parse(atob(jwt.split('.')[1]))
    const userId = payload.sub

    // Llamar a Fintual API para obtener token
    const fintualResponse = await fetch('https://fintual.cl/api/access_tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user: {
          email,
          password,
        },
      }),
    })

    if (!fintualResponse.ok) {
      const errorText = await fintualResponse.text()
      console.error('Error de Fintual:', errorText)
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Credenciales inválidas o error de Fintual'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    const fintualData = await fintualResponse.json() as FintualTokenResponse
    const token = fintualData.data.attributes.token

    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: 'No se recibió token de Fintual' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    console.log('Token obtenido exitosamente')

    // Guardar token en DB (reemplazar si ya existe)
    const { error: upsertError } = await supabaseClient
      .from('fintual_tokens')
      .upsert({
        user_id: userId,
        token,
        email,
        last_synced_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id'
      })

    if (upsertError) {
      console.error('Error guardando token:', upsertError)
      return new Response(
        JSON.stringify({ success: false, error: 'Error guardando token' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    console.log('Token guardado exitosamente en DB')

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Conexión con Fintual exitosa'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
