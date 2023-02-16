import { Account } from "next-auth";

import type {
  Adapter,
  AdapterUser,
  AdapterSession,
  VerificationToken,
} from "next-auth/adapters";

import { RedisClientType } from "redis";

import { v4 as uuid } from "uuid";

export interface RedisAdapterOptions {
  baseKeyPrefix?: string;
  accountKeyPrefix?: string;
  emailKeyPrefix?: string;
  sessionKeyPrefix?: string;
  userKeyPrefix?: string;
  verificationTokenKeyPrefix?: string;
}

export const defaultOptions: RedisAdapterOptions = {
  baseKeyPrefix: "",
  accountKeyPrefix: "user:account:",
  emailKeyPrefix: "user:email:",
  sessionKeyPrefix: "user:session:",
  userKeyPrefix: "user:",
  verificationTokenKeyPrefix: "user:token:",
}

const isoDateRE =
  /(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))/
function isDate(value: any) {
  return value && isoDateRE.test(value) && !isNaN(Date.parse(value))
}

export function hydrateDates(json: object) {
  return Object.entries(json).reduce((acc, [key, val]) => {
    acc[key] = isDate(val) ? new Date(val as string) : val
    return acc
  }, {} as any)
}

export const getObjectFromRedis = <T extends object>(client: RedisClientType, key: string) => {
  return client.get(key).then((value) => {
    if (!value)
      return null;
    try {
      const t = JSON.parse(value) as T;
      return hydrateDates(t) as T;
    } catch (error: unknown) {
      return null;
    }
  });
}

