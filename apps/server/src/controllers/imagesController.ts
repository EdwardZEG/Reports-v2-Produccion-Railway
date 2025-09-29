import { NextFunction, Request, RequestHandler, Response } from 'express';
import Device from '../models/Device';
import DeviceImages from '../models/DeviceImages';

import Types from 'mongoose';
import { AppError } from '../errors/customErrors';

export const uploadImages = async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const { manualUploadReason } = req.body;
  const files = req.files as {
    WorkEvidence?: Express.Multer.File[];
    DeviceEvidence?: Express.Multer.File[];
    ViewEvidence?: Express.Multer.File[];
  };

  try {
    const device = await Device.findById(id);
    if (!device) {
      return next(new AppError("Dispositivo no encontrado", 404));
    }

    // Convierte buffer a Data URI Base64
    const toDataUri = (file?: Express.Multer.File) => {
      if (!file) return null;
      const mime = file.mimetype;
      const b64 = file.buffer.toString('base64');
      return `data:${mime};base64,${b64}`;
    };

    const newImages = await DeviceImages.create({
      IdDevice: id,
      WorkEvidence:   toDataUri(files.WorkEvidence?.[0]),
      DeviceEvidence: toDataUri(files.DeviceEvidence?.[0]),
      ViewEvidence:   toDataUri(files.ViewEvidence?.[0]),
      manualUploadReason,
    });

    device.images = device.images || [];
    device.images.push(newImages._id as import('mongoose').Schema.Types.ObjectId);

    await device.save();

    res.status(200).json(newImages);
  } catch (err) {
    next(new AppError("Error inesperado al subir imágenes", 500));
  }
};

export const registrarJustificacion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { manualUploadReason } = req.body;

    if (!manualUploadReason) {
      return res.status(400).json({ message: "Faltan datos obligatorios" });
    }

    const nuevaJustificacion = await DeviceImages.create({
      manualUploadReason
    });

    res.status(201).json({
      message: "Justificación registrada correctamente",
      justificacion: nuevaJustificacion
    });
  } catch (error) {
    console.error("Error al registrar justificación:", error);
    res.status(500).json({ message: "Error al registrar justificación" });
  }
};

