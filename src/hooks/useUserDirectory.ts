import { useEffect, useState } from 'react'
import { listUsers } from '../api/usersApi'

export interface UserDirectory {
  displayName: (userId: string) => string
}

/** Resolves Keycloak user ids to "First Last" wherever a screen would otherwise show a raw id
 * (e.g. "submitted by 7fc5847e-...") -- backed by `GET /api/v1/users`, which Admin, Checker and
 * Legal Officer can all call. Falls back to the id itself if the lookup fails or hasn't
 * resolved yet, so a slow/failed fetch never blocks the rest of the screen. */
export function useUserDirectory(accessToken: string | undefined): UserDirectory {
  const [names, setNames] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!accessToken) {
      return
    }
    listUsers(accessToken)
      .then((response) => {
        const next: Record<string, string> = {}
        for (const user of response.items) {
          next[user.id] = `${user.firstName} ${user.lastName}`
        }
        setNames(next)
      })
      .catch(() => {
        // Non-fatal: callers fall back to showing raw user IDs below.
      })
  }, [accessToken])

  return { displayName: (userId: string) => names[userId] ?? userId }
}
