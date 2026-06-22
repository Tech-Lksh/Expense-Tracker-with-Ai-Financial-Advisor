const { User } = require("../models");

/**
 * Repository pattern: the business layer never imports Mongoose models
 * directly. This keeps persistence concerns isolated to the data layer —
 * swapping MongoDB for another store later only touches this file.
 */
class UserRepository {
  create(data) {
    return User.create(data);
  }

  findById(id, { withSecrets = false } = {}) {
    const query = User.findById(id);
    if (withSecrets) query.select("+password +refreshTokenHash");
    return query.exec();
  }

  findByEmail(email, { withSecrets = false } = {}) {
    const query = User.findOne({ email: email.toLowerCase() });
    if (withSecrets) query.select("+password +refreshTokenHash");
    return query.exec();
  }

  updateRefreshTokenHash(userId, refreshTokenHash) {
    return User.findByIdAndUpdate(userId, { refreshTokenHash }, { new: true });
  }

  updateHomeLocation(userId, location) {
    return User.findByIdAndUpdate(userId, { homeLocation: location }, { new: true });
  }

  findByResetToken(hashedToken) {
    return User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() },
    }).select("+passwordResetToken +passwordResetExpires");
  }
}

module.exports = new UserRepository();