export function RedisAdapter(
  client: RedisClientType,
  options: RedisAdapterOptions = {}
): Adapter {
  const mergedOptions = Object.entries({ ...defaultOptions, ...options }).reduce((acc, [key, val]) => {
    if (key !== "baseKeyPrefix") {
      acc[key as keyof RedisAdapterOptions] = acc["baseKeyPrefix"] + val;
    }
    return acc;
  }, {baseKeyPrefix: options.baseKeyPrefix || defaultOptions.baseKeyPrefix } as RedisAdapterOptions);
  const {
    accountKeyPrefix,
    emailKeyPrefix,
    sessionKeyPrefix,
    userKeyPrefix,
    verificationTokenKeyPrefix
  } = mergedOptions;
  const saveObject = async <T>(key: string, obj: T) => {
    await client.set(key, JSON.stringify(obj));
    return obj;
  }
  const getObject = <T extends object>(key: string) => {
    return getObjectFromRedis<T>(client, key);
  }
  const setUser = (user: Omit<AdapterUser, "id">) => {
    const id = uuid();
    if (user["email"]) {
      client.set(`${emailKeyPrefix}${user["email"]}`, id);
    }
    return saveObject(userKeyPrefix + id, { ...user, id } as AdapterUser);
  }
  const deleteUser = (user: AdapterUser) => {
    if (user["email"]) {
      client.del(`${emailKeyPrefix}${user["email"]}`);
    }
    client.del(`${userKeyPrefix}${user.id}`);
    return user;
  }
  const updateUser = (user: AdapterUser) => {
    return getObject<AdapterUser>(userKeyPrefix + user.id).then(olduser =>
      saveObject(userKeyPrefix + user.id, { ...olduser, ...user } as AdapterUser));
  }
  return {
    createUser: async (user: Omit<AdapterUser, "id">) => {
      return setUser(user);
    },
    getUser: (id: string) => {
      return getObject<AdapterUser>(userKeyPrefix + id);
    },
    getUserByEmail: async (email: string) => {
      const id = await client.get(emailKeyPrefix + email);
      if (!id)
        return null;
      return getObject<AdapterUser>(userKeyPrefix + id);
    },
    updateUser: (user: Partial<AdapterUser>) => {
      if (!user.id) {
        return setUser(user);
      }
      return updateUser(user as AdapterUser);
    },
    deleteUser: (userId: string) => {
      return getObject<AdapterUser>(userKeyPrefix + userId)
        .then(user => {
          if (user) {
            return deleteUser(user);
          }
          return Promise.resolve(null);
        }).catch(() => Promise.resolve(null));
    },
    /** Using the provider id and the id of the user for a specific account, get the user. */
    getUserByAccount: (providerAccountId: Pick<Account, "provider" | "providerAccountId">) => {
      const id = `${accountKeyPrefix}:${providerAccountId.provider}:${providerAccountId.providerAccountId}`;
      return getObject<Account>(id).then(account => {
        if (account) {
          return getObject<AdapterUser>(userKeyPrefix + account.userId);
        }
        return Promise.resolve(null);
      });
    },
    linkAccount: (account: Account) => {
      const id = `${accountKeyPrefix}:${account.provider}:${account.providerAccountId}`;
      return saveObject(id, account).then(account => {
        // auto delete from redis when token expired
        client.expireAt(id, new Date(account.expires_at! * 1000));
        return account;
      }).catch(() => Promise.resolve(undefined));
    },
    unlinkAccount: (providerAccountId: Pick<Account, "provider" | "providerAccountId">) => {
      const id = `${accountKeyPrefix}:${providerAccountId.provider}:${providerAccountId.providerAccountId}`;
      return getObject<Account>(id).then(account => {
        if (account) {
          return client.del(id).then(() => account)
        }
        return Promise.resolve(undefined);
      }).catch(() => Promise.resolve(undefined));
    },
    /** Creates a session for the user and returns it. */
    createSession: (session: {
      sessionToken: string;
      userId: string;
      expires: Date;
    }) => {
      const key = `${sessionKeyPrefix}${session.sessionToken}`;
      return saveObject(key, session)
        .then(() => {
          client.expireAt(key, session.expires);
          client.expireAt(`${userKeyPrefix}${session.userId}`, session.expires);
          return session as AdapterSession;
        });
    },
    getSessionAndUser: (sessionToken: string) => {
      return getObject<AdapterSession>(`${sessionKeyPrefix}${sessionToken}`)
        .then(session => {
          if (session) {
            return getObject<AdapterUser>(userKeyPrefix + session.userId).then(user => {
              if (user) {
                return {
                  session,
                  user
                }
              }
              return {
                session,
                user: {} as AdapterUser
              }
            });
          }
          return Promise.resolve(null);
        }).catch(() => Promise.resolve(null))
    },
    updateSession: (session: Partial<AdapterSession> & Pick<AdapterSession, "sessionToken">) => {
      return getObject<AdapterSession>(`${sessionKeyPrefix}${session.sessionToken}`)
        .then(oldsession => saveObject(`${sessionKeyPrefix}${session?.sessionToken}`,
          { ...oldsession, ...session } as AdapterSession))
        .catch(() => Promise.resolve(session as AdapterSession));
    },
    /**
     * Deletes a session from the database.
     * It is preferred that this method also returns the session
     * that is being deleted for logging purposes.
     */
    deleteSession: (sessionToken: string) => {
      return getObject<AdapterSession>(`${sessionKeyPrefix}${sessionToken}`)
        .then(session => {
          if (session) {
            return client.del(`${sessionKeyPrefix}${sessionToken}`).then(() => session);
          }
          return Promise.resolve(null);
        }).catch(() => Promise.resolve(null));
    },
    createVerificationToken: (verificationToken: VerificationToken) => {
      return saveObject(`${verificationTokenKeyPrefix}${verificationToken.identifier}:${verificationToken.token}`, verificationToken);
    },
    /**
     * Return verification token from the database
     * and delete it so it cannot be used again.
     */
    useVerificationToken: ({
      identifier,
      token
    }) => {
      return getObject<VerificationToken>(`${verificationTokenKeyPrefix}${identifier}:${token}`)
        .then(verificationToken => client.del(`${verificationTokenKeyPrefix}${identifier}:${token}`)
          .then(() => verificationToken));
    }
  }
}