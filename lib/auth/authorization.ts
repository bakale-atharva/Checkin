export enum AuthorizationErrorCode {
  Unauthenticated = "UNAUTHENTICATED",
  Forbidden = "FORBIDDEN",
  ProfileNotFound = "PROFILE_NOT_FOUND",
}

const authorizationErrors = {
  [AuthorizationErrorCode.Unauthenticated]:
    "You must be signed in to perform this action.",
  [AuthorizationErrorCode.Forbidden]:
    "You do not have permission to perform this action.",
  [AuthorizationErrorCode.ProfileNotFound]:
    "Your Checkin profile has not been created yet.",
} as const;

export function authorizationError(code: AuthorizationErrorCode) {
  return {
    code,
    message: authorizationErrors[code],
  };
}
