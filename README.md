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

## Vistas inmersivas

- **Mapa**: la ruta en línea recta con el avión o helicóptero avanzando.
- **Ventanilla**: lo que ves desde tu asiento, con el cielo según la hora y la posición real del sol, nubes, terreno, luces de ciudades de noche, el ala con sus luces (jets) o la sombra de las palas (helicópteros). Cambia según la aeronave: jet privado, avión militar o helicóptero. Delante tienes una **tablet** con el vuelo, el mapa, el destino, la tripulación y un menú de **servicio** para pedir cosas a la azafata.

Atajo: `Espacio` pausa o reanuda el vuelo.

## Publicación

Es un sitio estático (`index.html`, `app.js`, `data.js`, `sw.js`). Se publica con GitHub Pages desde la rama `main`, carpeta raíz.
