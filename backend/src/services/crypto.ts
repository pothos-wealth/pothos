import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
        throw new Error("ENCRYPTION_KEY environment variable is required");
    }
    const buf = Buffer.from(key, "hex");
    if (buf.length !== 32) {
        throw new Error("ENCRYPTION_KEY must be a 32-byte hex string (64 hex characters)");
    }
    return buf;
}

export function validateEncryptionKey(): void {
    getKey(); // throws if invalid
}

// Returns "iv:authTag:ciphertext" (all base64)
export function encrypt(plaintext: string): string {
    const key = getKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);

    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return [iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(
        ":"
    );
}

// Parses "iv:authTag:ciphertext" and decrypts
export function decrypt(stored: string): string {
    const parts = stored.split(":");
    if (parts.length !== 3) {
        throw new Error("Invalid encrypted value format");
    }

    const [ivB64, authTagB64, encryptedB64] = parts;
    const key = getKey();
    const iv = Buffer.from(ivB64, "base64");
    const authTag = Buffer.from(authTagB64, "base64");
    const encrypted = Buffer.from(encryptedB64, "base64");

    if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
        throw new Error("Invalid encrypted value: wrong iv or authTag length");
    }

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
