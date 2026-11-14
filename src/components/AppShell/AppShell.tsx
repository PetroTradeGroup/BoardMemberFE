import type { ReactNode } from 'react'
import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from 'react-oidc-context'
import {
  BarChart3,
  CalendarDays,
  ClipboardCheck,
  FileText,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Network,
  Receipt,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { accessTokenHasRole } from '../../auth/accessTokenRoles'
import { friendlyError } from '../../auth/friendlyError'
import logo from '../../assets/petrotrade-logo.png'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

interface NavSection {
  title?: string
  items: NavItem[]
}

const ROLE_LABELS: [string, string][] = [
  ['admin', 'Administrator'],
  ['checker', 'Checker'],
  ['legal_officer', 'Legal Officer'],
  ['board_member', 'Board Member'],
  ['committee_member', 'Committee Member'],
]

/**
 * The persistent chrome around every authenticated screen (rendered once, from `ProtectedRoute`):
 * a left sidebar on desktop (brand, role-scoped nav, account actions) that becomes a top bar +
 * slide-out Sheet on small screens.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const location = useLocation()
  const accessToken = auth.user?.access_token
  const username = auth.user?.profile?.preferred_username ?? auth.user?.profile?.sub ?? 'user'
  const displayName = auth.user?.profile?.name ?? username
  const isAdmin = accessTokenHasRole(accessToken, 'admin')
  const isLegalOfficer = accessTokenHasRole(accessToken, 'legal_officer')
  const isChecker = accessTokenHasRole(accessToken, 'checker')
  const isMember = accessTokenHasRole(accessToken, 'board_member') || accessTokenHasRole(accessToken, 'committee_member')
  const roleLabel = ROLE_LABELS.find(([role]) => accessTokenHasRole(accessToken, role))?.[1]

  const [isSigningOut, setIsSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState<string>()
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [changePasswordError, setChangePasswordError] = useState<string>()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [lastPath, setLastPath] = useState(location.pathname)
  if (lastPath !== location.pathname) {
    // Close the mobile menu after navigating.
    setLastPath(location.pathname)
    setMobileOpen(false)
  }

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
      // routes to the New Password screen. Both are Keycloak-hosted pages (AD-4).
      await auth.signinRedirect({ prompt: 'login', extraQueryParams: { kc_action: 'UPDATE_PASSWORD' } })
    }
    catch (error: unknown) {
      setIsChangingPassword(false)
      setChangePasswordError(friendlyError(error))
    }
  }

  const sections: NavSection[] = [
    { items: [{ to: '/home', label: 'Dashboard', icon: LayoutDashboard, end: true }] },
  ]
  if (isAdmin) {
    sections.push({
      title: 'Administration',
      items: [
        { to: '/admin/users', label: 'Users', icon: Users },
        { to: '/admin/committee-membership', label: 'Committee Membership', icon: Network },
        { to: '/admin/rate-table', label: 'Rate Table', icon: FileText },
      ],
    })
  }
  if (isLegalOfficer || isChecker) {
    const items: NavItem[] = []
    if (isLegalOfficer) items.push({ to: '/staff/meetings', label: 'Meetings', icon: CalendarDays })
    if (isChecker) {
      items.push({ to: '/staff/pending-approvals', label: 'Pending Approvals', icon: ClipboardCheck })
      items.push({ to: '/staff/users', label: 'Users', icon: Users })
    }
    items.push({ to: '/staff/reports', label: 'Reports', icon: BarChart3 })
    sections.push({ title: 'Governance', items })
  }
  if (isMember) {
    sections.push({
      title: 'My Board',
      items: [
        { to: '/member/meetings', label: 'Meetings', icon: CalendarDays },
        { to: '/member/payslips', label: 'Payslips', icon: Receipt },
      ],
    })
  }

  const initials = displayName
    .split(/[\s.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

  const sidebarBody = (
    <div className="flex h-full flex-col">
      <div className="h-1 bg-gradient-to-r from-brand-green via-brand-lime to-brand-gold" aria-hidden />
      <NavLink to="/home" className="flex flex-col gap-2 px-5 py-5">
        <img src={logo} alt="Petrotrade" className="h-11 w-auto self-start" />
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Board &amp; Committee Management</span>
      </NavLink>
      <Separator />

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4" aria-label="Main">
        {sections.map((section, index) => (
          <div key={section.title ?? index} className="space-y-1">
            {section.title ? (
              <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">{section.title}</p>
            ) : null}
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'relative flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
                    isActive &&
                      'bg-primary/10 font-medium text-primary hover:bg-primary/15 hover:text-primary before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-full before:bg-brand-gold',
                  )
                }
              >
                <item.icon className="size-4" aria-hidden />
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <Separator />
      <div className="space-y-3 p-4">
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
            {initials || '?'}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium" title={username}>{username}</p>
            {roleLabel ? <p className="truncate text-xs text-muted-foreground">{roleLabel}</p> : null}
          </div>
        </div>
        <div className="grid gap-1.5">
          <Button variant="ghost" size="sm" className="justify-start text-muted-foreground" onClick={handleChangePassword} disabled={isBusy}>
            <KeyRound /> {isChangingPassword ? 'Redirecting…' : 'Change password'}
          </Button>
          {changePasswordError ? (
            <p className="text-xs text-destructive" role="alert">{changePasswordError}</p>
          ) : null}
          <Button variant="ghost" size="sm" className="justify-start text-muted-foreground" onClick={handleSignOut} disabled={isBusy}>
            <LogOut /> {isSigningOut ? 'Signing out…' : 'Sign out'}
          </Button>
          {signOutError ? (
            <p className="text-xs text-destructive" role="alert">{signOutError}</p>
          ) : null}
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r bg-sidebar lg:block">{sidebarBody}</aside>

      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur lg:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open menu">
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 bg-sidebar p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            {mobileOpen ? sidebarBody : null}
          </SheetContent>
        </Sheet>
        <img src={logo} alt="Petrotrade" className="h-7 w-auto" />
      </header>

      <div className="flex min-h-screen flex-col lg:pl-64">
        <div className="flex-1">{children}</div>
        <footer className="border-t px-6 py-4 text-xs text-muted-foreground">
          © {new Date().getFullYear()} Petrotrade — Board and Committee Management System
        </footer>
      </div>
    </div>
  )
}
