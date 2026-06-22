const userRepository = require("../../data/repositories/user.repository");
const categoryRepository = require("../../data/repositories/category.repository");
const tokenService = require("./token.service");
const ApiError = require("../../utils/ApiError");
const logger = require("../../config/logger");

class AuthService {
  async register({ name, email, password }) {
    const existing = await userRepository.findByEmail(email);
    if (existing) throw ApiError.conflict("An account with this email already exists");

    const user = await userRepository.create({ name, email, password });

    // Production-quality onboarding: give every new user a starter category
    // set so the app isn't empty on first login.
    await categoryRepository.seedDefaults(user._id);

    return this._issueSession(user);
  }

  async login({ email, password }) {
    const user = await userRepository.findByEmail(email, { withSecrets: true });
    if (!user) throw ApiError.unauthorized("Invalid email or password");

    const isMatch = await user.comparePassword(password);
    if (!isMatch) throw ApiError.unauthorized("Invalid email or password");

    return this._issueSession(user);
  }

  async refresh(refreshToken) {
    if (!refreshToken) throw ApiError.unauthorized("Refresh token missing");

    let decoded;
    try {
      decoded = tokenService.verifyRefreshToken(refreshToken);
    } catch {
      throw ApiError.unauthorized("Invalid or expired refresh token");
    }

    const user = await userRepository.findById(decoded.sub, { withSecrets: true });
    if (!user || !user.refreshTokenHash) throw ApiError.unauthorized("Session expired");

    const presentedHash = tokenService.hashToken(refreshToken);
    if (presentedHash !== user.refreshTokenHash) {
      // Token reuse after rotation indicates possible theft — invalidate
      // the whole session as a precaution.
      await userRepository.updateRefreshTokenHash(user._id, null);
      throw ApiError.unauthorized("Session invalidated, please log in again");
    }

    return this._issueSession(user);
  }

  async logout(userId) {
    await userRepository.updateRefreshTokenHash(userId, null);
  }

  async forgotPassword(email) {
    const user = await userRepository.findByEmail(email);
    if (!user) throw ApiError.notFound("No account associated with this email address");

    const crypto = require("crypto");
    const rawPin = crypto.randomInt(100000, 999999).toString();

    user.passwordResetToken = tokenService.hashToken(rawPin);
    user.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry
    await user.save();

    logger.info(`Password reset PIN for ${email}: ${rawPin}`);
    return rawPin;
  }

  async resetPassword(pin, newPassword) {
    const hashedPin = tokenService.hashToken(pin);
    const user = await userRepository.findByResetToken(hashedPin);
    if (!user) throw ApiError.badRequest("Reset PIN is invalid or has expired");

    user.password = newPassword;
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    await user.save();
  }

  /**
   * Issues a fresh access+refresh token pair and rotates the stored
   * refresh-token hash (refresh token rotation = standard production
   * practice to limit the blast radius of a leaked token).
   */
  async _issueSession(user) {
    const accessToken = tokenService.signAccessToken({ sub: user._id.toString() });
    const refreshToken = tokenService.signRefreshToken({ sub: user._id.toString() });

    await userRepository.updateRefreshTokenHash(user._id, tokenService.hashToken(refreshToken));

    return { user: user.toSafeJSON(), accessToken, refreshToken };
  }
}

module.exports = new AuthService();
