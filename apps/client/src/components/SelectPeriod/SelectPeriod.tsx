import React from "react";
import "./SelectPeriod.css";

interface SelectPeriodProps {
  fechaInicio: string;
  fechaFinal: string;
  setFechaInicio: (v: string) => void;
  setFechaFinal: (v: string) => void;
}

const SelectPeriod: React.FC<SelectPeriodProps> = ({ fechaInicio, fechaFinal, setFechaInicio, setFechaFinal }) => {
  return (
    <div>
      <label className="PeriodosMP-form-label">Período del MP</label>
      <div className="PeriodosMP-form-dates">
        <input
          type="date"
          className="PeriodosMP-form-input"
          value={fechaInicio}
          onChange={(e) => setFechaInicio(e.target.value)}
        />
        <span className="PeriodosMP-form-date-separator">a</span>
        <input
          type="date"
          className="PeriodosMP-form-input"
          value={fechaFinal}
          onChange={(e) => setFechaFinal(e.target.value)}
        />
      </div>
    </div>
  );
};

export default SelectPeriod;
