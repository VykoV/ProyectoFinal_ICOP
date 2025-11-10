import { Router } from "express";
import * as ctl from "../controllers/compras";
import { requireAuth } from "../middleware/requireAuth";
import { authorize } from "../middleware/authorize";

const r = Router();

r.get("/", requireAuth, authorize(["Administrador"]), ctl.list);
r.get("/:id", requireAuth, authorize(["Administrador"]), ctl.getById);
r.post("/", requireAuth, authorize(["Administrador"]), ctl.create);
r.put("/:id", requireAuth, authorize(["Administrador"]), ctl.update);
r.delete("/:id", requireAuth, authorize(["Administrador"]), ctl.remove);
r.post("/:id/confirmar", requireAuth, authorize(["Administrador"]), ctl.confirmar);

export default r;