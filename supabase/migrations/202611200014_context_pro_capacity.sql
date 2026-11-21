-- After the operator's Pro upgrade, allow ten shared in-flight requests.
-- Keep the bounded pool, FIFO, leases and provider cooldown; do not use all 100 plan slots.
update public.provider_throttle set max_in_flight=10 where provider='context';
