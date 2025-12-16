"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const tickets_1 = require("../controllers/tickets");
const requireAuth_1 = require("../middleware/requireAuth");
const authorize_1 = require("../middleware/authorize");
const router = (0, express_1.Router)();
// Todas las rutas requieren autenticación
router.use(requireAuth_1.requireAuth);
// Rutas para tickets - accesibles por Admin, Vendedor y Cajero
router.get('/presupuesto/:id', (0, authorize_1.authorize)(['Administrador', 'Vendedor', 'Cajero']), tickets_1.getPresupuestoTicket);
router.get('/venta/:id', (0, authorize_1.authorize)(['Administrador', 'Vendedor', 'Cajero']), tickets_1.getVentaTicket);
exports.default = router;
