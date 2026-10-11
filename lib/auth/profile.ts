export type ProfileIdentity = {
  tokenIdentifier: string;
  subject: string;
  email?: string;
  name?: string;
  pictureUrl?: string;
};

export function profileFieldsFromIdentity(identity: ProfileIdentity) {
  return {
    tokenIdentifier: identity.tokenIdentifier,
    clerkUserId: identity.subject,
    email: identity.email,
    name: identity.name,
    imageUrl: identity.pictureUrl,
  };
}

export function shouldBootstrapProfile(isAuthenticated: boolean) {
  return isAuthenticated;
}
