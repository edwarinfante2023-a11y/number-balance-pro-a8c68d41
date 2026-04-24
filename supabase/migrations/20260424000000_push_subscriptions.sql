-- ═══════════════════════════════════════════════════════════════════════════
-- Web Push Subscriptions — Nivel 6B
-- ═══════════════════════════════════════════════════════════════════════════
-- Almacena las suscripciones de Web Push de cada usuario para que las
-- Edge Functions puedan enviar notificaciones push nativas del navegador.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  keys_p256dh text NOT NULL,
  keys_auth text NOT NULL,
  activa boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(endpoint)
);

-- Índice para búsquedas rápidas de suscripciones activas
CREATE INDEX IF NOT EXISTS idx_push_subs_active ON push_subscriptions (activa) WHERE activa = true;

-- RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Usuarios gestionan sus propias suscripciones
CREATE POLICY "Users manage own push subscriptions"
  ON push_subscriptions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
