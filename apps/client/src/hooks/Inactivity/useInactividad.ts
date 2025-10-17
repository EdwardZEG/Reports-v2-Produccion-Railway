import { useEffect, useRef } from "react";

const useInactividad = (tiempoLimite: number, onInactividad: () => void) => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ultimaActividad = useRef<number>(Date.now());
  const STORAGE_KEY = 'lastActivity';

  // Función para guardar última actividad en localStorage
  const guardarUltimaActividad = (tiempo: number) => {
    localStorage.setItem(STORAGE_KEY, tiempo.toString());
  };

  // Función para obtener última actividad desde localStorage
  const obtenerUltimaActividad = (): number => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? parseInt(stored, 10) : Date.now();
  };

  const verificarTiempoTranscurrido = () => {
    const ahora = Date.now();
    const ultimaActividadStorage = obtenerUltimaActividad();
    const tiempoTranscurrido = ahora - ultimaActividadStorage;

    // Si ha pasado más tiempo del límite (ej: computadora apagada/suspendida)
    if (tiempoTranscurrido >= tiempoLimite) {
      console.log(`Tiempo transcurrido detectado: ${tiempoTranscurrido}ms (límite: ${tiempoLimite}ms)`);
      onInactividad();
      return true;
    }
    return false;
  };

  const reiniciarTemporizador = () => {
    const ahora = Date.now();
    ultimaActividad.current = ahora;
    guardarUltimaActividad(ahora);

    // Verificar si ya se pasó el tiempo límite
    if (verificarTiempoTranscurrido()) {
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      console.log("Timer expirado - ejecutando callback de inactividad");
      onInactividad();
    }, tiempoLimite);
  };

  useEffect(() => {
    // Eventos que detectan actividad del usuario
    const eventos = [
      "mousemove",
      "keydown",
      "keypress",
      "mousedown",
      "click",
      "scroll",
      "touchstart",
      "touchmove",
      "focus",
      "resize"
    ];

    // Eventos especiales para detectar regreso de suspensión/apagado
    const eventosEspeciales = [
      "visibilitychange", // Cuando cambia de pestaña o regresa
      "focus",            // Cuando la ventana regresa al foco
      "pageshow"          // Cuando la página se muestra (incluso desde cache)
    ];

    // Función especial para manejar el regreso de suspensión
    const manejarRegreso = () => {
      console.log("Detectado regreso de suspensión/cambio pestaña");
      const ahora = Date.now();
      const ultimaActividadStorage = obtenerUltimaActividad();
      const tiempoTranscurrido = ahora - ultimaActividadStorage;

      console.log(`Tiempo transcurrido durante ausencia: ${tiempoTranscurrido}ms`);

      // Si estuvo ausente más del tiempo límite, cerrar sesión inmediatamente
      if (tiempoTranscurrido >= tiempoLimite) {
        console.log("Tiempo límite excedido durante ausencia - cerrando sesión");
        onInactividad();
      } else {
        // Si no, reiniciar normalmente
        console.log("Tiempo dentro del límite - reiniciando temporizador");
        reiniciarTemporizador();
      }
    };

    // Agregar listeners de actividad normal
    eventos.forEach(evento =>
      window.addEventListener(evento, reiniciarTemporizador)
    );

    // Agregar listeners especiales
    eventosEspeciales.forEach(evento =>
      document.addEventListener(evento, manejarRegreso)
    );

    // Verificación inicial al cargar la página
    const verificacionInicial = () => {
      const ahora = Date.now();
      const ultimaActividadStorage = obtenerUltimaActividad();
      const tiempoTranscurrido = ahora - ultimaActividadStorage;

      console.log(`Verificación inicial: tiempo transcurrido ${tiempoTranscurrido}ms`);

      if (tiempoTranscurrido >= tiempoLimite) {
        console.log("Sesión expirada detectada al cargar - cerrando sesión inmediatamente");
        onInactividad();
      } else {
        console.log("Sesión válida - iniciando temporizador");
        reiniciarTemporizador();
      }
    };

    // Inicializar con verificación
    verificacionInicial();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      eventos.forEach(evento =>
        window.removeEventListener(evento, reiniciarTemporizador)
      );
      eventosEspeciales.forEach(evento =>
        document.removeEventListener(evento, manejarRegreso)
      );
    };
  }, [tiempoLimite, onInactividad]);
};

export default useInactividad;
