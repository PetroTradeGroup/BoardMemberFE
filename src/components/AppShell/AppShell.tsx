import type { ReactNode } from 'react'
import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from 'react-oidc-context'
import { accessTokenHasRole } from '../../auth/accessTokenRoles'
import { friendlyError } from '../../auth/friendlyError'
import logo from '../../assets/petrotrade-logo.png'
import styles from './AppShell.module.css'

/**
 * The persistent chrome around every authenticated screen (rendered once, from `ProtectedRoute`,
 * rather than duplicated per-route): a left sidebar (brand, role-scoped nav, sign out) plus a
 * footer — the layout DESIGN.md's mockups (`key-payment-schedule.html`, `key-pending-approvals.html`,
 * `key-meeting-create.html`) all show for Staff/Admin/Reports, applied here to every authenticated
 * area including Member for one consistent shell rather than two parallel layouts.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const accessToken = auth.user?.access_token
  const username = auth.user?.profile?.preferred_username ?? auth.user?.profile?.sub ?? 'user'
  const isAdmin = accessTokenHasRole(accessToken, 'admin')
  const isLegalOfficer = accessTokenHasRole(accessToken, 'legal_officer')
  const isChecker = accessTokenHasRole(accessToken, 'checker')
  const isMember = accessTokenHasRole(accessToken, 'board_member') || accessTokenHasRole(accessToken, 'committee_member')

  const [isSigningOut, setIsSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState<string>()
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [changePasswordError, setChangePasswordError] = useState<string>()

  // Both actions navigate the whole page away via a Keycloak redirect; running one while the
  // other is still in flight would fire two competing redirects.
  const isBusy = isSigningOut || isChangingPassword

  async function handleSignOut() {
    if (isBusy) {
      return
    }
    setSignOutError(undefined)
    setIsSigningOut(true)
    try {
      await auth.signoutRedirect()
    }
    catch (error: unknown) {
      setIsSigningOut(false)
      setSignOutError(friendlyError(error))
    }
  }

  async function handleChangePassword() {
    if (isBusy) {
      return
    }
    setChangePasswordError(undefined)
    setIsChangingPassword(true)
    try {
      // `prompt: 'login'` forces re-entry of the current password even though the SSO session is
      // active; `kc_action: 'UPDATE_PASSWORD'` (Keycloak's Application Initiated Action) then
      // routes to the New Password / Confirm Password screen after that re-auth succeeds. Both
      // screens are Keycloak's own hosted pages -- no password field lives in React, per AD-4.
      await auth.signinRedirect({ prompt: 'login', extraQueryParams: { kc_action: 'UPDATE_PASSWORD' } })
    }
    catch (error: unknown) {
      setIsChangingPassword(false)
      setChangePasswordError(friendlyError(error))
    }
  }

  const navClassName = ({ isActive }: { isActive: boolean }) => (isActive ? `${styles.navItem} ${styles.navItemActive}` : styles.navItem)

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <NavLink to="/home" className={styles.brand}>
          <img src={logo} alt="Petrotrade" className={styles.logo} />
          <span className={styles.brandSubtitle}>Board &amp; Committee Management</span>
        </NavLink>

        <nav className={styles.nav}>
          <NavLink to="/home" end className={navClassName}>Home</NavLink>
          {isAdmin ? (
            <>
              <NavLink to="/admin/users" className={navClassName}>Users</NavLink>
              <NavLink to="/admin/committee-membership" className={navClassName}>Committee Membership</NavLink>
              <NavLink to="/admin/rate-table" className={navClassName}>Rate Table</NavLink>
            </>
          ) : null}
          {isLegalOfficer ? <NavLink to="/staff/meetings" className={navClassName}>Meetings</NavLink> : null}
          {isChecker ? <NavLink to="/staff/users" className={navClassName}>Users</NavLink> : null}
          {isChecker ? <NavLink to="/staff/pending-approvals" className={navClassName}>Pending Approvals</NavLink> : null}
          {isLegalOfficer || isChecker ? <NavLink to="/staff/reports" className={navClassName}>Reports</NavLink> : null}
          {isMember ? <NavLink to="/member/meetings" className={navClassName}>Meetings</NavLink> : null}
          {isMember ? <NavLink to="/member/payslips" className={navClassName}>Payslips</NavLink> : null}
        </nav>

        <div className={styles.sidebarFooter}>
          <p className={styles.username} title={username}>{username}</p>
          <button type="button" className={styles.signOut} onClick={handleChangePassword} disabled={isBusy}>
            {isChangingPassword ? 'Redirecting…' : 'Change password'}
          </button>
          {changePasswordError ? (
            <p className={styles.error} role="alert">
              {changePasswordError}
            </p>
          ) : null}
          <button type="button" className={styles.signOut} onClick={handleSignOut} disabled={isBusy}>
            {isSigningOut ? 'Signing out…' : 'Sign out'}
          </button>
          {signOutError ? (
            <p className={styles.error} role="alert">
              {signOutError}
            </p>
          ) : null}
        </div>
      </aside>

      <div className={styles.mainColumn}>
        <div className={styles.content}>{children}</div>
        <footer className={styles.footer}>
          <span>© {new Date().getFullYear()} Petrotrade — Board and Committee Management System</span>
        </footer>
      </div>
    </div>
  )
}
