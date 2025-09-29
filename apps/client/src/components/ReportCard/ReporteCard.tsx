// Componente para tarjeta de reporte con funcionalidad de descarga
import React from 'react';
import './ReporteCard.css';

// Props del componente con datos del archivo de reporte
interface ReporteCardProps {
  nombreArchivo: string; // Nombre del archivo generado
  urlDescarga: string;   // URL para descargar el archivo
}

/**
 * Componente ReporteCard: Muestra información del reporte generado
 * Incluye nombre del archivo, formato y botón de descarga
 * Maneja estados de archivo disponible y no disponible
 */
const ReporteCard: React.FC<ReporteCardProps> = ({ nombreArchivo, urlDescarga }) => {
  // Verificar si hay un archivo válido para mostrar
  const hasFile = nombreArchivo && nombreArchivo !== "–" && urlDescarga && urlDescarga !== "#";

  return (
    <div className="reporte-card">
      {/* Cuerpo principal de la tarjeta con clases condicionales */}
      <div className={`reporte-card__body ${hasFile ? 'has-file' : ''}`}>
        {hasFile ? (
          // Estado con archivo disponible - muestra información y botón de descarga
          <>
            {/* Información del archivo */}
            <div className="reporte-card__info">
              <h4 className="reporte-card__label">Nombre del documento</h4>
              <span className="reporte-card__filename">{nombreArchivo}</span>
            </div>

            {/* Sección de acciones - formato y descarga */}
            <div className="reporte-card__acciones">
              <span className="reporte-card__formato">Word</span>
              <a
                href={urlDescarga}
                download={nombreArchivo}
                className="reporte-card__descargar"
                title="Descargar reporte"
              >
                <i className="bi bi-download"></i>
              </a>
            </div>
          </>
        ) : (
          // Estado sin archivo - muestra placeholders y botón deshabilitado
          <div className="reporte-card__empty-state">
            <i className="bi bi-file-earmark-text"></i>
            <div className="reporte-card__info">
              <h4 className="reporte-card__label">Nombre del documento</h4>
              <span className="reporte-card__filename no-file">Sin reporte generado</span>
            </div>
            <div className="reporte-card__acciones">
              <span className="reporte-card__formato">Word</span>
              {/* Botón de descarga deshabilitado */}
              <div className="reporte-card__descargar disabled">
                <i className="bi bi-download"></i>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReporteCard;
