const { Conversation } = require("../models");

class ConversationRepository {
  async findByUserId(userId) {
    return Conversation.findOne({ user: userId }).exec();
  }

  async createForUser(userId) {
    return Conversation.create({ user: userId, messages: [] });
  }

  async findOrCreateForUser(userId) {
    let convo = await this.findByUserId(userId);
    if (!convo) {
      convo = await this.createForUser(userId);
    }
    return convo;
  }

  async updateMessages(userId, messages) {
    return Conversation.findOneAndUpdate(
      { user: userId },
      { messages },
      { new: true, upsert: true }
    ).exec();
  }

  async clearMessages(userId) {
    return Conversation.findOneAndUpdate(
      { user: userId },
      { messages: [] },
      { new: true }
    ).exec();
  }
}

module.exports = new ConversationRepository();
