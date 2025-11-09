import { Router } from "express";
import * as ctl from "../controllers/proveedores";
import { requireAuth } from "../middleware/requireAuth";
import { authorize } from "../middleware/authorize";

const r = Router();

r.get("/select", requireAuth, ctl.selectList);
r.get("/", requireAuth, ctl.list);
r.get("/:id", requireAuth, ctl.getById);
r.post("/", requireAuth, authorize(["Administrador"]), ctl.create);
r.put("/:id", requireAuth, authorize(["Administrador"]), ctl.update);
r.delete("/:id", requireAuth, authorize(["Administrador"]), ctl.remove);

// vínculo con productos
r.get("/:id/productos", requireAuth, ctl.listProductosByProveedor);

export default r;