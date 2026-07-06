/**
 * The currently signed-in user id, or null for local-only mode.
 * Set by the auth→store bridge; read by the storage layer to pick the backend.
 * Kept in its own module to avoid import cycles.
 */
let userId: string | null = null;

export function setActiveUser(id: string | null) {
  userId = id;
}

export function getActiveUser(): string | null {
  return userId;
}
