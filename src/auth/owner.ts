export const OWNER_USER_ID = 'ce399408-8885-49fd-a960-ce4479603aaa'

export function isOwnerSession(userId: string | null | undefined): boolean {
  return userId === OWNER_USER_ID
}
