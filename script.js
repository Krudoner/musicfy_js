// VARIABLES GLOBALES DEL REPRODUCTOR
let datosMusica = null;      
let sound = null;            
let indiceActual = 0;        
let listaActual = [];        
let isPlaying = false;      


// VARIABLES DE AUDIO Y ECUALIZADOR (WEB AUDIO API)
let contextoAudio = null;         
let analizadorFrecuencias = null; 
let filtroGraves = null;          
let filtroMedios = null;          
let filtroAgudos = null;          
let arrayDatosFrecuencia = null;  
let filtrosConfigurados = false;  



// INICIALIZACIÓN AL CARGAR LA PÁGINA
document.addEventListener("DOMContentLoaded", () => {
    inicializarVisualizadorBarras();

    // Cargamos el archivo JSON con las canciones
    fetch('canciones.json')
        .then(response => {
            if (!response.ok) throw new Error("No se pudo cargar el archivo canciones.json");
            return response.json();
        })
        .then(data => {
            datosMusica = data;
            listaActual = datosMusica.canciones;
            renderizarPlaylist(listaActual);
            if (listaActual.length > 0) {
                cargarCancion(0, false); 
            }
        })
        .catch(error => console.error("Error al cargar el JSON:", error));
});



// CONFIGURACIÓN DEL ECUALIZADOR VISUAL
function inicializarVisualizadorBarras() {
    const contenedorVisual = document.getElementById("visualizer");
    contenedorVisual.innerHTML = "";
    // Creamos barra Sonido
    for (let i = 0; i < 32; i++) {
        const barra = document.createElement("div");
        barra.className = "flex-1 bg-gradient-to-t from-red-950 via-red-600 to-red-400 rounded h-[10%] transition-all duration-75";
        contenedorVisual.appendChild(barra);
    }
}



// CONEXIÓN DE FILTROS REALES (GRAVES, MEDIOS, AGUDOS)
function configurarFiltrosYAnalizador() {
    if (filtrosConfigurados) return;

    try {
        // Obtenemos el elemento de audio HTML5 interno de Howler para que funcione con html5: true
        if (sound && sound._sounds && sound._sounds[0] && sound._sounds[0]._node) {
            const audioElement = sound._sounds[0]._node;

            if (!contextoAudio) {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                contextoAudio = new AudioContext();
            }

            if (contextoAudio.state === 'suspended') {
                contextoAudio.resume();
            }

            // Creamos el nodo fuente a partir del elemento HTML5
            const sourceNode = contextoAudio.createMediaElementSource(audioElement);

            // Configurar filtro de Graves
            filtroGraves = contextoAudio.createBiquadFilter();
            filtroGraves.type = "lowshelf";
            filtroGraves.frequency.value = 250;
            filtroGraves.gain.value = parseFloat(document.getElementById("val-graves-input")?.value || 0);

            // Configurar filtro de Medios
            filtroMedios = contextoAudio.createBiquadFilter();
            filtroMedios.type = "peaking";
            filtroMedios.frequency.value = 1500;
            filtroMedios.Q.value = 1;
            filtroMedios.gain.value = parseFloat(document.getElementById("val-medios-input")?.value || 0);

            // Configurar filtro de Agudos
            filtroAgudos = contextoAudio.createBiquadFilter();
            filtroAgudos.type = "highshelf";
            filtroAgudos.frequency.value = 4000;
            filtroAgudos.gain.value = parseFloat(document.getElementById("val-agudos-input")?.value || 0);

            // Configurar Analizador para el movimiento de las barras
            analizadorFrecuencias = contextoAudio.createAnalyser();
            analizadorFrecuencias.fftSize = 128;
            arrayDatosFrecuencia = new Uint8Array(analizadorFrecuencias.frequencyBinCount);

            // Conectar la cadena de audio desde el elemento HTML5 hasta los altavoces
            sourceNode.connect(filtroGraves);
            filtroGraves.connect(filtroMedios);
            filtroMedios.connect(filtroAgudos);
            filtroAgudos.connect(analizadorFrecuencias);
            analizadorFrecuencias.connect(contextoAudio.destination);

            filtrosConfigurados = true;
            console.log("Filtros y Analizador conectados correctamente.");
        }
    } catch (e) {
        console.error("Error al configurar Web Audio API:", e);
    }
}



