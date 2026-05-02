import type { Request, Response, NextFunction } from "express";

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const expected = process.env["ADMIN_TOKEN"];
  if (!expected) {
    res.status(500).json({ error: "ADMIN_TOKEN not configured on server" });
    return;
  }
  const provided = (req.headers["x-admin-token"] as string | undefined) ?? "";
  if (provided !== expected) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}
