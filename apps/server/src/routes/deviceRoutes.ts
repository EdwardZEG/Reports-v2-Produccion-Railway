import { Router } from 'express';
import { createOrGetDevice, getDevices, getDeviceById, updateDevice, migrateDeviceIds } from '../controllers/dataDeviceController';
import { uploadImages, registrarJustificacion } from '../controllers/imagesController';
import multer from 'multer';
import { upload } from '../middlewares/upload';
const router = Router();

function asyncHandler(fn: any) {
  return function (req: any, res: any, next: any) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
router.post('/devices', asyncHandler(createOrGetDevice));
router.get('/devices', getDevices);
router.get('/devices/:id', asyncHandler(getDeviceById));
router.put('/devices/:id', asyncHandler(updateDevice));

// Endpoint temporal para migrar IDs de string a ObjectId
router.post('/devices/migrate-ids', asyncHandler(migrateDeviceIds));

router.post('/devices/:id/images',
  upload.fields([
    { name: 'WorkEvidence', maxCount: 1 },
    { name: 'DeviceEvidence', maxCount: 1 },
    { name: 'ViewEvidence', maxCount: 1 },
  ]),
  asyncHandler(uploadImages)
);

router.post('/device-images/justificacion', asyncHandler(registrarJustificacion));

export default router;
