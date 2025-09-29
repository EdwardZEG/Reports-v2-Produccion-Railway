import { Router } from 'express';

const router = Router();

// Temporalmente usando rutas simples para las pruebas de migración
router.get('/search', async (req, res) => {
  try {
    // Importar dinámicamente para evitar problemas de circular imports
    const { searchDevicesForAutocomplete } = await import('../controllers/deviceCatalogController');
    await searchDevicesForAutocomplete(req, res, () => { });
  } catch (error) {
    res.status(500).json({ error: 'Error en searchDevicesForAutocomplete' });
  }
});

router.get('/', async (req, res) => {
  try {
    const { getCatalogDevices } = await import('../controllers/deviceCatalogController');
    await getCatalogDevices(req, res, () => { });
  } catch (error) {
    res.status(500).json({ error: 'Error en getCatalogDevices' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { createOrGetCatalogDevice } = await import('../controllers/deviceCatalogController');
    await createOrGetCatalogDevice(req, res, () => { });
  } catch (error) {
    res.status(500).json({ error: 'Error en createOrGetCatalogDevice' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { getDeviceById } = await import('../controllers/deviceCatalogController');
    await getDeviceById(req, res, () => { });
  } catch (error) {
    res.status(500).json({ error: 'Error en getDeviceById' });
  }
});

export default router;