// CONTROLES DE REPRODUCCIÓN (CARGAR, PLAY, PAUSE)

function cargarCancion(index, reproducirInmediato = true) {
    if (sound) {
        sound.unload(); // <-- Limpa la canción anterior
    }
    indiceActual = index;
    const cancion = listaActual[index];

    // Actualizamos los textos e imágenes en la interfaz
    document.getElementById("side-titulo").innerText = cancion.titulo;
    document.getElementById("side-artista").innerText = cancion.artista;
    document.getElementById("side-genero").innerText = cancion.genero;
    document.getElementById("side-img").src = cancion.imagen;

    document.getElementById("footer-titulo").innerText = cancion.titulo;
    document.getElementById("footer-artista").innerText = cancion.artista;
    document.getElementById("footer-img").src = cancion.imagen;

    // Creamos la instancia con Howler.js
    sound = new Howl({
        src: [cancion.archivo],
        html5: true, 
        volume: parseFloat(document.getElementById("volumen-bar").value),
        onplay: () => {
            isPlaying = true;
            document.getElementById("btn-play-pause").innerText = "⏸";

            if (contextoAudio && contextoAudio.state === 'suspended') {
                contextoAudio.resume();
            }
            configurarFiltrosYAnalizador();

            requestAnimationFrame(actualizarReproductorYVisualizador);
        },
        onpause: () => {
            isPlaying = false;
            document.getElementById("btn-play-pause").innerText = "▶";
            resetearVisualizador();
        },
        onend: () => {
            cancionSiguiente(); 
        },
        onload: () => {
            const duracion = sound.duration();
            document.getElementById("total-time").innerText = formatearTiempo(duracion);
        }
    });

    if (reproducirInmediato) {
        sound.play();
    }
    
    marcarCancionActiva(cancion.id);
}

function reproducirCancionIndex(index) {
    cargarCancion(index, true);
}

function alternarPlayPause() {
    if (!sound) return;
    if (isPlaying) {
        sound.pause();
    } else {
        if (contextoAudio && contextoAudio.state === 'suspended') {
            contextoAudio.resume();
        }
        sound.play();
    }
}

function cancionSiguiente() {
    let nuevoIndice = (indiceActual + 1) % listaActual.length;
    reproducirCancionIndex(nuevoIndice);
}

function cancionAnterior() {
    let nuevoIndice = (indiceActual - 1 + listaActual.length) % listaActual.length;
    reproducirCancionIndex(nuevoIndice);
}

function cambiarVolumen(valor) {
    if (sound) {
        sound.volume(parseFloat(valor));
    }
}

function cambiarPosicion(valor) {
    if (sound && sound.duration()) {
        let duracion = sound.duration();
        let nuevaPosicion = (valor / 100) * duracion;
        sound.seek(nuevaPosicion);
    }
}



// ANIMACIÓN DEL ESPECTRO Y BARRA DE TIEMPO
function actualizarReproductorYVisualizador() {
    if (isPlaying && sound) {
        // Actualizar barra de progreso general con validación de duración
        let seek = sound.seek();
        let duration = sound.duration();
        if (duration && !isNaN(duration) && duration > 0) {
            let porcentaje = (seek / duration) * 100;
            document.getElementById("seek-bar").value = porcentaje;
            document.getElementById("current-time").innerText = formatearTiempo(seek);
        }

        // Mover las barras del ecualizador al ritmo real de la música
        if (analizadorFrecuencias && arrayDatosFrecuencia) {
            analizadorFrecuencias.getByteFrequencyData(arrayDatosFrecuencia);
            const barrasVisualizador = document.querySelectorAll("#visualizer > div");
            barrasVisualizador.forEach((barra, idx) => {
                let valorFrecuencia = arrayDatosFrecuencia[idx] || 0;
                let alturaPorcentaje = Math.max(8, (valorFrecuencia / 255) * 100);
                barra.style.height = `${alturaPorcentaje}%`;
            });
        }

        requestAnimationFrame(actualizarReproductorYVisualizador);
    }
}

