import { HttpError } from "./http-error.js";

const editableFields = ["email", "first_name", "last_name", "password", "role"];

function invalid(message) {
  throw new HttpError(400, message, "INVALID_INPUT");
}

export function validateObject(value, allowedFields) {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid("Envía un objeto JSON válido.");
  if (Object.keys(value).some((key) => !allowedFields.includes(key))) invalid("La solicitud contiene campos no permitidos.");
}

export function normalizeEmail(value) {
  if (typeof value !== "string") invalid("El correo no es válido.");
  const email = value.trim().toLowerCase();
  if (email.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) invalid("El correo no es válido o supera 100 caracteres.");
  return email;
}

function validateName(value, label) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 100) invalid(`${label} debe tener entre 1 y 100 caracteres.`);
  return value.trim();
}

function validatePassword(value, isLogin = false) {
  if (typeof value !== "string" || value.length < (isLogin ? 1 : 8) || Buffer.byteLength(value, "utf8") > 72) {
    invalid(isLogin ? "La contraseña no es válida." : "La contraseña debe tener al menos 8 caracteres y como máximo 72 bytes UTF-8.");
  }
  return value;
}

export function validateLogin(body) {
  validateObject(body, ["email", "password"]);
  return { email: normalizeEmail(body.email), password: validatePassword(body.password, true) };
}

export function validateUserInput(body, { create = false } = {}) {
  validateObject(body, editableFields);
  if (!create && Object.keys(body).length === 0) invalid("Envía al menos un campo para actualizar.");
  const input = {};
  if (create || Object.hasOwn(body, "email")) input.email = normalizeEmail(body.email);
  if (create || Object.hasOwn(body, "first_name")) input.first_name = validateName(body.first_name, "El nombre");
  if (create || Object.hasOwn(body, "last_name")) input.last_name = validateName(body.last_name, "El apellido");
  if (create || Object.hasOwn(body, "password")) input.password = validatePassword(body.password);
  if (create || Object.hasOwn(body, "role")) {
    const role = create && !Object.hasOwn(body, "role") ? "player" : body.role;
    if (role !== "player" && role !== "admin") invalid("El rol debe ser player o admin.");
    input.role = role;
  }
  return input;
}

export function parseUserId(value) {
  if (!/^\d+$/.test(String(value))) invalid("El identificador de usuario no es válido.");
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) invalid("El identificador de usuario no es válido.");
  return id;
}
