// Componente para vista previa de dispositivos con modal de imágenes
import React, { useState } from "react";
import { createPortal } from "react-dom";
import "./PreviewDoc.css";

// Interface para objetos de imagen con evidencias fotográficas
interface ImageObj {
  _id: string;
  WorkEvidence: string;   // Imagen del trabajo realizado
  DeviceEvidence: string; // Imagen del equipo/dispositivo
  ViewEvidence: string;   // Imagen del área donde se realizó el trabajo
}

// Props del componente con array de dispositivos y sus datos
interface VistaPreviaProps {
  dispositivos: {
    _id: string;
    type: string;        // Tipo de dispositivo (cámara, router, etc.)
    ubication: string;   // Ubicación específica
    identifier: string;  // Identificador único del dispositivo
    building: string;    // Edificio donde se encuentra
    level: string;       // Nivel/piso del edificio
    note: string;        // Notas adicionales del técnico
    images: ImageObj[];  // Array de evidencias fotográficas
    createdAt?: string;  // Fecha de creación del reporte
    colaborador?: {      // Información del usuario que hizo el reporte (reportes individuales)
      _id: string;
      nombre: string;
      apellido_paterno?: string;
      apellido_materno?: string;
      correo?: string;
      rol?: string;
    };
    esColaborativo?: boolean; // Indica si es un reporte colaborativo
    tipoParticipacion?: {     // Array de colaboradores (reportes colaborativos)
      colaborador: {
        _id: string;
        nombre: string;
        apellido_paterno?: string;
        apellido_materno?: string;
      };
      rol: 'principal' | 'colaborador';
      descripcion?: string;
    }[];
  }[];
  isLoading?: boolean;   // Estado de carga
}

