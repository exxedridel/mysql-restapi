export class HttpError extends Error {
  constructor(status, message, code = "REQUEST_FAILED") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const asyncRoute = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

export function handleErrors(error, _req, res, _next) {
  if (error instanceof HttpError) {
    return res.status(error.status).json({ message: error.message, code: error.code });
  }
  if (error?.code === "ER_DUP_ENTRY") {
    return res.status(409).json({ message: "El correo ya está registrado.", code: "EMAIL_ALREADY_EXISTS" });
  }
  if (error?.type === "entity.parse.failed") {
    return res.status(400).json({ message: "El cuerpo JSON no es válido.", code: "INVALID_INPUT" });
  }
  if (error?.type === "entity.too.large") {
    return res.status(413).json({ message: "La solicitud es demasiado grande.", code: "INVALID_INPUT" });
  }
  return res.status(500).json({ message: "No se pudo completar la solicitud.", code: "INTERNAL_ERROR" });
}
