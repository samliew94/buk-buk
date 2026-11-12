import { Hono } from "hono";
import type { AppEnv } from "../dependencies";
import { BadRequestError } from "../errors";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { parseLoginInput } from "./auth.types";

export const auth = new Hono<AppEnv>();
auth.use("*", async (c, next) => {
  c.header("Cache-Control", "no-store");
  await next();
});
auth.post("/login", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new BadRequestError("Invalid JSON body");
  }
  const { password } = parseLoginInput(body);
  return c.json(c.get("dependencies").authService.login(password));
});
auth.get("/me", authenticate, (c) => c.json(c.get("principal")));
auth.get("/admin", authenticate, authorize("admin"), (c) =>
  c.json(c.get("principal")),
);
