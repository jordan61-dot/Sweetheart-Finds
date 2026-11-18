export const merchantObservationLifetime = 30 * 60_000;

export function merchantObservationIsFresh(observedAt: string, clock = Date.now()) {
  const age = clock - Date.parse(observedAt);
  return age >= 0 && age < merchantObservationLifetime;
}
