/**
 * Authentication and Authorization module
 *
 * This module provides the core auth functionality for the RBAC system:
 * - Password hashing and validation
 * - Session management
 * - Authorization (RBAC)
 */

export {
  type AuthResult,
  authorize,
  authorizeMinimumRole,
  getRolesAtOrAbove,
  getUserOrganizations,
  getUserRole,
  hasMinimumRole,
  hasRole,
  isInternalAdmin,
  isMemberOf,
  ROLE_HIERARCHY,
} from "./authorization";
export {
  hashPassword,
  type PasswordValidationResult,
  passwordSchema,
  validatePassword,
  verifyPassword,
} from "./password";
export {
  cleanupExpiredSessions,
  createSession,
  deleteSession,
  deleteUserSessions,
  getSessionById,
  getSessionWithUser,
  getUserSessions,
  refreshSession,
  SESSION_COOKIE_OPTIONS,
  type SessionData,
  type SessionWithUser,
  switchOrganization,
} from "./session";
