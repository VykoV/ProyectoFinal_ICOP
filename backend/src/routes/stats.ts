import { Router } from "express";
import * as ctl from "../controllers/stats";
import { requireAuth } from "../middleware/requireAuth";
import { authorize } from "../middleware/authorize";

const r = Router();

// Middleware global para estas rutas
r.use(requireAuth);
r.use(authorize(["Administrador", "Contador"]));

r.get("/rotation", ctl.getStockRotation);
r.get("/stagnant", ctl.getStagnantProducts);
r.get("/margin", ctl.getEstimatedMargin);
r.get("/inactive-clients", ctl.getInactiveClients);
r.get("/provider-dependency", ctl.getProviderDependency);
r.get("/budget-conversion", ctl.getBudgetConversion);

export default r;
