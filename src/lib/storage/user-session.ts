import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createPasswordSalt,
  hashLocalPassword,
  localPasswordVersion,
  verifyLocalPassword,
} from "@/lib/password";
import type {
  LocalUser,
  LocalUserLoginInput,
  LocalUserRegistrationInput,
} from "@/lib/types";

const USERS_KEY = "wearabouts:local-users:v1";
const ACTIVE_USER_ID_KEY = "wearabouts:active-user-id:v1";
const LEGACY_USER_SESSION_KEY = "wearabouts:local-user:v1";

function createId(prefix: string) {
  const randomId =
    globalThis.crypto && "randomUUID" in globalThis.crypto
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return `${prefix}_${randomId}`;
}

function timestamp() {
  return new Date().toISOString();
}

function isLocalUser(value: Partial<LocalUser>): value is LocalUser {
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.email === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.lastSignedInAt === "string"
  );
}

function hasPassword(
  user: LocalUser,
): user is LocalUser & { passwordHash: string; passwordSalt: string } {
  return Boolean(user.passwordHash && user.passwordSalt);
}

async function createPasswordFields(password: string) {
  const passwordSalt = createPasswordSalt();
  const passwordHash = await hashLocalPassword(password, passwordSalt);

  return {
    passwordHash,
    passwordSalt,
    passwordVersion: localPasswordVersion,
  };
}

async function migrateLegacyUserSession(): Promise<LocalUser | undefined> {
  const rawLegacyUser = await AsyncStorage.getItem(LEGACY_USER_SESSION_KEY);

  if (!rawLegacyUser) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(rawLegacyUser) as Partial<LocalUser>;
    const now = timestamp();

    if (
      typeof parsed.id !== "string" ||
      typeof parsed.name !== "string" ||
      typeof parsed.email !== "string"
    ) {
      return undefined;
    }

    const user: LocalUser = {
      id: parsed.id,
      name: parsed.name,
      email: parsed.email.toLowerCase(),
      passwordHash: parsed.passwordHash,
      passwordSalt: parsed.passwordSalt,
      passwordVersion: parsed.passwordVersion,
      createdAt: parsed.createdAt ?? now,
      lastSignedInAt: parsed.lastSignedInAt ?? now,
    };

    await Promise.all([
      AsyncStorage.setItem(USERS_KEY, JSON.stringify([user])),
      AsyncStorage.setItem(ACTIVE_USER_ID_KEY, user.id),
      AsyncStorage.removeItem(LEGACY_USER_SESSION_KEY),
    ]);

    return user;
  } catch {
    return undefined;
  }
}

export async function getLocalUserSession(): Promise<LocalUser | undefined> {
  const [rawUsers, activeUserId] = await Promise.all([
    AsyncStorage.getItem(USERS_KEY),
    AsyncStorage.getItem(ACTIVE_USER_ID_KEY),
  ]);

  if (!rawUsers || !activeUserId) {
    return migrateLegacyUserSession();
  }

  try {
    const users = JSON.parse(rawUsers) as Partial<LocalUser>[];

    if (!Array.isArray(users)) {
      return undefined;
    }

    return users.find(
      (user): user is LocalUser => user.id === activeUserId && isLocalUser(user),
    );
  } catch {
    return undefined;
  }
}

async function listLocalUsers(): Promise<LocalUser[]> {
  const rawUsers = await AsyncStorage.getItem(USERS_KEY);

  if (!rawUsers) {
    return [];
  }

  try {
    const users = JSON.parse(rawUsers) as Partial<LocalUser>[];

    if (!Array.isArray(users)) {
      return [];
    }

    return users.filter(isLocalUser);
  } catch {
    return [];
  }
}

async function saveUsersAndActivate(users: LocalUser[], activeUserId: string) {
  await Promise.all([
    AsyncStorage.setItem(USERS_KEY, JSON.stringify(users)),
    AsyncStorage.setItem(ACTIVE_USER_ID_KEY, activeUserId),
  ]);
}

export async function registerLocalUserSession(input: LocalUserRegistrationInput) {
  const users = await listLocalUsers();
  const now = timestamp();
  const normalizedEmail = input.email.toLowerCase();
  const existingUser = users.find((user) => user.email === normalizedEmail);

  if (existingUser && hasPassword(existingUser)) {
    throw new Error("Bu e-posta ile yerel profil zaten var.");
  }

  const user: LocalUser = {
    id: existingUser?.id ?? createId("user"),
    name: input.name,
    email: normalizedEmail,
    ...(await createPasswordFields(input.password)),
    createdAt: existingUser?.createdAt ?? now,
    lastSignedInAt: now,
  };

  const nextUsers = existingUser
    ? users.map((record) => (record.id === user.id ? user : record))
    : [user, ...users];

  await saveUsersAndActivate(nextUsers, user.id);

  return user;
}

export async function signInLocalUserSession(input: LocalUserLoginInput) {
  const users = await listLocalUsers();
  const normalizedEmail = input.email.toLowerCase();
  const existingUser = users.find((user) => user.email === normalizedEmail);

  if (!existingUser) {
    throw new Error("Bu e-posta ile yerel profil bulunamadı.");
  }

  const now = timestamp();
  let user: LocalUser;

  if (!hasPassword(existingUser)) {
    user = {
      ...existingUser,
      ...(await createPasswordFields(input.password)),
      lastSignedInAt: now,
    };
  } else {
    const isPasswordValid = await verifyLocalPassword(
      input.password,
      existingUser.passwordSalt,
      existingUser.passwordHash,
    );

    if (!isPasswordValid) {
      throw new Error("Şifre hatalı.");
    }

    user = {
      ...existingUser,
      lastSignedInAt: now,
    };
  }

  await saveUsersAndActivate(
    users.map((record) => (record.id === user.id ? user : record)),
    user.id,
  );

  return user;
}

export async function clearLocalUserSession() {
  await AsyncStorage.removeItem(ACTIVE_USER_ID_KEY);
}
