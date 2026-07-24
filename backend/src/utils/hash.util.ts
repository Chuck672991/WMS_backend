import * as bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

export async function hash(plainText: string): Promise<string> {
  return bcrypt.hash(plainText, SALT_ROUNDS);
}

export async function compareHash(
  plainText: string,
  hashed: string,
): Promise<boolean> {
  return bcrypt.compare(plainText, hashed);
}
