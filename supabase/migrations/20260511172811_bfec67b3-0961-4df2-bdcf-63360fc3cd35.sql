ALTER TABLE public.push_subscriptions
  RENAME COLUMN p256dh TO keys_p256dh;
ALTER TABLE public.push_subscriptions
  RENAME COLUMN auth TO keys_auth;
ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS activa BOOLEAN NOT NULL DEFAULT true;