import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { AdminCommitteeMembership } from './routes/AdminCommitteeMembership'
import { AdminRateTable } from './routes/AdminRateTable'
import { AdminUsers } from './routes/AdminUsers'
import { Callback } from './routes/Callback'
import { Home } from './routes/Home'
import { MemberMeetingDetail } from './routes/MemberMeetingDetail'
import { MemberMeetings } from './routes/MemberMeetings'
import { MemberPayslips } from './routes/MemberPayslips'
import { PendingApprovals } from './routes/PendingApprovals'
import { SignIn } from './routes/SignIn'
import { StaffAttendanceRegister } from './routes/StaffAttendanceRegister'
import { StaffMeetings } from './routes/StaffMeetings'
import { StaffPaymentSchedule } from './routes/StaffPaymentSchedule'
import { StaffReports } from './routes/StaffReports'
import { StaffUsers } from './routes/StaffUsers'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SignIn />} />
        <Route path="/callback" element={<Callback />} />
        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminUsers />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/committee-membership"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminCommitteeMembership />
            </ProtectedRoute>
          }
        />
        <Route
          path="/staff/meetings"
          element={
            <ProtectedRoute requiredRole="legal_officer">
              <StaffMeetings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/staff/users"
          element={
            <ProtectedRoute requiredRole="checker">
              <StaffUsers />
            </ProtectedRoute>
          }
        />
        <Route
          path="/staff/pending-approvals"
          element={
            <ProtectedRoute requiredRole="checker">
              <PendingApprovals />
            </ProtectedRoute>
          }
        />
        <Route
          path="/staff/meetings/:id/register"
          element={
            <ProtectedRoute requiredRole={['legal_officer', 'checker']}>
              <StaffAttendanceRegister />
            </ProtectedRoute>
          }
        />
        <Route
          path="/staff/meetings/:id/payment-schedule"
          element={
            <ProtectedRoute requiredRole={['legal_officer', 'checker']}>
              <StaffPaymentSchedule />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/rate-table"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminRateTable />
            </ProtectedRoute>
          }
        />
        <Route
          path="/staff/reports"
          element={
            <ProtectedRoute requiredRole={['legal_officer', 'checker']}>
              <StaffReports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/member/meetings"
          element={
            <ProtectedRoute requiredRole={['board_member', 'committee_member']}>
              <MemberMeetings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/member/meetings/:id"
          element={
            <ProtectedRoute requiredRole={['board_member', 'committee_member']}>
              <MemberMeetingDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/member/payslips"
          element={
            <ProtectedRoute requiredRole={['board_member', 'committee_member']}>
              <MemberPayslips />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
