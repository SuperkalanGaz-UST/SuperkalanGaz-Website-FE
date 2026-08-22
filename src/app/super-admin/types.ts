export type GovernanceRequestType =
  | 'franchise-admin-account'
  | 'price-configuration'
  | 'sla-threshold'
  | 'branch-owner-change'
  | 'branch-account'
  | 'other';

export type GovernanceRequestStatus =
  | 'pending'
  | 'applying'
  | 'approved'
  | 'rejected'
  | 'revision-requested';

export interface GovernanceRequest {
  id: string;
  type: GovernanceRequestType;
  status: GovernanceRequestStatus;
  title: string;
  reason: string;
  risk_level: 'low' | 'medium' | 'high';
  branch_id: string | null;
  requested_by: string;
  requested_by_name: string;
  payload: Record<string, unknown>;
  submitted_at: string;
  decided_by: string | null;
  decided_by_name: string | null;
  decision_reason: string | null;
  decided_at: string | null;
  applied_at: string | null;
}

export type AuditCategory =
  | 'approval'
  | 'admin-account'
  | 'price-change'
  | 'branch-owner-change'
  | 'sla-configuration'
  | 'security';

export interface AuditEvent {
  id: string;
  category: AuditCategory;
  action: string;
  actorUserId: string;
  actorName: string;
  actorRole: 'super-admin' | 'franchise-admin' | 'system';
  affectedRecordType: string;
  affectedRecordId: string | null;
  branchId: string | null;
  governanceRequestId: string | null;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  reason: string | null;
  occurredAt: string;
}

export interface GovernanceDashboardData {
  metrics: {
    pendingApprovals: number;
    adminAccountRequests: number;
    priceChanges30Days: number;
    branchOwnerChanges: number;
  };
  priorityRequests: GovernanceRequest[];
  recentActivity: AuditEvent[];
  controls: {
    noSelfApproval: boolean;
    auditTrailActive: boolean;
    auditHistoryMutableByUsers: boolean;
  };
}

export interface AdminAccount {
  id: string;
  email: string | null;
  username: string | null;
  displayName: string | null;
  phone: string | null;
  status: 'Active' | 'Inactive';
  createdAt: string;
}

export interface SecuritySummary {
  accountHealth: {
    activeSuperAdministrators: number;
    activeFranchiseAdministrators: number;
    inactiveAccounts: number;
  };
  auditIntegrity: {
    approvalDecisionsRecorded: boolean;
    actorAndTimestampPresent: boolean;
    beforeAfterCoverage: boolean;
    eventCount: number;
  };
  signInTelemetry: { connected: boolean; message: string };
  recentActivity: AuditEvent[];
}
