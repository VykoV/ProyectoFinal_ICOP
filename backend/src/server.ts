import express, { Request, Response } from "express";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors({ origin: ["http://localhost:5173"], credentials: true }));

app.get("/api/health", (_req: Request, res: Response) => res.json({ ok: true }));

app.listen(4000, () => console.log("API listening on http://localhost:4000"));
