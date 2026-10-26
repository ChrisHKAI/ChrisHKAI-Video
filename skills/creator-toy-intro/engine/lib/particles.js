// Particles: confetti, sparks and paper bits thrown on the hits.
const G = 2.4; // toy-scale gravity, m/s²
// where a particle thrown from p0 at v0 is after dt seconds (it stops on `floor`)
export function ballistic(p0, v0, dt, floor) {
  const p = [p0[0] + v0[0] * dt, p0[1] + v0[1] * dt - 0.5 * G * dt * dt, p0[2] + v0[2] * dt];
  if (floor !== undefined && p[1] < floor) p[1] = floor;
  return p;
}