const VistaPrevia: React.FC<VistaPreviaProps> = ({ dispositivos, isLoading = false }) => {
  // Verificar si hay dispositivos para mostrar
  const hasDevices = dispositivos && dispositivos.length > 0;

  // Logs solo para debug - remover en producción
  // console.log('🎯 PreviewDoc ejecutándose con dispositivos:', dispositivos?.length || 0);

  // Datos optimizados sin logs costosos para mejor rendimiento

  // Estados para control del modal de imágenes
  const [modalImage, setModalImage] = useState<string | null>(null); // URL de la imagen a mostrar
  const [modalAlt, setModalAlt] = useState<string>("");              // Texto alternativo para accesibilidad

  // Función helper para formatear información de colaboradores
  const formatearColaboradores = (dispositivo: any) => {
    // Si es un reporte colaborativo
    if (dispositivo.esColaborativo) {
      const participantes = [];

      // SIEMPRE incluir al colaborador principal (responsable) AL PRINCIPIO
      if (dispositivo.colaborador && dispositivo.colaborador.nombre) {
        const responsable = `${dispositivo.colaborador.nombre} ${dispositivo.colaborador.apellido_paterno || ''}`.trim();
        participantes.push(responsable);
      }

      // Agregar colaboradores adicionales (excluyendo al responsable si aparece duplicado)
      if (dispositivo.colaboradores && dispositivo.colaboradores.length > 0) {
        const responsableId = dispositivo.colaborador?._id;

        dispositivo.colaboradores.forEach((colaborador: any) => {
          if (colaborador && colaborador.nombre && colaborador._id !== responsableId) {
            const nombreColaborador = `${colaborador.nombre} ${colaborador.apellido_paterno || ''}`.trim();
            participantes.push(nombreColaborador);
          }
        });
      }

      return {
        esTrabajo: 'colaborativo',
        participantes: participantes
      };
    }

    // Si es un reporte individual (solo colaborador principal)
    if (dispositivo.colaborador) {
      const nombreCompleto = `${dispositivo.colaborador.nombre} ${dispositivo.colaborador.apellido_paterno || ''}`.trim();
      return {
        esTrabajo: 'individual',
        participantes: [nombreCompleto]
      };
    }

    return null;
  };

  // Función para abrir el modal con una imagen específica
  const openImageModal = (imageSrc: string, altText: string) => {
    setModalImage(imageSrc);
    setModalAlt(altText);
  };

  // Función para cerrar el modal de imagen
  const closeImageModal = () => {
    setModalImage(null);
    setModalAlt("");
  };

  return (
    <div className="vista-previa">
      {/* Contenedor principal de la tabla con scroll optimizado */}
      <div className="vista-previa__tabla-wrapper">
        {hasDevices ? (
          // Tabla principal con datos de dispositivos y evidencias fotográficas
          <table className="vista-previa__tabla">
            <thead>
              <tr>
                {/* Columna de datos del dispositivo - 31.5% del ancho */}
                <th>
                  <i className="bi bi-info-circle me-2"></i>
                  Datos
                </th>
                {/* Columnas de imágenes - 22.83% cada una para distribución equilibrada */}
                <th>
                  <i className="bi bi-geo-alt me-2"></i>
                  Foto del área
                </th>
                <th>
                  <i className="bi bi-gear me-2"></i>
                  Foto del equipo
                </th>
                <th>
                  <i className="bi bi-tools me-2"></i>
                  Foto del trabajo
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Mapear dispositivos y sus imágenes asociadas */}
              {dispositivos.map((d) => {
                return d.images.map((imgObj, index) => {
                  return (
                    <tr key={`${d._id}-${index}`}>
                      {/* Columna de datos del dispositivo con información técnica */}
                      <td>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <strong>{d.type}</strong>
                          {d.createdAt && (
                            <span style={{ color: '#000000', fontWeight: 'bold', fontSize: '0.7rem' }}>
                              {new Date(d.createdAt).toLocaleDateString('es-ES')}
                            </span>
                          )}
                        </div>
                        {(() => {
                          const infoColaboradores = formatearColaboradores(d);
                          if (!infoColaboradores) return null;

                          return (
                            <div className="vista-previa__colaboradores-info">
                              <div className="vista-previa__colaborador vista-previa__colaborador--principal">
                                <strong>Realizado por:</strong>
                                <b>{infoColaboradores.participantes.join(', ')}</b>
                              </div>
                            </div>
                          );
                        })()}
                        {d.identifier} — {d.ubication}<br />
                        <strong>Edificio:</strong> {d.building}<br />
                        <strong>Nivel:</strong> {d.level}<br />
                        <strong>Nota:</strong> {d.note || 'Sin notas'}
                      </td>
                      {/* Columna de imagen del área - clickeable para modal */}
                      <td>
                        {imgObj?.ViewEvidence ? (
                          <img
                            src={imgObj.ViewEvidence}
                            alt="Área"
                            className="vista-previa__img vista-previa__img--clickable"
                            title="Ver mejor"
                            onClick={() => openImageModal(imgObj.ViewEvidence, "Imagen del área")}
                          />
                        ) : (
                          // Placeholder cuando no hay imagen disponible
                          <div className="vista-previa__img-placeholder">
                            <i className="bi bi-image"></i>
                            <span>Sin ViewEvidence</span>
                          </div>
                        )}
                      </td>
                      {/* Columna de imagen del equipo - clickeable para modal */}
                      <td>
                        {imgObj?.DeviceEvidence ? (
                          <img
                            src={imgObj.DeviceEvidence}
                            alt="Equipo"
                            className="vista-previa__img vista-previa__img--clickable"
                            title="Ver mejor"
                            onClick={() => openImageModal(imgObj.DeviceEvidence, "Imagen del equipo")}
                          />
                        ) : (
                          <div className="vista-previa__img-placeholder">
                            <i className="bi bi-image"></i>
                            <span>Sin DeviceEvidence</span>
                          </div>
                        )}
                      </td>
                      {/* Columna de imagen del trabajo - clickeable para modal */}
                      <td>
                        {imgObj?.WorkEvidence ? (
                          <img
                            src={imgObj.WorkEvidence}
                            alt="Trabajo"
                            className="vista-previa__img vista-previa__img--clickable"
                            title="Ver mejor"
                            onClick={() => openImageModal(imgObj.WorkEvidence, "Imagen del trabajo")}
                          />
                        ) : (
                          <div className="vista-previa__img-placeholder">
                            <i className="bi bi-image"></i>
                            <span>Sin WorkEvidence</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                });
              })}
            </tbody>
          </table>
        ) : (
          // Estado vacío cuando no hay dispositivos para mostrar
          <div className="vista-previa__empty-state">
            <i className={isLoading ? "bi bi-arrow-clockwise loading-spin" : "bi bi-search"}></i>
            <p>{isLoading ? "Buscando dispositivos disponibles" : "Realiza una búsqueda para ver los dispositivos"}</p>
          </div>
        )}
      </div>

      {/* Modal para vista ampliada de imágenes - renderizado usando portal */}
      {modalImage && createPortal(
        <div className="image-modal" onClick={closeImageModal}>
          {/* Backdrop del modal - clicking cierra el modal */}
          <div className="image-modal__backdrop"></div>
          {/* Contenido del modal - previene propagación del click */}
          <div className="image-modal__content" onClick={(e) => e.stopPropagation()}>
            {/* Botón de cerrar con icono Bootstrap */}
            <button
              className="image-modal__close"
              onClick={closeImageModal}
              title="Cerrar"
            >
              <i className="bi bi-x-lg"></i>
            </button>
            {/* Imagen principal del modal con tamaño optimizado */}
            <img
              src={modalImage}
              alt={modalAlt}
              className="image-modal__img"
            />
            {/* Caption/descripción de la imagen para contexto */}
            <p className="image-modal__caption">{modalAlt}</p>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default VistaPrevia;
