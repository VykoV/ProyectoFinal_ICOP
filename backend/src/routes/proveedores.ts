import { Router } from "express";
import * as ctl from "../controllers/proveedores";
import { requireAuth } from "../middleware/requireAuth";
import { authorize } from "../middleware/authorize";

const r = Router();

r.get("/select", requireAuth, authorize(["Administrador"]), ctl.selectList);
r.get("/", requireAuth, authorize(["Administrador"]), ctl.list);
r.get("/:id", requireAuth, authorize(["Administrador"]), ctl.getById);
r.post("/", requireAuth, authorize(["Administrador"]), ctl.create);
r.put("/:id", requireAuth, authorize(["Administrador"]), ctl.update);
r.delete("/:id", requireAuth, authorize(["Administrador"]), ctl.remove);

// vínculo con productos
r.get("/:id/productos", requireAuth, authorize(["Administrador"]), ctl.listProductosByProveedor);

export default r;