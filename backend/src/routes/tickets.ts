import { Router } from 'express';
import { getPresupuestoTicket, getVentaTicket } from '../controllers/tickets';
import { requireAuth } from '../middleware/requireAuth';
import { authorize } from '../middleware/authorize';

const router = Router();

// Todas las rutas requieren autenticación
router.use(requireAuth);

// Rutas para tickets - accesibles por Admin, Vendedor y Cajero
router.get(
  '/presupuesto/:id',
  authorize(['Administrador', 'Vendedor', 'Cajero']),
  getPresupuestoTicket
);

router.get(
  '/venta/:id',
  authorize(['Administrador', 'Vendedor', 'Cajero']),
  getVentaTicket
);

export default router;
