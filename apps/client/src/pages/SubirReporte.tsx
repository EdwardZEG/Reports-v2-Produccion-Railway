import React, { useEffect, useRef, useState } from "react";
import "../styles/SubirReporte.css";
import { toast } from "react-toastify";
import { jwtDecode } from "jwt-decode";

const SubirReporte: React.FC = () => {
  const [deviceData, setDeviceData] = useState({
    type: "",
    ubication: "",
    identifier: "",
    building: "",
    level: "",
    note: "",
  });

  // Estado para almacenar el ID del dispositivo cuando se selecciona del autocompletado
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

  // Estados para almacenar IDs necesarios para actualizar el estado del dispositivo
  const [selectedPeriodoId, setSelectedPeriodoId] = useState<string | null>(null);
  const [selectedColaboradorId, setSelectedColaboradorId] = useState<string | null>(null);

  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [focusedField, setFocusedField] = useState<null | string>(null);

  const [especialidades, setEspecialidades] = useState<
    { _id: string; nombre: string }[]
  >([]);
  const [especialidadSeleccionada, setEspecialidadSeleccionada] = useState("");

  const [manualUpload, setManualUpload] = useState(false);
  const [manualUploadReason, setManualUploadReason] = useState("");
  const [nombreUsuario, setNombreUsuario] = useState("");
  const [rolUsuario, setRolUsuario] = useState("");

  // Estados para modo de edición


  useEffect(() => {
    const nombre = localStorage.getItem("nombre");
    const rol = localStorage.getItem("rol");
    setNombreUsuario(nombre || "");
    setRolUsuario(rol || "");

    // Autocompletar campos si viene desde Mis Dispositivos
    const selectedDevice = localStorage.getItem('selectedDeviceForReport');
    console.log('🔍 Verificando localStorage selectedDeviceForReport:', selectedDevice);

    if (selectedDevice) {
      try {
        const deviceInfo = JSON.parse(selectedDevice);
        console.log('📝 Device info parseado:', deviceInfo);

        // Ya no hay modo de edición - solo creación de reportes

        console.log('📝 Obteniendo datos del dispositivo con ID:', deviceInfo.deviceId);

        // Obtener los datos frescos del dispositivo desde la API
        const fetchDeviceData = async () => {
          try {
            const token = localStorage.getItem('token');
            const response = await fetch(`http://localhost:4000/api/device-catalog/${deviceInfo.deviceId}`, {
              headers: {
                Authorization: token ? `Bearer ${token}` : '',
              },
            });

            if (response.ok) {
              const result = await response.json();
              const device = result.data;

              console.log('✅ Datos del dispositivo obtenidos:', device);

              // Autocompletar el formulario con los datos actualizados
              setDeviceData({
                type: device.type || "",
                ubication: device.ubication || "",
                identifier: device.identifier || "",
                building: device.building || "",
                level: device.level || "",
                note: device.note || "",
              });

              // Establecer los IDs necesarios para actualización
              setSelectedDeviceId(deviceInfo.deviceId);
              setSelectedPeriodoId(deviceInfo.periodoId);
              setSelectedColaboradorId(deviceInfo.colaboradorId);

              console.log('✅ IDs configurados para completado:', {
                selectedDeviceId: deviceInfo.deviceId,
                selectedPeriodoId: deviceInfo.periodoId,
                selectedColaboradorId: deviceInfo.colaboradorId
              });

              // Solo modo de creación de reportes
              toast.success(`Formulario autocompletado para ${device.identifier}`);

              // Limpiar el localStorage DESPUÉS de configurar los valores
              localStorage.removeItem('selectedDeviceForReport');

            } else {
              console.error('❌ Error al obtener datos del dispositivo:', response.status);
              toast.error('Error al cargar datos del dispositivo');
            }
          } catch (error) {
            console.error('❌ Error en la petición:', error);
            toast.error('Error al conectar con el servidor');
          }
        };

        fetchDeviceData();

      } catch (error) {
        console.error('❌ Error al parsear datos del dispositivo:', error);
      }
    }
  }, []);

  const [evidencias, setEvidencias] = useState<(File | null)[]>([
    null,
    null,
    null,
  ]);
  const [previewList, setPreviewList] = useState<
    { datos: string; evidencias: string[] }[]
  >([]);
  const [showCameraIndex, setShowCameraIndex] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  const handleDeviceChange = (field: string, value: string) => {
    setDeviceData((prev) => ({ ...prev, [field]: value }));

    if (field === "identifier" || field === "ubication") {
      buscarDispositivo(value, field);
    }
  };

  const handleFileChange = (index: number, file: File | null) => {
    setEvidencias((prev) => {
      const updated = [...prev];
      updated[index] = file;
      return updated;
    });
  };

  const handleRemoveFile = (index: number) => {
    setEvidencias((prev) => {
      const updated = [...prev];
      updated[index] = null;
      return updated;
    });
  };

  const startCamera = async (index: number) => {
    setShowCameraIndex(index);
    try {
      const constraints = {
        video: { facingMode: { exact: "environment" } }, // intenta cámara trasera
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      streamRef.current = stream;
    } catch (err) {
      console.warn(
        "No se pudo acceder a la cámara trasera, usando la predeterminada:",
        err
      );
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
          videoRef.current.play();
        }
        streamRef.current = fallbackStream;
      } catch (fallbackErr) {
        console.error("No se pudo acceder a ninguna cámara:", fallbackErr);
        alert("No se pudo acceder a la cámara de tu dispositivo.");
        setShowCameraIndex(null);
      }
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    setShowCameraIndex(null);
  };

  const capturePhoto = () => {
    const index = showCameraIndex;
    if (videoRef.current && canvasRef.current && index !== null) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `evidencia_${index + 1}.jpg`, {
            type: "image/jpeg",
          });
          handleFileChange(index, file);
          stopCamera();
        }
      }, "image/jpeg");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!evidencias.every((f) => f)) {
      alert("Debes subir las 3 evidencias");
      return;
    }

    if (!especialidadSeleccionada) {
      alert("Debes seleccionar una especialidad");
      return;
    }

    const token = localStorage.getItem("token");
    let colaboradorId = null;

    if (token) {
      try {
        const decoded: any = jwtDecode(token);
        colaboradorId = decoded.userId;
      } catch (err) {
        console.error("Error al decodificar el token:", err);
      }
    }
    if (!colaboradorId) {
      alert("No se pudo obtener el ID del colaborador desde el token");
      return;
    }

    // Solo modo de creación de reportes - se eliminó la funcionalidad de edición

    // *** MODO NORMAL (CREAR NUEVO REPORTE) ***
    console.log('📝 === MODO NORMAL - CREAR NUEVO REPORTE ===');

    const dataToSend = {
      ...deviceData,
      colaborador: colaboradorId,
      especialidad: especialidadSeleccionada,
    };

    try {
      let idDevice;
      let resDevice;

      if (selectedDeviceId) {
        // Actualizar dispositivo existente
        resDevice = await fetch(`http://localhost:4000/api/devices/${selectedDeviceId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: token ? `Bearer ${token}` : "",
          },
          body: JSON.stringify(dataToSend),
        });

        const deviceResp = await resDevice.json();
        if (!resDevice.ok)
          throw new Error(
            deviceResp.message || "Error al actualizar el dispositivo"
          );
        idDevice = selectedDeviceId;
      } else {
        // Crear nuevo dispositivo
        resDevice = await fetch("http://localhost:4000/api/devices", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: token ? `Bearer ${token}` : "",
          },
          body: JSON.stringify(dataToSend),
        });

        const deviceResp = await resDevice.json();
        if (!resDevice.ok)
          throw new Error(
            deviceResp.message || "Error al registrar el dispositivo"
          );
        idDevice = deviceResp.device._id;
      }

      const formImages = new FormData();
      formImages.append("WorkEvidence", evidencias[0] as Blob);
      formImages.append("DeviceEvidence", evidencias[1] as Blob);
      formImages.append("ViewEvidence", evidencias[2] as Blob);
      formImages.append("nombre", nombreUsuario);
      formImages.append("rol", rolUsuario);

      if (manualUpload) {
        if (!manualUploadReason.trim()) {
          alert("Debes justificar la carga manual");
          return;
        }
        formImages.append("manualUploadReason", manualUploadReason.trim());
      }

      await fetch(`http://localhost:4000/api/devices/${idDevice}/images`, {
        method: "POST",
        body: formImages,
      });

      const urls = evidencias.map((file) =>
        file ? URL.createObjectURL(file) : ""
      );
      setPreviewList((prev) => [
        ...prev,
        {
          datos: `${deviceData.identifier} - ${deviceData.ubication} - Piso: ${deviceData.level}`,
          evidencias: urls,
        },
      ]);

      setDeviceData({
        type: "",
        ubication: "",
        identifier: "",
        building: "",
        level: "",
        note: "",
      });
      setEvidencias([null, null, null]);
      setEspecialidadSeleccionada("");
      setManualUploadReason("");
      console.log('🔍 Verificando si debe completar dispositivo:', {
        selectedDeviceId,
        selectedPeriodoId,
        selectedColaboradorId,
        shouldComplete: !!(selectedDeviceId && selectedPeriodoId && selectedColaboradorId)
      });

      // Si viene desde Mis Dispositivos, actualizar el estado del dispositivo en el período MP
      console.log('🔍 DEBUG COMPLETO - Datos disponibles para completado:', {
        selectedDeviceId,
        selectedPeriodoId,
        selectedColaboradorId,
        deviceData,
        tieneDeviceId: !!selectedDeviceId,
        tienePeriodoId: !!selectedPeriodoId,
        tieneColaboradorId: !!selectedColaboradorId,
        condicionCompleta: !!(selectedDeviceId && selectedPeriodoId && selectedColaboradorId)
      });

      if (selectedDeviceId && selectedPeriodoId && selectedColaboradorId) {
        try {
          console.log('🔄 INICIANDO completado de dispositivo en período MP:', {
            periodoId: selectedPeriodoId,
            deviceCatalogId: selectedDeviceId, // Este es el deviceCatalog._id
            colaboradorId: selectedColaboradorId
          });

          const token = localStorage.getItem("token");
          const url = `http://localhost:4000/api/periodos-mp/${selectedPeriodoId}/complete-device/${selectedDeviceId}/${selectedColaboradorId}`;

          console.log('📡 URL de completado:', url);
          console.log('🔑 Token disponible:', !!token);

          const completeResponse = await fetch(url, {
            method: 'PATCH',
            headers: {
              Authorization: token ? `Bearer ${token}` : '',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              deviceReportId: idDevice, // Pasar el ID del nuevo reporte creado
              notas: `Reporte completado: ${deviceData.identifier} - ${deviceData.ubication}`
            })
          });

          console.log('📨 Respuesta de completado:', completeResponse.status, completeResponse.statusText);

          if (completeResponse.ok) {
            const result = await completeResponse.json();
            console.log('✅ Dispositivo marcado como completado - respuesta:', result);
            toast.success('¡Dispositivo completado exitosamente en el período MP!');

            // Disparar evento para actualizar la lista de dispositivos
            const updateEvent = new CustomEvent('deviceCompleted', {
              detail: {
                deviceId: selectedDeviceId,
                periodoId: selectedPeriodoId,
                colaboradorId: selectedColaboradorId
              }
            });
            window.dispatchEvent(updateEvent);
          } else {
            const errorData = await completeResponse.text();
            console.error('❌ Error al completar dispositivo:', completeResponse.status, errorData);
            console.error('❌ Respuesta completa:', errorData);
            toast.warning(`Reporte subido, pero error al actualizar estado: ${completeResponse.status}`);
          }
        } catch (error) {
          console.error('❌ EXCEPCIÓN en completado:', error);
          toast.warning('Reporte subido, pero error de conexión al actualizar estado');
        }
      } else {
        console.log('⚠️ NO se completará el dispositivo - faltan datos:', {
          selectedDeviceId: selectedDeviceId || 'FALTA',
          selectedPeriodoId: selectedPeriodoId || 'FALTA',
          selectedColaboradorId: selectedColaboradorId || 'FALTA',
          tieneDeviceId: !!selectedDeviceId,
          tienePeriodoId: !!selectedPeriodoId,
          tieneColaboradorId: !!selectedColaboradorId
        });
      }

      // Limpiar estados DESPUÉS del completado
      setTimeout(() => {
        setSelectedDeviceId(null);
        setSelectedPeriodoId(null);
        setSelectedColaboradorId(null);
        console.log('🧹 Estados de completado limpiados');
      }, 1000); // Esperar 1 segundo para asegurar que el completado termine
      fileRefs.forEach((ref) => {
        if (ref.current) ref.current.value = "";
      });

      toast(selectedDeviceId
        ? "¡Dispositivo actualizado y evidencias subidas exitosamente!"
        : "¡Dispositivo y evidencias subidos exitosamente!"
      );
    } catch (error) {
      console.error("Error en el flujo:", error);
      toast.warning("Error al subir el reporte completo");
    }
  };

  useEffect(() => {
    const fetchEspecialidades = async () => {
      const token = localStorage.getItem("token");

      if (!token) {
        toast.error("Token no encontrado");
        return;
      }

      try {
        const decoded: any = jwtDecode(token);
        const colaboradorId = decoded.userId;

        const res = await fetch(
          `http://localhost:4000/api/especialidades/colaboradores/${colaboradorId}/especialidades`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await res.json();

        if (!res.ok)
          throw new Error(data.message || "Error al cargar especialidades");

        setEspecialidades(data);
      } catch (error) {
        console.error("Error al obtener especialidades:", error);
        toast.error("No se pudieron cargar las especialidades");
      }
    };

    fetchEspecialidades();
  }, []);

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
      const url = `http://localhost:4000/api/devices?${campo}=${encodeURIComponent(value)}`;

      const res = await fetch(url, {
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
        },
      });

      if (!res.ok) {
        return;
      }

      const data = await res.json();
      setSuggestions(data);

      const match = data.find(
        (item: any) =>
          item[campo]?.toLowerCase().trim() === value.toLowerCase().trim()
      );
      if (match) {
        rellenarCampos(match);
      }
    } catch (err) {
      console.error("Error al buscar dispositivo:", err);
    }
  };

  const rellenarCampos = (dispositivo: any) => {
    setDeviceData({
      type: dispositivo.type || "",
      ubication: dispositivo.ubication || "",
      identifier: dispositivo.identifier || "",
      building: dispositivo.building || "",
      level: dispositivo.level || "",
      note: dispositivo.note || "",
    });
    // Guardar el ID del dispositivo seleccionado
    setSelectedDeviceId(dispositivo._id);
    toast.success("Dispositivo existente seleccionado - se actualizará en lugar de crear uno nuevo");
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

  return (
    <div className="report-layout">
      <div className="report-layout__body">
        <div className="report-main-container">
          <main className="report-main">
            <section className="report-content">
              <form
                onSubmit={handleSubmit}
                className="report-form"
                encType="multipart/form-data"
              >
                <h2>Datos del dispositivo</h2>
                {[
                  "identifier",
                  "ubication",
                  "type",
                  "building",
                  "level",
                  "note",
                ].map((field) => (
                  <div
                    className="report-form__group"
                    key={field}
                    style={{ position: "relative" }}
                  >
                    <input
                      type="text"
                      placeholder={field}
                      value={deviceData[field as keyof typeof deviceData]}
                      onChange={(e) =>
                        handleDeviceChange(field, e.target.value)
                      }
                      onFocus={() => setFocusedField(field)}
                      onBlur={() => setTimeout(() => setSuggestions([]), 200)}
                      required={field !== "note"}
                    />
                    {(field === "identifier" || field === "ubication") &&
                      focusedField === field &&
                      suggestions.length > 0 && (
                        <ul className="autocomplete-list">
                          {suggestions.map((s, i) => {
                            return (
                              <li
                                key={i}
                                onMouseDown={() => handleSuggestionClick(s)}
                              >
                                {s[field]}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                  </div>
                ))}

                <h2>Subir evidencias</h2>
                <div className="report-form__group">
                  <label>Especialidad</label>
                  <select
                    value={especialidadSeleccionada}
                    onChange={(e) =>
                      setEspecialidadSeleccionada(e.target.value)
                    }
                    required
                  >
                    <option value="">Seleccione una especialidad</option>
                    {especialidades.map((esp) => (
                      <option key={esp._id} value={esp._id}>
                        {esp.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                {["Base", "Equipo", "Panorámica"].map((label, i) => (
                  <div className="report-form__group" key={i}>
                    <label>
                      Evidencia {i + 1} ({label})
                    </label>
                    {manualUpload ? (
                      <div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) =>
                            handleFileChange(i, e.target.files?.[0] || null)
                          }
                          ref={fileRefs[i]}
                        />
                        {evidencias[i] && (
                          <div style={{ marginTop: 8 }}>
                            <img
                              src={URL.createObjectURL(evidencias[i] as File)}
                              alt={`Evidencia ${i + 1}`}
                              style={{ width: 100 }}
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveFile(i)}
                              className="report-btn"
                              style={{ backgroundColor: "#c00", marginTop: 4 }}
                            >
                              Eliminar
                            </button>
                          </div>
                        )}
                      </div>
                    ) : showCameraIndex === i ? (
                      <div>
                        <video
                          ref={videoRef}
                          style={{ width: "100%", borderRadius: "8px" }}
                        />
                        <button
                          type="button"
                          onClick={capturePhoto}
                          className="report-btn"
                        >
                          Tomar Foto
                        </button>
                        <button
                          type="button"
                          onClick={stopCamera}
                          className="report-btn"
                          style={{ backgroundColor: "#666" }}
                        >
                          Cancelar
                        </button>
                        <canvas ref={canvasRef} style={{ display: "none" }} />
                      </div>
                    ) : (
                      <div>
                        <button
                          type="button"
                          onClick={() => startCamera(i)}
                          className="camera-btn"
                        >
                          Abrir Cámara
                        </button>
                        {evidencias[i] && (
                          <div style={{ marginTop: 8 }}>
                            <img
                              src={URL.createObjectURL(evidencias[i] as File)}
                              alt={`Evidencia ${i + 1}`}
                              style={{ width: 100 }}
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveFile(i)}
                              className="report-btn"
                              style={{ backgroundColor: "#c00", marginTop: 4 }}
                            >
                              Eliminar
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                <div className="report-form__group">
                  <div className="report-form__group manual-checkbox">
                    <label className="manual-checkbox__label">
                      <input
                        type="checkbox"
                        checked={manualUpload}
                        onChange={() => setManualUpload(!manualUpload)}
                      />
                      <span>¿Es carga manual?</span>
                    </label>
                  </div>
                  {manualUpload && (
                    <textarea
                      placeholder="Justificación de carga manual (obligatoria)"
                      value={manualUploadReason}
                      onChange={(e) => setManualUploadReason(e.target.value)}
                      required
                      rows={3}
                      className="manual-reason"
                    />
                  )}
                </div>

                <button type="submit" className="report-btn">
                  Subir Reporte
                </button>
              </form>

              <div className="report-preview">
                <h2>Vista previa</h2>
                <table>
                  <thead>
                    <tr>
                      <th>Datos</th>
                      <th>Foto del área</th>
                      <th>Foto del equipo</th>
                      <th>Foto del trabajo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewList.map((preview, index) => (
                      <tr key={index}>
                        <td>{preview.datos}</td>
                        {preview.evidencias.map((src, i) => (
                          <td key={i}>
                            <img src={src} alt={`Evidencia ${i + 1}`} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
};

export default SubirReporte;
