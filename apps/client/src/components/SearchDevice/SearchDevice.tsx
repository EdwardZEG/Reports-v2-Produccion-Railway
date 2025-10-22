// SearchDevice.tsx
import React, { useState } from "react";
import "./SearchDevice.css";
import { toast } from "react-toastify";
import { getBaseApiUrl } from "../../utils/apiUrl";

interface DeviceType {
  identifier: string;
  ubication: string;
  type: string;
  building: string;
  level: string;
}

// Definir props que recibe SearchDevice
interface SearchDeviceProps {
  onAddDevice: (device: DeviceType) => void;
}

const SearchDevice: React.FC<SearchDeviceProps> = ({ onAddDevice }) => {
  const [deviceData, setDeviceData] = useState<DeviceType>({
    type: "",
    ubication: "",
    identifier: "",
    building: "",
    level: "",
  });

  const [focusedField, setFocusedField] = useState<null | string>(null);
  const [suggestions, setSuggestions] = useState<any[]>([]);

  const handleDeviceChange = (field: string, value: string) => {
    setDeviceData((prev) => ({ ...prev, [field]: value }));
    if (field === "identifier" || field === "ubication") {
      buscarDispositivo(value, field);
    }
  };

  const handleSuggestionClick = async (dispositivo: any) => {
    if (!focusedField) return;

    const value = dispositivo[focusedField];
    if (!value) return;

    setDeviceData((prev) => ({ ...prev, [focusedField]: value }));
    await buscarDispositivo(value, focusedField as "identifier" | "ubication");
    setSuggestions([]);
    setFocusedField(null);
  };

  const rellenarCampos = (match: any) => {
    setDeviceData({
      type: match.type || "",
      ubication: match.ubication || "",
      identifier: match.identifier || "",
      building: match.building || "",
      level: match.level || "",
    });
    toast.success("Dispositivo encontrado y campos rellenados");
  };

  const buscarDispositivo = async (
    value: string,
    campo: "identifier" | "ubication"
  ) => {
    if (!value.trim()) {
      setSuggestions([]);
      return;
    }
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${getBaseApiUrl()}/device-catalog-search?${campo}=${encodeURIComponent(
          value
        )}`,
        {
          headers: {
            Authorization: token ? `Bearer ${token}` : "",
          },
        }
      );
      if (!res.ok) return;
      const response = await res.json();
      const data = response.data || []; // Extraer el array de data
      setSuggestions(data);

      const match = data.find(
        (item: any) =>
          item[campo]?.toLowerCase().trim() === value.toLowerCase().trim()
      );
      if (match) rellenarCampos(match);
    } catch (err) {
      console.error("Error al buscar dispositivo:", err);
      toast.error("Error al buscar el dispositivo");
    }
  };

  // Función para agregar el dispositivo al padre
  const handleAddClick = () => {
    onAddDevice(deviceData);
    // Limpiar inputs después de agregar
    setDeviceData({
      type: "",
      ubication: "",
      identifier: "",
      building: "",
      level: "",
    });
  };

  return (
    <div className="PeriodosMP-container">
      <form className="PeriodosMP-searchForm">
        <h2 className="PeriodosMP-searchForm__title">Busque su dispositivo</h2>

        {["identifier", "ubication", "type", "building", "level"].map(
          (field) => (
            <div className="PeriodosMP-formGroup" key={field}>
              <input
                type="text"
                placeholder={field}
                value={deviceData[field as keyof DeviceType]}
                onChange={(e) => handleDeviceChange(field, e.target.value)}
                disabled={field !== "identifier"}
                style={{
                  backgroundColor:
                    field !== "identifier" ? "#f0f0f0" : "white",
                  color: field !== "identifier" ? "#888" : "black",
                  cursor: field !== "identifier" ? "not-allowed" : "text",
                }}
                onFocus={() => setFocusedField(field)}
                onBlur={() => setTimeout(() => setSuggestions([]), 200)}
                required
              />
              {(field === "identifier" || field === "ubication") &&
                focusedField === field &&
                suggestions.length > 0 && (
                  <ul className="PeriodosMP-autocompleteList">
                    {suggestions.map((s, i) => (
                      <li key={i} onMouseDown={() => handleSuggestionClick(s)}>
                        {s[field]}
                      </li>
                    ))}
                  </ul>
                )}
            </div>
          )
        )}

        <button
          type="button"
          className="PeriodosMP-addButton"
          onClick={handleAddClick}
        >
          Agregar a lista
        </button>
      </form>
    </div>
  );
};

export default SearchDevice;
