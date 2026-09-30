export class AppError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }

  static badRequest(message: string) {
    return new AppError(400, message);
  }
  static unauthorized(message = 'Avtorizatsiyadan o\'tilmagan') {
    return new AppError(401, message);
  }
  static forbidden(message = 'Ruxsat yo\'q') {
    return new AppError(403, message);
  }
  static notFound(message = 'Topilmadi') {
    return new AppError(404, message);
  }
  static conflict(message: string) {
    return new AppError(409, message);
  }
}
