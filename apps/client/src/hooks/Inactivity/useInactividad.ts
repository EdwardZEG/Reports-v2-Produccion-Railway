import { useEffect, useRef } from "react";

const useInactividad = (tiempoLimite: number, onInactividad: () => void) => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reiniciarTemporizador = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(onInactividad, tiempoLimite);
  };

  useEffect(() => {
    const eventos = ["mousemove", "keydown", "mousedown", "scroll", "touchstart"];

    eventos.forEach(evento =>
      window.addEventListener(evento, reiniciarTemporizador)
    );

    reiniciarTemporizador();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      eventos.forEach(evento =>
        window.removeEventListener(evento, reiniciarTemporizador)
      );
    };
  }, [tiempoLimite, onInactividad]);
};

export default useInactividad;
