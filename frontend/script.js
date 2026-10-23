// ============================================
// CONFIGURACIÓN
// ============================================
const API_URL = ''; // Vacío porque el frontend se sirve desde el mismo servidor que el backend

// ============================================
// REFERENCIAS A ELEMENTOS DEL DOM
// ============================================
// Pantallas
const pantallaAuth = document.getElementById('pantalla-auth');
const pantallaTareas = document.getElementById('pantalla-tareas');

// Formularios de auth
const formLogin = document.getElementById('form-login');
const formRegistro = document.getElementById('form-registro');
const linkRegistro = document.getElementById('link-registro');
const linkLogin = document.getElementById('link-login');

// Mensajes de error
const loginError = document.getElementById('login-error');
const registroError = document.getElementById('registro-error');

// Pantalla de tareas
const nombreUsuario = document.getElementById('nombre-usuario');
const btnLogout = document.getElementById('btn-logout');
const formTarea = document.getElementById('form-tarea');
const inputTarea = document.getElementById('input-tarea');
const listaTareas = document.getElementById('lista-tareas');

// ============================================
// UTILIDADES
// ============================================
function guardarToken(token) {
    localStorage.setItem('token', token);
}

function obtenerToken() {
    return localStorage.getItem('token');
}

function eliminarToken() {
    localStorage.removeItem('token');
}

function guardarUsuario(usuario) {
    localStorage.setItem('usuario', JSON.stringify(usuario));
}

function obtenerUsuario() {
    const usuario = localStorage.getItem('usuario');
    return usuario ? JSON.parse(usuario) : null;
}

// ============================================
// CAMBIAR ENTRE LOGIN Y REGISTRO
// ============================================
linkRegistro.addEventListener('click', (e) => {
    e.preventDefault();
    formLogin.classList.add('oculto');
    formRegistro.classList.remove('oculto');
    loginError.textContent = '';
    registroError.textContent = '';
});

linkLogin.addEventListener('click', (e) => {
    e.preventDefault();
    formRegistro.classList.add('oculto');
    formLogin.classList.remove('oculto');
    loginError.textContent = '';
    registroError.textContent = '';
});

// ============================================
// REGISTRO DE USUARIO
// ============================================
formRegistro.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nombre = document.getElementById('registro-nombre').value;
    const email = document.getElementById('registro-email').value;
    const password = document.getElementById('registro-password').value;

    try {
        const respuesta = await fetch(`${API_URL}/api/auth/registro`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, email, password })
        });

        const datos = await respuesta.json();

        if (respuesta.ok) {
            // Registro exitoso: mostrar login con mensaje
            registroError.style.color = '#27ae60';
            registroError.textContent = '¡Cuenta creada! Ahora inicia sesión.';
            
            setTimeout(() => {
                formRegistro.classList.add('oculto');
                formLogin.classList.remove('oculto');
                document.getElementById('login-email').value = email;
                registroError.textContent = '';
                registroError.style.color = '#e74c3c';
            }, 1500);
        } else {
            registroError.textContent = datos.error || 'Error al registrar.';
        }
    } catch (error) {
        registroError.textContent = 'Error de conexión con el servidor.';
        console.error(error);
    }
});

// ============================================
// LOGIN DE USUARIO
// ============================================
formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        const respuesta = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const datos = await respuesta.json();

        if (respuesta.ok) {
            // Guardar token y usuario
            guardarToken(datos.token);
            guardarUsuario(datos.usuario);
            
            // Entrar a la pantalla de tareas
            mostrarPantallaTareas();
        } else {
            loginError.textContent = datos.error || 'Credenciales incorrectas.';
        }
    } catch (error) {
        loginError.textContent = 'Error de conexión con el servidor.';
        console.error(error);
    }
});

// ============================================
// MOSTRAR PANTALLA DE TAREAS
// ============================================
function mostrarPantallaTareas() {
    pantallaAuth.classList.add('oculto');
    pantallaTareas.classList.remove('oculto');

    const usuario = obtenerUsuario();
    if (usuario) {
        nombreUsuario.textContent = `Hola, ${usuario.nombre}`;
    }

    cargarTareas();
}

