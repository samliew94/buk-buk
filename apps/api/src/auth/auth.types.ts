import { BadRequestError } from "../errors";

export type Role = "admin" | "user";
export interface Principal {
  id: string;
  role: Role;
}

export function parseLoginInput(value: unknown): { password: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BadRequestError("Request body must be a JSON object");
  }
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some((key) => key !== "password")) {
    throw new BadRequestError("Only password is allowed");
  }
  if (typeof body.password !== "string" || !body.password.length) {
    throw new BadRequestError("password must be a non-empty string");
  }
  return { password: body.password };
}
