# Hestia

Asistente familiar para Juan, Marina y Judith. Combina una app web Next.js, una API NestJS y un bot de Telegram con un LLM local (Ollama).

## Stack

| Capa | Tecnología |
|---|---|
| Web | Next.js 15 (App Router), Tailwind CSS, Zustand, PWA |
| API | NestJS, TypeORM, SQLite (`better-sqlite3`) |
| Bot | grammY (Telegram) |
| LLM | Ollama / cualquier endpoint compatible con OpenAI |
| Monorepo | Yarn workspaces + Turborepo |

## Requisitos previos

- Node.js ≥ 20
- Yarn
- [Ollama](https://ollama.ai) corriendo en local (`ollama run llama3.2`)

## Puesta en marcha

```bash
# 1. Instalar dependencias
yarn

# 2. Configurar entorno de la API
cp apps/api/.env.example apps/api/.env
# Edita apps/api/.env si necesitas cambiar rutas o tokens

# 3. Arrancar todo
yarn dev
```

- Web → http://localhost:3000
- API → http://localhost:3001/api/v1
- Swagger → http://localhost:3001/api/docs

## Variables de entorno (`apps/api/.env`)

| Variable | Por defecto | Descripción |
|---|---|---|
| `LLM_API_URL` | `http://localhost:11434/v1` | Endpoint Ollama/LM Studio/Jan |
| `LLM_MODEL` | `llama3.2` | Nombre del modelo |
| `TELEGRAM_BOT_TOKEN` | _(vacío)_ | Token del bot (configurable también desde el admin) |
| `DATABASE_PATH` | `./data/hestia.db` | Ruta del fichero SQLite |
| `JWT_SECRET` | _(requerido)_ | Secreto para firmar tokens JWT |

La web no tiene `.env`; usa `NEXT_PUBLIC_API_URL` (por defecto `http://localhost:3001/api/v1`).

## Usuarios

Tres miembros fijos sembrados en el primer arranque con PIN `0000`:

- **Juan** — administrador (acceso al panel de admin)
- **Marina**
- **Judith**

Cada usuario puede cambiar su PIN desde Ajustes. Límite: 3 intentos por hora.

## Funcionalidades

### Tareas
- CRUD con prioridad (alta/media/baja), asignado, fecha límite y descripción (Markdown)
- Recurrencia: diaria, semanal-ventana (cualquier día de la semana), cada N días, día concreto de semana/mes/año

### Lista de la compra
- Múltiples listas por categoría: `hogar`, `decoración`, `ocio`, `otros`
- Archivar / desarchivar listas con fecha de archivo

### Recetas y menú semanal
- Recetas con ingredientes y pasos
- Planificador semanal por desayuno / comida / cena

### Calendario
- Eventos con tipo, color y asignados
- El chat de IA puede crear eventos directamente desde el lenguaje natural

### Chat con IA (Hestia)
- Contexto completo inyectado: tareas, compra, recetas, menú, calendario
- Detección de eventos en el mensaje → creación automática en el calendario
- Historial de conversaciones (web y Telegram) consultable desde la propia pantalla
- Vista de admin con todas las conversaciones de la familia
- Memoria a largo plazo: las conversaciones inactivas >1h se compactan en un resumen

### Estadísticas
- Tareas completadas esta semana vs. la anterior
- Recetas más cocinadas
- Artículos más comprados
- Eventos por tipo

### Notificaciones
- **Telegram**: recordatorios automáticos
  - Resumen diario a las 8:00 (zona horaria configurable)
  - Aviso 30 min antes de cada evento
  - Alerta de tareas vencidas a las 9:00
- **Push PWA**: mismos avisos en el navegador/dispositivo tras activar en Ajustes

### Panel de administración (solo Juan)
- Configurar LLM (URL, modelo, temperatura, tokens)
- Configurar bot de Telegram y gestionar contactos
- Zona horaria del sistema (usada para cron jobs de recordatorios)
- Cron jobs personalizados de Telegram
- Historial de conversaciones de toda la familia

## Comandos

```bash
# Desde la raíz
yarn dev          # Arranca API + web en paralelo
yarn build        # Compila ambas apps
yarn lint         # Lint
yarn type-check   # TypeScript sin emitir

# Por app (desde apps/api o apps/web)
yarn dev
yarn build
yarn type-check
```
