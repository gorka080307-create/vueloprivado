# ✈️ Vuelo Privado

Temporizador de estudio con simulador de vuelo en jet privado. Sin registros, sin cuentas: todo se guarda en tu navegador.

**Pasajero:** Gorka Corbacho Martínez · *«Comandante Supremo»*

## Qué hace

- **Plan de vuelo**: eliges salida y destino (más de 110 aeropuertos, incluidos destinos de aviación privada como Teterboro, Le Bourget, Courchevel, St. Moritz, Saint-Tropez o San Bartolomé) y te calcula la distancia, el tiempo de vuelo aproximado y el nivel de crucero.
- **Flota privada**: Phenom 300E, Citation Latitude, Challenger 350, Falcon 8X, Gulfstream G700 y Global 7500, cada uno con su velocidad y autonomía.
- **Tarjeta de embarque privada**: número de vuelo, indicativo, matrícula, puerta FBO y tripulación inventada en cada vuelo (comandante, primer oficial y azafata). Se puede descargar como PNG.
- **Mapa en tiempo real**: línea recta de origen a destino con un ✈️ que avanza según el tiempo de estudio.
- **Temporizador de estudio**: fases de vuelo (rodaje, despegue, ascenso, crucero, descenso, aproximación), altitud, velocidad, distancia restante y hora de llegada.
- **Megafonía de cabina**: avisos de la tripulación durante el vuelo, con el sonido de aviso de cabina.
- **Ruido de cabina** opcional para concentrarse.
- **Modo estudio**: dices cuánto quieres estudiar (25 min, 1 h, 3 h…) y te propone destinos que duran eso.
- **Pausa (circuito de espera)**, **desvío** del vuelo y recuperación automática del vuelo si recargas la página.
- **Bitácora y Club Vuelo Privado**: horas, km y destinos acumulados, con niveles Silver → Gold → Platinum → Black → Infinite.

## Rutas aéreas reales

- **Pistas reales** de cada aeropuerto (orientación, longitud y extremos) y **radioayudas VOR reales** de todo el mundo, de [OurAirports](https://ourairports.com/data/) (dominio público).
- La **pista en uso** se elige según el **viento real** en ese momento (Open-Meteo), como en un aeropuerto de verdad.
- El avión despega por el rumbo de pista, sigue una ruta por VOR sobre tierra y por puntos oceánicos (tipo `45N030W`) sobre el mar, y llega pasando por IAF y FAF alineado con la pista de destino.
- El plan de vuelo aparece en el planificador y en la tarjeta de embarque. En el HUD se ve el próximo punto de la ruta.
- Los helicópteros vuelan en VFR directo. Hay una opción para volver a la línea recta.

Atajo: `Espacio` pausa o reanuda el vuelo.

## Publicación

Es un sitio estático (`index.html`, `app.js`, `data.js`, `sw.js`). Se publica con GitHub Pages desde la rama `main`, carpeta raíz.
