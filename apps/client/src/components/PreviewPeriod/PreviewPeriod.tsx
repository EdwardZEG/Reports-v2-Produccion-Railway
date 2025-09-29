import React from "react";
import "./PreviewPeriod.css";

interface Device {
  identifier: string;
  ubication: string;
  type: string;
  building: string;
  level: string;
}

interface PreviewPeriodProps {
  devices: Device[];
}

const PreviewPeriod: React.FC<PreviewPeriodProps> = ({ devices }) => {
  return (
    <div className="PeriodosMP-tableWrapper">
      <h2 className="vista-previa__titulo">Dispositivos seleccionados</h2>
      <table className="PeriodosMP-table">
        <thead>
          <tr>
            <th>Identificador</th>
            <th>Ubicación</th>
            <th>Tipo</th>
            <th>Edificio</th>
            <th>Nivel</th>
          </tr>
        </thead>
        <tbody>
          {devices.map((device, index) => (
            <tr key={index}>
              <td>{device.identifier}</td>
              <td>{device.ubication}</td>
              <td>{device.type}</td>
              <td>{device.building}</td>
              <td>{device.level}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PreviewPeriod;