function mostrarPantallaAuth() {
    pantallaTareas.classList.add('oculto');
    pantallaAuth.classList.remove('oculto');
    formLogin.reset();
    formRegistro.reset();
}

// ============================================
// CERRAR SESIÓN
// ============================================
btnLogout.addEventListener('click', () => {
    eliminarToken();
    localStorage.removeItem('usuario');
    mostrarPantallaAuth();
});

// ============================================
// CARGAR TAREAS DEL USUARIO
// ============================================
async function cargarTareas() {
    const token = obtenerToken();
    if (!token) return;

    try {
        const respuesta = await fetch(`${API_URL}/api/tareas`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (respuesta.status === 401) {
            // Token expirado o inválido
            eliminarToken();
            mostrarPantallaAuth();
            return;
        }

        const tareas = await respuesta.json();
        renderizarTareas(tareas);
    } catch (error) {
        console.error('Error al cargar tareas:', error);
    }
}

// ============================================
// RENDERIZAR TAREAS EN EL HTML
// ============================================
function renderizarTareas(tareas) {
    listaTareas.innerHTML = '';

    if (tareas.length === 0) {
        listaTareas.innerHTML = '<p class="mensaje-vacio">No tienes tareas todavía. ¡Agrega una!</p>';
        return;
    }

    tareas.forEach(tarea => {
        const div = document.createElement('div');
        div.className = 'tarea-item' + (tarea.completada ? ' completada' : '');
        
        div.innerHTML = `
            <input type="checkbox" class="tarea-checkbox" ${tarea.completada ? 'checked' : ''} data-id="${tarea.id}">
            <span class="tarea-texto">${tarea.texto}</span>
            <button class="btn-eliminar" data-id="${tarea.id}">🗑️</button>
        `;

        // Evento para marcar como completada
        const checkbox = div.querySelector('.tarea-checkbox');
        checkbox.addEventListener('change', () => toggleTarea(tarea.id));

        // Evento para eliminar
        const btnEliminar = div.querySelector('.btn-eliminar');
        btnEliminar.addEventListener('click', () => eliminarTarea(tarea.id));

        listaTareas.appendChild(div);
    });
}

// ============================================
// CREAR NUEVA TAREA
// ============================================
formTarea.addEventListener('submit', async (e) => {
    e.preventDefault();

    const texto = inputTarea.value.trim();
    if (!texto) return;

    const token = obtenerToken();
    if (!token) return;

    try {
        const respuesta = await fetch(`${API_URL}/api/tareas`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ texto })
        });

        if (respuesta.ok) {
            inputTarea.value = '';
            cargarTareas();
        } else {
            const datos = await respuesta.json();
            alert(datos.error || 'Error al crear tarea.');
        }
    } catch (error) {
        console.error('Error al crear tarea:', error);
    }
});

// ============================================
// MARCAR TAREA COMO COMPLETADA
// ============================================
async function toggleTarea(id) {
    const token = obtenerToken();
    if (!token) return;

    try {
        await fetch(`${API_URL}/api/tareas/${id}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        cargarTareas();
    } catch (error) {
        console.error('Error al actualizar tarea:', error);
    }
}

// ============================================
// ELIMINAR TAREA
// ============================================
async function eliminarTarea(id) {
    const token = obtenerToken();
    if (!token) return;

    if (!confirm('¿Eliminar esta tarea?')) return;

    try {
        await fetch(`${API_URL}/api/tareas/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        cargarTareas();
    } catch (error) {
        console.error('Error al eliminar tarea:', error);
    }
}

// ============================================
// INICIO DE LA APP
// ============================================
// Al cargar la página, verificar si ya hay sesión activa
if (obtenerToken()) {
    mostrarPantallaTareas();
} else {
    mostrarPantallaAuth();
}