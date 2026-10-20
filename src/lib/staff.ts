const STAFF_DOMAIN = "staff.projectk.local";

export const isValidUsername = (u: string) => /^[a-z0-9_]{3,30}$/i.test(u);

export const usernameToEmail = (u: string) => `${u.trim().toLowerCase()}@${STAFF_DOMAIN}`;

/** Owner logs in with email, staff with username. */
export function loginIdToEmail(id: string): string {
  const v = id.trim().toLowerCase();
  return v.includes("@") ? v : usernameToEmail(v);
}
