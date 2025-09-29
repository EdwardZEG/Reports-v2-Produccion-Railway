/**
 * Componente para la gestión de períodos de mantenimiento preventivo (MP)
 * Permite seleccionar dispositivos, configurar fechas y crear períodos de mantenimiento
 * 
 * Funcionalidades principales:
 * - Búsqueda y selección de dispositivos
 * - Configuración de fechas de inicio y fin del período
 * - Vista previa de dispositivos seleccionados
 * - Creación y validación de períodos MP
 */
import React, { useState } from "react";
import SearchDevice from "../components/SearchDevice/SearchDevice";
import SelectPeriod from "../components/SelectPeriod/SelectPeriod";
import PreviewPeriod from "../components/PreviewPeriod/PreviewPeriod";
import "../styles/Periodos MP.css";

/**
 * Interface que define la estructura de un dispositivo
 * Contiene información básica necesaria para identificar y ubicar el dispositivo
 */
interface DeviceType {
  identifier: string;
  ubication: string;
  type: string;
  building: string;
  level: string;
}

const PeriodosMP: React.FC = () => {
  // Estados para manejar dispositivos seleccionados y fechas del período
  const [selectedDevices, setSelectedDevices] = useState<DeviceType[]>([]);
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFinal, setFechaFinal] = useState("");

  /**
   * Maneja la adición de un dispositivo a la lista de seleccionados
   * Evita duplicados verificando si el dispositivo ya existe en la lista
   * @param device - Dispositivo a agregar a la selección
   */
  const handleAddDevice = (device: DeviceType) => {
    if (!selectedDevices.some((d) => d.identifier === device.identifier)) {
      setSelectedDevices((prev) => [...prev, device]);
    }
  };

  /**
   * Maneja la creación de un nuevo período de mantenimiento preventivo
   * Realiza validaciones antes de procesar:
   * - Verifica que se hayan seleccionado fechas válidas
   * - Confirma que hay dispositivos seleccionados
   * - Limpia el formulario después de la creación exitosa
   */
  const handleCreatePeriod = () => {
    // Validación: fechas requeridas
    if (!fechaInicio || !fechaFinal) {
      alert("Seleccione las fechas de inicio y fin del periode");
      return;
    }

    // Validación: dispositivos requeridos
    if (selectedDevices.length === 0) {
      alert("No hay dispositivos seleccionados para crear el periodo");
      return;
    }

    // Preparar datos para envío al servidor
    const payload = {
      devices: selectedDevices,
      fechaInicio,
      fechaFinal,
    };

    console.log("Creando periodo:", payload);
    alert("Periodo creado correctamente");

    // Limpiar formulario después de creación exitosa
    setSelectedDevices([]);
    setFechaInicio("");
    setFechaFinal("");
  };

  return (
    <div className="periodosmp-wrapper">
      <div className="periodosmp-left">
        <h2>Administrar Periodos MP</h2>

        <SearchDevice onAddDevice={handleAddDevice} />

        <div className="periodosmp-periodContainer">
          <SelectPeriod
            fechaInicio={fechaInicio}
            fechaFinal={fechaFinal}
            setFechaInicio={setFechaInicio}
            setFechaFinal={setFechaFinal}
          />
          <button
            className="periodosmp-addButton"
            onClick={handleCreatePeriod}
          >
            Crear periodo
          </button>
        </div>
      </div>

      <div className="periodosmp-right">
        <PreviewPeriod devices={selectedDevices} />
      </div>
    </div>
  );
};

export default PeriodosMP;