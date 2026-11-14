import { useEffect, useState } from 'react'
import { listUsers, type UserSummary } from '../api/usersApi'

export interface UserDirectory {
  displayName: (userId: string) => string
  users: UserSummary[]
}

/** Resolves Keycloak user ids to "First Last" wherever a screen would otherwise show a raw id
 * (e.g. "submitted by 7fc5847e-...") -- backed by `GET /api/v1/users`, which Admin, Checker and
 * Legal Officer can all call. Falls back to the id itself while loading or if the lookup fails,
 * so a slow/failed fetch never blocks the rest of the screen. Once loaded, an id that isn't in
 * the directory (deleted account / stale reference) shows as "Unknown user" instead. */
export function useUserDirectory(accessToken: string | undefined): UserDirectory {
  const [users, setUsers] = useState<UserSummary[]>()

  useEffect(() => {
    if (!accessToken) {
      return
    }
    listUsers(accessToken)
      .then((response) => setUsers(response.items))
      .catch(() => {
        // Non-fatal: callers fall back to showing raw user IDs below.
      })
  }, [accessToken])

  const names: Record<string, string> = {}
  for (const user of users ?? []) {
    names[user.id] = `${user.firstName} ${user.lastName}`
  }

  return {
    users: users ?? [],
    displayName: (userId: string) => names[userId] ?? (users ? 'Unknown user' : userId),
  }
}