function resetearVisualizador() {
    const barrasVisualizador = document.querySelectorAll("#visualizer > div");
    barrasVisualizador.forEach(barra => {
        barra.style.height = "10%";
    });
}

function formatearTiempo(segundos) {
    let mins = Math.floor(segundos / 60);
    let secs = Math.floor(segundos % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}


// LISTA DE REPRODUCCIÓN Y FILTROS

function renderizarPlaylist(canciones) {
    const contenedor = document.getElementById("contenedor-canciones");
    contenedor.innerHTML = "";
    document.getElementById("total-canciones").innerText = `${canciones.length} canciones`;

    if (canciones.length === 0) {
        contenedor.innerHTML = "<p class='text-gray-500 text-center py-4'>No hay canciones para este género.</p>";
        return;
    }

    canciones.forEach((cancion) => {
        const tarjeta = document.createElement("div");
        tarjeta.id = `track-${cancion.id}`;
        tarjeta.className = "flex items-center justify-between p-2.5 rounded-xl hover:bg-zinc-800/50 transition cursor-pointer group border border-transparent";
        
        tarjeta.onclick = () => {
            let realIndex = listaActual.findIndex(c => c.id === cancion.id);
            reproducirCancionIndex(realIndex);
        };

        tarjeta.innerHTML = `
            <div class="flex items-center gap-3 truncate">
                <img src="${cancion.imagen}" alt="${cancion.artista}" class="w-11 h-11 rounded-lg object-cover">
                <div class="truncate">
                    <h4 class="text-sm font-medium group-hover:text-red-400 transition truncate">${cancion.titulo}</h4>
                    <p class="text-xs text-gray-400 truncate">${cancion.artista} - <span class="text-gray-500">${cancion.genero}</span></p>
                </div>
            </div>
            <span class="status-indicator text-xs text-red-400 font-medium px-2"></span>
        `;

        contenedor.appendChild(tarjeta);
    });
}

function marcarCancionActiva(id) {
    document.querySelectorAll("#contenedor-canciones > div").forEach(el => {
        el.classList.remove("bg-zinc-800/80", "border-red-600/30");
        const span = el.querySelector(".status-indicator");
        if (span) span.innerText = "";
    });
    const actual = document.getElementById(`track-${id}`);
    if (actual) {
        actual.classList.add("bg-zinc-800/80", "border-red-600/30");
        const span = actual.querySelector(".status-indicator");
        if (span) span.innerText = "▶ sonando";
    }
}

function filtrarPorGenero(genero) {
    if (!datosMusica) return;
    if (genero === "Todos") {
        listaActual = datosMusica.canciones;
    } else {
        listaActual = datosMusica.canciones.filter(c => c.genero === genero);
    }
    renderizarPlaylist(listaActual);
}

// CONTROLES DEL ECUALIZADOR (GRAVES, MEDIOS, AGUDOS)
function ajustarGraves(valor) {
    document.getElementById("val-graves").innerText = `${valor} dB`;
    if (filtroGraves) {
        filtroGraves.gain.value = parseFloat(valor);
    }
}

function ajustarMedios(valor) {
    document.getElementById("val-medios").innerText = `${valor} dB`;
    if (filtroMedios) {
        filtroMedios.gain.value = parseFloat(valor);
    }
}

function ajustarAgudos(valor) {
    document.getElementById("val-agudos").innerText = `${valor} dB`;
    if (filtroAgudos) {
        filtroAgudos.gain.value = parseFloat(valor);
    }
}