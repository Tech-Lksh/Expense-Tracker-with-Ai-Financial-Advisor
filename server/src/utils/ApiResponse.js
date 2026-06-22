/**
 * Every successful API response follows the same envelope so frontend
 * clients can rely on a single response shape:
 * { success, message, data, meta }
 */
class ApiResponse {
  constructor(statusCode, data = null, message = "Success", meta = null) {
    this.success = statusCode < 400;
    this.statusCode = statusCode;
    this.message = message;
    this.data = data;
    if (meta) this.meta = meta;
  }

  send(res) {
    const { statusCode, ...body } = this;
    return res.status(statusCode).json(body);
  }
}

module.exports = ApiResponse;
