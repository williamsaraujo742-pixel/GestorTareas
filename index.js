require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// --- MIDDLEWARES ---
app.use(cors());
app.use(express.json());
app.use(express.static('../frontend')); // linea nueva

// --- MIDDLEWARE DE AUTENTICACIÓN ---
// Esta función verifica que el usuario tenga un token válido antes de dejarlo pasar
function verificarToken(req, res, next) {
    const token = req.header('Authorization');

    if (!token) {
        return res.status(401).json({ error: 'Acceso denegado. No hay token.' });
    }

    try {
        // El token viene como "Bearer eyJhbG..." - quitamos el "Bearer "
        const tokenLimpio = token.replace('Bearer ', '');
        const verificado = jwt.verify(tokenLimpio, process.env.JWT_SECRET);
        req.usuario = verificado; // Guardamos los datos del usuario en la petición
        next(); // Dejamos pasar a la siguiente función
    } catch (error) {
        res.status(401).json({ error: 'Token inválido o expirado.' });
    }
}

// --- RUTA DE PRUEBA ---
app.get('/', (req, res) => {
    res.json({ mensaje: 'Servidor del Gestor de Tareas funcionando 🚀' });
});

// ============================================================
// RUTAS DE AUTENTICACIÓN
// ============================================================

// 1. REGISTRO - POST /api/auth/registro
app.post('/api/auth/registro', async (req, res) => {
    try {
        const { nombre, email, password } = req.body;

        // Validaciones básicas
        if (!nombre || !email || !password) {
            return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
        }

        // Verificar si el email ya existe
        const usuarioExiste = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
        if (usuarioExiste.rows.length > 0) {
            return res.status(400).json({ error: 'El email ya está registrado.' });
        }

        // Encriptar la contraseña
        const salt = await bcrypt.genSalt(10);
        const passwordEncriptada = await bcrypt.hash(password, salt);

        // Insertar el nuevo usuario
        const nuevoUsuario = await pool.query(
            'INSERT INTO usuarios (nombre, email, password) VALUES ($1, $2, $3) RETURNING id, nombre, email',
            [nombre, email, passwordEncriptada]
        );

        res.status(201).json({ 
            mensaje: 'Usuario registrado exitosamente.', 
            usuario: nuevoUsuario.rows[0] 
        });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ error: 'Error en el servidor.' });
    }
});

// 2. LOGIN - POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
        }

        // Buscar el usuario por email
        const resultado = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
        if (resultado.rows.length === 0) {
            return res.status(400).json({ error: 'Credenciales incorrectas.' });
        }

        const usuario = resultado.rows[0];

        // Comparar la contraseña
        const passwordValida = await bcrypt.compare(password, usuario.password);
        if (!passwordValida) {
            return res.status(400).json({ error: 'Credenciales incorrectas.' });
        }

        // Generar el token JWT
        const token = jwt.sign(
            { id: usuario.id, nombre: usuario.nombre, email: usuario.email },
            process.env.JWT_SECRET,
            { expiresIn: '7d' } // El token dura 7 días
        );

        res.json({ 
            mensaje: 'Login exitoso.', 
            token: token, 
            usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email }
        });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ error: 'Error en el servidor.' });
    }
});

// ============================================================
// RUTAS DE TAREAS (protegidas)
// ============================================================

// 3. OBTENER TAREAS - GET /api/tareas
app.get('/api/tareas', verificarToken, async (req, res) => {
    try {
        const tareas = await pool.query(
            'SELECT * FROM tareas WHERE usuario_id = $1 ORDER BY fecha_creacion DESC',
            [req.usuario.id]
        );
        res.json(tareas.rows);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ error: 'Error en el servidor.' });
    }
});

// 4. CREAR TAREA - POST /api/tareas
app.post('/api/tareas', verificarToken, async (req, res) => {
    try {
        const { texto } = req.body;

        if (!texto) {
            return res.status(400).json({ error: 'El texto de la tarea es obligatorio.' });
        }

        const nuevaTarea = await pool.query(
            'INSERT INTO tareas (usuario_id, texto) VALUES ($1, $2) RETURNING *',
            [req.usuario.id, texto]
        );

        res.status(201).json(nuevaTarea.rows[0]);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ error: 'Error en el servidor.' });
    }
});

// 5. MARCAR COMO COMPLETADA - PUT /api/tareas/:id
app.put('/api/tareas/:id', verificarToken, async (req, res) => {
    try {
        const { id } = req.params;

        // Verificamos que la tarea pertenezca al usuario logueado
        const tarea = await pool.query(
            'SELECT * FROM tareas WHERE id = $1 AND usuario_id = $2',
            [id, req.usuario.id]
        );

        if (tarea.rows.length === 0) {
            return res.status(404).json({ error: 'Tarea no encontrada.' });
        }

        // Invertimos el estado de "completada"
        const nuevaEstado = !tarea.rows[0].completada;

        const tareaActualizada = await pool.query(
            'UPDATE tareas SET completada = $1 WHERE id = $2 RETURNING *',
            [nuevaEstado, id]
        );

        res.json(tareaActualizada.rows[0]);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ error: 'Error en el servidor.' });
    }
});

// 6. ELIMINAR TAREA - DELETE /api/tareas/:id
app.delete('/api/tareas/:id', verificarToken, async (req, res) => {
    try {
        const { id } = req.params;

        const resultado = await pool.query(
            'DELETE FROM tareas WHERE id = $1 AND usuario_id = $2 RETURNING *',
            [id, req.usuario.id]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({ error: 'Tarea no encontrada.' });
        }

        res.json({ mensaje: 'Tarea eliminada correctamente.' });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ error: 'Error en el servidor.' });
    }
});

// --- INICIAR SERVIDOR ---
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});